import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { LatLngExpression, Map as LeafletMap, Marker } from 'leaflet';

import { AppModalComponent } from '../app-modal/app-modal.component';

const BANGKOK_CENTER: LatLngExpression = [13.7563, 100.5018];

@Component({
  selector: 'app-shop-location-map-picker',
  imports: [AppModalComponent],
  templateUrl: './shop-location-map-picker.component.html',
  styleUrl: './shop-location-map-picker.component.css',
})
export class ShopLocationMapPickerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  /** Current form values — empty string / null uses Bangkok default. */
  readonly latitude = input<string | null>('');
  readonly longitude = input<string | null>('');

  readonly confirm = output<{ latitude: string; longitude: string }>();
  readonly dismiss = output<void>();

  private map: LeafletMap | null = null;
  private marker: Marker | null = null;
  private draftLat = 13.7563;
  private draftLng = 100.5018;

  constructor() {
    afterNextRender(() => {
      void this.initMap();
    });
    this.destroyRef.onDestroy(() => this.destroyMap());
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  onConfirm(): void {
    this.confirm.emit({
      latitude: this.formatCoord(this.draftLat),
      longitude: this.formatCoord(this.draftLng),
    });
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');
    const host = this.mapHost().nativeElement;
    const initial = this.resolveInitialLatLng();
    this.draftLat = initial[0];
    this.draftLng = initial[1];

    this.map = L.map(host, {
      center: initial,
      zoom: 16,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    this.marker = L.marker(initial, {
      draggable: true,
      icon: L.divIcon({
        className: 'shop-map-pin',
        html: '<span class="shop-map-pin__dot"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    }).addTo(this.map);

    this.marker.on('dragend', () => {
      const pos = this.marker?.getLatLng();
      if (!pos) return;
      this.draftLat = pos.lat;
      this.draftLng = pos.lng;
    });

    this.map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
      this.draftLat = event.latlng.lat;
      this.draftLng = event.latlng.lng;
      this.marker?.setLatLng(event.latlng);
    });

    // Modal layout settles after paint — otherwise tiles stay blank.
    window.setTimeout(() => this.map?.invalidateSize(), 80);
    window.setTimeout(() => this.map?.invalidateSize(), 300);
  }

  private resolveInitialLatLng(): [number, number] {
    const lat = Number(String(this.latitude() ?? '').trim());
    const lng = Number(String(this.longitude() ?? '').trim());
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return [lat, lng];
    }
    const bangkok = BANGKOK_CENTER as [number, number];
    return bangkok;
  }

  private formatCoord(value: number): string {
    return String(Math.round(value * 1e7) / 1e7);
  }

  private destroyMap(): void {
    this.map?.remove();
    this.map = null;
    this.marker = null;
  }
}
