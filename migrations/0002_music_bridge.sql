-- Temporary bridge used by the admin-only music-recognition integration test.
CREATE TABLE IF NOT EXISTS music_bridge_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  private_chat_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  source_message_id INTEGER,
  bridge_message_id INTEGER,
  audio_message_id INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS music_bridge_one_active_group
ON music_bridge_requests(group_id)
WHERE status IN ('awaiting_video','sending_video','waiting_audio','delivering');

CREATE INDEX IF NOT EXISTS music_bridge_user_status
ON music_bridge_requests(user_id,status,created_at);
