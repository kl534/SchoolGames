CREATE TABLE email_tokens (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, expires_at INTEGER NOT NULL);
