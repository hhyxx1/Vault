-- 问卷发布类型与目标班级迁移（已有数据库执行此脚本）
-- 为 surveys 表增加 release_type、target_class_ids 列

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS release_type VARCHAR(30) NOT NULL DEFAULT 'in_class';
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS target_class_ids JSONB;

CREATE INDEX IF NOT EXISTS idx_surveys_release_type ON surveys(release_type);

COMMENT ON COLUMN surveys.release_type IS '发布类型: in_class=课堂检测, homework=课后作业, practice=自主练习';
COMMENT ON COLUMN surveys.target_class_ids IS '发布目标班级ID列表(JSON数组)';
