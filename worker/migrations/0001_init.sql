CREATE TABLE accounts (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
  password_hash TEXT, password_salt TEXT,
  google_sub TEXT UNIQUE, email_verified INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL);
CREATE INDEX sessions_account ON sessions(account_id);
CREATE TABLE players (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, id TEXT NOT NULL,
  name TEXT NOT NULL, avatar TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL, PRIMARY KEY (account_id, id));
CREATE TABLE progress (
  account_id TEXT NOT NULL, player_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, player_id),
  FOREIGN KEY (account_id, player_id) REFERENCES players(account_id, id) ON DELETE CASCADE);
CREATE TABLE attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL);
