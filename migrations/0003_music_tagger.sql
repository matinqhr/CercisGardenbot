-- Standalone music metadata editor. This does not alter archive/search tables.
CREATE TABLE IF NOT EXISTS music_tagger_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS music_tagger_sessions (
  user_id INTEGER PRIMARY KEY,
  step TEXT NOT NULL,
  audio_file_id TEXT,
  audio_file_name TEXT,
  audio_mime_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS music_tagger_sessions_step_updated
ON music_tagger_sessions(step, updated_at);
