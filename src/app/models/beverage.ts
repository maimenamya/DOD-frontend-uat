export interface Beverage {
  id: number;
  name: string;
  price: number;
  createdAt: string;
}

export interface CreateBeveragePayload {
  name: string;
  price: number;
}

export interface UpdateBeveragePayload {
  name?: string;
  price?: number;
}
