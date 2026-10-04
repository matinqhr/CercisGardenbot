-- Cercis Classification + Library
-- Production migration
--
-- Dossier tables are intentionally untouched.
-- 1585 is the initial archive snapshot only, not a permanent ceiling.
-- New Home posts are added later by manual sync.
-- Library remains disabled until explicitly enabled by admin.
-- Deleted Home posts are not auto-detected.

CREATE TABLE IF NOT EXISTS home_archive_posts (
  message_id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'Arghavanplaylistt',
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  future_dossier INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classification_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  emoji TEXT,
  emoji_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS classification_categories_sibling_name
ON classification_categories(
  COALESCE(parent_id, 0),
  name
);

CREATE INDEX IF NOT EXISTS classification_categories_parent_order
ON classification_categories(
  parent_id,
  sort_order
);

CREATE TABLE IF NOT EXISTS home_post_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS home_post_paths_post
ON home_post_paths(post_id);

CREATE TABLE IF NOT EXISTS home_post_path_nodes (
  path_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY(path_id, level),
  UNIQUE(path_id, category_id)
);

CREATE INDEX IF NOT EXISTS home_post_path_nodes_category
ON home_post_path_nodes(category_id);

CREATE TABLE IF NOT EXISTS home_post_keywords (
  post_id INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  PRIMARY KEY(post_id, keyword)
);

CREATE TABLE IF NOT EXISTS classification_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  library_enabled INTEGER NOT NULL DEFAULT 0,
  next_message_id INTEGER NOT NULL DEFAULT 1,
  last_message_id INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_library_preferences (
  user_id INTEGER PRIMARY KEY,
  sort_mode TEXT NOT NULL DEFAULT 'cercis',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

WITH RECURSIVE nums(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1
  FROM nums
  WHERE n < 1585
)
INSERT OR IGNORE INTO home_archive_posts (
  message_id,
  channel,
  url,
  status,
  future_dossier
)
SELECT
  n,
  'Arghavanplaylistt',
  'https://t.me/Arghavanplaylistt/' || n,
  'pending',
  0
FROM nums;

INSERT OR IGNORE INTO classification_categories
  (name, parent_id, emoji, emoji_id, sort_order)
VALUES
  ('موسیقی', NULL, '🎵', NULL, 1),
  ('نقل‌قول', NULL, '📖', NULL, 2),
  ('تصویر', NULL, '🖼', NULL, 3),
  ('ویدیو', NULL, '🎬', NULL, 4),
  ('نوشته', NULL, '💭', NULL, 5),
  ('Daily', NULL, '🌅', NULL, 6);

INSERT OR IGNORE INTO classification_settings (
  id,
  enabled,
  library_enabled,
  next_message_id,
  last_message_id
)
VALUES (
  1,
  1,
  0,
  1,
  1585
);
