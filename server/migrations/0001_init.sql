-- GYM platform schema. Every row belongs to one gym (gym_id) and every query is scoped by it.
-- Medicines are deliberately absent: they stay on the member's phone.

CREATE TABLE gyms (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  tagline       TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#2F45FF',
  logo_key      TEXT,
  features      TEXT NOT NULL DEFAULT '{}',   -- JSON: module on/off switches, empty = all on
  settings      TEXT NOT NULL DEFAULT '{}',   -- JSON: hours, contact, guest pass rules
  -- pending: self-signed-up, waiting for the platform owner. active: live. suspended: locked out.
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at    TEXT NOT NULL
);

-- Owners and front-desk staff. Owners sign in with a password, staff with a PIN.
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  gym_id     TEXT NOT NULL REFERENCES gyms(id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  secret     TEXT NOT NULL,                   -- pbkdf2$iterations$salt$hash
  created_at TEXT NOT NULL,
  UNIQUE (gym_id, phone)
);

-- The gym's own member list. A person only gets in if a row for their phone exists here.
CREATE TABLE members (
  id         TEXT PRIMARY KEY,
  gym_id     TEXT NOT NULL REFERENCES gyms(id),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  gender     TEXT CHECK (gender IN ('male', 'female', 'other')),
  plan_name  TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (gym_id, phone)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                -- sha-256 of the bearer token; the token itself is never stored
  gym_id     TEXT NOT NULL REFERENCES gyms(id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'member')),
  user_id    TEXT REFERENCES users(id),
  member_id  TEXT REFERENCES members(id),
  expires_at INTEGER NOT NULL,                -- unix seconds
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_gym ON sessions(gym_id);

-- Owner invites: a 6-digit code the owner sends over WhatsApp. Stored only as a keyed hash.
CREATE TABLE invites (
  id         TEXT PRIMARY KEY,
  gym_id     TEXT NOT NULL REFERENCES gyms(id),
  member_id  TEXT NOT NULL REFERENCES members(id),
  salt       TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX invites_member ON invites(member_id);

-- Front-desk pairing: the member asks to join, staff scan their QR and match them to a member row.
CREATE TABLE pairings (
  id          TEXT PRIMARY KEY,
  gym_id      TEXT NOT NULL REFERENCES gyms(id),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'approved', 'claimed')),
  member_id   TEXT REFERENCES members(id),
  expires_at  INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

-- Failed-attempt counters for sign-in, invite redemption and sign-up.
CREATE TABLE attempts (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE slots (
  id       TEXT PRIMARY KEY,
  gym_id   TEXT NOT NULL REFERENCES gyms(id),
  label    TEXT NOT NULL,
  start    TEXT NOT NULL,                     -- HH:MM
  end      TEXT NOT NULL,
  weekdays TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
  capacity INTEGER NOT NULL CHECK (capacity > 0)
);

CREATE TABLE bookings (
  id         TEXT PRIMARY KEY,
  gym_id     TEXT NOT NULL REFERENCES gyms(id),
  member_id  TEXT NOT NULL REFERENCES members(id),
  slot_id    TEXT NOT NULL REFERENCES slots(id),
  date       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX bookings_once ON bookings(member_id, slot_id, date) WHERE status = 'booked';
CREATE INDEX bookings_slot_day ON bookings(slot_id, date);

CREATE TABLE checkins (
  id        TEXT PRIMARY KEY,
  gym_id    TEXT NOT NULL REFERENCES gyms(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  date      TEXT NOT NULL,
  at        TEXT NOT NULL,
  method    TEXT NOT NULL DEFAULT 'qr'
);
CREATE UNIQUE INDEX checkins_once_a_day ON checkins(member_id, date);

-- XP is only ever added by the server. The (member_id, key) pair makes every award idempotent.
CREATE TABLE xp_events (
  id        TEXT PRIMARY KEY,
  gym_id    TEXT NOT NULL REFERENCES gyms(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  key       TEXT NOT NULL,
  amount    INTEGER NOT NULL,
  reason    TEXT NOT NULL,
  at        TEXT NOT NULL,
  UNIQUE (member_id, key)
);

CREATE TABLE chests (
  id        TEXT PRIMARY KEY,
  gym_id    TEXT NOT NULL REFERENCES gyms(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  earned_at TEXT NOT NULL,
  opened_at TEXT,
  prize     TEXT                              -- JSON, drawn on the server when the chest is opened
);
CREATE INDEX chests_member ON chests(member_id);
