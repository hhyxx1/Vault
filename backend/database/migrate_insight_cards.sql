-- 教师洞察卡片持久化表
CREATE TABLE IF NOT EXISTS teacher_insight_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'analyzing',  -- analyzing, completed, failed
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_cards_teacher ON teacher_insight_cards(teacher_id);
CREATE INDEX IF NOT EXISTS idx_insight_cards_created ON teacher_insight_cards(created_at DESC);
