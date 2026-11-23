import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { GURUGRAM } from './lib/geo';
import type { CaseSummary } from './lib/issues';

const COLORS: Record<string, string> = { reported: 'var(--amber)', filed: 'var(--amber)', acknowledged: 'var(--sky)', fixed: 'var(--fixed)' };

/** A map of cases, or a single draggable pin when `pin` is given. */
export default function MapView({ cases = [], pin, onPin, onOpen, height = 360 }: {
  cases?: CaseSummary[]; pin?: { lat: number; lng: number } | null; onPin?: (p: { lat: number; lng: number }) => void; onOpen?: (id: number) => void; height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const marker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(pin ? [pin.lat, pin.lng] : [GURUGRAM.lat, GURUGRAM.lng], pin ? 16 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current; if (!m || !layer.current) return;
    layer.current.clearLayers();
    for (const c of cases) {
      const size = Math.min(34, 16 + Math.sqrt(c.plusOnes) * 4);
      const icon = L.divIcon({ className: 'pin', html: `<span style="--c:${COLORS[c.status]};--s:${size}px" class="pin-dot${c.status === 'fixed' ? ' is-fixed' : ''}"></span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      L.marker([c.lat, c.lng], { icon, title: c.title, keyboard: true }).on('click', () => onOpen?.(c.id)).addTo(layer.current);
    }
    if (cases.length > 1 && !pin) m.fitBounds(L.latLngBounds(cases.map((c) => [c.lat, c.lng] as [number, number])).pad(0.25), { maxZoom: 14 });
  }, [cases, onOpen, pin]);

  useEffect(() => {
    const m = map.current; if (!m || !pin) return;
    if (!marker.current) {
      const icon = L.divIcon({ className: 'pin', html: '<span class="drop-pin"></span>', iconSize: [28, 40], iconAnchor: [14, 38] });
      marker.current = L.marker([pin.lat, pin.lng], { icon, draggable: !!onPin }).addTo(m);
      marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); onPin?.({ lat: p.lat, lng: p.lng }); });
      m.on('click', (e: L.LeafletMouseEvent) => { if (onPin) { marker.current!.setLatLng(e.latlng); onPin({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
    } else marker.current.setLatLng([pin.lat, pin.lng]);
    m.setView([pin.lat, pin.lng], Math.max(m.getZoom(), 16));
  }, [pin, onPin]);

  return <div ref={el} className="map" style={{ height }} role="region" aria-label="Map" />;
}
