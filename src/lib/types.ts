export const BUILDING_TYPES = [
  'Apartment',
  'Office',
  'Badminton Centre',
  'Hotel',
  'Golf Course',
  'Supermarket',
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

/**
 * The map always renders exactly one city -- Melbourne and Sydney are too
 * far apart to usefully show together. City is a live switch, not a filter
 * like the rest (see BuildingExplorer).
 */
export const CITIES = ['Melbourne', 'Sydney'] as const;
export type City = (typeof CITIES)[number];

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
  city: City;
  name: string;
  address: string;
  place_id: string | null;
  lat: number;
  lng: number;
  suburb: string;
  /** A building can be more than one type at once -- always at least one. */
  building_type: BuildingType[];
  /** Could-have on upload -- null when not supplied. */
  levels: number | null;
  screen_count: number;
  /** Could-have on upload -- null when not supplied. */
  population: number | null;
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
        // id is the client's own building id, always caller-supplied --
        // never generated here, never optional.
        Insert: Omit<BuildingRow, 'created_at' | 'updated_at'>;
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
