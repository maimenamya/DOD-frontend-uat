export type StationTicketKind = 'FOOD' | 'DRINK';

export type StationTicketStatus = 'PENDING' | 'READY' | 'PICKED_UP';

export interface StationTicketLine {
  name: string;
  quantity: number;
}

export interface StationTicket {
  id: number;
  sessionId: number;
  tableName: string;
  kind: StationTicketKind;
  status: StationTicketStatus;
  lines: StationTicketLine[];
  linesLabel: string;
  createdAtLabel: string;
  readyAtLabel: string | null;
  createdByNickname: string | null;
}

export const STATION_TICKET_KIND_LABEL: Record<StationTicketKind, string> = {
  FOOD: 'อาหาร',
  DRINK: 'เครื่องดื่ม',
};

export const STATION_TICKET_STATUS_LABEL: Record<StationTicketStatus, string> = {
  PENDING: 'รอทำ',
  READY: 'พร้อมเสิร์ฟ',
  PICKED_UP: 'รับแล้ว',
};
