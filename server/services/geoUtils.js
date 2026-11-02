// Haversine distance in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Bearing in degrees (0 - 360) for rotating bus marker
function getBearing(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

// Linear interpolation between two coordinates
function interpolate(p1, p2, factor) {
  if (!p1 && !p2) return [12.9716, 77.5946];
  if (!p1) return p2;
  if (!p2) return p1;
  const f = Math.max(0, Math.min(1, factor || 0));
  return [
    p1[0] + (p2[0] - p1[0]) * f,
    p1[1] + (p2[1] - p1[1]) * f
  ];
}

// Format duration into readable string ("14 mins", "1 hr 10 mins")
function formatEtaMinutes(minutes) {
  if (minutes < 1) return "Arriving now";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs} hr ${mins} min`;
}

module.exports = {
  getDistanceKm,
  getBearing,
  interpolate,
  formatEtaMinutes
};
