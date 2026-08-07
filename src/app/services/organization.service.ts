import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';

export type BusinessDataPartnerShareSettings = {
  allowBusinessDataPartnerShare: boolean;
  updatedAtLabel: string | null;
};

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getBusinessDataPartnerShare(): Observable<BusinessDataPartnerShareSettings> {
    return this.http.get<BusinessDataPartnerShareSettings>(
      this.api.resource('organization', 'business-data-partner-share'),
    );
  }

  setBusinessDataPartnerShare(
    enabled: boolean,
  ): Observable<BusinessDataPartnerShareSettings> {
    return this.http.put<BusinessDataPartnerShareSettings>(
      this.api.resource('organization', 'business-data-partner-share'),
      { enabled },
    );
  }
}
