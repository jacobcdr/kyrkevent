import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function markerRadius(count) {
  const value = Number(count) || 0;
  return Math.min(28, Math.max(8, 6 + Math.sqrt(value) * 5));
}

export function EventAnalyticsMap({ locations }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 8,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const map = mapRef.current;
    const layer = layerRef.current;
    layer.clearLayers();

    const points = (locations || []).filter(
      (row) => row.latitude != null && row.longitude != null && (Number(row.count) || 0) > 0
    );

    if (points.length === 0) {
      map.setView([20, 0], 2);
      requestAnimationFrame(() => map.invalidateSize());
      return undefined;
    }

    const bounds = [];
    points.forEach((row) => {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      const count = Number(row.count) || 0;
      const marker = L.circleMarker([lat, lng], {
        radius: markerRadius(count),
        color: "#0c4a6e",
        weight: 2,
        fillColor: "var(--accent, #c95a1a)",
        fillOpacity: 0.75
      });
      marker.bindPopup(`<strong>${count}</strong> besök`);
      marker.addTo(layer);
      bounds.push([lat, lng]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 4);
    } else {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 5 });
    }

    requestAnimationFrame(() => map.invalidateSize());

    return undefined;
  }, [locations]);

  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    },
    []
  );

  return <div className="event-analytics-map" ref={containerRef} aria-label="Karta över besökares ungefärliga plats" />;
}
