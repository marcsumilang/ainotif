-- Apply to the database shared by the backend and web before deploying this change.
CREATE TABLE IF NOT EXISTS notification_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_notification text NOT NULL,
  source_package varchar(255),
  timestamp timestamp NOT NULL,
  requires_review boolean NOT NULL DEFAULT false,
  analysis jsonb NOT NULL,
  context jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_analyses_user_review_idx
  ON notification_analyses(user_id, requires_review);
