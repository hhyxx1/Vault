-- 添加智能问答功能的数据库表
-- 执行此脚本前请备份数据库

-- =====================================================
-- 问答记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    question TEXT NOT NULL,
    answer TEXT,
    answer_type VARCHAR(50) DEFAULT 'ai',
    context_used JSONB,
    knowledge_sources JSONB,
    confidence_score DECIMAL(3, 2),
    is_helpful BOOLEAN,
    feedback TEXT,
    response_time INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_qa_records_student ON qa_records(student_id);
CREATE INDEX idx_qa_records_course ON qa_records(course_id);
CREATE INDEX idx_qa_records_session ON qa_records(session_id);
CREATE INDEX idx_qa_records_created ON qa_records(created_at);

-- 添加更新时间触发器
CREATE TRIGGER update_qa_records_updated_at 
BEFORE UPDATE ON qa_records 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 问答会话表
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP
);

CREATE INDEX idx_qa_sessions_student ON qa_sessions(student_id);
CREATE INDEX idx_qa_sessions_course ON qa_sessions(course_id);
CREATE INDEX idx_qa_sessions_updated ON qa_sessions(updated_at);

CREATE TRIGGER update_qa_sessions_updated_at 
BEFORE UPDATE ON qa_sessions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 提示信息
SELECT 'QA表创建完成' AS message;
