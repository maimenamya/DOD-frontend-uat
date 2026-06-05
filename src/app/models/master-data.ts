export interface MstCocktail {
  id: number;
  name: string;
  drinkValue: number;
  unitLabelTh: string;
  shopId: number;
  createdAt: string;
}

export interface MstFoodCategory {
  id: number;
  name: string;
  shopId: number;
  createdAt: string;
}

export interface MstFood {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  shopId: number;
  createdAt: string;
  category?: MstFoodCategory;
}

export interface LoungeTable {
  id: number;
  tableCode: string;
  shopId: number;
  createdAt: string;
}

export type RoomPricingType = 'HOURLY' | 'FLAT_RATE';

export interface Room {
  id: number;
  roomCode: string;
  price: number;
  pricingType: RoomPricingType;
  shopId: number;
  createdAt: string;
}

export interface DrinkPackageRow {
  id: number;
  name: string;
  packagePrice: number;
  drinkId: number;
  quantity: number;
  isFreeMixer: boolean;
  freeDrinks?: number;
  shopId: number;
  createdAt: string;
  drink?: { id: number; name: string; price: number };
}

export type MstPromotion = DrinkPackageRow;
export type MstMembership = DrinkPackageRow;

export interface DrinkPackagePayload {
  name: string;
  packagePrice: number;
  drinkId: number;
  quantity: number;
  isFreeMixer: boolean;
  freeDrinks?: number;
}
