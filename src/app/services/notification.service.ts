import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { WorkDuty } from '../models/work-duty';

export interface ShopNotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  targetDuty: WorkDuty;
  createdAtLabel: string;
  isRead: boolean;
  createdByNickname: string | null;
}

export interface ShopNotificationListResult {
  unreadCount: number;
  items: ShopNotificationItem[];
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<ShopNotificationListResult> {
    return this.http.get<ShopNotificationListResult>(this.api.resource('notifications'));
  }

  markRead(id: number): Observable<void> {
    return this.http.post<void>(this.api.resource(`notifications/${id}/read`), {});
  }

  markAllRead(): Observable<{ marked: number }> {
    return this.http.post<{ marked: number }>(this.api.resource('notifications/read-all'), {});
  }
}
