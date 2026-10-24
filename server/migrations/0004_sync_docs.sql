-- Everything the app stores now lives as documents in one table that every device syncs with.
-- The earlier purpose-built tables (slots, bookings, check-ins, XP, chests, member data) are replaced.
DROP TABLE IF EXISTS member_data;
DROP TABLE IF EXISTS chests;
DROP TABLE IF EXISTS xp_events;
DROP TABLE IF EXISTS checkins;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS slots;

-- `members` keeps only identity. The full member record (plan, dates, dues...) is a document.
ALTER TABLE members DROP COLUMN plan_name;
ALTER TABLE members DROP COLUMN start_date;
ALTER TABLE members DROP COLUMN end_date;
ALTER TABLE members ADD COLUMN code TEXT;

CREATE TABLE docs (
  gym_id    TEXT NOT NULL REFERENCES gyms(id),
  kind      TEXT NOT NULL,
  id        TEXT NOT NULL,
  member_id TEXT,                              -- whose document it is, for per-member access rules
  data      TEXT NOT NULL,                     -- JSON
  seq       INTEGER NOT NULL,                  -- position in the gym's change log; devices ask for "everything after N"
  deleted   INTEGER NOT NULL DEFAULT 0,        -- deletions stay as tombstones so other devices hear about them
  k1        TEXT,                              -- lookup key (bookings: which session on which day)
  k2        TEXT,                              -- lookup key (bookings: status)
  at        TEXT,                              -- date or timestamp, used to limit how far back other members' data goes
  PRIMARY KEY (gym_id, kind, id)
);
CREATE INDEX docs_seq ON docs(gym_id, seq);
CREATE INDEX docs_member ON docs(gym_id, member_id, seq);
CREATE INDEX docs_lookup ON docs(gym_id, kind, k1, k2);

-- One counter row per gym: the change-log position, and the running number behind member IDs like FK-1001.
CREATE TABLE gym_seq (
  gym_id    TEXT PRIMARY KEY REFERENCES gyms(id),
  seq       INTEGER NOT NULL DEFAULT 0,
  member_no INTEGER NOT NULL DEFAULT 1000
);
INSERT INTO gym_seq (gym_id) SELECT id FROM gyms;

-- Platform administrators: you, signing in with your own email to create gyms on the spot.
CREATE TABLE admins (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  secret     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
