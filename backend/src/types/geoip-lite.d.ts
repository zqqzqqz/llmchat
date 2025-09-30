declare module 'geoip-lite' {
  export interface GeoLookup {
    range: [number, number];
    country: string;
    region: string;
    city: string;
    ll: [number, number];
    metro?: number;
    area?: number;
  }

  export function lookup(ip: string): GeoLookup | null;
  export function reloadData(): void;

  const geoipLite: {
    lookup: typeof lookup;
    reloadData: typeof reloadData;
  };

  export default geoipLite;
}
