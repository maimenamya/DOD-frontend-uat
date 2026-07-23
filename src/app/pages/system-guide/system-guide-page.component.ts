import { Component } from '@angular/core';

import {
  SYSTEM_GUIDE_INTRO,
  SYSTEM_GUIDE_SECTIONS,
  SYSTEM_GUIDE_TITLE,
} from '../../components/system-guide/system-guide.data';

@Component({
  selector: 'app-system-guide-page',
  templateUrl: './system-guide-page.component.html',
  styleUrl: './system-guide-page.component.css',
})
export class SystemGuidePageComponent {
  readonly title = SYSTEM_GUIDE_TITLE;
  readonly intro = SYSTEM_GUIDE_INTRO;
  readonly sections = SYSTEM_GUIDE_SECTIONS;
}
