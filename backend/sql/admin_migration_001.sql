SET @db = DATABASE();

SET @exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'review_note'
);
SET @sql = IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN review_note VARCHAR(255) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'reviewed_by'
);
SET @sql = IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN reviewed_by VARCHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists = (
  SELECT COUNT(1)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'reviewed_at'
);
SET @sql = IF(@exists = 0, 'ALTER TABLE reports ADD COLUMN reviewed_at TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
