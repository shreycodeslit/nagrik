/** Distance in metres between two points. */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bits that differ between two 64-bit photo fingerprints (hex strings). 0 = identical, under ~12 = very similar. */
export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { n += x & 1; x >>= 1; } }
  return n;
}

export const GURUGRAM = { lat: 28.4595, lng: 77.0266 };
/** Rough box around Gurugram and Manesar, used to say when a report is outside the city Nagrik covers. */
export const inGurugram = (p: { lat: number; lng: number }) => p.lat > 28.3 && p.lat < 28.56 && p.lng > 76.85 && p.lng < 77.15;
