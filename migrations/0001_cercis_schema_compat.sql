-- Cercis Garden D1 schema compatibility migration
-- Non-destructive: the production database already contains these tables.
-- This migration only adds the two missing pickled_tracks columns required by
-- the current pickle-master.js implementation.

ALTER TABLE pickled_tracks ADD COLUMN content_type TEXT;
ALTER TABLE pickled_tracks ADD COLUMN details TEXT;
