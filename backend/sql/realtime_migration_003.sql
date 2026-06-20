CREATE TABLE IF NOT EXISTS message_deliveries (
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  last_delivered_message_id BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT fk_message_deliveries_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_deliveries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
