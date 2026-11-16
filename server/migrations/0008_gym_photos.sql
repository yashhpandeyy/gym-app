-- Gym ambiance photos stored just like logos — base64 in D1, no R2 needed.
-- Up to 8 photos per gym, indexed 0–7. Owners upload from the setup screen.
CREATE TABLE gym_photos (
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  idx    INTEGER NOT NULL,
  type   TEXT NOT NULL CHECK (type IN ('image/png', 'image/jpeg', 'image/webp')),
  data   TEXT NOT NULL,          -- base64
  PRIMARY KEY (gym_id, idx)
);

ALTER TABLE gyms ADD COLUMN photos_key TEXT;
