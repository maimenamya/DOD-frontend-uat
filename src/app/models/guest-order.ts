export type GuestMenuItem = {
  id: number;
  name: string;
  price: number;
  unitLabelTh: string;
  imageUrl?: string | null;
  categoryId: number | null;
  categoryName: string | null;
  allowDeposit?: boolean;
  isMixer?: boolean;
  isFreeMixer?: boolean;
};

export type GuestOrderMenuPayload = {
  shop: { publicId: string; name: string; branchCode: string };
  session: {
    sessionId: number;
    tableLabel: string;
    billIndex: number;
    revision: number;
    hasFreeMixerPackage: boolean;
  };
  foods: GuestMenuItem[];
  beverages: GuestMenuItem[];
  promotions: GuestMenuItem[];
  memberships: GuestMenuItem[];
};

export type GuestOrderItemType = 'FOOD' | 'DRINK' | 'PROMOTION' | 'MEMBERSHIP';

export type GuestOrderCartLine = {
  key: string;
  itemId: number;
  type: GuestOrderItemType;
  name: string;
  catalogPrice: number;
  unitPrice: number;
  unitLabelTh: string;
  quantity: number;
  isMixer: boolean;
  isFreeMixer: boolean;
};

export type GuestOrderSubmitItem = {
  itemId: number;
  quantity: number;
  type: GuestOrderItemType;
};

export type GuestOrderSubmitResult = {
  ok: true;
  sessionId: number;
  revision: number;
  tableLabel: string;
};
