CREATE TABLE IF NOT EXISTS scribbles (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ip_hash text NOT NULL,
  idempotency_hash text UNIQUE,
  payload_hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS scribbles_recent_idx ON scribbles (created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS write_limits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start, window_seconds)
);
