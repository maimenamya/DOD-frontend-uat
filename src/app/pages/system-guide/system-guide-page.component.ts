import { Component, signal } from '@angular/core';

import {
  SYSTEM_GUIDE_INTRO,
  SYSTEM_GUIDE_SECTIONS,
  SYSTEM_GUIDE_TITLE,
} from '../../components/system-guide/system-guide.data';
import { SystemGuideWalkthroughComponent } from '../../components/system-guide/system-guide-walkthrough.component';

@Component({
  selector: 'app-system-guide-page',
  imports: [SystemGuideWalkthroughComponent],
  templateUrl: './system-guide-page.component.html',
  styleUrl: './system-guide-page.component.css',
})
export class SystemGuidePageComponent {
  readonly title = SYSTEM_GUIDE_TITLE;
  readonly intro = SYSTEM_GUIDE_INTRO;
  readonly sections = SYSTEM_GUIDE_SECTIONS;

  /** Section indexes currently expanded — ปิดทุกส่วนตอนเปิดหน้า */
  private readonly openSections = signal<ReadonlySet<number>>(new Set());

  isSectionOpen(index: number): boolean {
    return this.openSections().has(index);
  }

  toggleSection(index: number): void {
    this.openSections.update((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }
}
