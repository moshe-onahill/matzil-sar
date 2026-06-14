// Haversine distance between two lat/lng points in kilometers
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Estimate driving ETA in minutes: assumes ~70 km/h average + 3 min buffer
export function etaMinutesFromKm(km: number): number {
  return Math.ceil((km / 70) * 60) + 3;
}

// Speed in mph from two positions
export function speedMph(
  pos1: GeolocationPosition,
  pos2: GeolocationPosition
): number {
  const km = haversineKm(
    pos1.coords.latitude, pos1.coords.longitude,
    pos2.coords.latitude, pos2.coords.longitude
  );
  const hours = (pos2.timestamp - pos1.timestamp) / 3_600_000;
  if (hours <= 0) return 0;
  return Math.round((km / hours) * 0.621371);
}

export function getCurrentPosition(timeoutMs = 12000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 15000,
    });
  });
}
