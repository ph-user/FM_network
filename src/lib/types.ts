export const BUILDING_TYPES = ['Apartment', 'Office', 'Shop', 'Hotel'] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export const STATUSES = ['Signed', 'Installed'] as const;
export type Status = (typeof STATUSES)[number];

/**
 * A building row as it exists in Postgres.
 *
 * `type`, not `interface` -- Supabase's generated types need every Row/Insert
 * /Update shape to structurally satisfy `Record<string, unknown>` so its
 * client can index into them, and TypeScript only allows that for object
 * type aliases, not interfaces (interfaces are "open" and don't get treated
 * as compatible with index signatures). Using `interface` here silently
 * degrades every `.insert()`/`.update()` call to `never`.
 */
export type BuildingRow = {
  id: string;
  name: string;
  address: string;
  place_id: string | null;
  lat: number;
  lng: number;
  levels: number;
  building_type: BuildingType;
  postcode: string;
  suburb: string;
  status: Status;
  screen_count: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

/**
 * A building as sent to the browser. Identical to the row minus place_id, which
 * stays on the server.
 */
export type Building = Omit<BuildingRow, 'place_id'>;

export function toClientBuilding(row: BuildingRow): Building {
  const { place_id: _placeId, ...rest } = row;
  return rest;
}

export type BuildingImageRow = {
  id: string;
  building_id: string;
  storage_path: string;
  caption: string;
  created_at: string;
};

/** An image as sent to the browser: a signed URL instead of a storage path. */
export interface BuildingImage {
  id: string;
  caption: string;
  url: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      buildings: {
        Row: BuildingRow;
        Insert: Omit<BuildingRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<BuildingRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      building_images: {
        Row: BuildingImageRow;
        Insert: Omit<BuildingImageRow, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Pick<BuildingImageRow, 'caption'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
