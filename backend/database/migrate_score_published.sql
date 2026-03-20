-- 迁移脚本：为 surveys 表添加成绩发布相关字段
-- 执行此脚本前请备份数据库

-- 添加 score_published 字段（成绩是否已发布）
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS score_published BOOLEAN NOT NULL DEFAULT FALSE;

-- 添加 score_published_at 字段（成绩发布时间）
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS score_published_at TIMESTAMP;

-- 为旧数据设置默认值：如果问卷已发布且有学生提交答卷，则视为成绩已发布
UPDATE surveys s
SET score_published = TRUE,
    score_published_at = published_at
WHERE status = 'published'
AND EXISTS (
    SELECT 1 FROM survey_responses sr 
    WHERE sr.survey_id = s.id 
    AND sr.total_score IS NOT NULL
);

-- 提示
-- 执行完成后，教师需要在问卷统计页面手动发布成绩，学生才能看到自己的成绩
