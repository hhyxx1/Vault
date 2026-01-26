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
  role: 'student' | 'teacher'
  email: string
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
  status: 'draft' | 'active' | 'closed'
  createdAt: string
  questions: Question[]
}

export interface Question {
  id: string
  text: string
  type: 'radio' | 'checkbox' | 'text'
  options?: string[]
  required: boolean
}

export interface SurveyAnswer {
  surveyId: string
  answers: Record<string, any>
  submittedAt: string
}

// 统计数据类型
export interface DashboardStats {
  totalStudents: number
  activeQuestions: number
  surveysCompleted: number
  averageScore: number
}
