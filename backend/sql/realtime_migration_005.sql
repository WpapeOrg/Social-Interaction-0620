ALTER TABLE notification_tasks
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 5;

UPDATE notification_tasks
SET max_retries = 5
WHERE max_retries < 1;
