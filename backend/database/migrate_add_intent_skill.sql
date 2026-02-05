-- 为 qa_records 表添加缺少的字段
-- 执行命令: psql -U postgres -d your_database -f migrate_add_intent_skill.sql

-- 添加 intent 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS intent VARCHAR(50);

-- 添加 skill_used 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS skill_used VARCHAR(200);

-- 添加 context_used 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS context_used JSONB;

-- 添加 knowledge_sources 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS knowledge_sources JSONB;

-- 添加 confidence_score 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3, 2);

-- 添加 is_helpful 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS is_helpful BOOLEAN;

-- 添加 feedback 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS feedback TEXT;

-- 添加 response_time 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS response_time INTEGER;

-- 添加 tokens_used 字段
ALTER TABLE qa_records ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

-- 为 session_id 创建索引
CREATE INDEX IF NOT EXISTS idx_qa_records_session_id ON qa_records(session_id);

-- 创建 qa_sessions 表（如果不存在）
CREATE TABLE IF NOT EXISTS qa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    title VARCHAR(200),
    course_id UUID,
    message_count INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    last_message_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_qa_sessions_student_id ON qa_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_updated_at ON qa_sessions(updated_at);

-- 创建 qa_shares 表（如果不存在）
CREATE TABLE IF NOT EXISTS qa_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_code VARCHAR(10) UNIQUE NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    student_id UUID NOT NULL,
    title VARCHAR(200),
    messages JSONB NOT NULL,
    view_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qa_shares_share_code ON qa_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_qa_shares_session_id ON qa_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_shares_student_id ON qa_shares(student_id);

SELECT '迁移完成！' as status;
