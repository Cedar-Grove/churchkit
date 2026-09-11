-- Example seed content for a new ChurchKit deployment.
--
-- Every value here is fictional. Replace it with your own, or let the
-- provisioning tool generate this from your brand.json.
--
--   wrangler d1 execute <your-db> --remote --file=seed.example.sql

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('church_name', 'Example Community Church'),
  ('tagline', 'A Place to Belong'),
  ('phone', '(555) 010-0100'),
  ('email', 'hello@example.org'),
  ('address', '100 Example Road, Springfield, IL 62701'),
  ('featured_event_id', ''),
  -- Your Church Center subdomain, with no trailing slash. Leave empty if
  -- you do not use Church Center; calendar events then carry no link.
  ('church_center_url', ''),
  ('giving_url', ''),
  ('service_times', '{"sunday":["9:00 AM — Bible Study","10:30 AM — Worship Service"],"wednesday":["6:30 PM — Midweek Gathering"]}');

-- Ministries are pages with is_ministry = 1. Add, remove and reorder them
-- in the admin panel; nothing about this set is fixed in code.
INSERT OR IGNORE INTO pages (slug, title, sub_title, subtext, content_html, is_ministry, sort_order, status) VALUES
  ('kids',   'Kids',   'Ministry for Children', 'A place where every child is known and loved.', '<p>Tell families about your children''s ministry here.</p>', 1, 1, 'published'),
  ('youth',  'Youth',  'Student Ministry',      'Students are the church right now.',            '<p>Tell families about your student ministry here.</p>', 1, 2, 'published'),
  ('adults', 'Adults', 'Groups and Classes',    'Community for every stage of life.',            '<p>Describe your adult groups and classes here.</p>', 1, 3, 'published');

INSERT OR IGNORE INTO carousel_slides (headline, subtext, button_label, button_link, sort_order, active) VALUES
  ('A Place to Belong', 'Join us this Sunday at 10:30 AM.', 'Plan Your Visit', '/im-new', 0, 1);
