import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Alarm-clock style swipe row:
 * - swipe right (content →) reveals start actions (delete)
 * - swipe left (content ←) reveals end actions (edit / stop)
 */
@Component({
  selector: 'app-swipe-reveal-row',
  templateUrl: './swipe-reveal-row.component.html',
  styleUrl: './swipe-reveal-row.component.css',
  host: {
    class: 'swipe-reveal-host',
  },
})
export class SwipeRevealRowComponent {
  private static openRow: SwipeRevealRowComponent | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly contentEl = viewChild<ElementRef<HTMLElement>>('content');
  private readonly startEl = viewChild<ElementRef<HTMLElement>>('startActions');
  private readonly endEl = viewChild<ElementRef<HTMLElement>>('endActions');

  /** Allow swipe right → reveal start (ลบ). */
  readonly enableStart = input(true, { transform: (v: unknown) => !!v });
  /** Allow swipe left → reveal end (แก้ไข / สต็อป). */
  readonly enableEnd = input(true, { transform: (v: unknown) => !!v });
  readonly disabled = input(false, { transform: (v: unknown) => !!v });

  readonly offsetX = signal(0);
  readonly dragging = signal(false);

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private originOffset = 0;
  private tracking = false;
  private axisLocked: 'h' | 'v' | null = null;
  private startWidth = 0;
  private endWidth = 0;
  private didDrag = false;

  constructor() {
    effect(() => {
      this.enableStart();
      this.enableEnd();
      queueMicrotask(() => this.measurePanels());
    });

    afterNextRender(() => {
      this.measurePanels();
      const onDocPointer = (ev: PointerEvent): void => {
        if (!this.isOpen()) return;
        const t = ev.target as Node | null;
        if (t && this.host.nativeElement.contains(t)) return;
        this.close();
      };
      document.addEventListener('pointerdown', onDocPointer, true);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('pointerdown', onDocPointer, true);
        if (SwipeRevealRowComponent.openRow === this) {
          SwipeRevealRowComponent.openRow = null;
        }
      });
    });
  }

  isOpen(): boolean {
    return this.offsetX() !== 0;
  }

  close(): void {
    this.offsetX.set(0);
    if (SwipeRevealRowComponent.openRow === this) {
      SwipeRevealRowComponent.openRow = null;
    }
  }

  onActionActivate(): void {
    this.close();
  }

  onPointerDown(event: PointerEvent): void {
    if (this.disabled() || event.button !== 0) return;
    if (!this.enableStart() && !this.enableEnd()) return;
    this.measurePanels();
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.originOffset = this.offsetX();
    this.tracking = true;
    this.axisLocked = null;
    this.didDrag = false;
    this.dragging.set(false);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.tracking || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    if (!this.axisLocked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      this.axisLocked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      if (this.axisLocked === 'v') {
        this.tracking = false;
        return;
      }
      this.dragging.set(true);
    }
    if (this.axisLocked !== 'h') return;
    if (Math.abs(dx) > 8) this.didDrag = true;
    event.preventDefault();
    let next = this.originOffset + dx;
    const maxRight = this.enableStart() ? this.startWidth : 0;
    const maxLeft = this.enableEnd() ? -this.endWidth : 0;
    if (next > maxRight) next = maxRight + (next - maxRight) * 0.2;
    if (next < maxLeft) next = maxLeft + (next - maxLeft) * 0.2;
    this.offsetX.set(next);
  }

  onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.dragging.set(false);
    if (!this.tracking || this.axisLocked !== 'h') {
      this.tracking = false;
      this.axisLocked = null;
      return;
    }
    this.tracking = false;
    this.axisLocked = null;
    this.snap();
  }

  onContentClick(event: MouseEvent): void {
    if (this.didDrag) {
      event.preventDefault();
      event.stopPropagation();
      this.didDrag = false;
      return;
    }
    if (!this.isOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  private snap(): void {
    const x = this.offsetX();
    const openRight = this.enableStart() && this.startWidth > 0 && x > this.startWidth * 0.35;
    const openLeft = this.enableEnd() && this.endWidth > 0 && x < -this.endWidth * 0.35;
    if (openRight) {
      this.claimOpen();
      this.offsetX.set(this.startWidth);
      return;
    }
    if (openLeft) {
      this.claimOpen();
      this.offsetX.set(-this.endWidth);
      return;
    }
    this.close();
  }

  private claimOpen(): void {
    if (SwipeRevealRowComponent.openRow && SwipeRevealRowComponent.openRow !== this) {
      SwipeRevealRowComponent.openRow.close();
    }
    SwipeRevealRowComponent.openRow = this;
  }

  private measurePanels(): void {
    this.startWidth = this.enableStart()
      ? Math.max(this.startEl()?.nativeElement.scrollWidth ?? 0, 0)
      : 0;
    this.endWidth = this.enableEnd()
      ? Math.max(this.endEl()?.nativeElement.scrollWidth ?? 0, 0)
      : 0;
  }
}
