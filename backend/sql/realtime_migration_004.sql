CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id BIGINT PRIMARY KEY,
  push_enabled TINYINT(1) NOT NULL DEFAULT 1,
  message_push_enabled TINYINT(1) NOT NULL DEFAULT 1,
  match_push_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  conversation_id BIGINT NULL,
  message_id BIGINT NULL,
  task_type VARCHAR(32) NOT NULL DEFAULT 'new_message',
  channel VARCHAR(32) NOT NULL DEFAULT 'wx_subscribe',
  title VARCHAR(64) NOT NULL,
  content VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 5,
  error_message VARCHAR(255) NULL,
  scheduled_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_notification_tasks_user_status (user_id, status),
  KEY idx_notification_tasks_created (created_at),
  CONSTRAINT fk_notification_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_tasks_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_tasks_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
);
