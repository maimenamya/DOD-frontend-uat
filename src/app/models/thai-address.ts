export interface ThaiProvince {
  id: number;
  nameTh: string;
  nameEn: string | null;
}

export interface ThaiDistrict {
  id: number;
  provinceId: number;
  nameTh: string;
  nameEn: string | null;
}

export interface ThaiSubdistrict {
  id: number;
  districtId: number;
  nameTh: string;
  nameEn: string | null;
  postalCode: string | null;
}
