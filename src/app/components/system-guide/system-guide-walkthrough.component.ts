import { NgTemplateOutlet } from '@angular/common';
import { afterNextRender, Component, inject, Injector, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SidebarIconComponent } from '../sidebar/sidebar-icon.component';
import type {
  GuidePosSeatStatus,
  GuideWalkthroughBeat,
  GuideWalkthroughChapter,
} from './system-guide-walkthrough.data';

@Component({
  selector: 'app-system-guide-walkthrough',
  imports: [NgTemplateOutlet, RouterLink, SidebarIconComponent],
  templateUrl: './system-guide-walkthrough.component.html',
  styleUrl: './system-guide-walkthrough.component.css',
})
export class SystemGuideWalkthroughComponent {
  readonly chapters = input.required<GuideWalkthroughChapter[]>();
  readonly chapterDomId = input('guide-wt');

  private readonly injector = inject(Injector);

  /** One chapter open at a time so shops follow the pictures in order. */
  private readonly openChapterIndex = signal(0);
  private chapterScrollToken = 0;

  isChapterOpen(index: number): boolean {
    return this.openChapterIndex() === index;
  }

  chapterElementId(index: number): string {
    return `${this.chapterDomId()}-chapter-${index}`;
  }

  beatHasVisual(beat: GuideWalkthroughBeat): boolean {
    return !!(
      beat.image ||
      (beat.screen && beat.nav) ||
      beat.posPreview ||
      beat.sidebarPreview ||
      beat.swipeDemo ||
      beat.phonePreview
    );
  }

  openChapter(index: number): void {
    this.openChapterIndex.set(index);
    this.scrollOpenedChapterIntoView(index);
  }

  toggleChapter(index: number): void {
    if (this.isChapterOpen(index)) {
      this.openChapterIndex.set(-1);
      return;
    }
    this.openChapter(index);
  }

  openNextChapter(index: number): void {
    const last = this.chapters().length - 1;
    this.openChapter(Math.min(index + 1, last));
  }

  hasNextChapter(index: number): boolean {
    return index < this.chapters().length - 1;
  }

  /**
   * Wait until the previous (often much taller) chapter unmounts,
   * then scroll — a microtask runs too early and lands on the old offset.
   */
  private scrollOpenedChapterIntoView(index: number): void {
    const token = ++this.chapterScrollToken;
    afterNextRender(
      () => {
        if (token !== this.chapterScrollToken) return;
        const el = document.getElementById(this.chapterElementId(index));
        if (!el) return;
        requestAnimationFrame(() => {
          if (token !== this.chapterScrollToken) return;
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
      },
      { injector: this.injector },
    );
  }

  /** Floor filter chips use the same status dots as POS. */
  statusFilterKey(chip: string): GuidePosSeatStatus | null {
    if (chip === 'ว่าง') return 'empty';
    if (chip === 'จอง') return 'reserved';
    if (chip === 'ใช้งาน' || chip === 'มีลูกค้า') return 'open';
    if (chip === 'รอลูกค้ากลับ') return 'wait';
    return null;
  }
}
