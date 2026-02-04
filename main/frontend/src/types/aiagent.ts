// 学生数据类型
export interface Student {
  id: string;
  name: string;
  avatar: string;
  grade: string;
  class: string;
  enrollmentDate: string;
}

// 学生统计数据类型
export interface StudentStats {
  studentId: string;
  questionCount: number;
  participationRate: number;
  avgQuestionScore: number;
  highFrequencyQuestions: string[];
  lastActiveDate: string;
}

// 看板数据类型
export interface DashboardData {
  totalStudents: number;
  totalQuestions: number;
  avgParticipationRate: number;
  topStudents: Array<{
    studentId: string;
    name: string;
    score: number;
  }>;
  questionTrend: Array<{
    date: string;
    count: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
  }>;
}

// 自测结果类型
export interface SelfAssessment {
  id: string;
  studentId: string;
  date: string;
  score: number;
  topics: string[];
  strengths: string[];
  weaknesses: string[];
}

// 对话历史类型
export interface Conversation {
  id: string;
  studentId: string;
  date: string;
  content: string;
  response: string;
  tags: string[];
}

// 表头配置类型
export interface TableHeader {
  id: string;
  title: string;
  key: string;
  visible: boolean;
}

// 学生学习进度分析类型
export interface LearningProgress {
  studentId: string;
  overallProgress: number;
  topicProgress: Array<{
    topic: string;
    progress: number;
  }>;
  recommendations: string[];
  riskFactors: string[];
}
