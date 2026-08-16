import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PERMISSION_GROUP_SHORT_LABEL_TH } from '../../models/permission-group';
import {
  PERMISSION_MATRIX_GROUPS,
  PERMISSION_MENU_SECTIONS,
  menuAccessLabel,
  type MenuAccess,
} from './permission-menu-matrix';

@Component({
  selector: 'app-permission-overview-page',
  imports: [RouterLink],
  templateUrl: './permission-overview-page.component.html',
  styleUrl: './permission-overview-page.component.css',
})
export class PermissionOverviewPageComponent {
  readonly groups = PERMISSION_MATRIX_GROUPS;
  readonly sections = PERMISSION_MENU_SECTIONS;
  readonly groupLabel = PERMISSION_GROUP_SHORT_LABEL_TH;
  readonly accessLabel = menuAccessLabel;

  isVisible(access: MenuAccess): boolean {
    return access === true;
  }

  isDuty(access: MenuAccess): boolean {
    return access === 'sale' || access === 'station';
  }
}
