-- 知识点和知识图谱系统迁移脚本

-- 1. 修改课程文档表，添加文档类型字段
ALTER TABLE course_documents 
ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'material',  -- 'outline'大纲 或 'material'资料
ADD COLUMN IF NOT EXISTS processing_progress INTEGER DEFAULT 0,  -- 处理进度 0-100
ADD COLUMN IF NOT EXISTS extracted_text TEXT;  -- 提取的文本内容

COMMENT ON COLUMN course_documents.document_type IS '文档类型：outline-课程大纲，material-课程资料';
COMMENT ON COLUMN course_documents.processing_progress IS '文档处理进度：0-100';

-- 2. 创建知识点表
CREATE TABLE IF NOT EXISTS knowledge_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    document_id UUID REFERENCES course_documents(id) ON DELETE SET NULL,
    point_name VARCHAR(500) NOT NULL,  -- 知识点名称
    point_content TEXT,  -- 知识点内容
    point_type VARCHAR(50) DEFAULT 'concept',  -- 类型：concept概念、method方法、example例子、principle原理等
    level INTEGER DEFAULT 1,  -- 层级：1为顶级，2为二级，依次类推
    parent_id UUID REFERENCES knowledge_points(id) ON DELETE SET NULL,  -- 父知识点
    keywords TEXT[],  -- 关键词数组
    difficulty VARCHAR(20) DEFAULT 'medium',  -- 难度：easy、medium、hard
    importance INTEGER DEFAULT 3,  -- 重要程度：1-5
    order_index INTEGER DEFAULT 0,  -- 排序索引
    extra_info JSONB,  -- 额外元数据（重命名避免与SQLAlchemy保留字冲突）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_points_course ON knowledge_points(course_id);
CREATE INDEX idx_knowledge_points_document ON knowledge_points(document_id);
CREATE INDEX idx_knowledge_points_parent ON knowledge_points(parent_id);
CREATE INDEX idx_knowledge_points_type ON knowledge_points(point_type);
CREATE INDEX idx_knowledge_points_level ON knowledge_points(level);

COMMENT ON TABLE knowledge_points IS '知识点表';
COMMENT ON COLUMN knowledge_points.point_name IS '知识点名称';
COMMENT ON COLUMN knowledge_points.level IS '知识点层级，1为顶级';
COMMENT ON COLUMN knowledge_points.importance IS '重要程度1-5，5最重要';

-- 3. 创建知识点关系表（用于构建知识图谱）
CREATE TABLE IF NOT EXISTS knowledge_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    source_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    target_point_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,  -- prerequisite前置、related相关、includes包含、extends扩展等
    relation_strength DECIMAL(3,2) DEFAULT 0.5,  -- 关系强度 0-1
    description TEXT,  -- 关系描述
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_point_id, target_point_id, relation_type)
);

CREATE INDEX idx_knowledge_relations_course ON knowledge_relations(course_id);
CREATE INDEX idx_knowledge_relations_source ON knowledge_relations(source_point_id);
CREATE INDEX idx_knowledge_relations_target ON knowledge_relations(target_point_id);
CREATE INDEX idx_knowledge_relations_type ON knowledge_relations(relation_type);

COMMENT ON TABLE knowledge_relations IS '知识点关系表，用于构建知识图谱';
COMMENT ON COLUMN knowledge_relations.relation_type IS '关系类型：prerequisite-前置知识、related-相关、includes-包含、extends-扩展';
COMMENT ON COLUMN knowledge_relations.relation_strength IS '关系强度0-1，值越大关系越强';

-- 4. 创建文档处理任务表（用于追踪异步处理进度）
CREATE TABLE IF NOT EXISTS document_processing_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES course_documents(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,  -- 'extract'提取、'parse'解析、'knowledge'知识点提取
    status VARCHAR(20) DEFAULT 'pending',  -- pending、processing、completed、failed
    progress INTEGER DEFAULT 0,  -- 0-100
    total_steps INTEGER DEFAULT 1,
    current_step INTEGER DEFAULT 0,
    result_data JSONB,  -- 处理结果数据
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_tasks_document ON document_processing_tasks(document_id);
CREATE INDEX idx_doc_tasks_status ON document_processing_tasks(status);
CREATE INDEX idx_doc_tasks_type ON document_processing_tasks(task_type);

COMMENT ON TABLE document_processing_tasks IS '文档处理任务表，追踪异步处理进度';

-- 5. 创建知识图谱元数据表
CREATE TABLE IF NOT EXISTS knowledge_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
    graph_name VARCHAR(200),
    total_points INTEGER DEFAULT 0,  -- 总知识点数
    total_relations INTEGER DEFAULT 0,  -- 总关系数
    graph_depth INTEGER DEFAULT 0,  -- 图谱深度
    graph_data JSONB,  -- 图谱结构数据（用于前端可视化）
    statistics JSONB,  -- 统计信息
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_graphs_course ON knowledge_graphs(course_id);

COMMENT ON TABLE knowledge_graphs IS '知识图谱元数据表';
COMMENT ON COLUMN knowledge_graphs.graph_data IS '图谱可视化数据，包含节点和边的信息';

-- 6. 创建更新触发器
CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_knowledge_points_updated_at ON knowledge_points;
CREATE TRIGGER update_knowledge_points_updated_at
    BEFORE UPDATE ON knowledge_points
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_updated_at();

DROP TRIGGER IF EXISTS update_doc_tasks_updated_at ON document_processing_tasks;
CREATE TRIGGER update_doc_tasks_updated_at
    BEFORE UPDATE ON document_processing_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_updated_at();

DROP TRIGGER IF EXISTS update_knowledge_graphs_updated_at ON knowledge_graphs;
CREATE TRIGGER update_knowledge_graphs_updated_at
    BEFORE UPDATE ON knowledge_graphs
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_updated_at();

-- 7. 创建更新知识图谱统计的函数
CREATE OR REPLACE FUNCTION update_knowledge_graph_stats(p_course_id UUID)
RETURNS VOID AS $$
DECLARE
    v_point_count INTEGER;
    v_relation_count INTEGER;
    v_max_depth INTEGER;
BEGIN
    -- 统计知识点数量
    SELECT COUNT(*) INTO v_point_count
    FROM knowledge_points
    WHERE course_id = p_course_id;
    
    -- 统计关系数量
    SELECT COUNT(*) INTO v_relation_count
    FROM knowledge_relations
    WHERE course_id = p_course_id;
    
    -- 计算最大深度
    SELECT COALESCE(MAX(level), 0) INTO v_max_depth
    FROM knowledge_points
    WHERE course_id = p_course_id;
    
    -- 更新或插入知识图谱记录
    INSERT INTO knowledge_graphs (course_id, total_points, total_relations, graph_depth, updated_at)
    VALUES (p_course_id, v_point_count, v_relation_count, v_max_depth, CURRENT_TIMESTAMP)
    ON CONFLICT (course_id) 
    DO UPDATE SET
        total_points = v_point_count,
        total_relations = v_relation_count,
        graph_depth = v_max_depth,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_knowledge_graph_stats IS '更新课程知识图谱统计信息';
