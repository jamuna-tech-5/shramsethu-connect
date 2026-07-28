// Shared browser geolocation helper with production-safe error messages.
// Geolocation only works over HTTPS (or localhost); Vercel is HTTPS so the
// common production failures are permission-denied and timeout.

export type Coords = { lat: number; lng: number; accuracy?: number };

export function geolocationUnavailableReason(): string | null {
  if (typeof window === "undefined") return "Location is only available in the browser.";
  if (!("geolocation" in navigator)) return "Geolocation is not supported by this browser.";
  if (!window.isSecureContext) {
    return "Location requires a secure (HTTPS) connection. Open the site over https:// and try again.";
  }
  return null;
}

export function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Enable location access for this site in your browser settings, then try again.";
    case err.POSITION_UNAVAILABLE:
      return "Your location could not be determined. Check that device location/GPS is turned on.";
    case err.TIMEOUT:
      return "Getting your location timed out. Move to an area with better signal and try again.";
    default:
      return err.message || "Could not get your location.";
  }
}

export function getCurrentCoords(options?: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    const reason = geolocationUnavailableReason();
    if (reason) return reject(new Error(reason));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(new Error(geolocationErrorMessage(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options },
    );
  });
}
