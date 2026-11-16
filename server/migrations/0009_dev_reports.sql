-- Bug reports submitted from the app to the developer.
CREATE TABLE dev_reports (
  id         TEXT PRIMARY KEY,
  gym_id     TEXT REFERENCES gyms(id),
  gym_code   TEXT,
  gym_name   TEXT,
  kind       TEXT NOT NULL,   -- 'crash' | 'wrong_data' | 'ui_issue' | 'feature' | 'other'
  message    TEXT NOT NULL,
  platform   TEXT,            -- 'ios' | 'android' | 'web'
  app_ver    TEXT,
  created_at TEXT NOT NULL
);
