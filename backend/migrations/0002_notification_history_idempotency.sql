-- Apply after 0001_notification_analyses.sql in the shared Neon database.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source_event_id varchar(255);
ALTER TABLE suspicious_alerts
  ADD COLUMN IF NOT EXISTS source_event_id varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_source_event_idx
  ON transactions(user_id, source_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS alerts_user_source_event_idx
  ON suspicious_alerts(user_id, source_event_id);

ALTER TABLE notification_analyses
  ADD COLUMN IF NOT EXISTS source_event_id varchar(255),
  ADD COLUMN IF NOT EXISTS saved_record_id varchar(255),
  ADD COLUMN IF NOT EXISTS saved_record_type varchar(20);

CREATE UNIQUE INDEX IF NOT EXISTS notification_analyses_user_source_event_idx
  ON notification_analyses(user_id, source_event_id);
CREATE INDEX IF NOT EXISTS notification_analyses_user_created_idx
  ON notification_analyses(user_id, created_at DESC, id DESC);
