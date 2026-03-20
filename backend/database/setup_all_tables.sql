-- =====================================================
-- 智能教学平台 - 完整数据库初始化脚本
-- 合并 init.sql + full_export.sql 中的所有23张表
-- 按正确依赖顺序创建，跳过无效占位INSERT数据
-- =====================================================

-- 启用所需扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 第一层: 无外键依赖的基础表
-- =====================================================

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    full_name VARCHAR(100),
    avatar_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 第二层: 仅依赖 users 的表
-- =====================================================

-- 2. students
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_number VARCHAR(50) UNIQUE NOT NULL,
    major VARCHAR(100),
    grade VARCHAR(20),
    class_name VARCHAR(50),
    total_questions INTEGER NOT NULL DEFAULT 0,
    total_scores DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_students_number ON students(student_number);
CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_grade_class ON students(grade, class_name);

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. teachers
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_number VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100),
    title VARCHAR(50),
    courses JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_teachers_number ON teachers(teacher_number);
CREATE INDEX IF NOT EXISTS idx_teachers_user ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_department ON teachers(department);

DROP TRIGGER IF EXISTS update_teachers_updated_at ON teachers;
CREATE TRIGGER update_teachers_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. courses
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_code VARCHAR(50) UNIQUE NOT NULL,
    course_name VARCHAR(200) NOT NULL,
    description TEXT,
    teacher_id UUID NOT NULL REFERENCES users(id),
    semester VARCHAR(50),
    credit DECIMAL(3, 1),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'survey' NOT NULL,
    related_id UUID,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    PRIMARY KEY (id),
    CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- =====================================================
-- 第三层: 依赖 courses 的表
-- =====================================================

-- 6. classes
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name VARCHAR(100) NOT NULL,
    course_id UUID NOT NULL REFERENCES courses(id),
    teacher_id UUID NOT NULL REFERENCES users(id),
    max_students INTEGER DEFAULT 100,
    academic_year VARCHAR(20),
    invite_code VARCHAR(20) UNIQUE,
    allow_self_enroll BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_classes_course ON classes(course_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_invite_code ON classes(invite_code);

DROP TRIGGER IF EXISTS update_classes_updated_at ON classes;
CREATE TRIGGER update_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 7. class_students
CREATE TABLE IF NOT EXISTS class_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id),
    student_id UUID NOT NULL REFERENCES users(id),
    enrollment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    UNIQUE(class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON class_students(student_id);

-- 8. class_courses
CREATE TABLE IF NOT EXISTS class_courses (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    class_id UUID NOT NULL,
    course_id UUID NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT class_courses_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id),
    CONSTRAINT class_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_class_courses_class_id ON class_courses(class_id);
CREATE INDEX IF NOT EXISTS idx_class_courses_course_id ON class_courses(course_id);

-- 9. course_documents
CREATE TABLE IF NOT EXISTS course_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id),
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    upload_status VARCHAR(20) NOT NULL DEFAULT 'processing',
    processed_status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_course_docs_course ON course_documents(course_id);
CREATE INDEX IF NOT EXISTS idx_course_docs_teacher ON course_documents(teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_docs_status ON course_documents(upload_status);

DROP TRIGGER IF EXISTS update_course_documents_updated_at ON course_documents;
CREATE TRIGGER update_course_documents_updated_at
BEFORE UPDATE ON course_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 10. qa_sessions
CREATE TABLE IF NOT EXISTS qa_sessions (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    student_id UUID NOT NULL,
    title VARCHAR(200),
    course_id UUID,
    message_count INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_message_at TIMESTAMP WITHOUT TIME ZONE,
    PRIMARY KEY (id),
    CONSTRAINT qa_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id),
    CONSTRAINT qa_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_student ON qa_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_course ON qa_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_active ON qa_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_qa_sessions_updated ON qa_sessions(updated_at);

-- =====================================================
-- 第四层: 依赖 course_documents / qa_sessions 的表
-- =====================================================

-- 11. knowledge_base (含 document_type 列)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    document_id UUID NOT NULL,
    course_id UUID NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_metadata JSONB,
    embedding_vector TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    document_type VARCHAR(50) DEFAULT 'material',
    PRIMARY KEY (id),
    CONSTRAINT knowledge_base_document_id_fkey FOREIGN KEY (document_id) REFERENCES course_documents(id),
    CONSTRAINT knowledge_base_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_course ON knowledge_base(course_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_document ON knowledge_base(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_course_doc_type ON knowledge_base(course_id, document_type);
CREATE INDEX IF NOT EXISTS idx_kb_document_type ON knowledge_base(document_type);

-- 12. document_processing_tasks
CREATE TABLE IF NOT EXISTS document_processing_tasks (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    document_id UUID NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 1,
    current_step INTEGER DEFAULT 0,
    result_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT document_processing_tasks_document_id_fkey FOREIGN KEY (document_id) REFERENCES course_documents(id)
);
CREATE INDEX IF NOT EXISTS idx_doc_tasks_document ON document_processing_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_tasks_status ON document_processing_tasks(status);
CREATE INDEX IF NOT EXISTS idx_doc_tasks_type ON document_processing_tasks(task_type);

-- 13. qa_documents
CREATE TABLE IF NOT EXISTS qa_documents (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    student_id UUID NOT NULL,
    session_id UUID,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    processed_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    chunk_count INTEGER DEFAULT 0 NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT qa_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id),
    CONSTRAINT qa_documents_session_id_fkey FOREIGN KEY (session_id) REFERENCES qa_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_qa_documents_student ON qa_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_documents_session ON qa_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_documents_status ON qa_documents(processed_status);
CREATE INDEX IF NOT EXISTS idx_qa_documents_created ON qa_documents(created_at);

-- 14. qa_records
CREATE TABLE IF NOT EXISTS qa_records (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    student_id UUID NOT NULL,
    course_id UUID,
    session_id UUID,
    question TEXT NOT NULL,
    answer TEXT,
    answer_type VARCHAR(50),
    context_used JSONB,
    knowledge_sources JSONB,
    confidence_score NUMERIC(3,2),
    is_helpful BOOLEAN,
    feedback TEXT,
    response_time INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    intent VARCHAR(50),
    skill_used VARCHAR(200),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_qa_records_student ON qa_records(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_records_course ON qa_records(course_id);
CREATE INDEX IF NOT EXISTS idx_qa_records_session ON qa_records(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_records_created ON qa_records(created_at);

-- 15. qa_shares
CREATE TABLE IF NOT EXISTS qa_shares (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    share_code VARCHAR(10) NOT NULL,
    session_id UUID NOT NULL,
    student_id UUID NOT NULL,
    title VARCHAR(200),
    messages JSONB NOT NULL,
    view_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_qa_shares_code ON qa_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_qa_shares_session ON qa_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_shares_student ON qa_shares(student_id);
CREATE INDEX IF NOT EXISTS idx_qa_shares_created ON qa_shares(created_at);

-- =====================================================
-- 第五层: 问卷模块 (surveys -> questions -> responses -> answers)
-- =====================================================

-- 16. surveys
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    teacher_id UUID NOT NULL REFERENCES users(id),
    course_id UUID REFERENCES courses(id),
    class_id UUID REFERENCES classes(id),
    survey_type VARCHAR(50) NOT NULL DEFAULT 'questionnaire',
    release_type VARCHAR(30) NOT NULL DEFAULT 'in_class',
    target_class_ids JSONB,
    target_students JSONB,
    generation_method VARCHAR(50) NOT NULL DEFAULT 'manual',
    generation_prompt TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    total_score INTEGER DEFAULT 100,
    pass_score INTEGER DEFAULT 60,
    time_limit INTEGER,
    allow_multiple_attempts BOOLEAN NOT NULL DEFAULT false,
    max_attempts INTEGER DEFAULT 1,
    show_answer BOOLEAN NOT NULL DEFAULT false,
    shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_surveys_teacher ON surveys(teacher_id);
CREATE INDEX IF NOT EXISTS idx_surveys_course ON surveys(course_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_release_type ON surveys(release_type);
CREATE INDEX IF NOT EXISTS idx_surveys_created ON surveys(created_at);

DROP TRIGGER IF EXISTS update_surveys_updated_at ON surveys;
CREATE TRIGGER update_surveys_updated_at
BEFORE UPDATE ON surveys
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 17. questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_type VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    question_order INTEGER NOT NULL,
    score DECIMAL(10, 2) NOT NULL DEFAULT 0,
    difficulty VARCHAR(20) DEFAULT 'medium',
    options JSONB,
    correct_answer JSONB,
    answer_explanation TEXT,
    tags TEXT[],
    knowledge_points TEXT[],
    is_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_survey ON questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(survey_id, question_order);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);

DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 18. survey_responses
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id),
    student_id UUID NOT NULL REFERENCES users(id),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    total_score DECIMAL(5, 2),
    percentage_score DECIMAL(5, 2),
    is_passed BOOLEAN,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submit_time TIMESTAMP,
    time_spent INTEGER,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, student_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_student ON survey_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_responses_status ON survey_responses(status);

DROP TRIGGER IF EXISTS update_survey_responses_updated_at ON survey_responses;
CREATE TRIGGER update_survey_responses_updated_at
BEFORE UPDATE ON survey_responses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 19. answers
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    student_answer JSONB,
    is_correct BOOLEAN,
    score DECIMAL(5, 2) DEFAULT 0,
    teacher_comment TEXT,
    auto_graded BOOLEAN NOT NULL DEFAULT false,
    graded_by UUID REFERENCES users(id),
    graded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(response_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_answers_response ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);

DROP TRIGGER IF EXISTS update_answers_updated_at ON answers;
CREATE TRIGGER update_answers_updated_at
BEFORE UPDATE ON answers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 20. questionnaire_submissions
CREATE TABLE IF NOT EXISTS questionnaire_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    total_score DECIMAL(10, 2),
    time_spent INTEGER NOT NULL DEFAULT 0,
    submit_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON questionnaire_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_time ON questionnaire_submissions(submit_time);

-- =====================================================
-- 第六层: 知识图谱模块
-- =====================================================

-- 21. knowledge_graphs
CREATE TABLE IF NOT EXISTS knowledge_graphs (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    course_id UUID NOT NULL,
    graph_name VARCHAR(200),
    total_points INTEGER DEFAULT 0,
    total_relations INTEGER DEFAULT 0,
    graph_depth INTEGER DEFAULT 0,
    graph_data JSONB,
    statistics JSONB,
    last_updated_by UUID,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT knowledge_graphs_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT knowledge_graphs_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_course ON knowledge_graphs(course_id);

-- 22. knowledge_points (含自引用外键)
CREATE TABLE IF NOT EXISTS knowledge_points (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    course_id UUID NOT NULL,
    document_id UUID,
    point_name VARCHAR(500) NOT NULL,
    point_content TEXT,
    point_type VARCHAR(50) DEFAULT 'concept',
    level INTEGER DEFAULT 1,
    parent_id UUID,
    keywords TEXT[],
    difficulty VARCHAR(20) DEFAULT 'medium',
    importance INTEGER DEFAULT 3,
    order_index INTEGER DEFAULT 0,
    extra_info JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT knowledge_points_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT knowledge_points_document_id_fkey FOREIGN KEY (document_id) REFERENCES course_documents(id),
    CONSTRAINT knowledge_points_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES knowledge_points(id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_course ON knowledge_points(course_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_document ON knowledge_points(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_level ON knowledge_points(level);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_parent ON knowledge_points(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_type ON knowledge_points(point_type);

-- 23. knowledge_relations
CREATE TABLE IF NOT EXISTS knowledge_relations (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    course_id UUID NOT NULL,
    source_point_id UUID NOT NULL,
    target_point_id UUID NOT NULL,
    relation_type VARCHAR(50) NOT NULL,
    relation_strength NUMERIC(3,2) DEFAULT 0.5,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT knowledge_relations_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT knowledge_relations_source_point_id_fkey FOREIGN KEY (source_point_id) REFERENCES knowledge_points(id),
    CONSTRAINT knowledge_relations_target_point_id_fkey FOREIGN KEY (target_point_id) REFERENCES knowledge_points(id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_course ON knowledge_relations(course_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_source ON knowledge_relations(source_point_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_target ON knowledge_relations(target_point_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_type ON knowledge_relations(relation_type);

-- =====================================================
-- 辅助函数
-- =====================================================

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        SELECT EXISTS(SELECT 1 FROM classes WHERE invite_code = code) INTO code_exists;
        IF NOT code_exists THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 完成: 共23张表已创建
-- =====================================================
