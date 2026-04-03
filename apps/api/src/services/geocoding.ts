import axios from "axios";
import { env } from "../config";

type GeocodeInput = {
  query: string;
  proximity?: { lng: number; lat: number };
};

export type AddressCandidate = {
  id: string;
  label: string;
  secondaryLabel?: string | null;
  lat: number;
  lng: number;
  confidence: "high" | "medium" | "low" | "fallback";
  source: "mapbox" | "fallback";
};

function confidenceForScore(relevance?: number) {
  if (typeof relevance !== "number") {
    return "low" as const;
  }
  if (relevance >= 0.92) return "high" as const;
  if (relevance >= 0.75) return "medium" as const;
  return "low" as const;
}

export class GeocodingService {
  static async search({ query, proximity }: GeocodeInput): Promise<AddressCandidate[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    if (!env.MAPBOX_ACCESS_TOKEN) {
      return [];
    }

    const params = new URLSearchParams({
      access_token: env.MAPBOX_ACCESS_TOKEN,
      autocomplete: "true",
      limit: "5",
      language: "ar,en",
      country: "eg",
      types: "address,poi,place,locality,neighborhood",
    });

    if (proximity) {
      params.set("proximity", `${proximity.lng},${proximity.lat}`);
    }

    const response = await axios.get<{
      features?: Array<{
        id: string;
        place_name?: string;
        text?: string;
        center?: [number, number];
        properties?: { full_address?: string };
        relevance?: number;
      }>;
    }>(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?${params.toString()}`);

    return (response.data.features || [])
      .filter((feature) => Array.isArray(feature.center) && feature.center.length === 2)
      .map((feature) => ({
        id: feature.id,
        label: feature.properties?.full_address || feature.place_name || feature.text || trimmed,
        secondaryLabel: feature.place_name && feature.properties?.full_address !== feature.place_name ? feature.place_name : null,
        lat: feature.center![1],
        lng: feature.center![0],
        confidence: confidenceForScore(feature.relevance),
        source: "mapbox" as const,
      }));
  }

  static fallbackFromBranch(query: string, branch: { id: string; lat: number; lng: number; address: string }) {
    return [
      {
        id: `fallback-${branch.id}`,
        label: query.trim(),
        secondaryLabel: branch.address,
        lat: branch.lat,
        lng: branch.lng,
        confidence: "fallback" as const,
        source: "fallback" as const,
      },
    ];
  }
}
