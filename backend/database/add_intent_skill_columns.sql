-- 为qa_records表添加intent和skill_used列
ALTER TABLE qa_records 
ADD COLUMN IF NOT EXISTS intent VARCHAR(50),
ADD COLUMN IF NOT EXISTS skill_used VARCHAR(200);

-- 添加注释
COMMENT ON COLUMN qa_records.intent IS '用户意图类型';
COMMENT ON COLUMN qa_records.skill_used IS '使用的Skill名称';
