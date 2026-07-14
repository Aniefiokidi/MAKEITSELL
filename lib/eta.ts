const DEFAULT_AVG_SPEED_KMH = 23;

export function estimateEtaMinutes(distanceMeters: number, avgSpeedKmh = DEFAULT_AVG_SPEED_KMH): number {
  const distanceKm = distanceMeters / 1000;
  const hours = distanceKm / avgSpeedKmh;
  return Math.max(1, Math.round(hours * 60));
}
