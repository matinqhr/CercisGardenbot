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
