import { Component, output } from '@angular/core';

import { AppModalComponent } from '../app-modal/app-modal.component';
import {
  SYSTEM_GUIDE_INTRO,
  SYSTEM_GUIDE_SECTIONS,
  SYSTEM_GUIDE_TITLE,
} from './system-guide.data';

@Component({
  selector: 'app-system-guide-modal',
  imports: [AppModalComponent],
  templateUrl: './system-guide-modal.component.html',
  styleUrl: './system-guide-modal.component.css',
})
export class SystemGuideModalComponent {
  readonly dismiss = output<void>();

  readonly title = SYSTEM_GUIDE_TITLE;
  readonly intro = SYSTEM_GUIDE_INTRO;
  readonly sections = SYSTEM_GUIDE_SECTIONS;

  close(): void {
    this.dismiss.emit();
  }
}
