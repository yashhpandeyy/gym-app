-- Logos live in D1 (small, resized by the app before upload) so the stack needs no R2 bucket and no payment card.
CREATE TABLE gym_logos (
  gym_id TEXT PRIMARY KEY REFERENCES gyms(id),
  type   TEXT NOT NULL CHECK (type IN ('image/png', 'image/jpeg', 'image/webp')),
  data   TEXT NOT NULL                          -- base64
);
