-- One-time links, stored only as a sha-256 hash of the link's token (like session tokens), so a
-- copy of the database can't be used to take over an account.

-- An owner who has forgotten their password: the admin sends this link and the owner picks a new one.
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  gym_id     TEXT NOT NULL REFERENCES gyms(id),
  expires_at INTEGER NOT NULL,                -- unix seconds
  created_at TEXT NOT NULL
);
CREATE INDEX password_resets_user ON password_resets(user_id);
CREATE INDEX password_resets_gym ON password_resets(gym_id);

-- Creating a platform admin account. Made by `node scripts/admin-link.mjs`, which writes straight to
-- D1, so only someone who can sign in to the Cloudflare account can make one.
CREATE TABLE admin_invites (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,                -- unix seconds
  created_at TEXT NOT NULL
);
