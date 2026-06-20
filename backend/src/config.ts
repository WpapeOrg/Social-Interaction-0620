import dotenv from "dotenv";

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  adminApiKey: process.env.ADMIN_API_KEY || "dev_admin_key",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "social_user",
    password: process.env.DB_PASSWORD || "social_pass",
    database: process.env.DB_NAME || "social_interaction"
  },
  push: {
    workerEnabled: String(process.env.PUSH_WORKER_ENABLED || "false").toLowerCase() === "true",
    workerPollIntervalMs: Math.max(Number(process.env.PUSH_WORKER_POLL_INTERVAL_MS || 2000), 500),
    workerBatchSize: Math.min(Math.max(Number(process.env.PUSH_WORKER_BATCH_SIZE || 20), 1), 100),
    maxRetries: Math.min(Math.max(Number(process.env.PUSH_MAX_RETRIES || 5), 1), 12),
    backoffBaseMs: Math.max(Number(process.env.PUSH_BACKOFF_BASE_MS || 5000), 1000),
    backoffMaxMs: Math.max(Number(process.env.PUSH_BACKOFF_MAX_MS || 300000), 10000),
    mockMode: String(process.env.PUSH_MOCK_MODE || "true").toLowerCase() === "true",
    mockFailureRate: Math.min(
      Math.max(Number(process.env.PUSH_MOCK_FAILURE_RATE || 0), 0),
      1
    )
  }
};
