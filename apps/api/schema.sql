-- ChurchKit — initial schema.
--
-- Apply with:
--   wrangler d1 execute <your-db> --remote --file=schema.sql
--
-- Contains no church-specific data. Seed content for a new deployment comes
-- from seed.example.sql, or from the brand file via the provisioning tool.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS pages (
  slug TEXT PRIMARY KEY,
  title TEXT,
  sub_title TEXT,
  subtext TEXT,
  content_html TEXT,
  image_url TEXT,
  image_focal_x REAL,
  image_focal_y REAL,
  gallery_image_1 TEXT,
  gallery_image_2 TEXT,
  gallery_image_3 TEXT,
  -- Ministries are just pages that opt in, so a church defines its own set
  -- in the admin panel instead of the list being fixed in code.
  is_ministry INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published',
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_pages_ministry ON pages(is_ministry, status, sort_order);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  photo_url TEXT,
  bio TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS carousel_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT,
  headline TEXT,
  subtext TEXT,
  button_label TEXT,
  button_link TEXT,
  starts_at TEXT,
  ends_at TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sermon_notes (
  pco_plan_id TEXT PRIMARY KEY,
  html TEXT,
  published INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_type TEXT,
  data TEXT,
  pco_person_id TEXT,
  submitted_at INTEGER DEFAULT (unixepoch()),
  emailed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS push_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  body TEXT,
  audience TEXT,
  deep_link TEXT,
  status TEXT DEFAULT 'draft',
  sent_at INTEGER,
  open_rate REAL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onesignal_player_id TEXT UNIQUE NOT NULL,
  platform TEXT,                          -- 'ios' | 'android'
  pco_person_id TEXT,                     -- linked person, optional
  created_at INTEGER DEFAULT (unixepoch()),
  last_seen_at INTEGER DEFAULT (unixepoch())
);

-- Shared cache for expensive or quota-limited upstream JSON, in D1 rather
-- than per-edge so one row serves every visitor from every location.
CREATE TABLE IF NOT EXISTS api_cache (
  cache_key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Hard-caps quota-limited upstream calls at a fixed count per day, shared
-- across every user and every edge location.
CREATE TABLE IF NOT EXISTS api_call_budget (
  budget_key TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (budget_key, day)
);

-- Per-IP and global counters for the public form endpoints, in D1 rather
-- than per-isolate memory so a limit holds across every edge.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
