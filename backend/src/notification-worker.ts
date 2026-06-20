import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { config } from "./config";
import { pool } from "./db";

type NotificationTaskRow = RowDataPacket & {
  id: number;
  user_id: number;
  conversation_id: number | null;
  message_id: number | null;
  task_type: string;
  channel: string;
  title: string;
  content: string;
  retry_count: number;
  max_retries: number;
};

type NotificationTask = {
  id: number;
  userId: number;
  conversationId: number | null;
  messageId: number | null;
  taskType: string;
  channel: string;
  title: string;
  content: string;
  retryCount: number;
  maxRetries: number;
};

class PermanentDeliveryError extends Error {}

function mapTaskRow(row: NotificationTaskRow): NotificationTask {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    conversationId: row.conversation_id === null ? null : Number(row.conversation_id),
    messageId: row.message_id === null ? null : Number(row.message_id),
    taskType: String(row.task_type),
    channel: String(row.channel),
    title: String(row.title || ""),
    content: String(row.content || ""),
    retryCount: Number(row.retry_count || 0),
    maxRetries: Math.max(Number(row.max_retries || config.push.maxRetries), 1)
  };
}

async function claimPendingTasks(limit: number): Promise<NotificationTask[]> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<NotificationTaskRow[]>(
      `SELECT id, user_id, conversation_id, message_id, task_type, channel, title, content, retry_count, max_retries
       FROM notification_tasks
       WHERE status = 'pending'
         AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
       ORDER BY id ASC
       LIMIT ?
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );

    const taskIds = rows.map((row) => Number(row.id)).filter((id) => id > 0);
    if (taskIds.length > 0) {
      await markTasksProcessing(connection, taskIds);
    }

    await connection.commit();
    return rows.map(mapTaskRow);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function markTasksProcessing(connection: PoolConnection, taskIds: number[]): Promise<void> {
  const placeholders = taskIds.map(() => "?").join(", ");
  await connection.query(
    `UPDATE notification_tasks
     SET status = 'processing', updated_at = CURRENT_TIMESTAMP
     WHERE id IN (${placeholders})`,
    taskIds
  );
}

async function deliverTask(task: NotificationTask): Promise<void> {
  if (task.channel !== "wx_subscribe") {
    throw new PermanentDeliveryError(`unsupported channel: ${task.channel}`);
  }
  if (!config.push.mockMode) {
    throw new PermanentDeliveryError("wx subscribe delivery adapter is not configured");
  }
  if (task.content.includes("[dead]")) {
    throw new PermanentDeliveryError("dead-letter test marker");
  }
  if (task.content.includes("[retry]")) {
    throw new Error("transient retry test marker");
  }
  if (Math.random() < config.push.mockFailureRate) {
    throw new Error("transient mock network error");
  }
}

function calcNextRetryDelayMs(nextRetryCount: number): number {
  const delay = config.push.backoffBaseMs * Math.pow(2, Math.max(nextRetryCount - 1, 0));
  return Math.min(delay, config.push.backoffMaxMs);
}

async function handleTaskSuccess(taskId: number): Promise<void> {
  await pool.query(
    `UPDATE notification_tasks
     SET status = 'sent',
         sent_at = CURRENT_TIMESTAMP,
         error_message = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [taskId]
  );
}

async function handleTaskFailure(task: NotificationTask, error: unknown): Promise<void> {
  const errorText = error instanceof Error ? error.message : "unknown error";
  const isPermanent = error instanceof PermanentDeliveryError;
  const nextRetryCount = task.retryCount + 1;
  const exceededRetries = nextRetryCount >= task.maxRetries;

  if (isPermanent || exceededRetries) {
    await pool.query(
      `UPDATE notification_tasks
       SET status = 'dead',
           retry_count = ?,
           error_message = ?,
           scheduled_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextRetryCount, errorText, task.id]
    );
    return;
  }

  const delayMs = calcNextRetryDelayMs(nextRetryCount);
  const nextScheduledAt = new Date(Date.now() + delayMs);
  await pool.query(
    `UPDATE notification_tasks
     SET status = 'pending',
         retry_count = ?,
         error_message = ?,
         scheduled_at = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextRetryCount, errorText, nextScheduledAt, task.id]
  );
}

async function processTask(task: NotificationTask): Promise<void> {
  try {
    await deliverTask(task);
    await handleTaskSuccess(task.id);
  } catch (error) {
    await handleTaskFailure(task, error);
  }
}

let workerTimer: NodeJS.Timeout | null = null;
let working = false;

export async function runNotificationWorkerOnce(): Promise<void> {
  const tasks = await claimPendingTasks(config.push.workerBatchSize);
  for (const task of tasks) {
    await processTask(task);
  }
}

export function startNotificationWorker(): void {
  if (workerTimer) return;
  const intervalMs = config.push.workerPollIntervalMs;
  const runSafely = async () => {
    if (working) return;
    working = true;
    try {
      await runNotificationWorkerOnce();
    } catch (error) {
      console.error("[notification-worker] run failed", error);
    } finally {
      working = false;
    }
  };

  workerTimer = setInterval(() => {
    void runSafely();
  }, intervalMs);
  void runSafely();
  console.log(
    `[notification-worker] started: poll=${intervalMs}ms, batch=${config.push.workerBatchSize}, maxRetries=${config.push.maxRetries}`
  );
}

export function stopNotificationWorker(): void {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
  console.log("[notification-worker] stopped");
}
