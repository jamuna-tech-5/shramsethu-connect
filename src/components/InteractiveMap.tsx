import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };
export type MapMarker = { position: LatLng; title?: string; color?: string };

declare global {
  interface Window {
    google?: typeof google;
    __ssMapReady?: Promise<void>;
    __ssMapReadyResolve?: () => void;
  }
}

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__ssMapReady) return window.__ssMapReady;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const tracking = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  window.__ssMapReady = new Promise<void>((resolve) => {
    window.__ssMapReadyResolve = resolve;
    // @ts-expect-error global callback
    window.initMap = () => window.__ssMapReadyResolve?.();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key ?? ""}&loading=async&callback=initMap${tracking ? `&channel=${tracking}` : ""}`;
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  });
  return window.__ssMapReady;
}

export function InteractiveMap({
  center,
  markers = [],
  zoom = 13,
  className,
  polyline,
}: {
  center: LatLng | null;
  markers?: MapMarker[];
  zoom?: number;
  className?: string;
  polyline?: string | null;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker[]>([]);
  const polyRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current || !window.google?.maps) return;
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(ref.current, {
          center: center ?? { lat: 20.5937, lng: 78.9629 },
          zoom: center ? zoom : 5,
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
          ],
        });
      } else if (center) {
        mapRef.current.setCenter(center);
        mapRef.current.setZoom(zoom);
      }
      // Markers
      markerRef.current.forEach((m) => m.setMap(null));
      markerRef.current = markers.map((m) =>
        new google.maps.Marker({
          position: m.position, map: mapRef.current!, title: m.title,
          icon: m.color ? {
            path: google.maps.SymbolPath.CIRCLE, scale: 8,
            fillColor: m.color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2,
          } : undefined,
        }),
      );
      // Polyline (encoded)
      if (polyRef.current) polyRef.current.setMap(null);
      if (polyline && google.maps.geometry?.encoding) {
        const path = google.maps.geometry.encoding.decodePath(polyline);
        polyRef.current = new google.maps.Polyline({
          path, map: mapRef.current, strokeColor: "#4F46E5", strokeWeight: 5, strokeOpacity: 0.85,
        });
      }
    });
    return () => { cancelled = true; };
  }, [center?.lat, center?.lng, zoom, JSON.stringify(markers), polyline]);

  return <div ref={ref} className={className ?? "h-[420px] w-full"} />;
}