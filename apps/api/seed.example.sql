-- Example starter content for a new ChurchKit deployment.
--
-- Every word here is placeholder prose for a fictional church. It exists so
-- a fresh deployment looks like a website rather than an empty shell, and so
-- the pages the navigation links to actually resolve. Replace all of it in
-- the admin panel — it is written to be obviously yours-to-rewrite rather
-- than to be kept.
--
-- A church's identity (name, contact details, service times) does NOT come
-- from here. It comes from brand.json — see `churchkit seed`.
--
--   npx churchkit seed <slug> --example

-- ── Settings this file owns ──────────────────────────────────────────
-- Identity settings are written by `churchkit seed` from brand.json and are
-- deliberately absent here, so loading this never overwrites them.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('featured_event_id', ''),
  ('welcome_email_html', '');

-- ── Pages the site links to ──────────────────────────────────────────
-- Nav and footer link to /about, /privacy and /terms. Without these rows
-- those links 404, which is the first thing anyone notices.
INSERT OR IGNORE INTO pages (slug, title, sub_title, subtext, content_html, is_ministry, sort_order, status) VALUES
  ('about', 'About Us', 'Who We Are', 'A little about our church and what matters to us.',
   '<h2>Our Story</h2>
    <p>Write your church''s story here — when it began, what shaped it, and what it is like to walk through the doors on a Sunday. A few honest paragraphs do more than a page of description.</p>
    <h2>What We Believe</h2>
    <p>Set out your convictions in your own words. ChurchKit deliberately ships none: a statement of faith belongs to the congregation that holds it, and no default could be right for every church using this.</p>
    <h2>Our Mission</h2>
    <p>Say what your church exists to do, plainly enough that a visitor could repeat it.</p>',
   0, 0, 'published'),

  ('privacy', 'Privacy Policy', 'How we handle your information', 'What we collect, why, and what we do with it.',
   '<p><strong>This is placeholder text and is not legal advice.</strong> Replace it with a policy that reflects what your church actually does, and have someone qualified review it.</p>
    <h2>What we collect</h2>
    <p>Describe the information people give you through this site — connect cards, prayer requests, contact forms — and anything collected automatically.</p>
    <h2>How we use it</h2>
    <p>Explain who sees a submission, how it is stored, and how long you keep it. If it is filed into Planning Center, say so.</p>
    <h2>Getting in touch</h2>
    <p>Tell people how to ask what you hold about them, or to ask you to delete it.</p>',
   0, 0, 'published'),

  ('terms', 'Terms of Use', 'Using this site', 'The terms that apply to this website.',
   '<p><strong>This is placeholder text and is not legal advice.</strong> Replace it with terms that suit your church, and have someone qualified review it.</p>
    <h2>Using this site</h2>
    <p>Set out what visitors may and may not do here.</p>
    <h2>Content</h2>
    <p>Say who owns the words and images on this site, and how others may use them.</p>',
   0, 0, 'published'),

  ('give', 'Give', 'Generosity', 'Supporting the work of our church.',
   '<p>Explain what giving supports, and the ways people can give. If you have an online giving link, it appears above this text automatically.</p>
    <p>Mention in-person and postal giving here if you accept them, with the address to use.</p>',
   0, 0, 'published'),

  ('im-new', 'I''m New', 'Planning your first visit', 'What to expect when you visit for the first time.',
   '<h2>Come as you are</h2>
    <p>Tell a first-time visitor what to wear, where to park, and how long a service runs. The specifics are what settle nerves.</p>
    <h2>Your children</h2>
    <p>Describe what happens with children during the service, and how check-in works when they arrive.</p>
    <h2>What a service is like</h2>
    <p>Describe the shape of a service in your own words — the music, the preaching, whether communion is taken and how often.</p>',
   0, 0, 'published');

-- ── Ministries ───────────────────────────────────────────────────────
-- Pages with is_ministry = 1 appear on /ministries and in the site menu.
-- Add, remove and reorder them in the admin panel; nothing about this set
-- is fixed in code.
INSERT OR IGNORE INTO pages (slug, title, sub_title, subtext, content_html, is_ministry, sort_order, status) VALUES
  ('kids', 'Kids', 'Ministry for Children', 'A place where every child is known and loved.',
   '<p>Describe your children''s ministry — the ages it serves, what a morning looks like, and who leads it.</p>
    <p>Parents most want to know two things: that their child will be safe, and that someone will be glad to see them. Answer both here.</p>',
   1, 1, 'published'),

  ('youth', 'Youth', 'Student Ministry', 'Students are the church right now, not just the church to come.',
   '<p>Describe what your student ministry does, when it meets, and what a new student walking in on their own would find.</p>',
   1, 2, 'published'),

  ('adults', 'Adults', 'Groups and Classes', 'Community for every stage of life.',
   '<p>Describe the groups, studies and classes adults can join, and how someone finds the right one.</p>',
   1, 3, 'published');

-- ── Homepage carousel ────────────────────────────────────────────────
-- Slides render with no image until one is uploaded in the admin panel;
-- headline and text carry them in the meantime.
INSERT OR IGNORE INTO carousel_slides (headline, subtext, button_label, button_link, sort_order, active) VALUES
  ('A Place to Belong', 'Join us this Sunday. Come as you are — we would love to meet you.', 'Plan Your Visit', '/im-new', 0, 1),
  ('New Here?', 'Everything a first-time visitor wants to know, in one place.', 'What to Expect', '/im-new', 1, 1),
  ('Find Your People', 'Groups, studies and classes for every stage of life.', 'See Ministries', '/ministries', 2, 1);

-- ── Staff ────────────────────────────────────────────────────────────
-- Fictional placeholders so the leadership page renders. Replace them; a
-- page listing people who do not exist is worse than an empty one.
INSERT OR IGNORE INTO staff (name, title, email, sort_order, active) VALUES
  ('A. Placeholder', 'Senior Pastor', 'pastor@example.org', 1, 1),
  ('B. Placeholder', 'Children''s Ministry Director', 'kids@example.org', 2, 1),
  ('C. Placeholder', 'Church Administrator', 'office@example.org', 3, 1);
