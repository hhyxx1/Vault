-- 添加对话分享功能的数据库表
-- 执行此脚本前请确保 qa_records 和 qa_sessions 表已存在

-- =====================================================
-- 对话分享表
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_code VARCHAR(10) UNIQUE NOT NULL,  -- 6位分享码
    session_id VARCHAR(100) NOT NULL,        -- 关联的会话ID
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),                       -- 分享标题
    messages JSONB NOT NULL,                  -- 对话消息内容
    view_count INTEGER DEFAULT 0,             -- 查看次数
    is_active BOOLEAN DEFAULT TRUE,           -- 是否有效
    expires_at TIMESTAMP,                     -- 过期时间（可选）
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_qa_shares_code ON qa_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_qa_shares_student ON qa_shares(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_shares_session ON qa_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_shares_created ON qa_shares(created_at);

-- 添加更新时间触发器（如果 update_updated_at_column 函数存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_qa_shares_updated_at 
        BEFORE UPDATE ON qa_shares 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 提示信息
SELECT '对话分享表创建完成' AS message;
