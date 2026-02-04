import type { Student, StudentStats, DashboardData, SelfAssessment, Conversation, LearningProgress, TableHeader } from '../types/aiagent';

// 模拟学生数据
export const students: Student[] = [
  {
    id: '1',
    name: '张三',
    avatar: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=student%20avatar%20male%20chinese&size=512x512',
    grade: '高一',
    class: '三班',
    enrollmentDate: '2025-09-01'
  },
  {
    id: '2',
    name: '李四',
    avatar: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=student%20avatar%20female%20chinese&size=512x512',
    grade: '高一',
    class: '三班',
    enrollmentDate: '2025-09-01'
  },
  {
    id: '3',
    name: '王五',
    avatar: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=student%20avatar%20male%20chinese%20glasses&size=512x512',
    grade: '高一',
    class: '三班',
    enrollmentDate: '2025-09-01'
  },
  {
    id: '4',
    name: '赵六',
    avatar: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=student%20avatar%20female%20chinese%20long%20hair&size=512x512',
    grade: '高一',
    class: '三班',
    enrollmentDate: '2025-09-01'
  },
  {
    id: '5',
    name: '孙七',
    avatar: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=student%20avatar%20male%20chinese%20sporty&size=512x512',
    grade: '高一',
    class: '三班',
    enrollmentDate: '2025-09-01'
  }
];

// 模拟学生统计数据
export const studentStats: StudentStats[] = [
  {
    studentId: '1',
    questionCount: 15,
    participationRate: 0.85,
    avgQuestionScore: 4.2,
    highFrequencyQuestions: ['函数的定义域', '三角函数的性质', '数列求和'],
    lastActiveDate: '2026-01-28'
  },
  {
    studentId: '2',
    questionCount: 8,
    participationRate: 0.6,
    avgQuestionScore: 3.8,
    highFrequencyQuestions: ['几何证明', '概率计算', '不等式解法'],
    lastActiveDate: '2026-01-27'
  },
  {
    studentId: '3',
    questionCount: 22,
    participationRate: 0.95,
    avgQuestionScore: 4.5,
    highFrequencyQuestions: ['导数应用', '解析几何', '立体几何'],
    lastActiveDate: '2026-01-29'
  },
  {
    studentId: '4',
    questionCount: 5,
    participationRate: 0.4,
    avgQuestionScore: 3.5,
    highFrequencyQuestions: ['基础概念', '公式记忆', '计算错误'],
    lastActiveDate: '2026-01-26'
  },
  {
    studentId: '5',
    questionCount: 12,
    participationRate: 0.75,
    avgQuestionScore: 4.0,
    highFrequencyQuestions: ['应用题', '图表分析', '逻辑推理'],
    lastActiveDate: '2026-01-28'
  }
];

// 模拟看板数据
export const dashboardData: DashboardData = {
  totalStudents: 5,
  totalQuestions: 62,
  avgParticipationRate: 0.71,
  topStudents: [
    { studentId: '3', name: '王五', score: 4.5 },
    { studentId: '1', name: '张三', score: 4.2 },
    { studentId: '5', name: '孙七', score: 4.0 }
  ],
  questionTrend: [
    { date: '2026-01-23', count: 8 },
    { date: '2026-01-24', count: 12 },
    { date: '2026-01-25', count: 10 },
    { date: '2026-01-26', count: 8 },
    { date: '2026-01-27', count: 11 },
    { date: '2026-01-28', count: 9 },
    { date: '2026-01-29', count: 4 }
  ],
  categoryDistribution: [
    { category: '代数', count: 25 },
    { category: '几何', count: 18 },
    { category: '概率统计', count: 12 },
    { category: '其他', count: 7 }
  ]
};

// 模拟自测结果
export const selfAssessments: SelfAssessment[] = [
  {
    id: '1',
    studentId: '1',
    date: '2026-01-20',
    score: 85,
    topics: ['函数', '三角函数', '数列'],
    strengths: ['函数性质', '数列求和'],
    weaknesses: ['三角函数图像', '复合函数']
  },
  {
    id: '2',
    studentId: '2',
    date: '2026-01-18',
    score: 72,
    topics: ['几何', '概率', '不等式'],
    strengths: ['平面几何', '基础概率'],
    weaknesses: ['立体几何', '不等式证明']
  },
  {
    id: '3',
    studentId: '3',
    date: '2026-01-22',
    score: 92,
    topics: ['导数', '解析几何', '立体几何'],
    strengths: ['导数应用', '解析几何'],
    weaknesses: ['立体几何证明']
  },
  {
    id: '4',
    studentId: '4',
    date: '2026-01-15',
    score: 65,
    topics: ['基础概念', '公式应用', '计算能力'],
    strengths: ['基础概念'],
    weaknesses: ['公式应用', '计算能力']
  },
  {
    id: '5',
    studentId: '5',
    date: '2026-01-19',
    score: 78,
    topics: ['应用题', '图表分析', '逻辑推理'],
    strengths: ['图表分析', '逻辑推理'],
    weaknesses: ['复杂应用题']
  }
];

// 模拟对话历史
export const conversations: Conversation[] = [
  {
    id: '1',
    studentId: '1',
    date: '2026-01-28',
    content: '老师，我不太理解函数的定义域怎么求，特别是复合函数的情况',
    response: '复合函数的定义域需要考虑内层函数的值域是否在外侧函数的定义域内...',
    tags: ['函数', '定义域', '复合函数']
  },
  {
    id: '2',
    studentId: '1',
    date: '2026-01-27',
    content: '三角函数的周期性怎么判断？',
    response: '三角函数的周期性可以通过公式T=2π/|ω|来计算...',
    tags: ['三角函数', '周期性']
  },
  {
    id: '3',
    studentId: '3',
    date: '2026-01-29',
    content: '导数的几何意义是什么？如何应用到实际问题中？',
    response: '导数的几何意义是函数在某一点的切线斜率...',
    tags: ['导数', '几何意义', '应用']
  },
  {
    id: '4',
    studentId: '5',
    date: '2026-01-28',
    content: '概率题总是做错，有什么解题技巧吗？',
    response: '概率题的关键是明确事件类型，掌握基本公式...',
    tags: ['概率', '解题技巧']
  }
];

// 模拟学习进度分析
export const learningProgress: LearningProgress[] = [
  {
    studentId: '1',
    overallProgress: 75,
    topicProgress: [
      { topic: '函数', progress: 85 },
      { topic: '三角函数', progress: 65 },
      { topic: '数列', progress: 80 }
    ],
    recommendations: [
      '加强三角函数图像的理解和记忆',
      '多做复合函数的练习题',
      '定期复习函数性质的应用'
    ],
    riskFactors: ['三角函数掌握不够扎实']
  },
  {
    studentId: '2',
    overallProgress: 60,
    topicProgress: [
      { topic: '几何', progress: 70 },
      { topic: '概率', progress: 55 },
      { topic: '不等式', progress: 50 }
    ],
    recommendations: [
      '加强立体几何的空间想象能力',
      '多做不等式证明题',
      '参加几何专题辅导'
    ],
    riskFactors: ['立体几何基础薄弱', '不等式证明方法掌握不足']
  },
  {
    studentId: '3',
    overallProgress: 90,
    topicProgress: [
      { topic: '导数', progress: 95 },
      { topic: '解析几何', progress: 90 },
      { topic: '立体几何', progress: 85 }
    ],
    recommendations: [
      '挑战更高级的导数应用问题',
      '参加数学竞赛培训',
      '指导其他同学学习'
    ],
    riskFactors: []
  },
  {
    studentId: '4',
    overallProgress: 45,
    topicProgress: [
      { topic: '基础概念', progress: 60 },
      { topic: '公式应用', progress: 40 },
      { topic: '计算能力', progress: 35 }
    ],
    recommendations: [
      '加强基础公式的记忆和应用',
      '每天进行计算练习',
      '参加基础强化班'
    ],
    riskFactors: ['基础薄弱', '计算能力不足']
  },
  {
    studentId: '5',
    overallProgress: 70,
    topicProgress: [
      { topic: '应用题', progress: 65 },
      { topic: '图表分析', progress: 80 },
      { topic: '逻辑推理', progress: 85 }
    ],
    recommendations: [
      '多做复杂应用题的练习',
      '提高阅读和理解题目能力',
      '总结解题思路和方法'
    ],
    riskFactors: ['复杂应用题解题能力不足']
  }
];

// 模拟自定义表头配置
export const defaultTableHeaders: TableHeader[] = [
  { id: 'name', title: '学生姓名', key: 'name', visible: true },
  { id: 'questionCount', title: '提问数', key: 'questionCount', visible: true },
  { id: 'participationRate', title: '参与度', key: 'participationRate', visible: true },
  { id: 'avgQuestionScore', title: '问题质量评分', key: 'avgQuestionScore', visible: true },
  { id: 'lastActiveDate', title: '最后活跃', key: 'lastActiveDate', visible: true },
  { id: 'highFrequencyQuestions', title: '高频问题', key: 'highFrequencyQuestions', visible: false }
];

// 模拟API响应函数
export const mockApi = {
  // 获取看板数据
  getDashboardData: (): Promise<DashboardData> => {
    return Promise.resolve(dashboardData);
  },
  
  // 获取学生列表
  getStudents: (): Promise<Student[]> => {
    return Promise.resolve(students);
  },
  
  // 获取学生统计数据
  getStudentStats: (): Promise<StudentStats[]> => {
    return Promise.resolve(studentStats);
  },
  
  // 获取学生详情
  getStudentById: (id: string): Promise<Student | undefined> => {
    return Promise.resolve(students.find(s => s.id === id));
  },
  
  // 获取学生自测结果
  getSelfAssessments: (studentId: string): Promise<SelfAssessment[]> => {
    return Promise.resolve(selfAssessments.filter(a => a.studentId === studentId));
  },
  
  // 获取学生对话历史
  getConversations: (studentId: string): Promise<Conversation[]> => {
    return Promise.resolve(conversations.filter(c => c.studentId === studentId));
  },
  
  // 获取学生学习进度分析
  getLearningProgress: (studentId: string): Promise<LearningProgress | undefined> => {
    return Promise.resolve(learningProgress.find(p => p.studentId === studentId));
  },
  
  // 获取默认表头配置
  getTableHeaders: (): Promise<TableHeader[]> => {
    return Promise.resolve(defaultTableHeaders);
  }
};
