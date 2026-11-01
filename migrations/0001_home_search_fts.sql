-- Cercis inline-search FTS5 index.
-- Apply this migration to D1 before deploying the Worker code.
-- Source archive tables remain unchanged; this creates a derived search document per post.

CREATE TABLE IF NOT EXISTS home_search_documents (
  post_id INTEGER PRIMARY KEY,
  content TEXT NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE IF NOT EXISTS home_search_fts
USING fts5(
  content,
  content='home_search_documents',
  content_rowid='post_id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS home_search_documents_ai
AFTER INSERT ON home_search_documents
BEGIN
  INSERT INTO home_search_fts(rowid, content)
  VALUES (new.post_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS home_search_documents_ad
AFTER DELETE ON home_search_documents
BEGIN
  INSERT INTO home_search_fts(home_search_fts, rowid, content)
  VALUES ('delete', old.post_id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS home_search_documents_au
AFTER UPDATE OF content ON home_search_documents
BEGIN
  INSERT INTO home_search_fts(home_search_fts, rowid, content)
  VALUES ('delete', old.post_id, old.content);
  INSERT INTO home_search_fts(rowid, content)
  VALUES (new.post_id, new.content);
END;

-- Initial backfill. Persian/Arabic character normalization matches the current
-- inline-search SQL: ي -> ی, ك -> ک, and ZWNJ/tatweel -> space.
INSERT INTO home_search_documents(post_id, content)
SELECT
  p.message_id,
  lower(
    replace(
      replace(
        replace(
          COALESCE(p.title, '') || ' ' ||
          COALESCE((
            SELECT GROUP_CONCAT(k.keyword, ' ')
            FROM home_post_keywords k
            WHERE k.post_id = p.message_id
          ), '') || ' ' ||
          COALESCE(o.overview, ''),
          'ي', 'ی'
        ),
        'ك', 'ک'
      ),
      char(8204), ' '
    ),
    char(1600), ' '
  )
  )
FROM home_archive_posts p
LEFT JOIN home_post_overviews o ON o.post_id = p.message_id
WHERE p.message_id IS NOT NULL
ON CONFLICT(post_id) DO UPDATE SET content = excluded.content;
