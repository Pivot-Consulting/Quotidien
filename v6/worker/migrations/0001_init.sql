CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT,created_at TEXT NOT NULL,last_seen_at TEXT);
CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,deleted_at TEXT);
CREATE INDEX IF NOT EXISTS idx_entities_user_updated ON entities(user_id,updated_at);
CREATE TABLE IF NOT EXISTS reminders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,notify_at TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'scheduled');
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status,notify_at);
