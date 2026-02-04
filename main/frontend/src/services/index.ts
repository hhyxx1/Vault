import apiClient from './api'

// 认证相关API
interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    role: string;
    [key: string]: any;
  };
}

interface RegisterResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    role: string;
    [key: string]: any;
  };
}

export const authApi = {
  // 用户注册
  register: async (data: any): Promise<RegisterResponse> => {
    return apiClient.post('/auth/register', data)
  },
  
  // 用户登录
  login: async (username: string, password: string): Promise<LoginResponse> => {
    return apiClient.post('/auth/login', { username, password })
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
  getSurveys: async (releaseType?: 'in_class' | 'homework' | 'practice') => {
    const params = releaseType ? { release_type: releaseType } : {}
    return apiClient.get('/student/surveys', { params })
  },
  
  // 获取问卷详情
  getSurveyDetail: async (surveyId: string) => {
    return apiClient.get(`/student/surveys/${surveyId}`)
  },
  
  // 提交问卷
  submitSurvey: async (surveyId: string, answers: Record<string, any>) => {
    return apiClient.post(`/student/surveys/${surveyId}/submit`, { answers })
  },

  // 获取当前学生在该问卷的作答状态与成绩（查看详情用）
  getMyResult: async (surveyId: string) => {
    return apiClient.get(`/student/surveys/${surveyId}/my-result`)
  },
}

// 教师端 - 看板相关API
export const dashboardApi = {
  // 获取统计数据
  getStats: async () => {
    return apiClient.get('/teacher/dashboard/stats')
  },
  
  // 获取最近问题
  getRecentQuestions: async () => {
    return apiClient.get('/teacher/dashboard/recent-questions')
  },
}

// 教师端 - 问卷管理API
export const surveyApi = {
  // 获取问卷列表
  getSurveys: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/teacher/surveys')
    return res as unknown as any[]
  },
  
  // 获取问卷详情
  getSurveyDetail: async (surveyId: string): Promise<any> => {
    const res = await apiClient.get<any>(`/teacher/surveys/${surveyId}`)
    return res as unknown as any
  },
  
  // 创建问卷（保存解析后的问卷）
  createSurvey: async (surveyData: any): Promise<any> => {
    const res = await apiClient.post<any>('/teacher/surveys', surveyData)
    return res as unknown as any
  },
  
  // 更新问卷
  updateSurvey: async (surveyId: string, surveyData: any): Promise<any> => {
    const res = await apiClient.put<any>(`/teacher/surveys/${surveyId}`, surveyData)
    return res as unknown as any
  },
  
  // 发布问卷（选择班级与发布类型）- 请求体使用 snake_case 与后端一致
  publishSurvey: async (
    surveyId: string,
    options?: { classIds: string[]; releaseType: 'in_class' | 'homework' | 'practice' }
  ): Promise<any> => {
    const opts = options ?? { classIds: [], releaseType: 'in_class' }
    if (!opts.classIds?.length) {
      throw new Error('请至少选择一个班级')
    }
    const res = await apiClient.put<any>(`/teacher/surveys/${surveyId}/publish`, {
      class_ids: opts.classIds,
      release_type: opts.releaseType,
    })
    return res as unknown as any
  },
  
  // 取消发布问卷
  unpublishSurvey: async (surveyId: string): Promise<any> => {
    const res = await apiClient.put<any>(`/teacher/surveys/${surveyId}/unpublish`)
    return res as unknown as any
  },
  
  // 删除问卷
  deleteSurvey: async (surveyId: string): Promise<any> => {
    const res = await apiClient.delete<any>(`/teacher/surveys/${surveyId}`)
    return res as unknown as any
  },
  
  // 获取问卷结果
  getSurveyResults: async (surveyId: string): Promise<any> => {
    const res = await apiClient.get<any>(`/teacher/surveys/${surveyId}/results`)
    return res as unknown as any
  },
  
  // 上传Word文档并解析
  uploadWord: async (file: File): Promise<{
    success: boolean
    file_id: string
    filename: string
    questions: any[]
    validation: { is_valid: boolean; errors: string[]; question_count: number }
    is_duplicate?: boolean
    duplicate_info?: any
    message?: string
  }> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const res = await apiClient.post<{
      success: boolean
      file_id: string
      filename: string
      questions: any[]
      validation: { is_valid: boolean; errors: string[]; question_count: number }
      is_duplicate?: boolean
      duplicate_info?: any
      message?: string
    }>('/teacher/surveys/upload-word', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res as unknown as {
      success: boolean
      file_id: string
      filename: string
      questions: any[]
      validation: { is_valid: boolean; errors: string[]; question_count: number }
      is_duplicate?: boolean
      duplicate_info?: any
      message?: string
    }
  },
  
  // 删除上传的文件
  deleteUploadedFile: async (fileId: string): Promise<any> => {
    const res = await apiClient.delete<any>(`/teacher/surveys/uploaded-file/${fileId}`)
    return res as unknown as any
  },
  
  // 使用数据库中已有的文件（删除新上传的临时文件）
  useDatabaseFile: async (newFileId: string): Promise<any> => {
    const res = await apiClient.post<any>(`/teacher/surveys/use-database-file/${newFileId}`)
    return res as unknown as any
  },
  
  // 确认使用新文件（删除旧文件，保存新文件到向量数据库）
  confirmNewFile: async (data: { new_file_id: string; old_file_id: string; filename: string; questions: any[] }): Promise<any> => {
    const res = await apiClient.post<any>('/teacher/surveys/confirm-new-file', data)
    return res as unknown as any
  },
  
  // 搜索相似问题
  searchSimilar: async (query: string, limit: number = 5): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/teacher/surveys/search-similar', {
      params: { query, limit }
    })
    return res as unknown as any[]
  },
  
  // 手动创建问卷（直接创建不经过Word解析）
  createManualSurvey: async (surveyData: { title: string; description?: string; questions: any[] }): Promise<{ id: string }> => {
    const res = await apiClient.post<{ id: string }>('/teacher/surveys/manual', surveyData)
    return res as unknown as { id: string }
  },
  
  // 上传文件（用于问答题参考材料）
  uploadFile: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const res = await apiClient.post<{ url: string }>('/teacher/surveys/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res as unknown as { url: string }
  },
}

// 为了保持向后兼容，也导出为teacherSurveyApi
export const teacherSurveyApi = surveyApi

// 导出其他服务
export * from './teacher'
export * from './documents'
export * from './surveyGeneration'
export * from './student'
