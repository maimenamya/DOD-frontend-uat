import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';
import type { DropdownOption } from '../../components/custom-dropdown/custom-dropdown.component';
import {
  FLOOR_LAYOUT_SHAPE_OPTIONS,
  FLOOR_LAYOUT_SIZE_OPTIONS,
  floorLayoutBoxSize,
  type FloorLayoutPlacedSeat,
  type FloorLayoutShape,
  type FloorLayoutSize,
  type FloorLayoutUnplacedSeat,
  type FloorLayoutWriteItem,
  type FloorLayoutZone,
} from '../../models/seating-floor-layout';
import { SeatingFloorLayoutService } from '../../services/seating-floor-layout.service';
import { ToastService } from '../../services/toast.service';

type DragState =
  | { kind: 'move'; seatingId: number; offsetX: number; offsetY: number }
  | { kind: 'place'; seatingId: number }
  | null;

@Component({
  selector: 'app-master-seating-floor-layout-page',
  imports: [FormsModule, CustomDropdownComponent],
  templateUrl: './master-seating-floor-layout-page.component.html',
  styleUrl: './master-seating-floor-layout-page.component.css',
})
export class MasterSeatingFloorLayoutPageComponent implements OnInit {
  private readonly layoutService = inject(SeatingFloorLayoutService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly canvasWidth = signal(1200);
  readonly canvasHeight = signal(800);
  readonly zones = signal<FloorLayoutZone[]>([]);
  readonly placed = signal<FloorLayoutPlacedSeat[]>([]);
  readonly unplaced = signal<FloorLayoutUnplacedSeat[]>([]);
  readonly selectedZoneId = signal<number | null>(null);
  readonly selectedSeatingId = signal<number | null>(null);
  readonly dirty = signal(false);

  private drag: DragState = null;

  readonly shapeOptions: DropdownOption[] = FLOOR_LAYOUT_SHAPE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));
  readonly sizeOptions: DropdownOption[] = FLOOR_LAYOUT_SIZE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  readonly selectedZone = computed(() => {
    const id = this.selectedZoneId();
    if (id == null) return null;
    return this.zones().find((z) => z.id === id) ?? null;
  });

  readonly zonePlaced = computed(() => {
    const zoneId = this.selectedZoneId();
    if (zoneId == null) return [];
    return this.placed().filter((row) => row.seatingTypeId === zoneId);
  });

  readonly zoneUnplaced = computed(() => {
    const zoneId = this.selectedZoneId();
    if (zoneId == null) return [];
    return this.unplaced().filter((row) => row.seatingTypeId === zoneId);
  });

  readonly selected = computed(() => {
    const id = this.selectedSeatingId();
    if (id == null) return null;
    return this.zonePlaced().find((row) => row.seatingId === id) ?? null;
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.layoutService.getBoard().subscribe({
      next: (board) => {
        this.canvasWidth.set(board.canvasWidth);
        this.canvasHeight.set(board.canvasHeight);
        this.zones.set(board.zones ?? []);
        this.placed.set(board.placed);
        this.unplaced.set(sortUnplacedByCode(board.unplaced));
        this.selectedSeatingId.set(null);
        this.dirty.set(false);
        this.ensureZoneSelection(board.zones ?? []);
        this.loading.set(false);
      },
      error: (err: { error?: { error?: string } }) => {
        this.toast.showError(err.error?.error ?? 'โหลดผังโต๊ะไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  selectZone(zoneId: number): void {
    if (this.selectedZoneId() === zoneId) return;
    this.selectedZoneId.set(zoneId);
    this.selectedSeatingId.set(null);
  }

  boxStyle(row: FloorLayoutPlacedSeat): Record<string, string> {
    const box = floorLayoutBoxSize(row.shape, row.size);
    const w = this.canvasWidth();
    const h = this.canvasHeight();
    return {
      left: `${(row.posX / w) * 100}%`,
      top: `${(row.posY / h) * 100}%`,
      width: `${(box.width / w) * 100}%`,
      height: `${(box.height / h) * 100}%`,
      borderRadius: row.shape === 'CIRCLE' ? '999px' : '10px',
    };
  }

  selectSeat(seatingId: number): void {
    this.selectedSeatingId.set(seatingId);
  }

  onShapeChange(value: string | number | null): void {
    const selected = this.selected();
    if (!selected) return;
    const shape = String(value ?? 'SQUARE') as FloorLayoutShape;
    this.patchSelected({ shape });
  }

  onSizeChange(value: string | number | null): void {
    const selected = this.selected();
    if (!selected) return;
    const size = String(value ?? 'M') as FloorLayoutSize;
    this.patchSelected({ size });
  }

  removeSelected(): void {
    const selected = this.selected();
    if (!selected) return;
    this.placed.update((rows) => rows.filter((r) => r.seatingId !== selected.seatingId));
    this.unplaced.update((rows) =>
      sortUnplacedByCode([
        ...rows,
        {
          seatingId: selected.seatingId,
          code: selected.code,
          seatingTypeId: selected.seatingTypeId ?? 0,
          seatingTypeName: selected.seatingTypeName ?? '',
        },
      ]),
    );
    this.selectedSeatingId.set(null);
    this.dirty.set(true);
  }

  onUnplacedPointerDown(event: PointerEvent, seat: FloorLayoutUnplacedSeat): void {
    event.preventDefault();
    this.drag = { kind: 'place', seatingId: seat.seatingId };
    const onMove = (ev: PointerEvent): void => {
      void ev;
    };
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const canvasEl = document.querySelector('.floor-editor__canvas') as HTMLElement | null;
      if (!canvasEl || !this.drag || this.drag.kind !== 'place') {
        this.drag = null;
        return;
      }
      const rect = canvasEl.getBoundingClientRect();
      if (
        ev.clientX < rect.left ||
        ev.clientX > rect.right ||
        ev.clientY < rect.top ||
        ev.clientY > rect.bottom
      ) {
        this.drag = null;
        return;
      }
      const scaleX = this.canvasWidth() / rect.width;
      const scaleY = this.canvasHeight() / rect.height;
      const x = (ev.clientX - rect.left) * scaleX - 40;
      const y = (ev.clientY - rect.top) * scaleY - 40;
      this.placeSeat(this.drag.seatingId, x, y);
      this.drag = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  onPlacedPointerDown(event: PointerEvent, seat: FloorLayoutPlacedSeat): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectSeat(seat.seatingId);
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.drag = {
      kind: 'move',
      seatingId: seat.seatingId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    target.setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.drag || this.drag.kind !== 'move') return;
    const canvas = event.currentTarget as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = this.canvasWidth() / rect.width;
    const scaleY = this.canvasHeight() / rect.height;
    const x = (event.clientX - rect.left) * scaleX - this.drag.offsetX * scaleX;
    const y = (event.clientY - rect.top) * scaleY - this.drag.offsetY * scaleY;
    this.moveSeat(this.drag.seatingId, x, y);
  }

  onCanvasPointerUp(_event: PointerEvent): void {
    if (this.drag?.kind === 'move') {
      this.drag = null;
    }
  }

  onWindowPointerUp(): void {
    if (this.drag?.kind === 'move') {
      this.drag = null;
    }
  }

  save(): void {
    if (this.saving()) return;
    const items: FloorLayoutWriteItem[] = this.placed().map((row) => ({
      seatingId: row.seatingId,
      posX: row.posX,
      posY: row.posY,
      shape: row.shape,
      size: row.size,
    }));
    this.saving.set(true);
    this.layoutService.saveBoard(items).subscribe({
      next: (board) => {
        this.zones.set(board.zones ?? []);
        this.placed.set(board.placed);
        this.unplaced.set(sortUnplacedByCode(board.unplaced));
        this.ensureZoneSelection(board.zones ?? []);
        this.dirty.set(false);
        this.saving.set(false);
        this.toast.showSuccess('บันทึกผังโต๊ะแล้ว');
      },
      error: (err: { error?: { error?: string } }) => {
        this.saving.set(false);
        this.toast.showError(err.error?.error ?? 'บันทึกผังไม่สำเร็จ');
      },
    });
  }

  private ensureZoneSelection(zones: FloorLayoutZone[]): void {
    if (zones.length === 0) {
      this.selectedZoneId.set(null);
      return;
    }
    const current = this.selectedZoneId();
    if (current != null && zones.some((z) => z.id === current)) return;
    this.selectedZoneId.set(zones[0]!.id);
  }

  private placeSeat(seatingId: number, posX: number, posY: number): void {
    const seat = this.unplaced().find((row) => row.seatingId === seatingId);
    if (!seat) return;
    const box = floorLayoutBoxSize('SQUARE', 'M');
    const clamped = this.clampPos(posX, posY, box.width, box.height);
    this.unplaced.update((rows) => rows.filter((r) => r.seatingId !== seatingId));
    this.placed.update((rows) => [
      ...rows,
      {
        id: 0,
        seatingId: seat.seatingId,
        code: seat.code,
        seatingTypeId: seat.seatingTypeId,
        seatingTypeName: seat.seatingTypeName,
        posX: clamped.x,
        posY: clamped.y,
        shape: 'SQUARE',
        size: 'M',
      },
    ]);
    this.selectedSeatingId.set(seatingId);
    this.dirty.set(true);
  }

  private moveSeat(seatingId: number, posX: number, posY: number): void {
    const seat = this.placed().find((row) => row.seatingId === seatingId);
    if (!seat) return;
    const box = floorLayoutBoxSize(seat.shape, seat.size);
    const clamped = this.clampPos(posX, posY, box.width, box.height);
    this.placed.update((rows) =>
      rows.map((row) =>
        row.seatingId === seatingId
          ? { ...row, posX: clamped.x, posY: clamped.y }
          : row,
      ),
    );
    this.dirty.set(true);
  }

  private patchSelected(patch: Partial<Pick<FloorLayoutPlacedSeat, 'shape' | 'size'>>): void {
    const id = this.selectedSeatingId();
    if (id == null) return;
    this.placed.update((rows) =>
      rows.map((row) => {
        if (row.seatingId !== id) return row;
        const next = { ...row, ...patch };
        const box = floorLayoutBoxSize(next.shape, next.size);
        const clamped = this.clampPos(next.posX, next.posY, box.width, box.height);
        return { ...next, posX: clamped.x, posY: clamped.y };
      }),
    );
    this.dirty.set(true);
  }

  private clampPos(
    x: number,
    y: number,
    width: number,
    height: number,
  ): { x: number; y: number } {
    return {
      x: Math.min(Math.max(x, 0), Math.max(this.canvasWidth() - width, 0)),
      y: Math.min(Math.max(y, 0), Math.max(this.canvasHeight() - height, 0)),
    };
  }
}

function sortUnplacedByCode(rows: FloorLayoutUnplacedSeat[]): FloorLayoutUnplacedSeat[] {
  return [...rows].sort((a, b) =>
    a.code.localeCompare(b.code, 'th', { numeric: true, sensitivity: 'base' }),
  );
}
