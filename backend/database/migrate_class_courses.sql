-- 创建班级-课程关联表（多对多关系）
CREATE TABLE IF NOT EXISTS class_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_class_course UNIQUE (class_id, course_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_class_courses_class_id ON class_courses(class_id);
CREATE INDEX IF NOT EXISTS idx_class_courses_course_id ON class_courses(course_id);

-- 将现有的班级-课程关系迁移到关联表中
-- 注意：这会为每个现有班级添加一条记录到class_courses表
INSERT INTO class_courses (class_id, course_id, created_at)
SELECT id, course_id, created_at 
FROM classes 
WHERE course_id IS NOT NULL 
AND status = 'active'
ON CONFLICT (class_id, course_id) DO NOTHING;

-- 将classes表的course_id改为可空（如果还不是的话）
ALTER TABLE classes ALTER COLUMN course_id DROP NOT NULL;

-- 添加注释
COMMENT ON TABLE class_courses IS '班级-课程关联表，支持一个班级关联多个课程';
COMMENT ON COLUMN class_courses.class_id IS '班级ID';
COMMENT ON COLUMN class_courses.course_id IS '课程ID';
COMMENT ON COLUMN class_courses.created_at IS '创建时间';
