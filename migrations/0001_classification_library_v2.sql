-- Cercis classification/library v2
-- Safe migration from the current one-path classifier to multi-path library paths.

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

CREATE TABLE IF NOT EXISTS home_post_classification (
  post_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY(post_id, level),
  UNIQUE(post_id, category_id)
);

CREATE TABLE IF NOT EXISTS home_post_keywords (
  post_id INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  PRIMARY KEY(post_id, keyword)
);

CREATE TABLE IF NOT EXISTS classification_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  enabled INTEGER NOT NULL DEFAULT 1,
  library_enabled INTEGER NOT NULL DEFAULT 0,
  next_message_id INTEGER NOT NULL DEFAULT 1,
  last_message_id INTEGER NOT NULL DEFAULT 0
);

-- Rebuild the category table so duplicate names are allowed under different parents
-- while sibling names remain unique.
CREATE TABLE classification_categories_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  emoji TEXT,
  emoji_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO classification_categories_v2
  (id, name, parent_id, emoji, emoji_id, sort_order)
SELECT
  id, name, parent_id, emoji, emoji_id, sort_order
FROM classification_categories;

DROP TABLE classification_categories;
ALTER TABLE classification_categories_v2 RENAME TO classification_categories;

CREATE UNIQUE INDEX classification_categories_sibling_name
  ON classification_categories(COALESCE(parent_id, 0), name);

CREATE INDEX classification_categories_parent_order
  ON classification_categories(parent_id, sort_order, id);

-- One Home post may now own any number of independent library paths.
-- Ensure every legacy classification has an archive record so migrated library paths remain publicly addressable.
INSERT OR IGNORE INTO home_archive_posts
  (message_id, channel, url, status, future_dossier, updated_at)
SELECT DISTINCT
  pc.post_id,
  'Arghavanplaylistt',
  'https://t.me/Arghavanplaylistt/' || pc.post_id,
  'pending',
  0,
  CURRENT_TIMESTAMP
FROM home_post_classification pc;

-- The current bot stores conversational drafts in sessions; keep the migration schema aligned with it.
ALTER TABLE sessions ADD COLUMN draft TEXT;

CREATE TABLE IF NOT EXISTS home_post_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX home_post_paths_post
  ON home_post_paths(post_id, sort_order, id);

CREATE TABLE IF NOT EXISTS home_post_path_nodes (
  path_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY(path_id, level),
  UNIQUE(path_id, category_id)
);

CREATE INDEX home_post_path_nodes_category
  ON home_post_path_nodes(category_id, path_id);

-- Migrate every existing one-path classification into path #1 for that post.
INSERT INTO home_post_paths (post_id, sort_order)
SELECT DISTINCT pc.post_id, 1
FROM home_post_classification pc
WHERE NOT EXISTS (
  SELECT 1
  FROM home_post_paths p
  WHERE p.post_id = pc.post_id
);

INSERT INTO home_post_path_nodes (path_id, level, category_id)
SELECT
  p.id,
  pc.level,
  pc.category_id
FROM home_post_classification pc
JOIN home_post_paths p
  ON p.post_id = pc.post_id
 AND p.sort_order = 1
WHERE NOT EXISTS (
  SELECT 1
  FROM home_post_path_nodes n
  WHERE n.path_id = p.id
    AND n.level = pc.level
);

-- Remove any empty draft paths that may have been created by an interrupted path-creation flow.
DELETE FROM home_post_paths
WHERE id NOT IN (
  SELECT DISTINCT path_id
  FROM home_post_path_nodes
);

-- Classification is derived from library paths now; status only tracks pending/deleted.
UPDATE home_archive_posts
SET status = 'pending'
WHERE status <> 'deleted';

CREATE TABLE IF NOT EXISTS user_library_preferences (
  user_id INTEGER PRIMARY KEY,
  sort_mode TEXT NOT NULL DEFAULT 'cercis',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- The legacy table is intentionally retained for this development migration.
-- It can be dropped later after the new engine has been deployed and verified.
