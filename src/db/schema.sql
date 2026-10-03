DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS guest_list CASCADE;
DROP TABLE IF EXISTS tables CASCADE;

CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  side TEXT NOT NULL CHECK (side IN ('B', 'G')),
  kind TEXT NOT NULL CHECK (kind IN ('vip', 'guest', 'couch')),
  capacity INT NOT NULL CHECK (capacity > 0),
  short_label TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INT NOT NULL
);

CREATE TABLE seats (
  table_id TEXT NOT NULL REFERENCES tables (id) ON DELETE CASCADE,
  seat_index INT NOT NULL,
  guest_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (table_id, seat_index)
);

CREATE INDEX idx_seats_guest_name ON seats (guest_name) WHERE guest_name <> '';

CREATE TABLE guest_list (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);
