import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Client, Record } from '../types';

export interface BackupFile {
  version: 1;
  exportedAt: string;
  clients: Client[];
  records: Record[];
}

function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(records: Record[]): string {
  const header = [
    '日期',
    '客户名',
    '客户所在地',
    '产品名',
    '数量',
    '单位',
    '单价',
    '总价',
    '备货进度',
    '发货进度',
    '印字',
    '印字备注',
    '已付金额',
    '剩余金额',
    '已付款',
    '重点',
    '备注',
  ];
  const rows = records.map((r) =>
    [
      r.date,
      r.clientName,
      r.clientLocation,
      r.productName,
      r.quantity,
      r.unit,
      r.unitPrice,
      r.totalPrice,
      r.stockStatus === 'stocked' ? '已备货' : '未备货',
      r.shipStatus === 'shipped' ? '已发货' : '未发货',
      r.hasPrint ? '是' : '否',
      r.printNote,
      r.paidAmount,
      Math.max(0, Math.round((r.totalPrice - r.paidAmount) * 100) / 100),
      r.paid ? '已付款' : '未付款',
      r.starred ? '★' : '',
      r.note,
    ]
      .map(csvCell)
      .join(','),
  );
  return `\ufeff${[header.map(csvCell).join(','), ...rows].join('\r\n')}`;
}

export function buildBackupJson(clients: Client[], records: Record[]): string {
  const data: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    clients,
    records,
  };
  return JSON.stringify(data, null, 2);
}

export function parseBackupJson(text: string): BackupFile {
  const data = JSON.parse(text) as BackupFile;
  if (data.version !== 1 || !Array.isArray(data.clients) || !Array.isArray(data.records)) {
    throw new Error('备份文件格式不正确');
  }
  data.records = data.records.map((r) => ({
    ...r,
    shipStatus: r.shipStatus === 'shipped' ? 'shipped' : 'unshipped',
    hasPrint: r.hasPrint === true,
    printNote: r.printNote ?? '',
    noteImages: Array.isArray(r.noteImages) ? r.noteImages : [],
    printImages: Array.isArray(r.printImages) ? r.printImages : [],
    unit: r.unit || '件',
    paid: r.paid === true,
    paidAmount: typeof r.paidAmount === 'number' ? r.paidAmount : r.paid ? r.totalPrice : 0,
    starred: r.starred === true,
    deletedAt: r.deletedAt ?? null,
  }));
  return data;
}

function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportFile(filename: string, text: string, mime: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const path = `exports/${filename}`;
    await Filesystem.writeFile({ path, data: text, directory: Directory.Data, recursive: true });
    const uri = (await Filesystem.getUri({ path, directory: Directory.Data })).uri;
    await Share.share({ title: '记账本备份', files: [uri] });
    return uri;
  }
  downloadText(filename, text, mime);
  return filename;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}
