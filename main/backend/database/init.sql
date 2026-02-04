-- 智能教学平台数据库初始化脚本
-- PostgreSQL

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 启用向量扩展（如使用pgvector）
-- 注意：如果未安装pgvector，请注释掉下面这行
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 1. 用户模块
-- =====================================================

-- 1.1 用户表
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

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TRIGGER update_users_updated_at 
BEFORE UPDATE ON users 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 1.2 学生表
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

CREATE INDEX idx_students_number ON students(student_number);
CREATE INDEX idx_students_user ON students(user_id);
CREATE INDEX idx_students_grade_class ON students(grade, class_name);

CREATE TRIGGER update_students_updated_at 
BEFORE UPDATE ON students 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 1.3 教师表
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

CREATE INDEX idx_teachers_number ON teachers(teacher_number);
CREATE INDEX idx_teachers_user ON teachers(user_id);
CREATE INDEX idx_teachers_department ON teachers(department);

CREATE TRIGGER update_teachers_updated_at 
BEFORE UPDATE ON teachers 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. 课程与班级模块
-- =====================================================

-- 2.1 课程表
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

CREATE INDEX idx_courses_code ON courses(course_code);
CREATE INDEX idx_courses_teacher ON courses(teacher_id);

CREATE TRIGGER update_courses_updated_at 
BEFORE UPDATE ON courses 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 2.2 班级表
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name VARCHAR(100) NOT NULL,
    course_id UUID REFERENCES courses(id), -- 修改为可空，支持多课程关联
    teacher_id UUID NOT NULL REFERENCES users(id),
    max_students INTEGER DEFAULT 100,
    academic_year VARCHAR(20),
    invite_code VARCHAR(20) UNIQUE,
    allow_self_enroll BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_classes_course ON classes(course_id);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_invite_code ON classes(invite_code);

CREATE TRIGGER update_classes_updated_at 
BEFORE UPDATE ON classes 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 2.3 班级-课程关联表（多对多关系）
CREATE TABLE IF NOT EXISTS class_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, course_id)
);

CREATE INDEX idx_class_courses_class ON class_courses(class_id);
CREATE INDEX idx_class_courses_course ON class_courses(course_id);

-- 2.4 班级学生关联表
CREATE TABLE IF NOT EXISTS class_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id),
    student_id UUID NOT NULL REFERENCES users(id),
    enrollment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    UNIQUE(class_id, student_id)
);

CREATE INDEX idx_class_students_student ON class_students(student_id);

-- =====================================================
-- 3. 问卷模块
-- =====================================================

-- 3.1 问卷表
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

CREATE INDEX idx_surveys_teacher ON surveys(teacher_id);
CREATE INDEX idx_surveys_course ON surveys(course_id);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_release_type ON surveys(release_type);
CREATE INDEX idx_surveys_created ON surveys(created_at);

CREATE TRIGGER update_surveys_updated_at 
BEFORE UPDATE ON surveys 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 3.2 题目表
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

CREATE INDEX idx_questions_survey ON questions(survey_id);
CREATE INDEX idx_questions_order ON questions(survey_id, question_order);
CREATE INDEX idx_questions_type ON questions(question_type);

CREATE TRIGGER update_questions_updated_at 
BEFORE UPDATE ON questions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 3.3 问卷回答表
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

CREATE INDEX idx_responses_survey ON survey_responses(survey_id);
CREATE INDEX idx_responses_student ON survey_responses(student_id);
CREATE INDEX idx_responses_status ON survey_responses(status);

CREATE TRIGGER update_survey_responses_updated_at 
BEFORE UPDATE ON survey_responses 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 3.4 答案表
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

CREATE INDEX idx_answers_response ON answers(response_id);
CREATE INDEX idx_answers_question ON answers(question_id);

CREATE TRIGGER update_answers_updated_at 
BEFORE UPDATE ON answers 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 3.5 问卷提交记录表
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

CREATE INDEX idx_submissions_student ON questionnaire_submissions(student_id);
CREATE INDEX idx_submissions_time ON questionnaire_submissions(submit_time);

-- =====================================================
-- 4. 知识库模块
-- =====================================================

-- 4.1 课程文档表
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

CREATE INDEX idx_course_docs_course ON course_documents(course_id);
CREATE INDEX idx_course_docs_teacher ON course_documents(teacher_id);
CREATE INDEX idx_course_docs_status ON course_documents(upload_status);

CREATE TRIGGER update_course_documents_updated_at 
BEFORE UPDATE ON course_documents 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 4.2 知识库表（向量化的文档片段）
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES course_documents(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_metadata JSONB,
    embedding_vector TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_course ON knowledge_base(course_id);
CREATE INDEX idx_knowledge_document ON knowledge_base(document_id);

-- =====================================================
-- 5. 问答模块
-- =====================================================

-- 5.1 问答记录表
CREATE TABLE IF NOT EXISTS qa_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id),
    question TEXT NOT NULL,
    answer TEXT,
    answer_type VARCHAR(50),
    context_used JSONB,
    knowledge_sources JSONB,
    confidence_score DECIMAL(3, 2),
    is_helpful BOOLEAN,
    feedback TEXT,
    response_time INTEGER,
    tokens_used INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_qa_records_student ON qa_records(student_id);
CREATE INDEX idx_qa_records_course ON qa_records(course_id);
CREATE INDEX idx_qa_records_created ON qa_records(created_at);

-- 5.2 问答会话表
CREATE TABLE IF NOT EXISTS qa_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    course_id UUID REFERENCES courses(id),
    message_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
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

-- 5.3 问答分享表
CREATE TABLE IF NOT EXISTS qa_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_code VARCHAR(32) UNIQUE NOT NULL,
    sharer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES qa_sessions(id) ON DELETE CASCADE,
    qa_record_id UUID REFERENCES qa_records(id) ON DELETE CASCADE,
    title VARCHAR(200),
    description TEXT,
    access_password VARCHAR(128),
    expires_at TIMESTAMP,
    view_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_qa_shares_code ON qa_shares(share_code);
CREATE INDEX idx_qa_shares_sharer ON qa_shares(sharer_id);
CREATE INDEX idx_qa_shares_session ON qa_shares(session_id);
CREATE INDEX idx_qa_shares_record ON qa_shares(qa_record_id);
CREATE INDEX idx_qa_shares_created ON qa_shares(created_at);

-- =====================================================
-- 6. 辅助函数
-- =====================================================

-- 生成班级邀请码
CREATE OR REPLACE FUNCTION generate_invite_code() 
RETURNS VARCHAR(20) AS $$
DECLARE
    code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- 生成8位随机码
        code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        
        -- 检查是否已存在
        SELECT EXISTS(SELECT 1 FROM classes WHERE invite_code = code) INTO code_exists;
        
        -- 如果不存在则返回
        IF NOT code_exists THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 完成
-- =====================================================
COMMENT ON DATABASE current_database() IS '智能教学平台数据库 v1.0.0';
