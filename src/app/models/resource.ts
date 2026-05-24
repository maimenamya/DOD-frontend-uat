export interface ResourceItem {
  id: number;
  name: string;
  price: number;
  createdAt: string;
}

export interface CreateResourcePayload {
  name: string;
  price?: number;
}

export interface UpdateResourcePayload {
  name?: string;
  price?: number;
}
