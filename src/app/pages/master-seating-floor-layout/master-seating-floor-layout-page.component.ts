import { Component, ElementRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';
import type { DropdownOption } from '../../components/custom-dropdown/custom-dropdown.component';
import {
  DEFAULT_FLOOR_AREA_HEIGHT,
  DEFAULT_FLOOR_AREA_WIDTH,
  DEFAULT_FLOOR_SEAT_HEIGHT,
  DEFAULT_FLOOR_SEAT_WIDTH,
  FLOOR_LAYOUT_SHAPE_OPTIONS,
  clampFloorLayoutEdge,
  floorLayoutAreaBoxStyle,
  floorLayoutSeatBoxStyle,
  mapFloorLayoutAreasFromApi,
  normalizeFloorLayoutShape,
  type FloorLayoutArea,
  type FloorLayoutAreaWriteItem,
  type FloorLayoutPlacedSeat,
  type FloorLayoutShape,
  type FloorLayoutUnplacedSeat,
  type FloorLayoutWriteItem,
  type FloorLayoutZone,
} from '../../models/seating-floor-layout';
import { SeatingFloorLayoutService } from '../../services/seating-floor-layout.service';
import { ToastService } from '../../services/toast.service';

type DragState =
  | { kind: 'move'; seatingId: number; offsetX: number; offsetY: number }
  | { kind: 'move-area'; areaKey: string; offsetX: number; offsetY: number }
  | { kind: 'place'; seatingId: number }
  | { kind: 'pan'; startX: number; startY: number; scrollLeft: number; scrollTop: number }
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
  private readonly canvasWrap = viewChild<ElementRef<HTMLElement>>('canvasWrap');

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly canvasWidth = signal(1200);
  readonly canvasHeight = signal(800);
  readonly zones = signal<FloorLayoutZone[]>([]);
  readonly placed = signal<FloorLayoutPlacedSeat[]>([]);
  readonly unplaced = signal<FloorLayoutUnplacedSeat[]>([]);
  readonly areas = signal<FloorLayoutArea[]>([]);
  readonly selectedZoneId = signal<number | null>(null);
  readonly selectedSeatingId = signal<number | null>(null);
  readonly selectedAreaKey = signal<string | null>(null);
  readonly dirty = signal(false);
  readonly isPanning = signal(false);

  private drag: DragState = null;
  private nextTempAreaId = -1;

  constructor() {
    effect((onCleanup) => {
      const ref = this.canvasWrap();
      if (!ref) return;
      const el = ref.nativeElement;
      const onWheel = (event: WheelEvent): void => this.onCanvasWrapWheel(event, el);
      el.addEventListener('wheel', onWheel, { passive: false });
      onCleanup(() => el.removeEventListener('wheel', onWheel));
    });
  }

  readonly shapeOptions: DropdownOption[] = FLOOR_LAYOUT_SHAPE_OPTIONS.map((o) => ({
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

  /** Areas belonging to the selected zone only. */
  readonly zoneAreas = computed(() => {
    const zoneId = this.selectedZoneId();
    if (zoneId == null) return [];
    return this.areas().filter((row) => row.seatingTypeId === zoneId);
  });

  readonly selected = computed(() => {
    const id = this.selectedSeatingId();
    if (id == null) return null;
    return this.zonePlaced().find((row) => row.seatingId === id) ?? null;
  });

  readonly selectedArea = computed(() => {
    const key = this.selectedAreaKey();
    if (key == null) return null;
    return this.zoneAreas().find((row) => row.key === key) ?? null;
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
        this.placed.set(
          board.placed.map((row) => ({
            ...row,
            shape: normalizeFloorLayoutShape(row.shape),
          })),
        );
        this.unplaced.set(sortUnplacedByCode(board.unplaced));
        this.areas.set(mapFloorLayoutAreasFromApi(board.areas));
        this.selectedSeatingId.set(null);
        this.selectedAreaKey.set(null);
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
    this.selectedAreaKey.set(null);
  }

  boxStyle(row: FloorLayoutPlacedSeat): Record<string, string> {
    return floorLayoutSeatBoxStyle(row.posX, row.posY, row.shape, row.width, row.height);
  }

  areaStyle(row: FloorLayoutArea): Record<string, string> {
    return floorLayoutAreaBoxStyle(row.posX, row.posY, row.width, row.height);
  }

  selectSeat(seatingId: number): void {
    this.selectedSeatingId.set(seatingId);
    this.selectedAreaKey.set(null);
  }

  selectArea(key: string): void {
    this.selectedAreaKey.set(key);
    this.selectedSeatingId.set(null);
  }

  addArea(): void {
    const zoneId = this.selectedZoneId();
    if (zoneId == null) {
      this.toast.showError('เลือกโซนก่อน แล้วค่อยเพิ่มพื้นที่');
      return;
    }
    const id = this.nextTempAreaId--;
    const width = DEFAULT_FLOOR_AREA_WIDTH;
    const height = DEFAULT_FLOOR_AREA_HEIGHT;
    const clamped = this.clampPos(40, 40, width, height);
    const key = `temp-${id}`;
    const row: FloorLayoutArea = {
      key,
      id,
      seatingTypeId: zoneId,
      name: 'พื้นที่ว่าง',
      posX: clamped.x,
      posY: clamped.y,
      width,
      height,
    };
    this.areas.update((rows) => [...rows, row]);
    this.selectedAreaKey.set(key);
    this.dirty.set(true);
  }

  /** Palette “+ พื้นที่ว่าง” — add area in the currently selected zone. */
  addEmptyAreaFromPalette(): void {
    if (this.selectedZoneId() == null) {
      const first = this.zones()[0];
      if (!first) {
        this.toast.showError('ยังไม่มีโซนที่นั่ง — สร้างโซนก่อนแล้วค่อยจัดพื้นที่');
        return;
      }
      this.selectedZoneId.set(first.id);
    }
    this.selectedSeatingId.set(null);
    this.addArea();
  }

  onAreaNameChange(value: string): void {
    const key = this.selectedAreaKey();
    if (key == null) return;
    const name = value.trim().slice(0, 40);
    this.areas.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, name: name || row.name } : row)),
    );
    this.dirty.set(true);
  }

  onAreaWidthChange(value: string | number): void {
    this.patchSelectedAreaSize({ width: Number(value) });
  }

  onAreaHeightChange(value: string | number): void {
    this.patchSelectedAreaSize({ height: Number(value) });
  }

  removeSelectedArea(): void {
    const key = this.selectedAreaKey();
    if (key == null) return;
    this.areas.update((rows) => rows.filter((r) => r.key !== key));
    this.selectedAreaKey.set(null);
    this.dirty.set(true);
  }

  onShapeChange(value: string | number | null): void {
    const selected = this.selected();
    if (!selected) return;
    const shape = normalizeFloorLayoutShape(String(value ?? 'SQUARE'));
    this.patchSelectedSeat({ shape });
  }

  onSeatWidthChange(value: string | number): void {
    this.patchSelectedSeat({ width: Number(value) });
  }

  onSeatHeightChange(value: string | number): void {
    this.patchSelectedSeat({ height: Number(value) });
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
      const x = ev.clientX - rect.left - 40;
      const y = ev.clientY - rect.top - 40;
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
    this.isPanning.set(false);
    target.setPointerCapture?.(event.pointerId);
  }

  onAreaPointerDown(event: PointerEvent, area: FloorLayoutArea): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectArea(area.key);
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.drag = {
      kind: 'move-area',
      areaKey: area.key,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    this.isPanning.set(false);
    target.setPointerCapture?.(event.pointerId);
  }

  /** Pan the scroll wrap by dragging empty canvas (no Shift needed; works on touch). */
  onCanvasBackgroundPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.floor-editor__seat, .floor-editor__area')) return;
    const wrap = (event.currentTarget as HTMLElement).closest(
      '.floor-editor__canvas-wrap',
    ) as HTMLElement | null;
    if (!wrap) return;
    event.preventDefault();
    this.selectedSeatingId.set(null);
    this.selectedAreaKey.set(null);
    this.drag = {
      kind: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: wrap.scrollLeft,
      scrollTop: wrap.scrollTop,
    };
    this.isPanning.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.drag) return;
    if (this.drag.kind === 'move') {
      const canvas = event.currentTarget as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left - this.drag.offsetX;
      const y = event.clientY - rect.top - this.drag.offsetY;
      this.moveSeat(this.drag.seatingId, x, y);
      return;
    }
    if (this.drag.kind === 'move-area') {
      const canvas = event.currentTarget as HTMLElement;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left - this.drag.offsetX;
      const y = event.clientY - rect.top - this.drag.offsetY;
      this.moveArea(this.drag.areaKey, x, y);
      return;
    }
    if (this.drag.kind === 'pan') {
      const wrap = (event.currentTarget as HTMLElement).closest(
        '.floor-editor__canvas-wrap',
      ) as HTMLElement | null;
      if (!wrap) return;
      wrap.scrollLeft = this.drag.scrollLeft - (event.clientX - this.drag.startX);
      wrap.scrollTop = this.drag.scrollTop - (event.clientY - this.drag.startY);
    }
  }

  onCanvasPointerUp(_event: PointerEvent): void {
    if (
      this.drag?.kind === 'move' ||
      this.drag?.kind === 'move-area' ||
      this.drag?.kind === 'pan'
    ) {
      this.drag = null;
      this.isPanning.set(false);
    }
  }

  onWindowPointerUp(): void {
    if (
      this.drag?.kind === 'move' ||
      this.drag?.kind === 'move-area' ||
      this.drag?.kind === 'pan'
    ) {
      this.drag = null;
      this.isPanning.set(false);
    }
  }

  onCanvasWrapWheel(event: WheelEvent, el: HTMLElement): void {
    if (event.ctrlKey) return;
    event.preventDefault();
    el.scrollLeft += event.deltaX + event.deltaY;
    el.scrollTop += event.deltaY;
  }

  save(): void {
    if (this.saving()) return;
    for (const area of this.areas()) {
      if (!area.name.trim()) {
        this.toast.showError('กรุณาใส่ชื่อพื้นที่ให้ครบ');
        return;
      }
    }
    const items: FloorLayoutWriteItem[] = this.placed().map((row) => ({
      seatingId: row.seatingId,
      posX: row.posX,
      posY: row.posY,
      shape: normalizeFloorLayoutShape(row.shape),
      width: row.width,
      height: row.height,
    }));
    const areaItems: FloorLayoutAreaWriteItem[] = this.areas().map((row) => ({
      seatingTypeId: row.seatingTypeId,
      name: row.name.trim(),
      posX: row.posX,
      posY: row.posY,
      width: row.width,
      height: row.height,
    }));
    this.saving.set(true);
    this.layoutService.saveBoard(items, areaItems).subscribe({
      next: (board) => {
        this.zones.set(board.zones ?? []);
        this.placed.set(
          board.placed.map((row) => ({
            ...row,
            shape: normalizeFloorLayoutShape(row.shape),
          })),
        );
        this.unplaced.set(sortUnplacedByCode(board.unplaced));
        this.areas.set(mapFloorLayoutAreasFromApi(board.areas));
        this.selectedAreaKey.set(null);
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
    const width = DEFAULT_FLOOR_SEAT_WIDTH;
    const height = DEFAULT_FLOOR_SEAT_HEIGHT;
    const clamped = this.clampPos(posX, posY, width, height);
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
        width,
        height,
      },
    ]);
    this.selectedSeatingId.set(seatingId);
    this.dirty.set(true);
  }

  private moveSeat(seatingId: number, posX: number, posY: number): void {
    const seat = this.placed().find((row) => row.seatingId === seatingId);
    if (!seat) return;
    const clamped = this.clampPos(posX, posY, seat.width, seat.height);
    this.placed.update((rows) =>
      rows.map((row) =>
        row.seatingId === seatingId
          ? { ...row, posX: clamped.x, posY: clamped.y }
          : row,
      ),
    );
    this.dirty.set(true);
  }

  private moveArea(areaKey: string, posX: number, posY: number): void {
    const area = this.areas().find((row) => row.key === areaKey);
    if (!area) return;
    const clamped = this.clampPos(posX, posY, area.width, area.height);
    this.areas.update((rows) =>
      rows.map((row) =>
        row.key === areaKey ? { ...row, posX: clamped.x, posY: clamped.y } : row,
      ),
    );
    this.dirty.set(true);
  }

  private patchSelectedSeat(
    patch: Partial<Pick<FloorLayoutPlacedSeat, 'shape' | 'width' | 'height'>>,
  ): void {
    const id = this.selectedSeatingId();
    if (id == null) return;
    this.placed.update((rows) =>
      rows.map((row) => {
        if (row.seatingId !== id) return row;
        const width = clampFloorLayoutEdge(patch.width ?? row.width);
        const height = clampFloorLayoutEdge(patch.height ?? row.height);
        const next = { ...row, ...patch, width, height };
        const clamped = this.clampPos(next.posX, next.posY, width, height);
        return { ...next, posX: clamped.x, posY: clamped.y };
      }),
    );
    this.dirty.set(true);
  }

  private patchSelectedAreaSize(patch: Partial<Pick<FloorLayoutArea, 'width' | 'height'>>): void {
    const key = this.selectedAreaKey();
    if (key == null) return;
    this.areas.update((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const width = clampFloorLayoutEdge(patch.width ?? row.width, DEFAULT_FLOOR_AREA_WIDTH);
        const height = clampFloorLayoutEdge(patch.height ?? row.height, DEFAULT_FLOOR_AREA_HEIGHT);
        const clamped = this.clampPos(row.posX, row.posY, width, height);
        return { ...row, width, height, posX: clamped.x, posY: clamped.y };
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

