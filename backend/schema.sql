-- Database schema for the Event backend (PostgreSQL).
-- Safe to run multiple times (idempotent).

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  organization TEXT NOT NULL,
  ticket TEXT NOT NULL DEFAULT '',
  booth BOOLEAN NOT NULL DEFAULT FALSE,
  terms BOOLEAN NOT NULL DEFAULT FALSE,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  pris TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS organization TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS booth BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terms BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pris TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS program_items (
  id SERIAL PRIMARY KEY,
  time_text TEXT NOT NULL,
  description TEXT NOT NULL,
  position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE program_items
  ADD COLUMN IF NOT EXISTS position INTEGER;

UPDATE program_items
SET position = sub.pos
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY time_text ASC, id ASC) AS pos
  FROM program_items
) AS sub
WHERE program_items.id = sub.id
  AND program_items.position IS NULL;

CREATE TABLE IF NOT EXISTS place_settings (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE place_settings
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

INSERT INTO place_settings (id, address, description)
VALUES (1, '', '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_orders (
  payment_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  booking_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS speakers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL
);

ALTER TABLE prices
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

INSERT INTO prices (name, amount, position)
SELECT * FROM (VALUES
  ('Student', 199, 1),
  ('Ordinarie', 399, 2),
  ('Premium', 899, 3)
) AS v(name, amount, position)
WHERE NOT EXISTS (SELECT 1 FROM prices);

CREATE TABLE IF NOT EXISTS hero_section (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL
);

INSERT INTO hero_section (id, title, body_html)
VALUES (
  1,
  '18-19 september',
  '<p>Vad händer när kristna företagare, ledare och församlingar går samman med en gemensam längtan att se Guds rike ta plats – i affärslivet, i samhället och i världen? Hur ser det ut när tro får forma både vardagliga beslut och stora visioner?</p><p>Den 18-19 september samlas vi återigen för en konferens fylld av inspiration, gemenskap och andlig påfyllnad. Vi lyfter blicken, delar erfarenheter och söker tillsammans efter hur vi kan stå starkare – inte bara som enskilda foretagare eller organisationer, utan som en del av något större.</p>'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS discount_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  percent INTEGER NOT NULL,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
