CREATE TABLE IF NOT EXISTS notification_callback_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id VARCHAR(64) NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  event_status VARCHAR(64) NULL,
  from_user_openid VARCHAR(64) NULL,
  msg_id VARCHAR(64) NULL,
  payload_xml TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_callback_event_type (event_type),
  KEY idx_notification_callback_msg_id (msg_id)
);
