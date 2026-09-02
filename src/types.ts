export type StockStatus = 'unstocked' | 'stocked';
export type ShipStatus = 'unshipped' | 'shipped';
export const UNITS = ['个', '顶', '副', '件', '只', '包', '箱'] as const;
export type Unit = (typeof UNITS)[number];

export interface Client {
  id: string;
  name: string;
  location: string;
  wechatId: string;
  phone: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Record {
  id: string;
  date: string;
  clientName: string;
  clientLocation: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  note: string;
  stockStatus: StockStatus;
  shipStatus: ShipStatus;
  hasPrint: boolean;
  printNote: string;
  noteImages: string[];
  printImages: string[];
  paid: boolean;
  paidAmount: number;
  starred: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const STOCK_LABELS: { [K in StockStatus]: string } = {
  unstocked: '未备货',
  stocked: '已备货',
};

export const SHIP_LABELS: { [K in ShipStatus]: string } = {
  unshipped: '未发货',
  shipped: '已发货',
};
