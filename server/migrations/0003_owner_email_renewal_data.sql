-- Owners sign in with their email. It is an identifier, not proof of ownership: the platform owner
-- checks each gym by hand before activating it.
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX users_owner_email ON users(lower(email)) WHERE role = 'owner' AND email IS NOT NULL;

-- A member's email is optional. Many members don't have one.
ALTER TABLE members ADD COLUMN email TEXT;

-- Sessions renew themselves while people keep using the app. `renewed_at` makes sure that only one
-- of several simultaneous requests swaps the token.
ALTER TABLE sessions ADD COLUMN renewed_at INTEGER;
CREATE INDEX sessions_expiry ON sessions(expires_at);

-- Per-member storage for whatever the app needs to keep: workouts, meals, progress and so on.
-- One JSON document per (member, key). Medicines are not allowed here; they stay on the phone.
CREATE TABLE member_data (
  member_id  TEXT NOT NULL REFERENCES members(id),
  gym_id     TEXT NOT NULL REFERENCES gyms(id),
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (member_id, key)
);
