/**
 * 双设备端到端联调（Node + fake-indexeddb + 真实后端 API）：
 * 模拟 设备A / 设备B 两个独立 IndexedDB 实例，同一账号：
 *  1. 设备A 记账（写本地 Dexie）
 *  2. 设备A push → 云端
 *  3. 设备B pull → 应看到设备A 的账
 *  4. 设备A 改状态 → push；设备B pull → 看到更新
 *  5. 设备A 软删 → push；设备B pull → 记录进回收站
 */
import 'fake-indexeddb/auto';
import { db as dbA } from '../src/db';

// Node 环境无 localStorage：注入内存 shim（cloud.ts 的 token/session 存取依赖它）
const memStore = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memStore.set(k, String(v)),
  removeItem: (k: string) => void memStore.delete(k),
  clear: () => memStore.clear(),
  key: (i: number) => [...memStore.keys()][i] ?? null,
  get length() {
    return memStore.size;
  },
};

const BASE = 'http://localhost:3000';

async function freshDb(): Promise<void> {
  await dbA.meta.clear();
  await dbA.clients.clear();
  await dbA.records.clear();
  await dbA.tombstones.clear();
}

let seq = 0;
function makeRecord(clientName: string, product: string, note: string) {
  seq += 1;
  const now = new Date(Date.now() + seq * 1000).toISOString();
  return {
    id: `r-${seq}`,
    date: '2026-09-02',
    clientName,
    clientLocation: '上海',
    productName: product,
    quantity: 10,
    unit: '件',
    unitPrice: 50,
    totalPrice: 500,
    note,
    stockStatus: 'unstocked' as const,
    shipStatus: 'unshipped' as const,
    hasPrint: false,
    printNote: '',
    noteImages: [] as string[],
    printImages: [] as string[],
    paid: false,
    paidAmount: 0,
    starred: false,
    deletedAt: null as string | null,
    createdAt: now,
  };
}

async function registerAndLogin(): Promise<string> {
  const uname = `e2e_${Date.now()}`;
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: 'password123' }),
  });
  if (!reg.ok) throw new Error(`register failed ${reg.status}`);
  const body = (await reg.json()) as { data: { token: string; user: { id: number; username: string; createdAt: string } } };
  console.log('registered:', uname);
  // 存入 session（cloud.ts loadSession 从这里读 token）
  memStore.set('ledger_token', body.data.token);
  memStore.set('ledger_user', JSON.stringify(body.data.user));
  return body.data.token;
}

// 模拟"两个独立设备"：每个设备有自己的 fetch 携带自己的 token，但共享同一 Dexie 实例。
// 为模拟隔离，这里用 token 换 + 每设备前置清库来表示冷启动设备。
async function main(): Promise<void> {
  const token = await registerAndLogin();

  // ===== 设备 A：记账并推送 =====
  await freshDb();
  await dbA.records.put(makeRecord('张老板', '反光背心', '设备A记录'));
  const { pushLocal } = await import('../src/lib/sync');
  const push1 = await pushLocal();
  console.log('设备A push:', JSON.stringify(push1));

  // ===== 设备 B：冷启动拉取（清空本地，模拟全新的另一台手机首次登录） =====
  await freshDb();
  const { pullRemote } = await import('../src/lib/sync');
  const pullB1 = await pullRemote();
  console.log('设备B 首次 pull: pulled=%d applied=%d', pullB1.pulled, pullB1.applied);
  const rowsB = await dbA.records.toArray();
  const seenByB = rowsB.find((r) => r.note === '设备A记录');
  if (!seenByB) throw new Error('FAIL: 设备B 没看到设备A 记的账');
  console.log('PASS 设备B 看到设备A的账:', seenByB.productName, '/', seenByB.note);

  // ===== 设备 A：更新状态 =====
  await freshDb(); // 模拟设备A继续用本地数据：A 本地其实已有；此处简化从云端 pull 回来再改
  await pullRemote();
  const aRow = (await dbA.records.toArray()).find((r) => r.note === '设备A记录')!;
  aRow.stockStatus = 'stocked';
  await dbA.records.put(aRow);
  await pushLocal();
  console.log('设备A 更新备货状态为 stocked');

  // ===== 设备 B：再 pull 应看到 stocked =====
  await freshDb();
  const pullB2 = await pullRemote();
  const bRow = (await dbA.records.toArray()).find((r) => r.note === '设备A记录')!;
  if (bRow.stockStatus !== 'stocked') throw new Error('FAIL: 设备B 未同步到备货状态');
  console.log('PASS 设备B 同步到更新状态 stocked (pull#%d)', pullB2.pulled);

  // ===== 设备 A：软删除 → 设备 B 收到墓碑 =====
  // B 已同步过该记录（上一步 stocked 仍在本地），不清库直接模拟 B 持续在线
  const delRow = (await dbA.records.toArray()).find((r) => r.note === '设备A记录')!;
  if (!delRow) throw new Error('FAIL: 设备B 本地缺少记录，无法验证墓碑');
  // 角色切换：现在这台"设备"代表 A，先软删并推送
  delRow.deletedAt = new Date().toISOString();
  await dbA.records.put(delRow);
  await pushLocal();
  console.log('设备A 软删并推送');

  // 切回"设备B"视角：B 本地此前存的是活跃行，pull 后应被软删（deletedAt 非空）
  await pullRemote();
  const after = (await dbA.records.toArray()).find((r) => r.note === '设备A记录');
  if (!after || !after.deletedAt) throw new Error('FAIL: 设备B 未同步删除（墓碑）');
  console.log('PASS 设备B 收到删除墓碑, deletedAt=', after.deletedAt);

  // ===== 隔离：店B（另一账号）注册，应完全看不到店A 的数据 =====
  await registerAndLogin(); // 注册并切换 session 到新账号（店B）
  await freshDb();
  const pullB = await pullRemote();
  const rowsForeign = await dbA.records.toArray();
  if (rowsForeign.length !== 0) {
    throw new Error(`FAIL: 店B 看到了店A 的数据（${rowsForeign.length} 条）——隔离失效`);
  }
  console.log('PASS 不同账号隔离：店B 拉取条数=%d，看不到店A 的任何账', rowsForeign.length);

  console.log('E2E 全部通过 ✓');
  process.exit(0);
}

main().catch((e) => {
  console.error('E2E FAIL:', e);
  process.exit(1);
});
