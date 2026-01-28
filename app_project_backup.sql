-- PostgreSQL 数据库导出文件
-- 数据库: app_project
-- 导出时间: 2026-01-28 14:55:50

-- 设置编码
SET client_encoding = 'UTF8';

-- ============================================
-- 数据库结构
-- ============================================


-- 表: answers
-- 结构定义
CREATE TABLE IF NOT EXISTS answers (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    response_id uuid NOT NULL,
    question_id uuid NOT NULL,
    student_answer jsonb,
    is_correct boolean,
    score numeric DEFAULT 0,
    teacher_comment text,
    auto_graded boolean NOT NULL DEFAULT false,
    graded_by uuid,
    graded_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE answers ADD CONSTRAINT answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES survey_responses(id);

ALTER TABLE answers ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id);

ALTER TABLE answers ADD CONSTRAINT answers_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id);

-- 表: class_students
-- 结构定义
CREATE TABLE IF NOT EXISTS class_students (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    class_id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrollment_date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) NOT NULL DEFAULT 'active'::character varying,
    PRIMARY KEY (id)
);

ALTER TABLE class_students ADD CONSTRAINT class_students_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);

ALTER TABLE class_students ADD CONSTRAINT class_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id);

-- 表: classes
-- 结构定义
CREATE TABLE IF NOT EXISTS classes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    class_name character varying(100) NOT NULL,
    course_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    max_students integer DEFAULT 100,
    academic_year character varying(20),
    invite_code character varying(20),
    allow_self_enroll boolean NOT NULL DEFAULT false,
    status character varying(20) NOT NULL DEFAULT 'active'::character varying,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE classes ADD CONSTRAINT classes_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE classes ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id);

-- 表: courses
-- 结构定义
CREATE TABLE IF NOT EXISTS courses (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    course_code character varying(50) NOT NULL,
    course_name character varying(200) NOT NULL,
    description text,
    teacher_id uuid NOT NULL,
    semester character varying(50),
    credit numeric,
    status character varying(20) NOT NULL DEFAULT 'active'::character varying,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE courses ADD CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id);

-- 表: questionnaire_submissions
-- 结构定义
CREATE TABLE IF NOT EXISTS questionnaire_submissions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    survey_id uuid NOT NULL,
    student_id uuid NOT NULL,
    total_score numeric,
    time_spent integer NOT NULL DEFAULT 0,
    submit_time timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE questionnaire_submissions ADD CONSTRAINT questionnaire_submissions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id);

ALTER TABLE questionnaire_submissions ADD CONSTRAINT questionnaire_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);

-- 表: questions
-- 结构定义
CREATE TABLE IF NOT EXISTS questions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    survey_id uuid NOT NULL,
    question_type character varying(50) NOT NULL,
    question_text text NOT NULL,
    question_order integer NOT NULL,
    score numeric NOT NULL DEFAULT 0,
    difficulty character varying(20) DEFAULT 'medium'::character varying,
    options jsonb,
    correct_answer jsonb,
    answer_explanation text,
    tags ARRAY,
    knowledge_points ARRAY,
    is_required boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE questions ADD CONSTRAINT questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id);

-- 表: students
-- 结构定义
CREATE TABLE IF NOT EXISTS students (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    student_number character varying(50) NOT NULL,
    major character varying(100),
    grade character varying(20),
    class_name character varying(50),
    total_questions integer NOT NULL DEFAULT 0,
    total_scores numeric NOT NULL DEFAULT 0.00,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE students ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- 表: survey_responses
-- 结构定义
CREATE TABLE IF NOT EXISTS survey_responses (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    survey_id uuid NOT NULL,
    student_id uuid NOT NULL,
    attempt_number integer NOT NULL DEFAULT 1,
    total_score numeric,
    percentage_score numeric,
    is_passed boolean,
    status character varying(20) NOT NULL DEFAULT 'in_progress'::character varying,
    start_time timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submit_time timestamp without time zone,
    time_spent integer,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id);

ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id);

-- 表: surveys
-- 结构定义
CREATE TABLE IF NOT EXISTS surveys (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title character varying(200) NOT NULL,
    description text,
    teacher_id uuid NOT NULL,
    course_id uuid,
    class_id uuid,
    survey_type character varying(50) NOT NULL DEFAULT 'questionnaire'::character varying,
    target_students jsonb,
    generation_method character varying(50) NOT NULL DEFAULT 'manual'::character varying,
    generation_prompt text,
    status character varying(20) NOT NULL DEFAULT 'draft'::character varying,
    total_score integer DEFAULT 100,
    pass_score integer DEFAULT 60,
    time_limit integer,
    allow_multiple_attempts boolean NOT NULL DEFAULT false,
    max_attempts integer DEFAULT 1,
    show_answer boolean NOT NULL DEFAULT false,
    shuffle_questions boolean NOT NULL DEFAULT false,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at timestamp without time zone,
    PRIMARY KEY (id)
);

ALTER TABLE surveys ADD CONSTRAINT surveys_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id);

ALTER TABLE surveys ADD CONSTRAINT surveys_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);

ALTER TABLE surveys ADD CONSTRAINT surveys_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);

-- 表: teachers
-- 结构定义
CREATE TABLE IF NOT EXISTS teachers (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    teacher_number character varying(50) NOT NULL,
    department character varying(100),
    title character varying(50),
    courses jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

ALTER TABLE teachers ADD CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- 表: users
-- 结构定义
CREATE TABLE IF NOT EXISTS users (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL DEFAULT 'student'::character varying,
    full_name character varying(100),
    avatar_url character varying(500),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp without time zone,
    PRIMARY KEY (id)
);


-- ============================================
-- 数据内容
-- ============================================


-- 表 answers 无数据

-- 表 class_students 无数据

-- 表 classes 的数据 (1 行)
INSERT INTO classes (id, class_name, course_id, teacher_id, max_students, academic_year, invite_code, allow_self_enroll, status, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000201', '软件1班', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 100, '2024', 'TEST2024', True, 'active', '2026-01-28 05:17:28.841471', '2026-01-28 05:17:28.841471');

-- 表 courses 的数据 (1 行)
INSERT INTO courses (id, course_code, course_name, description, teacher_id, semester, credit, status, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000101', 'CS101', '计算机基础', '计算机科学入门课程', '00000000-0000-0000-0000-000000000001', '2024春季', '3.0', 'active', '2026-01-28 05:17:28.841471', '2026-01-28 05:17:28.841471');

-- 表 questionnaire_submissions 无数据

-- 表 questions 的数据 (29 行)
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('0eaf2833-92aa-42fa-b19c-31b4fb081753', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'single_choice', 'Python是一种什么类型的编程语言？', 1, '5.00', 'medium', '[{''text'': ''编译型语言'', ''label'': ''A''}, {''text'': ''解释型语言'', ''label'': ''B''}, {''text'': ''汇编语言'', ''label'': ''C''}, {''text'': ''机器语言'', ''label'': ''D''}]', 'B', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('6edb03ef-44c9-4ed6-879a-1a98ec52aa47', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'single_choice', '下列哪个数据结构遵循FIFO原则？', 2, '5.00', 'medium', '[{''text'': ''栈'', ''label'': ''A''}, {''text'': ''队列'', ''label'': ''B''}, {''text'': ''树'', ''label'': ''C''}, {''text'': ''图'', ''label'': ''D''}]', 'B', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('289ecd70-32ee-4d59-807a-d7af960e4887', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'single_choice', '以下哪个不是Python的数据类型？', 3, '5.00', 'medium', '[{''text'': ''list'', ''label'': ''A''}, {''text'': ''tuple'', ''label'': ''B''}, {''text'': ''array'', ''label'': ''C''}, {''text'': ''dict'', ''label'': ''D''}]', 'C', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('6304e7fe-fa18-464d-8559-d4523e3ea2fa', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'single_choice', '在Python中，哪个函数用于获取列表的长度？', 4, '4.00', 'medium', '[{''text'': ''length()'', ''label'': ''A''}, {''text'': ''size()'', ''label'': ''B''}, {''text'': ''len()'', ''label'': ''C''}, {''text'': ''count()'', ''label'': ''D''}]', 'C', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('43691d4a-3920-44fb-a4a8-f359f0a7b96b', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'multiple_choice', '下列哪些是Python的特点？（多选）', 5, '10.00', 'medium', '[{''text'': ''简单易学'', ''label'': ''A''}, {''text'': ''开源免费'', ''label'': ''B''}, {''text'': ''跨平台'', ''label'': ''C''}, {''text'': ''运行速度最快'', ''label'': ''D''}]', '[''A'', ''B'', ''C'']', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('e835bfb9-7b84-4fc2-8c29-4cca50471852', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'multiple_choice', 'Python中可以用来处理异常的关键字有？（多选）', 6, '8.00', 'medium', '[{''text'': ''try'', ''label'': ''A''}, {''text'': ''except'', ''label'': ''B''}, {''text'': ''finally'', ''label'': ''C''}, {''text'': ''catch'', ''label'': ''D''}]', '[''A'', ''B'', ''C'']', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('5f96fea4-028f-41a0-8b2d-adb1ea681b28', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'judgment', 'Python支持面向对象编程', 7, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('b150c3aa-10f5-4612-9765-aa9ee1f9e6fc', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'judgment', 'Python的列表是可变的', 8, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('0c1777c0-8d0a-4640-a309-717aee51c5e6', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'judgment', 'Python中的字符串是不可变的', 9, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('0a94484e-26cc-40a6-a24c-5b4b3d140a3c', 'dd8a32bd-02f9-4d17-af76-1011d83eb275', 'text', '请简述Python的主要应用领域。', 10, '15.00', 'medium', '[]', 'Web开发、数据分析、人工智能、机器学习、自动化脚本、科学计算等', NULL, NULL, NULL, True, '2026-01-28 06:39:50.680273', '2026-01-28 06:39:50.680273');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('39b35ca0-e71e-46e6-9f3d-17dd995ccd15', '9a04bb04-b119-4460-82b0-99450a82258d', 'single_choice', 'HTTP协议默认使用的端口号是？', 1, '5.00', 'medium', '[{''text'': ''21'', ''label'': ''A''}, {''text'': ''80'', ''label'': ''B''}, {''text'': ''443'', ''label'': ''C''}, {''text'': ''3306'', ''label'': ''D''}]', 'B', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('aa7943e9-6ce0-4878-ae1c-df20ec344b78', '9a04bb04-b119-4460-82b0-99450a82258d', 'single_choice', '下列哪个不是JavaScript的数据类型？', 2, '5.00', 'medium', '[{''text'': ''String'', ''label'': ''A''}, {''text'': ''Number'', ''label'': ''B''}, {''text'': ''Character'', ''label'': ''C''}, {''text'': ''Boolean'', ''label'': ''D''}]', 'C', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('8eb63a97-2718-41c6-8eba-a94166459461', '9a04bb04-b119-4460-82b0-99450a82258d', 'single_choice', '以下哪个是CSS的选择器？', 3, '5.00', 'medium', '[{''text'': ''#id'', ''label'': ''A''}, {''text'': ''.class'', ''label'': ''B''}, {''text'': ''element'', ''label'': ''C''}, {''text'': ''以上都是'', ''label'': ''D''}]', 'D', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('436248fd-c3ad-405b-8f8f-9b306c9fb711', '9a04bb04-b119-4460-82b0-99450a82258d', 'single_choice', '哪个HTTP方法用于更新资源？', 4, '5.00', 'medium', '[{''text'': ''GET'', ''label'': ''A''}, {''text'': ''POST'', ''label'': ''B''}, {''text'': ''PUT'', ''label'': ''C''}, {''text'': ''DELETE'', ''label'': ''D''}]', 'C', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('17881215-e712-4d8b-aeda-62db3d426838', '9a04bb04-b119-4460-82b0-99450a82258d', 'multiple_choice', '下列哪些是关系型数据库？（多选）', 5, '10.00', 'medium', '[{''text'': ''MySQL'', ''label'': ''A''}, {''text'': ''MongoDB'', ''label'': ''B''}, {''text'': ''PostgreSQL'', ''label'': ''C''}, {''text'': ''Redis'', ''label'': ''D''}]', '[''A'', ''C'']', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('e9b0fe48-4e5a-47c1-8a89-7e36d844ba75', '9a04bb04-b119-4460-82b0-99450a82258d', 'multiple_choice', '下列哪些是前端框架？（多选）', 6, '10.00', 'medium', '[{''text'': ''React'', ''label'': ''A''}, {''text'': ''Vue'', ''label'': ''B''}, {''text'': ''Django'', ''label'': ''C''}, {''text'': ''Angular'', ''label'': ''D''}]', '[''A'', ''B'', ''D'']', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('9907a5ae-32f1-40f7-8c52-4a11554af4b5', '9a04bb04-b119-4460-82b0-99450a82258d', 'judgment', 'Git是一个分布式版本控制系统', 7, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('26826d8d-7943-45a6-aca3-bc2a3ad0cfea', '9a04bb04-b119-4460-82b0-99450a82258d', 'judgment', 'RESTful API通常使用JSON格式传输数据', 8, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('57342937-cdef-4694-8853-06f671b2e11b', '9a04bb04-b119-4460-82b0-99450a82258d', 'judgment', 'Docker是一个容器化平台', 9, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('03c6aa16-702a-4294-b153-e7689177f9af', '9a04bb04-b119-4460-82b0-99450a82258d', 'text', '请简述什么是微服务架构。', 10, '15.00', 'medium', '[]', '微服务架构是一种将应用程序构建为一组小型服务的方法，每个服务运行在自己的进程中，服务之间通过轻量级的通信机制进行交互。', NULL, NULL, NULL, True, '2026-01-28 06:40:21.228197', '2026-01-28 06:40:21.228197');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('a42efd81-5eb4-4170-8c1e-838cffbdab23', '3b007717-26ec-49ae-af54-7a240e211b6d', 'single_choice', '什么是算法的时间复杂度？', 1, '5.00', 'medium', '[{''text'': ''算法执行所需的时间'', ''label'': ''A''}, {''text'': ''算法执行次数与问题规模的关系'', ''label'': ''B''}, {''text'': ''算法占用的内存大小'', ''label'': ''C''}, {''text'': ''算法的代码行数'', ''label'': ''D''}]', 'B', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('9096f710-3e6f-4a52-998f-f79810b15d75', '3b007717-26ec-49ae-af54-7a240e211b6d', 'single_choice', '下面哪个是NoSQL数据库？', 2, '5.00', 'medium', '[{''text'': ''MySQL'', ''label'': ''A''}, {''text'': ''MongoDB'', ''label'': ''B''}, {''text'': ''Oracle'', ''label'': ''C''}, {''text'': ''SQL Server'', ''label'': ''D''}]', 'B', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('6f109cfe-6ae9-46d2-878c-d6370ff24019', '3b007717-26ec-49ae-af54-7a240e211b6d', 'single_choice', '二叉搜索树的中序遍历结果是什么？', 3, '3.00', 'medium', '[{''text'': ''无序序列'', ''label'': ''A''}, {''text'': ''有序序列'', ''label'': ''B''}, {''text'': ''随机序列'', ''label'': ''C''}, {''text'': ''倒序序列'', ''label'': ''D''}]', 'B', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('8c142270-e0a2-40d1-b919-5a0b7bf66f81', '3b007717-26ec-49ae-af54-7a240e211b6d', 'single_choice', '动态规划的核心思想是什么？', 4, '5.00', 'medium', '[{''text'': ''分而治之'', ''label'': ''A''}, {''text'': ''贪心选择'', ''label'': ''B''}, {''text'': ''最优子结构和重叠子问题'', ''label'': ''C''}, {''text'': ''回溯法'', ''label'': ''D''}]', 'C', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('34e406a0-f82e-44eb-9a7a-4ee3c3ce9e31', '3b007717-26ec-49ae-af54-7a240e211b6d', 'multiple_choice', '以下哪些排序算法的平均时间复杂度是O(nlogn)？（多选）', 5, '10.00', 'medium', '[{''text'': ''快速排序'', ''label'': ''A''}, {''text'': ''冒泡排序'', ''label'': ''B''}, {''text'': ''归并排序'', ''label'': ''C''}, {''text'': ''堆排序'', ''label'': ''D''}]', '[''A'', ''C'', ''D'']', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('51556f1d-5330-491d-8e5e-4ecccd3ab959', '3b007717-26ec-49ae-af54-7a240e211b6d', 'multiple_choice', '下列哪些是图的遍历算法？（不定项）', 6, '8.00', 'medium', '[{''text'': ''深度优先搜索'', ''label'': ''A''}, {''text'': ''广度优先搜索'', ''label'': ''B''}, {''text'': ''二分查找'', ''label'': ''C''}, {''text'': ''拓扑排序'', ''label'': ''D''}]', '[''A'', ''B'']', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('acaed8e1-4e25-4de0-ac7f-263e1cae43aa', '3b007717-26ec-49ae-af54-7a240e211b6d', 'judgment', '栈是一种后进先出(LIFO)的数据结构（）', 7, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('713695f0-aa81-47a4-8052-e7433ef0b3d3', '3b007717-26ec-49ae-af54-7a240e211b6d', 'judgment', '哈希表的查找时间复杂度平均为O(1)', 8, '3.00', 'medium', '[{''text'': ''对'', ''label'': ''A''}, {''text'': ''错'', ''label'': ''B''}]', 'A', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');
INSERT INTO questions (id, survey_id, question_type, question_text, question_order, score, difficulty, options, correct_answer, answer_explanation, tags, knowledge_points, is_required, created_at, updated_at) VALUES ('4ed2a1e7-a1c2-438e-a879-51fc2f756a81', '3b007717-26ec-49ae-af54-7a240e211b6d', 'text', '请简述什么是递归算法。', 9, '12.00', 'medium', '[]', '递归算法是指函数直接或间接调用自身的算法，通常包含基本情况和递归情况两部分。', NULL, NULL, NULL, True, '2026-01-28 06:41:04.260396', '2026-01-28 06:41:04.260396');

-- 表 students 的数据 (2 行)
INSERT INTO students (id, user_id, student_number, major, grade, class_name, total_questions, total_scores, created_at, updated_at) VALUES ('62afffc5-53b2-4387-94fc-8977c2f244e2', '6d20de3b-1b74-4d54-be58-6f6e388eaada', 'f22015129', '软件工程', '2022', NULL, 0, '0.00', '2026-01-27 05:33:16.200533', '2026-01-27 05:33:16.200533');
INSERT INTO students (id, user_id, student_number, major, grade, class_name, total_questions, total_scores, created_at, updated_at) VALUES ('9a3504fb-3db9-4966-b8de-d58f0b205db3', '00000000-0000-0000-0000-000000000002', 'S001', '计算机科学与技术', '2023', '1班', 0, '0.00', '2026-01-28 03:59:49.197611', '2026-01-28 04:15:51.922281');

-- 表 survey_responses 无数据

-- 表 surveys 的数据 (3 行)
INSERT INTO surveys (id, title, description, teacher_id, course_id, class_id, survey_type, target_students, generation_method, generation_prompt, status, total_score, pass_score, time_limit, allow_multiple_attempts, max_attempts, show_answer, shuffle_questions, start_time, end_time, created_at, updated_at, published_at) VALUES ('dd8a32bd-02f9-4d17-af76-1011d83eb275', '测试问卷1', '从测试问卷1.docx自动生成', '00000000-0000-0000-0000-000000000001', NULL, NULL, 'questionnaire', NULL, 'word_upload', NULL, 'draft', 61, 60, NULL, False, 1, False, False, NULL, NULL, '2026-01-28 06:39:50.653188', '2026-01-28 06:39:50.653188', NULL);
INSERT INTO surveys (id, title, description, teacher_id, course_id, class_id, survey_type, target_students, generation_method, generation_prompt, status, total_score, pass_score, time_limit, allow_multiple_attempts, max_attempts, show_answer, shuffle_questions, start_time, end_time, created_at, updated_at, published_at) VALUES ('9a04bb04-b119-4460-82b0-99450a82258d', '测试问卷2', '从测试问卷2.docx自动生成', '00000000-0000-0000-0000-000000000001', NULL, NULL, 'questionnaire', NULL, 'word_upload', NULL, 'draft', 64, 60, NULL, False, 1, False, False, NULL, NULL, '2026-01-28 06:40:21.224196', '2026-01-28 06:40:21.224196', NULL);
INSERT INTO surveys (id, title, description, teacher_id, course_id, class_id, survey_type, target_students, generation_method, generation_prompt, status, total_score, pass_score, time_limit, allow_multiple_attempts, max_attempts, show_answer, shuffle_questions, start_time, end_time, created_at, updated_at, published_at) VALUES ('3b007717-26ec-49ae-af54-7a240e211b6d', '测试问卷3', '从测试问卷3.docx自动生成', '00000000-0000-0000-0000-000000000001', NULL, NULL, 'questionnaire', NULL, 'word_upload', NULL, 'draft', 54, 60, NULL, False, 1, False, False, NULL, NULL, '2026-01-28 06:41:04.255137', '2026-01-28 06:41:04.255137', NULL);

-- 表 teachers 的数据 (2 行)
INSERT INTO teachers (id, user_id, teacher_number, department, title, courses, created_at, updated_at) VALUES ('9c1482fb-4582-4205-8ada-9ff4e68ace0e', '6e8a7567-8d7d-4a9f-a24a-f90eaf020738', 'SD00001', '信息科学与技术学院', '副教授', NULL, '2026-01-27 06:01:09.679680', '2026-01-27 06:01:09.679680');
INSERT INTO teachers (id, user_id, teacher_number, department, title, courses, created_at, updated_at) VALUES ('583f8cc7-b1f3-4d92-9c9b-3a0dac63484b', '00000000-0000-0000-0000-000000000001', 'T001', '计算机科学系', '讲师', NULL, '2026-01-28 03:59:49.197611', '2026-01-28 04:15:51.922281');

-- 表 users 的数据 (4 行)
INSERT INTO users (id, username, email, password_hash, role, full_name, avatar_url, is_active, created_at, updated_at, last_login_at) VALUES ('6d20de3b-1b74-4d54-be58-6f6e388eaada', 'wangzhengfei', '123@qq.com', '$2b$12$fuFI7EBN/qP4RbcMHe1fp.StWGnkjFkMyWrw3hW5flIk5nr9b96ee', 'student', 'wzf', NULL, True, '2026-01-27 05:33:16.178702', '2026-01-27 14:39:05.193790', '2026-01-27 06:39:05.453674');
INSERT INTO users (id, username, email, password_hash, role, full_name, avatar_url, is_active, created_at, updated_at, last_login_at) VALUES ('6e8a7567-8d7d-4a9f-a24a-f90eaf020738', 'zxrong', '1234@qq.com', '$2b$12$x0j1taCLMTAqfCJ4hn.tCO7TLkKh7cGM9IAE0/0sPyJMldrmis6p6', 'teacher', 'zxr', NULL, True, '2026-01-27 06:01:09.649608', '2026-01-27 16:30:25.619676', '2026-01-27 08:30:25.876998');
INSERT INTO users (id, username, email, password_hash, role, full_name, avatar_url, is_active, created_at, updated_at, last_login_at) VALUES ('00000000-0000-0000-0000-000000000002', 'student', 'student@vault.cs', '$2b$12$GPacjW4wcmsdfGNPxFUDwuMeEwYqJmQe17OXbJWB7vOkOe4iu5sPK', 'student', '学生用户', NULL, True, '2026-01-28 03:59:49.197611', '2026-01-28 04:22:00.737510', NULL);
INSERT INTO users (id, username, email, password_hash, role, full_name, avatar_url, is_active, created_at, updated_at, last_login_at) VALUES ('00000000-0000-0000-0000-000000000001', 'teacher', 'teacher@vault.cs', '$2b$12$GPacjW4wcmsdfGNPxFUDwuMeEwYqJmQe17OXbJWB7vOkOe4iu5sPK', 'teacher', '教师用户', NULL, True, '2026-01-28 03:59:49.197611', '2026-01-28 14:28:22.729445', '2026-01-28 06:28:22.991603');
