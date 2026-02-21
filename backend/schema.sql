-- Database schema for the Event backend (PostgreSQL).
-- Safe to run multiple times (idempotent).

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO events (slug, name)
VALUES ('default', 'Standardevent')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS user_id INTEGER,
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS event_start_date DATE,
  ADD COLUMN IF NOT EXISTS event_end_date DATE,
  ADD COLUMN IF NOT EXISTS registration_deadline DATE;

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_token TEXT,
  ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

-- Befintliga användare (utan verifieringstoken) räknas som verifierade
UPDATE admin_users SET email_verified = TRUE WHERE verification_token IS NULL;

CREATE TABLE IF NOT EXISTS admin_user_profiles (
  user_id INTEGER PRIMARY KEY,
  profile_id TEXT UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  org_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  bg_number TEXT NOT NULL DEFAULT '',
  subscription_plan TEXT NOT NULL DEFAULT 'gratis',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_user_profiles
  ADD COLUMN IF NOT EXISTS profile_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS org_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'gratis';

CREATE TABLE IF NOT EXISTS payout_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  profile_id TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pågår',
  event_ids INTEGER[] NOT NULL DEFAULT '{}',
  event_names TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  event_id INTEGER,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  organization TEXT NOT NULL,
  ticket TEXT NOT NULL DEFAULT '',
  terms BOOLEAN NOT NULL DEFAULT FALSE,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  pris TEXT NOT NULL DEFAULT '',
  custom_fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_sections (
  event_id INTEGER PRIMARY KEY,
  show_program BOOLEAN NOT NULL DEFAULT TRUE,
  show_place BOOLEAN NOT NULL DEFAULT TRUE,
  show_text BOOLEAN NOT NULL DEFAULT TRUE,
  show_speakers BOOLEAN NOT NULL DEFAULT TRUE,
  show_partners BOOLEAN NOT NULL DEFAULT TRUE,
  show_name BOOLEAN NOT NULL DEFAULT TRUE,
  show_email BOOLEAN NOT NULL DEFAULT TRUE,
  show_phone BOOLEAN NOT NULL DEFAULT TRUE,
  show_organization BOOLEAN NOT NULL DEFAULT TRUE,
  show_translate BOOLEAN NOT NULL DEFAULT TRUE,
  show_discount_code BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE event_sections
  ADD COLUMN IF NOT EXISTS show_name BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_organization BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_translate BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_discount_code BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS event_custom_fields (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS event_id INTEGER,
  ADD COLUMN IF NOT EXISTS organization TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pris TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS program_items (
  id SERIAL PRIMARY KEY,
  event_id INTEGER,
  time_text TEXT NOT NULL,
  description TEXT NOT NULL,
  position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE program_items
  ADD COLUMN IF NOT EXISTS event_id INTEGER,
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
  event_id INTEGER,
  address TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE place_settings
  ADD COLUMN IF NOT EXISTS event_id INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

INSERT INTO place_settings (id, event_id, address, description)
VALUES ((SELECT id FROM events WHERE slug = 'default'), (SELECT id FROM events WHERE slug = 'default'), '', '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_orders (
  payment_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  booking_id INTEGER,
  booking_ids INTEGER[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS booking_ids INTEGER[];

CREATE TABLE IF NOT EXISTS speakers (
  id SERIAL PRIMARY KEY,
  event_id INTEGER,
  name TEXT NOT NULL,
  bio TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE speakers
  ADD COLUMN IF NOT EXISTS event_id INTEGER;

CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  event_id INTEGER,
  name TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS event_id INTEGER,
  ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  event_id INTEGER,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL
);

ALTER TABLE prices
  ADD COLUMN IF NOT EXISTS event_id INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

INSERT INTO prices (event_id, name, amount, position)
SELECT * FROM (VALUES
  ((SELECT id FROM events WHERE slug = 'default'), 'Student', 199, 1),
  ((SELECT id FROM events WHERE slug = 'default'), 'Ordinarie', 399, 2),
  ((SELECT id FROM events WHERE slug = 'default'), 'Premium', 899, 3)
) AS v(event_id, name, amount, position)
WHERE NOT EXISTS (SELECT 1 FROM prices WHERE event_id = (SELECT id FROM events WHERE slug = 'default'));

CREATE TABLE IF NOT EXISTS hero_section (
  id INTEGER PRIMARY KEY,
  event_id INTEGER,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT ''
);

ALTER TABLE hero_section
  ADD COLUMN IF NOT EXISTS event_id INTEGER,
  ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';

INSERT INTO hero_section (id, event_id, title, body_html, image_url)
VALUES (
  (SELECT id FROM events WHERE slug = 'default'),
  (SELECT id FROM events WHERE slug = 'default'),
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS discount_codes (
  id SERIAL PRIMARY KEY,
  event_id INTEGER,
  code TEXT NOT NULL UNIQUE,
  percent INTEGER NOT NULL,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS event_id INTEGER;

ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS discount_codes_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_event_code_unique
  ON discount_codes (event_id, code);

UPDATE bookings
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;

UPDATE program_items
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;

UPDATE prices
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;

UPDATE speakers
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;

UPDATE partners
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;

UPDATE place_settings
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;

UPDATE hero_section
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;

UPDATE discount_codes
SET event_id = (SELECT id FROM events WHERE slug = 'default')
WHERE event_id IS NULL;
