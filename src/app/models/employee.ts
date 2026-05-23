export interface Employee {
  id: number;
  nickname: string;
  roleId: number;
  role?: {
    id: number;
    name: string;
    createdAt: string;
  };
  shopId: number;
  status: string;
  createdAt: string;
  shop?: {
    id: number;
    name: string;
    createdAt: string;
  };
}
