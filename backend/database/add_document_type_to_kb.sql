-- 向 knowledge_base 表添加 document_type 字段
-- 用于区分大纲和资料文档

-- 添加 document_type 字段
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'material';

-- 添加注释
COMMENT ON COLUMN knowledge_base.document_type IS '文档类型：outline(大纲) 或 material(资料)';

-- 从 course_documents 表同步已有数据的 document_type
UPDATE knowledge_base kb
SET document_type = cd.document_type
FROM course_documents cd
WHERE kb.document_id = cd.id;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_kb_document_type ON knowledge_base(document_type);
CREATE INDEX IF NOT EXISTS idx_kb_course_doc_type ON knowledge_base(course_id, document_type);

-- 验证更新结果
SELECT 
    document_type,
    COUNT(*) as count
FROM knowledge_base
GROUP BY document_type
ORDER BY document_type;
