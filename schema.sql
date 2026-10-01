CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  post_id INTEGER NOT NULL,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  artist TEXT,
  release_date TEXT,
  lyrics TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  user_id INTEGER PRIMARY KEY,
  step TEXT NOT NULL,
  channel TEXT,
  post_id INTEGER,
  url TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
  ON classification_categories(COALESCE(parent_id, 0), name);

CREATE INDEX IF NOT EXISTS classification_categories_parent_order
  ON classification_categories(parent_id, sort_order, id);

CREATE TABLE IF NOT EXISTS home_post_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS home_post_paths_post
  ON home_post_paths(post_id, sort_order, id);

CREATE TABLE IF NOT EXISTS home_post_path_nodes (
  path_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY(path_id, level),
  UNIQUE(path_id, category_id)
);

CREATE INDEX IF NOT EXISTS home_post_path_nodes_category
  ON home_post_path_nodes(category_id, path_id);

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

CREATE TABLE IF NOT EXISTS user_library_preferences (
  user_id INTEGER PRIMARY KEY,
  sort_mode TEXT NOT NULL DEFAULT 'cercis',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);