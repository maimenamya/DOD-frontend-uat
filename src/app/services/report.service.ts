import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import { parseExcelDownloadResponse } from '../utils/excel-download.util';
import type { ReportPreview, ReportPreviewParams } from '../models/report';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getPreview(params: ReportPreviewParams): Observable<ReportPreview> {
    return this.http.get<ReportPreview>(this.api.resource('reports', 'preview'), {
      params: this.buildParams(params),
    });
  }

  downloadExcel(
    params: ReportPreviewParams,
  ): Observable<{ blob: Blob; filename: string }> {
    return this.http
      .get(this.api.resource('reports', 'download'), {
        params: this.buildParams(params),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(switchMap((res) => from(parseExcelDownloadResponse(res))));
  }

  private buildParams(params: ReportPreviewParams): HttpParams {
    let httpParams = new HttpParams().set('shopId', params.shopId.toString());
    if (params.preset) {
      httpParams = httpParams.set('preset', params.preset);
    }
    if (params.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params.to) {
      httpParams = httpParams.set('to', params.to);
    }
    if (params.sections?.length) {
      httpParams = httpParams.set('sections', params.sections.join(','));
    }
    return httpParams;
  }
}
