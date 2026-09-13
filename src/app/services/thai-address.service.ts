import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { ThaiDistrict, ThaiProvince, ThaiSubdistrict } from '../models/thai-address';

@Injectable({ providedIn: 'root' })
export class ThaiAddressService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  listProvinces(): Observable<ThaiProvince[]> {
    return this.http.get<ThaiProvince[]>(this.api.resource('thai-address/provinces'));
  }

  listDistricts(provinceId: number): Observable<ThaiDistrict[]> {
    const params = new HttpParams().set('provinceId', String(provinceId));
    return this.http.get<ThaiDistrict[]>(this.api.resource('thai-address/districts'), {
      params,
    });
  }

  listSubdistricts(districtId: number): Observable<ThaiSubdistrict[]> {
    const params = new HttpParams().set('districtId', String(districtId));
    return this.http.get<ThaiSubdistrict[]>(this.api.resource('thai-address/subdistricts'), {
      params,
    });
  }
}
