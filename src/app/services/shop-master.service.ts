import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
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

  createCocktail(payload: { name: string; drinkValue: number }): Observable<MstCocktail> {
    return this.http.post<MstCocktail>(this.api.resource('cocktails'), payload);
  }

  updateCocktail(id: number, payload: Partial<{ name: string; drinkValue: number }>): Observable<MstCocktail> {
    return this.http.put<MstCocktail>(this.api.resource(`cocktails/${id}`), payload);
  }

  deleteCocktail(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`cocktails/${id}`));
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
    payload: Partial<{ name: string; price: number; categoryId: number }>,
  ): Observable<MstFood> {
    return this.http.put<MstFood>(this.api.resource(`foods/${id}`), payload);
  }

  deleteFood(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`foods/${id}`));
  }

  getSeatingTypes(): Observable<MstSeatingType[]> {
    return this.http.get<MstSeatingType[]>(this.api.resource('seating-types'));
  }

  createSeatingType(payload: MstSeatingTypeWritePayload): Observable<MstSeatingType> {
    return this.http.post<MstSeatingType>(this.api.resource('seating-types'), payload);
  }

  updateSeatingType(id: number, payload: MstSeatingTypeWritePayload): Observable<MstSeatingType> {
    return this.http.put<MstSeatingType>(this.api.resource(`seating-types/${id}`), payload);
  }

  deleteSeatingType(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`seating-types/${id}`));
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

  updatePromotion(id: number, payload: Partial<DrinkPackagePayload>): Observable<MstPromotion> {
    return this.http.put<MstPromotion>(this.api.resource(`promotions/${id}`), payload);
  }

  deletePromotion(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`promotions/${id}`));
  }

  getMemberships(): Observable<MstMembership[]> {
    return this.http.get<MstMembership[]>(this.api.resource('memberships'));
  }

  createMembership(payload: DrinkPackagePayload): Observable<MstMembership> {
    return this.http.post<MstMembership>(this.api.resource('memberships'), payload);
  }

  updateMembership(id: number, payload: Partial<DrinkPackagePayload>): Observable<MstMembership> {
    return this.http.put<MstMembership>(this.api.resource(`memberships/${id}`), payload);
  }

  deleteMembership(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`memberships/${id}`));
  }
}
