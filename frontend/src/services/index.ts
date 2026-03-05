import apiClient from './api'

// 认证相关API
export const authApi = {
  // 用户注册
  register: async (data: any) => {
    const response = await apiClient.post('/auth/register', data)
    return response.data
  },
  
  // 用户登录
  login: async (username: string, password: string) => {
    const response = await apiClient.post('/auth/login', { username, password })
    return response.data
  },
  
  // 发送密码重置验证码
  sendResetCode: async (email: string) => {
    const response = await apiClient.post('/auth/send-reset-code', { email })
    return response.data
  },
  
  // 验证密码重置验证码
  verifyResetCode: async (email: string, code: string) => {
    const response = await apiClient.post('/auth/verify-reset-code', { email, code })
    return response.data
  },
  
  // 重置密码
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await apiClient.post('/auth/reset-password', { 
      email, 
      code, 
      new_password: newPassword 
    })
    return response.data
  },
}

// 学生端 - 智能问答相关API
export const qaApi = {
  // 提交问题
  askQuestion: async (question: string) => {
    return apiClient.post('/student/qa/ask', { question })
  },
  
  // 获取历史记录
  getHistory: async () => {
    return apiClient.get('/student/qa/history')
  },
}

// 学生端 - 问卷相关API
export const studentSurveyApi = {
  // 获取问卷列表（按发布类型：in_class=课堂检测, homework=课后作业, practice=自主练习）
  getSurveys: async (releaseType?: 'in_class' | 'homework' | 'practice' | 'ability_test') => {
    const params = releaseType ? { release_type: releaseType } : {}
    const response = await apiClient.get('/student/surveys', { params })
    return response.data
  },
  
  // 获取问卷详情
  getSurveyDetail: async (surveyId: string) => {
    const response = await apiClient.get(`/student/surveys/${surveyId}`)
    return response.data
  },
  
  // 提交问卷
  submitSurvey: async (surveyId: string, answers: Record<string, any>) => {
    const response = await apiClient.post(`/student/surveys/${surveyId}/submit`, { answers })
    return response.data
  },

  // 获取当前学生在该问卷的作答状态与成绩（查看详情用）
  getMyResult: async (surveyId: string) => {
    const response = await apiClient.get(`/student/surveys/${surveyId}/my-result`)
    return response.data
  },
}

// 教师端 - 看板相关API
export const dashboardApi = {
  // 获取完整概览数据
  getOverview: async () => {
    return apiClient.get('/teacher/dashboard/overview')
  },
  
  // 获取统计数据
  getStats: async () => {
    return apiClient.get('/teacher/dashboard/stats')
  },
  
  // 获取最近问题
  getRecentQuestions: async () => {
    return apiClient.get('/teacher/dashboard/recent-questions')
  },
  
  // 获取教师班级列表
  getClasses: async () => {
    return apiClient.get('/teacher/dashboard/classes')
  },

  // 创建自定义洞察卡片
  createCustomInsight: async (data: { question: string }) => {
    return apiClient.post('/teacher/dashboard/custom-insight', data)
  },

  // 获取所有自定义洞察卡片
  getCustomInsights: async () => {
    return apiClient.get('/teacher/dashboard/custom-insights')
  },

  // 获取单个洞察卡片（用于轮询状态）
  getCustomInsight: async (cardId: string) => {
    return apiClient.get(`/teacher/dashboard/custom-insight/${cardId}`)
  },

  // 删除洞察卡片
  deleteCustomInsight: async (cardId: string) => {
    return apiClient.delete(`/teacher/dashboard/custom-insight/${cardId}`)
  },
  
  // 获取班级详情
  getClassDetail: async (classId: string) => {
    return apiClient.get(`/teacher/dashboard/classes/${classId}`)
  },
}

// 教师端 - 问卷管理API
export const surveyApi = {
  // 获取问卷列表
  getSurveys: async () => {
    const response = await apiClient.get('/teacher/surveys')
    return response.data
  },
  
  // 获取问卷详情
  getSurveyDetail: async (surveyId: string) => {
    const response = await apiClient.get(`/teacher/surveys/${surveyId}`)
    return response.data
  },
  
  // 创建问卷（保存解析后的问卷）
  createSurvey: async (surveyData: any) => {
    return apiClient.post('/teacher/surveys', surveyData)
  },
  
  // 更新问卷
  updateSurvey: async (surveyId: string, surveyData: any) => {
    return apiClient.put(`/teacher/surveys/${surveyId}`, surveyData)
  },
  
  // 发布问卷（选择班级与发布类型）- 请求体使用 snake_case 与后端一致
  publishSurvey: async (
    surveyId: string,
    options?: { 
      classIds: string[]
      releaseType: 'in_class' | 'homework' | 'practice' | 'ability_test'
      startTime?: string
      endTime?: string
    }
  ) => {
    const opts = options ?? { classIds: [], releaseType: 'in_class' }
    if (!opts.classIds?.length) {
      throw new Error('请至少选择一个班级')
    }
    return apiClient.put(`/teacher/surveys/${surveyId}/publish`, {
      class_ids: opts.classIds,
      release_type: opts.releaseType,
      start_time: opts.startTime,
      end_time: opts.endTime,
    })
  },
  
  // 取消发布问卷
  unpublishSurvey: async (surveyId: string) => {
    return apiClient.put(`/teacher/surveys/${surveyId}/unpublish`)
  },
  
  // 删除问卷
  deleteSurvey: async (surveyId: string) => {
    return apiClient.delete(`/teacher/surveys/${surveyId}`)
  },
  
  // 获取问卷结果
  getSurveyResults: async (surveyId: string) => {
    const response = await apiClient.get(`/teacher/surveys/${surveyId}/results`)
    return response.data
  },
  
  // 上传Word文档并解析
  uploadWord: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/teacher/surveys/upload-word', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
  
  // 删除上传的文件
  deleteUploadedFile: async (fileId: string) => {
    return apiClient.delete(`/teacher/surveys/uploaded-file/${fileId}`)
  },
  
  // 使用数据库中已有的文件（删除新上传的临时文件）
  useDatabaseFile: async (newFileId: string) => {
    return apiClient.post(`/teacher/surveys/use-database-file/${newFileId}`)
  },
  
  // 确认使用新文件（删除旧文件，保存新文件到向量数据库）
  confirmNewFile: async (data: { new_file_id: string; old_file_id: string; filename: string; questions: any[] }) => {
    return apiClient.post('/teacher/surveys/confirm-new-file', data)
  },
  
  // 搜索相似问题
  searchSimilar: async (query: string, limit: number = 5) => {
    return apiClient.get('/teacher/surveys/search-similar', {
      params: { query, limit }
    })
  },
  
  // 手动创建问卷（直接创建不经过Word解析）
  createManualSurvey: async (surveyData: { title: string; description?: string; questions: any[] }) => {
    return apiClient.post('/teacher/surveys/manual', surveyData)
  },
  
  // 上传文件（用于问答题参考材料）
  uploadFile: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    
    return apiClient.post('/teacher/surveys/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  
  // ========== 学生成绩管理 API ==========
  
  // 获取学生成绩列表
  getStudentScores: async (surveyId: string) => {
    const response = await apiClient.get(`/teacher/surveys/${surveyId}/student-scores`)
    return response.data
  },
  
  // 获取学生答卷详情
  getStudentAnswers: async (surveyId: string, studentId: string) => {
    const response = await apiClient.get(`/teacher/surveys/${surveyId}/student/${studentId}/answers`)
    return response.data
  },
  
  // 修改学生总分
  updateStudentScore: async (surveyId: string, studentId: string, totalScore: number, comment?: string) => {
    return apiClient.put(`/teacher/surveys/${surveyId}/student/${studentId}/score`, {
      total_score: totalScore,
      comment
    })
  },
  
  // 修改单题分数
  updateQuestionScore: async (surveyId: string, questionId: string, studentId: string, score: number, comment?: string) => {
    return apiClient.put(`/teacher/surveys/${surveyId}/question/${questionId}/student/${studentId}/score`, null, {
      params: { score, comment }
    })
  },
  
  // 发布成绩
  publishScores: async (surveyId: string) => {
    return apiClient.post(`/teacher/surveys/${surveyId}/publish-scores`)
  },
  
  // 取消发布成绩
  unpublishScores: async (surveyId: string) => {
    return apiClient.post(`/teacher/surveys/${surveyId}/unpublish-scores`)
  },
}

// 为了保持向后兼容，也导出为teacherSurveyApi
export const teacherSurveyApi = surveyApi

// 学生端 - 学习计划API
export const learningPlanApi = {
  // 获取学习分析数据
  getAnalysis: async () => {
    const response = await apiClient.get('/student/learning-plan/analysis')
    return response.data
  },
  
  // 生成学习计划（支持包含所有类型问卷的成绩）
  generatePlan: async (includeAll: boolean = false) => {
    const response = await apiClient.post(`/student/learning-plan/generate?include_all=${includeAll}`)
    return response.data
  },
  
  // 获取薄弱知识点（简化版）
  getWeakPoints: async () => {
    const response = await apiClient.get('/student/learning-plan/weak-points')
    return response.data
  },
}

// 为了保持向后兼容，导出为learningPlanService
export const learningPlanService = learningPlanApi
