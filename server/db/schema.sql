-- schema.sql: the database tables. Written in the SQL both SQLite and Postgres understand.
-- Each statement ends with a semicolon at the end of a line.

-- A PG (the place itself).
CREATE TABLE IF NOT EXISTS pgs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  area_key TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '',
  gender_key TEXT NOT NULL DEFAULT 'unknown',
  deposit TEXT NOT NULL,
  lock_in TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  google_place_id TEXT
);

-- One row per amenity per PG. 'y' = yes, 'n' = no, '?' = unknown (never guessed).
CREATE TABLE IF NOT EXISTS amenities (
  pg_id INTEGER NOT NULL REFERENCES pgs(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('y', 'n', '?')),
  PRIMARY KEY (pg_id, name)
);

-- RoomType: the room options of a PG. price_kind is exact, range, from or unknown.
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY,
  pg_id INTEGER NOT NULL REFERENCES pgs(id),
  occupancy_type TEXT NOT NULL,
  label TEXT NOT NULL,
  monthly_rent INTEGER,
  rent_max INTEGER,
  price_kind TEXT NOT NULL,
  inclusions TEXT NOT NULL DEFAULT '[]'
);

-- Photo: pictures used with the PG's permission, each with its credit.
-- (Google photos are never stored: Google only allows showing them live, with attribution.)
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY,
  pg_id INTEGER NOT NULL REFERENCES pgs(id),
  file TEXT NOT NULL,
  credit TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- Booking: a demo visit request. Nothing is sent to any PG.
-- price_snapshot and deposit_snapshot freeze the terms at booking time, so later price changes cannot alter it.
-- request_id is UNIQUE: that is what stops a double click from creating two bookings.
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  pg_id INTEGER NOT NULL REFERENCES pgs(id),
  room_type_id INTEGER NOT NULL REFERENCES rooms(id),
  pg_name TEXT NOT NULL,
  room_label TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  move_in_date TEXT NOT NULL,
  expected_duration TEXT,
  note TEXT,
  price_snapshot TEXT NOT NULL,
  deposit_snapshot TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Reviews are NOT stored here. They are fetched live from Google Places and shown with attribution.
