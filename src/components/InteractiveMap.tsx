/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { getMapsBrowserKey } from "@/lib/maps.functions";

type LatLng = { lat: number; lng: number };
export type MapMarker = { position: LatLng; title?: string; color?: string };

declare global {
  interface Window {
    google?: any;
    __ssMapReady?: Promise<void>;
    __ssMapReadyResolve?: () => void;
    __ssMapAuthFailed?: boolean;
    gm_authFailure?: () => void;
  }
}

// Decodes an encoded polyline without depending on the Google geometry library.
function decodePolyline(str: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let result = 0, shift = 0, b: number;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// A Google key is only usable when it is allowed on the current host.
// The Lovable-managed connector key is referrer-restricted to *.lovable.app /
// *.lovableproject.com, so on any other domain (Vercel, custom domain) we fall
// back to OpenStreetMap tiles via Leaflet unless the deployer supplies their own key.
function resolveGoogleKey(): string | null {
  const own = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  if (own) return own;
  if (runtimeKey) return runtimeKey;
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  const lovableHost =
    host === "localhost" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.dev");
  if (!lovableHost) return null;
  const connector = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined)?.trim();
  return connector || null;
}

// A Maps key configured only as a runtime env var (common on Vercel, where
// VITE_* vars must exist at build time) is fetched once from the server.
let runtimeKey: string | null = null;
let runtimeKeyPromise: Promise<string | null> | null = null;
function fetchRuntimeKey(): Promise<string | null> {
  if (runtimeKey) return Promise.resolve(runtimeKey);
  if (!runtimeKeyPromise) {
    runtimeKeyPromise = getMapsBrowserKey()
      .then((r) => {
        runtimeKey = r.key;
        return runtimeKey;
      })
      .catch((e) => {
        console.warn("[maps] runtime key lookup failed", e);
        return null;
      });
  }
  return runtimeKeyPromise;
}

function loadMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__ssMapReady) return window.__ssMapReady;
  const tracking = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  window.__ssMapReady = new Promise<void>((resolve) => {
    window.__ssMapReadyResolve = resolve;
    // @ts-expect-error global callback
    window.initMap = () => window.__ssMapReadyResolve?.();
    window.gm_authFailure = () => {
      window.__ssMapAuthFailed = true;
      window.dispatchEvent(new Event("ss-map-auth-failed"));
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initMap${tracking ? `&channel=${tracking}` : ""}`;
    s.async = true; s.defer = true;
    s.onerror = () => { window.__ssMapAuthFailed = true; window.dispatchEvent(new Event("ss-map-auth-failed")); resolve(); };
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
  const [useLeaflet, setUseLeaflet] = useState<boolean>(() =>
    typeof window === "undefined" ? false : !resolveGoogleKey() || !!window.__ssMapAuthFailed,
  );

  useEffect(() => {
    const onFail = () => setUseLeaflet(true);
    window.addEventListener("ss-map-auth-failed", onFail);
    if (window.__ssMapAuthFailed) {
      setUseLeaflet(true);
    } else if (!resolveGoogleKey()) {
      // Try a runtime-provided key before falling back to OpenStreetMap.
      let cancelled = false;
      fetchRuntimeKey().then((k) => {
        if (cancelled) return;
        if (k) setUseLeaflet(false);
        else setUseLeaflet(true);
      });
      return () => {
        cancelled = true;
        window.removeEventListener("ss-map-auth-failed", onFail);
      };
    }
    return () => window.removeEventListener("ss-map-auth-failed", onFail);
  }, []);

  if (useLeaflet) {
    return <LeafletMap center={center} markers={markers} zoom={zoom} className={className} polyline={polyline} />;
  }
  return <GoogleMap center={center} markers={markers} zoom={zoom} className={className} polyline={polyline} />;
}

type MapProps = {
  center: LatLng | null;
  markers?: MapMarker[];
  zoom?: number;
  className?: string;
  polyline?: string | null;
};

function GoogleMap({ center, markers = [], zoom = 13, className, polyline }: MapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any[]>([]);
  const polyRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const key = resolveGoogleKey();
    if (!key) return;
    loadMaps(key).then(() => {
      if (cancelled || !ref.current || !window.google?.maps) return;
      const g = window.google;
      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(ref.current, {
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
      markerRef.current.forEach((m: any) => m.setMap(null));
      markerRef.current = markers.map((m) =>
        new g.maps.Marker({
          position: m.position, map: mapRef.current, title: m.title,
          icon: m.color ? {
            path: g.maps.SymbolPath.CIRCLE, scale: 8,
            fillColor: m.color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2,
          } : undefined,
        }),
      );
      // Polyline (encoded)
      if (polyRef.current) polyRef.current.setMap(null);
      if (polyline) {
        const path = decodePolyline(polyline);
        polyRef.current = new g.maps.Polyline({
          path, map: mapRef.current, strokeColor: "#4F46E5", strokeWeight: 5, strokeOpacity: 0.85,
        });
      }
    });
    return () => { cancelled = true; };
  }, [center?.lat, center?.lng, zoom, JSON.stringify(markers), polyline]);

  return <div ref={ref} className={className ?? "h-[420px] w-full"} />;
}

// OpenStreetMap / Leaflet renderer — no API key, works on every domain.
function LeafletMap({ center, markers = [], zoom = 13, className, polyline }: MapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default as any;
      if (cancelled || !ref.current) return;
      const fallbackCenter = center ?? { lat: 20.5937, lng: 78.9629 };
      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { zoomControl: true, attributionControl: true })
          .setView([fallbackCenter.lat, fallbackCenter.lng], center ? zoom : 5);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(mapRef.current);
      } else if (center) {
        mapRef.current.setView([center.lat, center.lng], zoom);
      }

      layersRef.current.forEach((l) => mapRef.current.removeLayer(l));
      layersRef.current = [];

      for (const m of markers) {
        const layer = L.circleMarker([m.position.lat, m.position.lng], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: m.color ?? "#4F46E5",
          fillOpacity: 1,
        }).addTo(mapRef.current);
        if (m.title) layer.bindTooltip(m.title);
        layersRef.current.push(layer);
      }

      if (polyline) {
        const path = decodePolyline(polyline).map((p) => [p.lat, p.lng]);
        const line = L.polyline(path, { color: "#4F46E5", weight: 5, opacity: 0.85 }).addTo(mapRef.current);
        layersRef.current.push(line);
      }
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    })();
    return () => { cancelled = true; };
  }, [center?.lat, center?.lng, zoom, JSON.stringify(markers), polyline]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={ref} className={className ?? "h-[420px] w-full"} />;
}