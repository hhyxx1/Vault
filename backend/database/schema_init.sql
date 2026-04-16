-- =====================================================
-- Smart Teaching Platform - Schema Initialization Script
-- No data import; contains only tables, functions, indexes, triggers, and foreign keys
-- Intended as the single database bootstrap script for source delivery
-- =====================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_knowledge_graph_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_knowledge_graph_stats(p_course_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_point_count INTEGER;
    v_relation_count INTEGER;
    v_max_depth INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_point_count
    FROM knowledge_points
    WHERE course_id = p_course_id;
    
    SELECT COUNT(*) INTO v_relation_count
    FROM knowledge_relations
    WHERE course_id = p_course_id;
    
    SELECT COALESCE(MAX(level), 0) INTO v_max_depth
    FROM knowledge_points
    WHERE course_id = p_course_id;
    
    INSERT INTO knowledge_graphs (course_id, total_points, total_relations, graph_depth, updated_at)
    VALUES (p_course_id, v_point_count, v_relation_count, v_max_depth, CURRENT_TIMESTAMP)
    ON CONFLICT (course_id) 
    DO UPDATE SET
        total_points = v_point_count,
        total_relations = v_relation_count,
        graph_depth = v_max_depth,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;


--
-- Name: FUNCTION update_knowledge_graph_stats(p_course_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_knowledge_graph_stats(p_course_id uuid) IS '更新课程知识图谱统计信息';


--
-- Name: update_knowledge_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_knowledge_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.answers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    response_id uuid NOT NULL,
    question_id uuid NOT NULL,
    student_answer jsonb,
    is_correct boolean,
    score numeric(5,2) DEFAULT 0,
    teacher_comment text,
    auto_graded boolean DEFAULT false NOT NULL,
    graded_by uuid,
    graded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: class_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class_id uuid NOT NULL,
    course_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: class_students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_students (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    class_id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrollment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    class_name character varying(100) NOT NULL,
    course_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    max_students integer DEFAULT 100,
    academic_year character varying(20),
    invite_code character varying(20),
    allow_self_enroll boolean DEFAULT false NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: course_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    file_name character varying(500) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_type character varying(50) NOT NULL,
    file_size bigint NOT NULL,
    upload_status character varying(20) DEFAULT 'processing'::character varying NOT NULL,
    processed_status character varying(20) DEFAULT 'pending'::character varying,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    doc_type character varying(20) DEFAULT 'material'::character varying,
    document_type character varying(50) DEFAULT 'material'::character varying,
    processing_progress integer DEFAULT 0,
    extracted_text text
);


--
-- Name: COLUMN course_documents.document_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.course_documents.document_type IS '文档类型：outline-课程大纲，material-课程资料';


--
-- Name: COLUMN course_documents.processing_progress; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.course_documents.processing_progress IS '文档处理进度：0-100';


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_code character varying(50) NOT NULL,
    course_name character varying(200) NOT NULL,
    description text,
    teacher_id uuid NOT NULL,
    semester character varying(50),
    credit numeric(3,1),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: document_processing_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_processing_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    task_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    progress integer DEFAULT 0,
    total_steps integer DEFAULT 1,
    current_step integer DEFAULT 0,
    result_data jsonb,
    error_message text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE document_processing_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.document_processing_tasks IS '文档处理任务表，追踪异步处理进度';


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    document_id uuid NOT NULL,
    course_id uuid NOT NULL,
    chunk_text text NOT NULL,
    chunk_index integer NOT NULL,
    chunk_metadata jsonb,
    embedding_vector text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    document_type character varying(50) DEFAULT 'material'::character varying
);


--
-- Name: knowledge_graphs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_graphs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    graph_name character varying(200),
    total_points integer DEFAULT 0,
    total_relations integer DEFAULT 0,
    graph_depth integer DEFAULT 0,
    graph_data jsonb,
    statistics jsonb,
    last_updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE knowledge_graphs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.knowledge_graphs IS '知识图谱元数据表';


--
-- Name: knowledge_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    document_id uuid,
    point_name character varying(500) NOT NULL,
    point_content text,
    point_type character varying(50) DEFAULT 'concept'::character varying,
    level integer DEFAULT 1,
    parent_id uuid,
    keywords text[],
    difficulty character varying(20) DEFAULT 'medium'::character varying,
    importance integer DEFAULT 3,
    order_index integer DEFAULT 0,
    extra_info jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE knowledge_points; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.knowledge_points IS '知识点表';


--
-- Name: knowledge_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    source_point_id uuid NOT NULL,
    target_point_id uuid NOT NULL,
    relation_type character varying(50) NOT NULL,
    relation_strength numeric(3,2) DEFAULT 0.5,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE knowledge_relations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.knowledge_relations IS '知识点关系表，用于构建知识图谱';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    notification_type character varying(50) DEFAULT 'survey'::character varying NOT NULL,
    related_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone
);


--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notifications IS '通知消息表';


--
-- Name: COLUMN notifications.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.user_id IS '用户ID';


--
-- Name: COLUMN notifications.title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.title IS '通知标题';


--
-- Name: COLUMN notifications.message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.message IS '通知内容';


--
-- Name: COLUMN notifications.notification_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.notification_type IS '通知类型：survey=问卷, system=系统, grade=成绩等';


--
-- Name: COLUMN notifications.related_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.related_id IS '关联的问卷、作业等ID';


--
-- Name: COLUMN notifications.is_read; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.is_read IS '是否已读';


--
-- Name: COLUMN notifications.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.created_at IS '创建时间';


--
-- Name: COLUMN notifications.read_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.read_at IS '已读时间';


--
-- Name: qa_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    session_id uuid,
    file_name character varying(500) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_type character varying(50) NOT NULL,
    file_size integer NOT NULL,
    processed_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE qa_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qa_documents IS '问答文档表 - 学生上传用于问答的文档';


--
-- Name: COLUMN qa_documents.processed_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qa_documents.processed_status IS '文档处理状态：pending(待处理)、processing(处理中)、completed(完成)、failed(失败)';


--
-- Name: qa_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    course_id uuid,
    session_id uuid,
    question text NOT NULL,
    answer text,
    answer_type character varying(50),
    context_used jsonb,
    knowledge_sources jsonb,
    confidence_score numeric(3,2),
    is_helpful boolean,
    feedback text,
    response_time integer,
    tokens_used integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    intent character varying(50),
    skill_used character varying(200),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE qa_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qa_records IS '问答记录表 - 每次问答的详细记录';


--
-- Name: COLUMN qa_records.answer_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qa_records.answer_type IS '回答类型：ai(纯AI)、knowledge_base(知识库)、hybrid(混合)';


--
-- Name: COLUMN qa_records.knowledge_sources; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qa_records.knowledge_sources IS '引用的知识库来源，JSON格式存储文档信息';


--
-- Name: qa_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    title character varying(200),
    course_id uuid,
    message_count integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_message_at timestamp without time zone
);


--
-- Name: TABLE qa_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.qa_sessions IS '问答会话表 - 学生的问答对话会话';


--
-- Name: qa_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qa_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_code character varying(10) NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid NOT NULL,
    title character varying(200),
    messages jsonb NOT NULL,
    view_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: questionnaire_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questionnaire_submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    survey_id uuid NOT NULL,
    student_id uuid NOT NULL,
    total_score numeric(10,2),
    time_spent integer DEFAULT 0 NOT NULL,
    submit_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    survey_id uuid NOT NULL,
    question_type character varying(50) NOT NULL,
    question_text text NOT NULL,
    question_order integer NOT NULL,
    score numeric(10,2) DEFAULT 0 NOT NULL,
    difficulty character varying(20) DEFAULT 'medium'::character varying,
    options jsonb,
    correct_answer jsonb,
    answer_explanation text,
    tags text[],
    knowledge_points text[],
    is_required boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reference_files jsonb,
    min_word_count integer,
    grading_criteria jsonb
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    student_number character varying(50) NOT NULL,
    major character varying(100),
    grade character varying(20),
    class_name character varying(50),
    total_questions integer DEFAULT 0 NOT NULL,
    total_scores numeric(10,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: student_learning_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_learning_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    learning_plan jsonb NOT NULL,
    analysis_data jsonb,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_responses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    survey_id uuid NOT NULL,
    student_id uuid NOT NULL,
    attempt_number integer DEFAULT 1 NOT NULL,
    total_score numeric(5,2),
    percentage_score numeric(5,2),
    is_passed boolean,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    submit_time timestamp without time zone,
    time_spent integer,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surveys (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    teacher_id uuid NOT NULL,
    course_id uuid,
    class_id uuid,
    survey_type character varying(50) DEFAULT 'questionnaire'::character varying NOT NULL,
    target_students jsonb,
    generation_method character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    generation_prompt text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    total_score integer DEFAULT 100,
    pass_score integer DEFAULT 60,
    time_limit integer,
    allow_multiple_attempts boolean DEFAULT false NOT NULL,
    max_attempts integer DEFAULT 1,
    show_answer boolean DEFAULT false NOT NULL,
    shuffle_questions boolean DEFAULT false NOT NULL,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    published_at timestamp without time zone,
    release_type character varying(30) DEFAULT 'in_class'::character varying NOT NULL,
    target_class_ids jsonb,
    score_published boolean DEFAULT false NOT NULL,
    score_published_at timestamp without time zone
);


--
-- Name: COLUMN surveys.release_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.surveys.release_type IS '发布类型: in_class=课堂检测, homework=课后作业, practice=自主练习';


--
-- Name: COLUMN surveys.target_class_ids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.surveys.target_class_ids IS '发布目标班级ID列表(JSON数组)';


--
-- Name: teacher_insight_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_insight_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    question text NOT NULL,
    answer text DEFAULT ''::text,
    status character varying(20) DEFAULT 'analyzing'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teachers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    teacher_number character varying(50) NOT NULL,
    department character varying(100),
    title character varying(50),
    courses jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'student'::character varying NOT NULL,
    full_name character varying(100),
    avatar_url character varying(500),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at timestamp without time zone
);


--
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (id);


--
-- Name: answers answers_response_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_response_id_question_id_key UNIQUE (response_id, question_id);


--
-- Name: class_courses class_courses_class_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_courses
    ADD CONSTRAINT class_courses_class_id_course_id_key UNIQUE (class_id, course_id);


--
-- Name: class_courses class_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_courses
    ADD CONSTRAINT class_courses_pkey PRIMARY KEY (id);


--
-- Name: class_students class_students_class_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_students
    ADD CONSTRAINT class_students_class_id_student_id_key UNIQUE (class_id, student_id);


--
-- Name: class_students class_students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_students
    ADD CONSTRAINT class_students_pkey PRIMARY KEY (id);


--
-- Name: classes classes_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_invite_code_key UNIQUE (invite_code);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: course_documents course_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_documents
    ADD CONSTRAINT course_documents_pkey PRIMARY KEY (id);


--
-- Name: courses courses_course_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_course_code_key UNIQUE (course_code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: document_processing_tasks document_processing_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_processing_tasks
    ADD CONSTRAINT document_processing_tasks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: knowledge_graphs knowledge_graphs_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_graphs
    ADD CONSTRAINT knowledge_graphs_course_id_key UNIQUE (course_id);


--
-- Name: knowledge_graphs knowledge_graphs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_graphs
    ADD CONSTRAINT knowledge_graphs_pkey PRIMARY KEY (id);


--
-- Name: knowledge_points knowledge_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_points
    ADD CONSTRAINT knowledge_points_pkey PRIMARY KEY (id);


--
-- Name: knowledge_relations knowledge_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_pkey PRIMARY KEY (id);


--
-- Name: knowledge_relations knowledge_relations_source_point_id_target_point_id_relatio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_source_point_id_target_point_id_relatio_key UNIQUE (source_point_id, target_point_id, relation_type);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: qa_documents qa_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_documents
    ADD CONSTRAINT qa_documents_pkey PRIMARY KEY (id);


--
-- Name: qa_records qa_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_records
    ADD CONSTRAINT qa_records_pkey PRIMARY KEY (id);


--
-- Name: qa_sessions qa_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_sessions
    ADD CONSTRAINT qa_sessions_pkey PRIMARY KEY (id);


--
-- Name: qa_shares qa_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_shares
    ADD CONSTRAINT qa_shares_pkey PRIMARY KEY (id);


--
-- Name: qa_shares qa_shares_share_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_shares
    ADD CONSTRAINT qa_shares_share_code_key UNIQUE (share_code);


--
-- Name: questionnaire_submissions questionnaire_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questionnaire_submissions
    ADD CONSTRAINT questionnaire_submissions_pkey PRIMARY KEY (id);


--
-- Name: questionnaire_submissions questionnaire_submissions_survey_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questionnaire_submissions
    ADD CONSTRAINT questionnaire_submissions_survey_id_student_id_key UNIQUE (survey_id, student_id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_student_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_number_key UNIQUE (student_number);


--
-- Name: students students_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_key UNIQUE (user_id);


--
-- Name: student_learning_plans student_learning_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_learning_plans
    ADD CONSTRAINT student_learning_plans_pkey PRIMARY KEY (id);


--
-- Name: student_learning_plans student_learning_plans_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_learning_plans
    ADD CONSTRAINT student_learning_plans_student_id_key UNIQUE (student_id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_survey_id_student_id_attempt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_student_id_attempt_number_key UNIQUE (survey_id, student_id, attempt_number);


--
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- Name: teacher_insight_cards teacher_insight_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_insight_cards
    ADD CONSTRAINT teacher_insight_cards_pkey PRIMARY KEY (id);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: teachers teachers_teacher_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_teacher_number_key UNIQUE (teacher_number);


--
-- Name: teachers teachers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_answers_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_answers_question ON public.answers USING btree (question_id);


--
-- Name: idx_answers_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_answers_response ON public.answers USING btree (response_id);


--
-- Name: idx_class_courses_class_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_courses_class_id ON public.class_courses USING btree (class_id);


--
-- Name: idx_class_courses_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_courses_course_id ON public.class_courses USING btree (course_id);


--
-- Name: idx_class_students_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_students_student ON public.class_students USING btree (student_id);


--
-- Name: idx_classes_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_course ON public.classes USING btree (course_id);


--
-- Name: idx_classes_invite_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_invite_code ON public.classes USING btree (invite_code);


--
-- Name: idx_classes_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_teacher ON public.classes USING btree (teacher_id);


--
-- Name: idx_course_docs_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_docs_course ON public.course_documents USING btree (course_id);


--
-- Name: idx_course_docs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_docs_status ON public.course_documents USING btree (upload_status);


--
-- Name: idx_course_docs_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_docs_teacher ON public.course_documents USING btree (teacher_id);


--
-- Name: idx_courses_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_code ON public.courses USING btree (course_code);


--
-- Name: idx_courses_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_teacher ON public.courses USING btree (teacher_id);


--
-- Name: idx_doc_tasks_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_tasks_document ON public.document_processing_tasks USING btree (document_id);


--
-- Name: idx_doc_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_tasks_status ON public.document_processing_tasks USING btree (status);


--
-- Name: idx_doc_tasks_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_tasks_type ON public.document_processing_tasks USING btree (task_type);


--
-- Name: idx_insight_cards_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insight_cards_created ON public.teacher_insight_cards USING btree (created_at DESC);


--
-- Name: idx_insight_cards_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_insight_cards_teacher ON public.teacher_insight_cards USING btree (teacher_id);


--
-- Name: idx_kb_course_doc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_course_doc_type ON public.knowledge_base USING btree (course_id, document_type);


--
-- Name: idx_kb_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kb_document_type ON public.knowledge_base USING btree (document_type);


--
-- Name: idx_knowledge_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_course ON public.knowledge_base USING btree (course_id);


--
-- Name: idx_knowledge_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_document ON public.knowledge_base USING btree (document_id);


--
-- Name: idx_knowledge_graphs_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_graphs_course ON public.knowledge_graphs USING btree (course_id);


--
-- Name: idx_knowledge_points_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_points_course ON public.knowledge_points USING btree (course_id);


--
-- Name: idx_knowledge_points_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_points_document ON public.knowledge_points USING btree (document_id);


--
-- Name: idx_knowledge_points_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_points_level ON public.knowledge_points USING btree (level);


--
-- Name: idx_knowledge_points_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_points_parent ON public.knowledge_points USING btree (parent_id);


--
-- Name: idx_knowledge_points_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_points_type ON public.knowledge_points USING btree (point_type);


--
-- Name: idx_knowledge_relations_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_relations_course ON public.knowledge_relations USING btree (course_id);


--
-- Name: idx_knowledge_relations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_relations_source ON public.knowledge_relations USING btree (source_point_id);


--
-- Name: idx_knowledge_relations_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_relations_target ON public.knowledge_relations USING btree (target_point_id);


--
-- Name: idx_knowledge_relations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_relations_type ON public.knowledge_relations USING btree (relation_type);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_qa_documents_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_documents_created ON public.qa_documents USING btree (created_at);


--
-- Name: idx_qa_documents_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_documents_session ON public.qa_documents USING btree (session_id);


--
-- Name: idx_qa_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_documents_status ON public.qa_documents USING btree (processed_status);


--
-- Name: idx_qa_documents_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_documents_student ON public.qa_documents USING btree (student_id);


--
-- Name: idx_qa_records_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_records_course ON public.qa_records USING btree (course_id);


--
-- Name: idx_qa_records_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_records_created ON public.qa_records USING btree (created_at);


--
-- Name: idx_qa_records_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_records_session ON public.qa_records USING btree (session_id);


--
-- Name: idx_qa_records_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_records_student ON public.qa_records USING btree (student_id);


--
-- Name: idx_qa_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_sessions_active ON public.qa_sessions USING btree (is_active);


--
-- Name: idx_qa_sessions_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_sessions_course ON public.qa_sessions USING btree (course_id);


--
-- Name: idx_qa_sessions_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_sessions_student ON public.qa_sessions USING btree (student_id);


--
-- Name: idx_qa_sessions_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_sessions_updated ON public.qa_sessions USING btree (updated_at);


--
-- Name: idx_qa_shares_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_shares_code ON public.qa_shares USING btree (share_code);


--
-- Name: idx_qa_shares_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_shares_created ON public.qa_shares USING btree (created_at);


--
-- Name: idx_qa_shares_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_shares_session ON public.qa_shares USING btree (session_id);


--
-- Name: idx_qa_shares_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qa_shares_student ON public.qa_shares USING btree (student_id);


--
-- Name: idx_questions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_order ON public.questions USING btree (survey_id, question_order);


--
-- Name: idx_questions_survey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_survey ON public.questions USING btree (survey_id);


--
-- Name: idx_questions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_type ON public.questions USING btree (question_type);


--
-- Name: idx_responses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_status ON public.survey_responses USING btree (status);


--
-- Name: idx_responses_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_student ON public.survey_responses USING btree (student_id);


--
-- Name: idx_responses_survey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_survey ON public.survey_responses USING btree (survey_id);


--
-- Name: idx_students_grade_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_grade_class ON public.students USING btree (grade, class_name);


--
-- Name: idx_students_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_number ON public.students USING btree (student_number);


--
-- Name: idx_students_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_user ON public.students USING btree (user_id);


--
-- Name: idx_student_learning_plans_generated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_learning_plans_generated_at ON public.student_learning_plans USING btree (generated_at DESC);


--
-- Name: idx_student_learning_plans_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_learning_plans_student_id ON public.student_learning_plans USING btree (student_id);


--
-- Name: idx_submissions_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_student ON public.questionnaire_submissions USING btree (student_id);


--
-- Name: idx_submissions_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_time ON public.questionnaire_submissions USING btree (submit_time);


--
-- Name: idx_surveys_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surveys_course ON public.surveys USING btree (course_id);


--
-- Name: idx_surveys_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surveys_created ON public.surveys USING btree (created_at);


--
-- Name: idx_surveys_release_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surveys_release_type ON public.surveys USING btree (release_type);


--
-- Name: idx_surveys_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surveys_status ON public.surveys USING btree (status);


--
-- Name: idx_surveys_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surveys_teacher ON public.surveys USING btree (teacher_id);


--
-- Name: idx_teachers_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teachers_department ON public.teachers USING btree (department);


--
-- Name: idx_teachers_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teachers_number ON public.teachers USING btree (teacher_number);


--
-- Name: idx_teachers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teachers_user ON public.teachers USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: answers update_answers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON public.answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: classes update_classes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: course_documents update_course_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_course_documents_updated_at BEFORE UPDATE ON public.course_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: courses update_courses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: document_processing_tasks update_doc_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doc_tasks_updated_at BEFORE UPDATE ON public.document_processing_tasks FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_updated_at();


--
-- Name: knowledge_graphs update_knowledge_graphs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_knowledge_graphs_updated_at BEFORE UPDATE ON public.knowledge_graphs FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_updated_at();


--
-- Name: knowledge_points update_knowledge_points_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_knowledge_points_updated_at BEFORE UPDATE ON public.knowledge_points FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_updated_at();


--
-- Name: qa_documents update_qa_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_qa_documents_updated_at BEFORE UPDATE ON public.qa_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: qa_sessions update_qa_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_qa_sessions_updated_at BEFORE UPDATE ON public.qa_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: questions update_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: students update_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: student_learning_plans update_student_learning_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_student_learning_plans_updated_at BEFORE UPDATE ON public.student_learning_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: survey_responses update_survey_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_survey_responses_updated_at BEFORE UPDATE ON public.survey_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: surveys update_surveys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teachers update_teachers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: answers answers_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.users(id);


--
-- Name: answers answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: answers answers_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.survey_responses(id) ON DELETE CASCADE;


--
-- Name: class_courses class_courses_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_courses
    ADD CONSTRAINT class_courses_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_courses class_courses_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_courses
    ADD CONSTRAINT class_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: class_students class_students_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_students
    ADD CONSTRAINT class_students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: class_students class_students_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_students
    ADD CONSTRAINT class_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: classes classes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: classes classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: course_documents course_documents_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_documents
    ADD CONSTRAINT course_documents_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_documents course_documents_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_documents
    ADD CONSTRAINT course_documents_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: courses courses_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: document_processing_tasks document_processing_tasks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_processing_tasks
    ADD CONSTRAINT document_processing_tasks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.course_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.course_documents(id) ON DELETE CASCADE;


--
-- Name: knowledge_graphs knowledge_graphs_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_graphs
    ADD CONSTRAINT knowledge_graphs_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: knowledge_graphs knowledge_graphs_last_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_graphs
    ADD CONSTRAINT knowledge_graphs_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES public.users(id);


--
-- Name: knowledge_points knowledge_points_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_points
    ADD CONSTRAINT knowledge_points_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: knowledge_points knowledge_points_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_points
    ADD CONSTRAINT knowledge_points_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.course_documents(id) ON DELETE SET NULL;


--
-- Name: knowledge_points knowledge_points_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_points
    ADD CONSTRAINT knowledge_points_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.knowledge_points(id) ON DELETE SET NULL;


--
-- Name: knowledge_relations knowledge_relations_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: knowledge_relations knowledge_relations_source_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_source_point_id_fkey FOREIGN KEY (source_point_id) REFERENCES public.knowledge_points(id) ON DELETE CASCADE;


--
-- Name: knowledge_relations knowledge_relations_target_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_target_point_id_fkey FOREIGN KEY (target_point_id) REFERENCES public.knowledge_points(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: qa_documents qa_documents_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_documents
    ADD CONSTRAINT qa_documents_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.qa_sessions(id) ON DELETE CASCADE;


--
-- Name: qa_documents qa_documents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_documents
    ADD CONSTRAINT qa_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: qa_sessions qa_sessions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_sessions
    ADD CONSTRAINT qa_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: qa_sessions qa_sessions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qa_sessions
    ADD CONSTRAINT qa_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: questionnaire_submissions questionnaire_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questionnaire_submissions
    ADD CONSTRAINT questionnaire_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: questionnaire_submissions questionnaire_submissions_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questionnaire_submissions
    ADD CONSTRAINT questionnaire_submissions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: questions questions_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_learning_plans student_learning_plans_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_learning_plans
    ADD CONSTRAINT student_learning_plans_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: survey_responses survey_responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id);


--
-- Name: surveys surveys_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- Name: surveys surveys_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: surveys surveys_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: teacher_insight_cards teacher_insight_cards_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_insight_cards
    ADD CONSTRAINT teacher_insight_cards_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teachers teachers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


