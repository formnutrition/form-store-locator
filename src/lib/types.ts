export type StoreInput = {
  stockistId: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  website: string;
  email: string;
  logoUrl: string;
  notes: string;
  priority: number | null;
  visible: boolean;
};

export type Store = StoreInput & {
  id: string;
  latitude: number | null;
  longitude: number | null;
  geocodedAt: string | null;
  updatedAt: string | null;
};

/** What the public map is allowed to see. No phone, email, or notes. */
export type PublicStore = {
  id: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

export type DbStoreRow = {
  id: string;
  stockist_id: string;
  name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  website: string;
  email: string;
  logo_url: string;
  notes: string;
  priority: number | null;
  visible: boolean;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
  updated_at: string | null;
};
