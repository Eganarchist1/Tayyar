"use client";

import React from "react";
import maplibregl, { LngLatBounds } from "maplibre-gl";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
};

type CoordinatePoint = {
  lat: number;
  lng: number;
};

const style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "(c) OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
} satisfies maplibregl.StyleSpecification;

const sourceId = "tayyar-polygon";
const lineId = "tayyar-polygon-line";
const fillId = "tayyar-polygon-fill";

function createPointMarker(color: string) {
  const element = document.createElement("div");
  element.className =
    "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-[0_0_0_5px_rgba(255,255,255,0.12)]";
  element.style.background = color;
  return element;
}

function createVertexMarker(selected: boolean) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = [
    "flex items-center justify-center rounded-full border-2 border-white shadow-[0_0_0_6px_rgba(245,158,11,0.16)]",
    selected ? "h-7 w-7 bg-[#f59e0b]" : "h-6 w-6 bg-[#0ea5e9]",
  ].join(" ");
  element.style.touchAction = "none";
  return element;
}

export default function MapLibreMap({
  center,
  zoom = 12,
  points = [],
  editablePoint,
  onEditablePointChange,
  polygon = [],
  polygons = [],
  editablePolygon = [],
  selectedEditablePointIndex,
  onEditablePolygonChange,
  onEditablePolygonPointSelect,
  onMapClick,
  className = "h-[420px]",
}: {
  center: CoordinatePoint;
  zoom?: number;
  points?: MapPoint[];
  editablePoint?: CoordinatePoint | null;
  onEditablePointChange?: (next: CoordinatePoint) => void;
  polygon?: CoordinatePoint[];
  polygons?: CoordinatePoint[][];
  editablePolygon?: CoordinatePoint[];
  selectedEditablePointIndex?: number | null;
  onEditablePolygonChange?: (next: CoordinatePoint[]) => void;
  onEditablePolygonPointSelect?: (index: number | null) => void;
  onMapClick?: (next: CoordinatePoint) => void;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markersRef = React.useRef<maplibregl.Marker[]>([]);
  const dragMarkerRef = React.useRef<maplibregl.Marker | null>(null);
  const polygonMarkersRef = React.useRef<maplibregl.Marker[]>([]);
  const centerRef = React.useRef(center);
  const zoomRef = React.useRef(zoom);
  const onMapClickRef = React.useRef(onMapClick);
  const onEditablePointChangeRef = React.useRef(onEditablePointChange);
  const onEditablePolygonChangeRef = React.useRef(onEditablePolygonChange);
  const onEditablePolygonPointSelectRef = React.useRef(onEditablePolygonPointSelect);
  const isDraggingRef = React.useRef(false);
  const lastDragPointRef = React.useRef<CoordinatePoint | null>(null);
  const [styleReady, setStyleReady] = React.useState(false);

  centerRef.current = center;
  zoomRef.current = zoom;
  onMapClickRef.current = onMapClick;
  onEditablePointChangeRef.current = onEditablePointChange;
  onEditablePolygonChangeRef.current = onEditablePolygonChange;
  onEditablePolygonPointSelectRef.current = onEditablePolygonPointSelect;

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [centerRef.current.lng, centerRef.current.lat],
      zoom: zoomRef.current,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: false }), "top-left");
    map.on("click", (event) => {
      onMapClickRef.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });
    map.on("load", () => setStyleReady(true));

    mapRef.current = map;

    return () => {
      setStyleReady(false);
      markersRef.current.forEach((marker) => marker.remove());
      polygonMarkersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      polygonMarkersRef.current = [];
      dragMarkerRef.current?.remove();
      dragMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || isDraggingRef.current) {
      return;
    }

    const currentCenter = map.getCenter();
    const sameCenter =
      Math.abs(currentCenter.lat - center.lat) < 0.000001 &&
      Math.abs(currentCenter.lng - center.lng) < 0.000001;
    const sameZoom = Math.abs(map.getZoom() - zoom) < 0.01;

    if (sameCenter && sameZoom) {
      return;
    }

    map.easeTo({
      center: [center.lng, center.lat],
      zoom,
      duration: 450,
    });
  }, [center.lat, center.lng, zoom]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = points.map((point) => {
      return new maplibregl.Marker({ element: createPointMarker(point.color || "#0ea5e9") })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
    });
  }, [points, styleReady]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) {
      return;
    }

    if (!editablePoint) {
      dragMarkerRef.current?.remove();
      dragMarkerRef.current = null;
      lastDragPointRef.current = null;
      return;
    }

    if (!dragMarkerRef.current) {
      const marker = new maplibregl.Marker({ draggable: true, color: "#f59e0b" })
        .setLngLat([editablePoint.lng, editablePoint.lat])
        .addTo(map);

      marker.on("dragstart", () => {
        isDraggingRef.current = true;
      });

      marker.on("dragend", () => {
        const next = marker.getLngLat();
        const nextPoint = { lat: next.lat, lng: next.lng };
        isDraggingRef.current = false;
        lastDragPointRef.current = nextPoint;
        onEditablePointChangeRef.current?.(nextPoint);
      });

      dragMarkerRef.current = marker;
      return;
    }

    const current = dragMarkerRef.current.getLngLat();
    const samePoint =
      Math.abs(current.lat - editablePoint.lat) < 0.000001 &&
      Math.abs(current.lng - editablePoint.lng) < 0.000001;
    const sameAsLastDrag =
      lastDragPointRef.current &&
      Math.abs(lastDragPointRef.current.lat - editablePoint.lat) < 0.000001 &&
      Math.abs(lastDragPointRef.current.lng - editablePoint.lng) < 0.000001;

    if (!samePoint && !isDraggingRef.current && !sameAsLastDrag) {
      dragMarkerRef.current.setLngLat([editablePoint.lng, editablePoint.lat]);
    }
  }, [editablePoint, styleReady]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) {
      return;
    }

    polygonMarkersRef.current.forEach((marker) => marker.remove());
    polygonMarkersRef.current = [];

    if (!editablePolygon.length) {
      return;
    }

    polygonMarkersRef.current = editablePolygon.map((point, index) => {
      const element = createVertexMarker(selectedEditablePointIndex === index);
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onEditablePolygonPointSelectRef.current?.(index);
      });

      const marker = new maplibregl.Marker({
        draggable: true,
        element,
      })
        .setLngLat([point.lng, point.lat])
        .addTo(map);

      marker.on("dragstart", () => {
        isDraggingRef.current = true;
        onEditablePolygonPointSelectRef.current?.(index);
      });

      marker.on("dragend", () => {
        const next = marker.getLngLat();
        isDraggingRef.current = false;
        const updated = editablePolygon.map((entry, currentIndex) =>
          currentIndex === index ? { lat: next.lat, lng: next.lng } : entry,
        );
        onEditablePolygonChangeRef.current?.(updated);
        onEditablePolygonPointSelectRef.current?.(index);
      });

      return marker;
    });
  }, [editablePolygon, selectedEditablePointIndex, styleReady]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !map.isStyleLoaded()) {
      return;
    }

    const polygonSet: CoordinatePoint[][] = [];
    if (editablePolygon.length) {
      polygonSet.push(editablePolygon);
    } else if (polygon.length) {
      polygonSet.push(polygon);
    }
    polygonSet.push(...polygons.filter((entry) => entry.length));

    const features: Array<Feature<Geometry, GeoJsonProperties>> = polygonSet.map((entry) => {
      const coordinates = entry.map((point) => [point.lng, point.lat]);
      const closedCoordinates = coordinates.length >= 3 ? [...coordinates, coordinates[0]] : coordinates;
      return coordinates.length >= 3
        ? {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [closedCoordinates],
            },
          }
        : {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates,
            },
          };
    });

    if (map.getLayer(fillId)) {
      map.removeLayer(fillId);
    }
    if (map.getLayer(lineId)) {
      map.removeLayer(lineId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    if (!features.length) {
      return;
    }

    const collection: FeatureCollection<Geometry, GeoJsonProperties> = {
      type: "FeatureCollection",
      features,
    };

    map.addSource(sourceId, {
      type: "geojson",
      data: collection,
    });

    if (polygonSet.some((entry) => entry.length >= 3)) {
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#0ea5e9",
          "fill-opacity": 0.18,
        },
      });
    }

    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#f59e0b",
        "line-width": 3,
      },
    });

    const allCoordinates = polygonSet.flat().map((point) => [point.lng, point.lat] as [number, number]);
    if (!allCoordinates.length || isDraggingRef.current) {
      return;
    }

    const bounds = allCoordinates.reduce(
      (memo, coordinate) => memo.extend(coordinate),
      new LngLatBounds(allCoordinates[0], allCoordinates[0]),
    );
    map.fitBounds(bounds, { padding: 60, duration: 400, maxZoom: 14 });
  }, [editablePolygon, polygon, polygons, styleReady]);

  return <div ref={containerRef} className={`overflow-hidden rounded-[24px] border border-white/10 ${className}`} />;
}
