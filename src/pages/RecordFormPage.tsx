import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { activeRecordsQuery, db, uid } from '../db';
import { computeTotal, today, uniqueStrings } from '../lib/analysis';
import { formatMoney, parseNum } from '../lib/money';
import { UNITS, type Client, type Record, type ShipStatus, type StockStatus } from '../types';
import Autocomplete from '../components/Autocomplete';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import ImageField from '../components/ImageField';

export default function RecordFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const record = useLiveQuery(() => (id ? db.records.get(id) : undefined), [id]);
  const clients = useLiveQuery(() => db.clients.toArray(), []) ?? [];
  const allRecords = useLiveQuery(() => activeRecordsQuery(), []) ?? [];

  const [date, setDate] = useState(today());
  const [clientName, setClientName] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('件');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [totalAuto, setTotalAuto] = useState(true);
  const [note, setNote] = useState('');
  const [hasPrint, setHasPrint] = useState(false);
  const [printNote, setPrintNote] = useState('');
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [printImages, setPrintImages] = useState<string[]>([]);
  const [stockStatus, setStockStatus] = useState<StockStatus>('unstocked');
  const [shipStatus, setShipStatus] = useState<ShipStatus>('unshipped');
  const [paidAmount, setPaidAmount] = useState('0');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    setDate(record.date);
    setClientName(record.clientName);
    setClientLocation(record.clientLocation);
    setProductName(record.productName);
    setQuantity(String(record.quantity));
    setUnit(record.unit || '件');
    setUnitPrice(String(record.unitPrice));
    setTotalPrice(String(record.totalPrice));
    setTotalAuto(false);
    setNote(record.note);
    setStockStatus(record.stockStatus);
    setShipStatus(record.shipStatus ?? 'unshipped');
    setHasPrint(record.hasPrint === true);
    setPrintNote(record.printNote ?? '');
    setNoteImages(Array.isArray(record.noteImages) ? record.noteImages : []);
    setPrintImages(Array.isArray(record.printImages) ? record.printImages : []);
    setPaidAmount(String(record.paidAmount ?? (record.paid ? record.totalPrice : 0)));
  }, [record]);

  const clientNames = useMemo(() => clients.map((c) => c.name), [clients]);
  const locations = useMemo(
    () => uniqueStrings([...clients.map((c) => c.location), ...allRecords.map((r) => r.clientLocation)]),
    [clients, allRecords],
  );
  const products = useMemo(() => uniqueStrings(allRecords.map((r) => r.productName)), [allRecords]);

  const onQuantityChange = (v: string) => {
    setQuantity(v);
    if (totalAuto) setTotalPrice(computeTotal(parseNum(v), parseNum(unitPrice)).toString());
  };
  const onUnitPriceChange = (v: string) => {
    setUnitPrice(v);
    if (totalAuto) setTotalPrice(computeTotal(parseNum(quantity), parseNum(v)).toString());
  };

  const doSave = async (existing: Client | null) => {
    const name = clientName.trim();
    const location = clientLocation.trim();
    const q = parseNum(quantity);
    const p = parseNum(unitPrice);
    const total = totalAuto ? computeTotal(q, p) : parseNum(totalPrice);
    const amt = Math.max(0, Math.round(parseNum(paidAmount) * 100) / 100);

    if (!existing) {
      await db.clients.add({
        id: uid(),
        name,
        location,
        wechatId: '',
        phone: '',
        createdAt: new Date().toISOString(),
      });
    }

    const payload: Record = {
      id: isEdit && id ? id : uid(),
      date,
      clientName: name,
      clientLocation: location || existing?.location || '',
      productName: productName.trim(),
      quantity: q,
      unit,
      unitPrice: p,
      totalPrice: total,
      note: note.trim(),
      stockStatus: stockStatus === 'stocked' ? 'stocked' : 'unstocked',
      shipStatus: stockStatus === 'stocked' ? shipStatus : 'unshipped',
      hasPrint,
      printNote: hasPrint ? printNote.trim() : '',
      noteImages,
      printImages: hasPrint ? printImages : [],
      paid: amt >= total,
      paidAmount: amt,
      starred: record?.starred ?? false,
      deletedAt: record?.deletedAt ?? null,
      createdAt: record?.createdAt ?? new Date().toISOString(),
    };
    await db.records.put(payload);
    navigate(-1);
  };

  const handleSave = () => {
    const name = clientName.trim();
    if (!name) {
      setMsg('请填写客户名');
      return;
    }
    if (!productName.trim()) {
      setMsg('请填写产品名');
      return;
    }
    if (parseNum(quantity) <= 0) {
      setMsg('数量必须大于 0');
      return;
    }
    const existing = clients.find((c) => c.name.trim() === name);
    if (!existing) {
      setConfirmOpen(true);
      return;
    }
    void doSave(existing);
  };

  const handleDelete = async () => {
    if (id) await db.records.update(id, { deletedAt: new Date().toISOString() });
    navigate('/');
  };

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-teal-700">
          ← 返回
        </button>
        <h1 className="text-lg font-bold">{isEdit ? '编辑账目' : '记一笔'}</h1>
        <span className="w-10" />
      </header>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">采购日期</label>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <Autocomplete
          label="客户名"
          required
          value={clientName}
          onChange={setClientName}
          onPick={(v) => {
            const c = clients.find((x) => x.name === v);
            if (c) setClientLocation(c.location);
          }}
          options={clientNames}
          placeholder="输入或选择客户"
        />

        <Autocomplete
          label="客户所在地"
          value={clientLocation}
          onChange={setClientLocation}
          options={locations}
          placeholder="如：广州、杭州"
        />

        <Autocomplete
          label="产品名"
          required
          value={productName}
          onChange={setProductName}
          options={products}
          placeholder="输入或选择产品"
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">产品选项</label>
          <button
            type="button"
            onClick={() => setHasPrint((v) => !v)}
            className={`flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold ${
              hasPrint
                ? 'border-amber-500 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs font-bold ${
                hasPrint ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 text-transparent'
              }`}
            >
              ✓
            </span>
            🖨 印字
            <span className="ml-auto text-xs font-normal text-slate-400">{hasPrint ? '已选择' : '可选'}</span>
          </button>
        </div>

        {hasPrint && (
          <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50/60 p-3">
            <div>
              <label className="mb-1 block text-sm font-bold text-amber-800">🖨 印字备注</label>
              <textarea
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5"
                rows={2}
                value={printNote}
                onChange={(e) => setPrintNote(e.target.value)}
                placeholder="如：背后印「XX 公司」红色大字"
              />
            </div>
            <ImageField label="印字备注图片" images={printImages} onChange={setPrintImages} />
          </div>
        )}

        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">数量</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">单位</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-2 py-2.5"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">单价（¥）</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            value={unitPrice}
            onChange={(e) => onUnitPriceChange(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">总价（¥）</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-semibold"
            value={totalPrice}
            onChange={(e) => {
              setTotalAuto(false);
              setTotalPrice(e.target.value);
            }}
            placeholder="0.00"
          />
          {totalAuto && parseNum(quantity) > 0 && parseNum(unitPrice) > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              自动计算：{formatMoney(computeTotal(parseNum(quantity), parseNum(unitPrice)))}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">付款状态</label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border-2 border-slate-200 p-3">
            <button
              type="button"
              onClick={() => {
                const total = parseNum(totalPrice);
                const cur = parseNum(paidAmount);
                setPaidAmount(String(cur >= total && total > 0 ? 0 : total));
              }}
              className={`flex items-center gap-1.5 text-sm font-bold ${
                parseNum(paidAmount) >= parseNum(totalPrice) && parseNum(totalPrice) > 0
                  ? 'text-emerald-700'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold ${
                  parseNum(paidAmount) >= parseNum(totalPrice) && parseNum(totalPrice) > 0
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 text-transparent'
                }`}
              >
                ✓
              </span>
              {parseNum(paidAmount) >= parseNum(totalPrice) && parseNum(totalPrice) > 0 ? '已付清' : '点击付清'}
            </button>
            <label className="flex items-center gap-1 text-sm font-semibold text-slate-600">
              已付 ¥
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 font-bold"
              />
            </label>
            <span className="text-xs text-slate-400">总价 {formatMoney(parseNum(totalPrice))}</span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">备货进度</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setStockStatus('unstocked');
                setShipStatus('unshipped');
              }}
              className={`rounded-xl border-2 py-3 text-sm font-bold ${
                stockStatus === 'unstocked'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              ⚠ 未备货
            </button>
            <button
              type="button"
              onClick={() => setStockStatus('stocked')}
              className={`rounded-xl border-2 py-3 text-sm font-bold ${
                stockStatus === 'stocked'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              ✓ 已备货
            </button>
          </div>
        </div>

        {stockStatus === 'stocked' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">发货进度</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShipStatus('unshipped')}
                className={`rounded-xl border-2 py-3 text-sm font-bold ${
                  shipStatus === 'unshipped'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                ⏳ 未发货
              </button>
              <button
                type="button"
                onClick={() => setShipStatus('shipped')}
                className={`rounded-xl border-2 py-3 text-sm font-bold ${
                  shipStatus === 'shipped'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                🚚 已发货
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">备注</label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="可留空"
          />
          <div className="mt-2">
            <ImageField label="备注图片" images={noteImages} onChange={setNoteImages} />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-xl bg-teal-700 py-3 text-base font-bold text-white active:bg-teal-800"
        >
          保存
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="w-full rounded-xl py-2 text-sm font-medium text-red-600"
          >
            删除这条账目
          </button>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="该客户不存在"
        message={`客户「${clientName.trim()}」不在客户列表中，是否继续？\n继续将自动新建该客户（所在地：${clientLocation.trim() || '未填写'}）并保存这笔账目。`}
        confirmText="继续"
        cancelText="取消"
        onConfirm={() => {
          setConfirmOpen(false);
          void doSave(null);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="删除账目"
        message="删除后将移入回收站，可在 设置 → 回收站 恢复。确定删除吗？"
        confirmText="删除"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
      <Toast message={msg} />
    </div>
  );
}
