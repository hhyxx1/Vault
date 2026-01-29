// API 响应通用类型
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// 用户类型
export interface User {
  id: string
  username: string
  email: string
  role: 'student' | 'teacher'
  fullName?: string
  avatarUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

// 学生类型
export interface Student {
  id: string
  userId: string
  studentNumber: string
  major?: string
  grade?: string
  className?: string
  totalQuestions: number
  totalScores: number
  createdAt: string
  updatedAt: string
}

// 教师类型
export interface Teacher {
  id: string
  userId: string
  teacherNumber: string
  department?: string
  title?: string
  courses?: string[]
  createdAt: string
  updatedAt: string
}

// 注册表单类型
export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
  role: 'student' | 'teacher'
  fullName: string
  // 学生专属字段
  studentNumber?: string
  major?: string
  grade?: string
  className?: string
  // 教师专属字段
  teacherNumber?: string
  department?: string
  title?: string
}

// 问答相关类型
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface QAHistory {
  id: string
  question: string
  answer: string
  timestamp: string
}

// 问卷相关类型
export interface Survey {
  id: string
  title: string
  description?: string
  teacherId: string
  courseId?: string
  classId?: string
  surveyType: 'questionnaire' | 'exam'  // 问卷类型：纯问卷或测验
  targetStudents?: string[]  // 目标学生ID列表
  generationMethod: 'manual' | 'ai' | 'knowledge_base'
  generationPrompt?: string
  status: 'draft' | 'published' | 'closed' | 'archived'
  totalScore?: number
  passScore?: number
  timeLimit?: number  // 答题时限（分钟）
  allowMultipleAttempts: boolean
  maxAttempts?: number
  showAnswer: boolean
  shuffleQuestions: boolean
  startTime?: string
  endTime?: string
  createdAt: string
  updatedAt: string
  publishedAt?: string
  questions: Question[]
}

export interface Question {
  id: string
  surveyId: string
  questionType: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'coding' | 'fill_blank'
  questionText: string
  questionOrder: number
  score: number
  difficulty?: 'easy' | 'medium' | 'hard'
  options?: QuestionOption[]
  correctAnswer?: any  // JSON格式，根据题型不同而不同
  answerExplanation?: string
  tags?: string[]
  knowledgePoints?: string[]
  isRequired: boolean
  // 问答题专用字段
  referenceFiles?: string[]  // 参考材料（图片/文件URL列表）
  minWordCount?: number  // 最小作答字数限制
  gradingCriteria?: GradingCriteria  // 评分标准
  createdAt: string
  updatedAt: string
}

export interface GradingCriteria {
  totalScore: number
  scoreDistribution?: Array<{
    item: string
    score: number
    description?: string
  }>
  keywords?: string[]  // 关键词要求
  requirements?: string[]  // 其他要求
}

export interface QuestionOption {
  key: string
  value: string
}

// 题目创建表单类型
export interface QuestionFormData {
  id?: string
  questionType: 'single_choice' | 'fill_blank' | 'essay'
  questionText: string
  score: number
  // 选择题字段
  options?: Array<{ key: string; value: string; isCorrect: boolean }>
  // 填空题字段
  correctAnswers?: string[]  // 多空答案
  // 问答题字段
  referenceFiles?: File[]
  minWordCount?: number
  gradingCriteria?: GradingCriteria
  answerExplanation?: string
}

export interface SurveyCreateFormData {
  title: string
  description?: string
  questions: QuestionFormData[]
}

export interface SurveyResponse {
  id: string
  surveyId: string
  studentId: string
  attemptNumber: number
  totalScore?: number
  percentageScore?: number
  isPassed?: boolean
  status: 'in_progress' | 'submitted' | 'graded'
  startTime: string
  submitTime?: string
  timeSpent?: number
  ipAddress?: string
  userAgent?: string
  createdAt: string
  updatedAt: string
}

export interface Answer {
  id: string
  responseId: string
  questionId: string
  studentAnswer?: any  // JSON格式
  isCorrect?: boolean
  score: number
  teacherComment?: string
  autoGraded: boolean
  gradedBy?: string
  gradedAt?: string
  createdAt: string
  updatedAt: string
}

// 统计数据类型
export interface DashboardStats {
  totalStudents: number
  activeQuestions: number
  surveysCompleted: number
  averageScore: number
}
