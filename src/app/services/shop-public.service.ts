import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';

export interface ShopPublicInfo {
  publicId: string;
  name: string;
  branchCode: string;
}

@Injectable({
  providedIn: 'root',
})
export class ShopPublicService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getByPublicId(publicId: string): Observable<ShopPublicInfo> {
    return this.http.get<ShopPublicInfo>(
      this.api.resource('shops', 'public', publicId),
    );
  }
}
