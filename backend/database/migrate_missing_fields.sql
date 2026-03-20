-- 完整迁移脚本：添加所有缺失的数据库字段
-- 执行日期：2026-02-05
-- 说明：此脚本会添加 surveys 和 questions 表中缺失的字段

-- =====================================================
-- 1. surveys 表：添加成绩发布相关字段
-- =====================================================

-- 添加 score_published 字段（成绩是否已发布）
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS score_published BOOLEAN NOT NULL DEFAULT FALSE;

-- 添加 score_published_at 字段（成绩发布时间）
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS score_published_at TIMESTAMP;

-- 为已发布且有成绩的问卷设置默认值
UPDATE surveys s
SET score_published = TRUE,
    score_published_at = published_at
WHERE status = 'published'
AND EXISTS (
    SELECT 1 FROM survey_responses sr 
    WHERE sr.survey_id = s.id 
    AND sr.total_score IS NOT NULL
);

COMMENT ON COLUMN surveys.score_published IS '成绩是否已发布（控制学生能否查看成绩）';
COMMENT ON COLUMN surveys.score_published_at IS '成绩发布时间';

-- =====================================================
-- 2. questions 表：添加问答题专用字段
-- =====================================================

-- 添加 reference_files 字段（参考材料文件URL列表）
ALTER TABLE questions ADD COLUMN IF NOT EXISTS reference_files JSONB;

-- 添加 min_word_count 字段（最小作答字数）
ALTER TABLE questions ADD COLUMN IF NOT EXISTS min_word_count INTEGER;

-- 添加 grading_criteria 字段（评分标准）
ALTER TABLE questions ADD COLUMN IF NOT EXISTS grading_criteria JSONB;

COMMENT ON COLUMN questions.reference_files IS '问答题参考材料文件URL列表（JSON数组）';
COMMENT ON COLUMN questions.min_word_count IS '问答题最小作答字数要求';
COMMENT ON COLUMN questions.grading_criteria IS '问答题评分标准（JSON对象）';

-- =====================================================
-- 3. 验证字段是否添加成功
-- =====================================================

DO $$
DECLARE
    missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- 检查 surveys 表字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'score_published'
    ) THEN
        missing_fields := array_append(missing_fields, 'surveys.score_published');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'score_published_at'
    ) THEN
        missing_fields := array_append(missing_fields, 'surveys.score_published_at');
    END IF;
    
    -- 检查 questions 表字段
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'reference_files'
    ) THEN
        missing_fields := array_append(missing_fields, 'questions.reference_files');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'min_word_count'
    ) THEN
        missing_fields := array_append(missing_fields, 'questions.min_word_count');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'grading_criteria'
    ) THEN
        missing_fields := array_append(missing_fields, 'questions.grading_criteria');
    END IF;
    
    -- 输出结果
    IF array_length(missing_fields, 1) IS NULL THEN
        RAISE NOTICE '✅ 所有字段添加成功！';
        RAISE NOTICE '   - surveys.score_published';
        RAISE NOTICE '   - surveys.score_published_at';
        RAISE NOTICE '   - questions.reference_files';
        RAISE NOTICE '   - questions.min_word_count';
        RAISE NOTICE '   - questions.grading_criteria';
    ELSE
        RAISE WARNING '❌ 以下字段添加失败: %', array_to_string(missing_fields, ', ');
    END IF;
END $$;

-- =====================================================
-- 完成
-- =====================================================
-- 迁移完成后，请重启后端服务以确保 SQLAlchemy 模型与数据库同步
