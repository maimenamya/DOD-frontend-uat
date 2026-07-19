import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  MstBeverageCategory,
  MstBeverageCategoryCreatePayload,
  MstBeverageCategoryUpdatePayload,
} from '../models/beverage';
import type {
  MstCocktail,
  DrinkPackagePayload,
  MstFood,
  MstFoodCategory,
  MstMembership,
  MstPromotion,
} from '../models/master-data';
import type {
  MstSeating,
  MstSeatingType,
  MstSeatingTypeWritePayload,
  MstSeatingWritePayload,
} from '../models/seating';

@Injectable({ providedIn: 'root' })
export class ShopMasterService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getCocktails(): Observable<MstCocktail[]> {
    return this.http.get<MstCocktail[]>(this.api.resource('cocktails'));
  }

  createCocktail(payload: {
    name: string;
    drinkValue: number;
    unitLabelTh?: string;
  }): Observable<MstCocktail> {
    return this.http.post<MstCocktail>(this.api.resource('cocktails'), payload);
  }

  updateCocktail(
    id: number,
    payload: Partial<{ name: string; drinkValue: number; unitLabelTh: string; changeReason: string }>,
  ): Observable<MstCocktail> {
    return this.http.put<MstCocktail>(this.api.resource(`cocktails/${id}`), payload);
  }

  deleteCocktail(id: number, changeReason: string): Observable<void> {
    return this.http.delete<void>(this.api.resource(`cocktails/${id}`), {
      body: { changeReason },
    });
  }

  getBeverageCategories(): Observable<MstBeverageCategory[]> {
    return this.http.get<MstBeverageCategory[]>(this.api.resource('beverage-categories'));
  }

  createBeverageCategory(
    payload: MstBeverageCategoryCreatePayload,
  ): Observable<MstBeverageCategory> {
    return this.http.post<MstBeverageCategory>(this.api.resource('beverage-categories'), payload);
  }

  updateBeverageCategory(
    id: number,
    payload: MstBeverageCategoryUpdatePayload,
  ): Observable<MstBeverageCategory> {
    return this.http.put<MstBeverageCategory>(
      this.api.resource(`beverage-categories/${id}`),
      payload,
    );
  }

  deleteBeverageCategory(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`beverage-categories/${id}`));
  }

  getFoodCategories(): Observable<MstFoodCategory[]> {
    return this.http.get<MstFoodCategory[]>(this.api.resource('food-categories'));
  }

  createFoodCategory(payload: { name: string }): Observable<MstFoodCategory> {
    return this.http.post<MstFoodCategory>(this.api.resource('food-categories'), payload);
  }

  updateFoodCategory(id: number, payload: { name: string }): Observable<MstFoodCategory> {
    return this.http.put<MstFoodCategory>(this.api.resource(`food-categories/${id}`), payload);
  }

  deleteFoodCategory(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`food-categories/${id}`));
  }

  getFoods(): Observable<MstFood[]> {
    return this.http.get<MstFood[]>(this.api.resource('foods'));
  }

  createFood(payload: { name: string; price: number; categoryId: number }): Observable<MstFood> {
    return this.http.post<MstFood>(this.api.resource('foods'), payload);
  }

  updateFood(
    id: number,
    payload: Partial<{ name: string; price: number; categoryId: number; changeReason: string }>,
  ): Observable<MstFood> {
    return this.http.put<MstFood>(this.api.resource(`foods/${id}`), payload);
  }

  deleteFood(id: number, changeReason: string): Observable<void> {
    return this.http.delete<void>(this.api.resource(`foods/${id}`), {
      body: { changeReason },
    });
  }

  getSeatingTypes(): Observable<MstSeatingType[]> {
    return this.http.get<MstSeatingType[]>(this.api.resource('seating-types'));
  }

  createSeatingType(payload: MstSeatingTypeWritePayload): Observable<MstSeatingType> {
    return this.http.post<MstSeatingType>(this.api.resource('seating-types'), payload);
  }

  updateSeatingType(
    id: number,
    payload: MstSeatingTypeWritePayload & { changeReason?: string },
  ): Observable<MstSeatingType> {
    return this.http.put<MstSeatingType>(this.api.resource(`seating-types/${id}`), payload);
  }

  deleteSeatingType(id: number, changeReason: string): Observable<void> {
    return this.http.delete<void>(this.api.resource(`seating-types/${id}`), {
      body: { changeReason },
    });
  }

  getSeatings(): Observable<MstSeating[]> {
    return this.http.get<MstSeating[]>(this.api.resource('seatings'));
  }

  createSeating(payload: MstSeatingWritePayload): Observable<MstSeating> {
    return this.http.post<MstSeating>(this.api.resource('seatings'), payload);
  }

  updateSeating(id: number, payload: MstSeatingWritePayload): Observable<MstSeating> {
    return this.http.put<MstSeating>(this.api.resource(`seatings/${id}`), payload);
  }

  deleteSeating(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`seatings/${id}`));
  }

  getPromotions(): Observable<MstPromotion[]> {
    return this.http.get<MstPromotion[]>(this.api.resource('promotions'));
  }

  createPromotion(payload: DrinkPackagePayload): Observable<MstPromotion> {
    return this.http.post<MstPromotion>(this.api.resource('promotions'), payload);
  }

  updatePromotion(
    id: number,
    payload: Partial<DrinkPackagePayload & { changeReason: string }>,
  ): Observable<MstPromotion> {
    return this.http.put<MstPromotion>(this.api.resource(`promotions/${id}`), payload);
  }

  deletePromotion(id: number, changeReason: string): Observable<void> {
    return this.http.delete<void>(this.api.resource(`promotions/${id}`), {
      body: { changeReason },
    });
  }

  getMemberships(): Observable<MstMembership[]> {
    return this.http.get<MstMembership[]>(this.api.resource('memberships'));
  }

  createMembership(payload: DrinkPackagePayload): Observable<MstMembership> {
    return this.http.post<MstMembership>(this.api.resource('memberships'), payload);
  }

  updateMembership(
    id: number,
    payload: Partial<DrinkPackagePayload & { changeReason: string }>,
  ): Observable<MstMembership> {
    return this.http.put<MstMembership>(this.api.resource(`memberships/${id}`), payload);
  }

  deleteMembership(id: number, changeReason: string): Observable<void> {
    return this.http.delete<void>(this.api.resource(`memberships/${id}`), {
      body: { changeReason },
    });
  }
}
