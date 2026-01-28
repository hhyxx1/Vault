import apiClient from './api'

// 认证相关API
export const authApi = {
  // 用户注册
  register: async (data: any) => {
    return apiClient.post('/auth/register', data)
  },
  
  // 用户登录
  login: async (username: string, password: string) => {
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
  // 获取问卷列表
  getSurveys: async () => {
    return apiClient.get('/student/surveys')
  },
  
  // 获取问卷详情
  getSurveyDetail: async (surveyId: string) => {
    return apiClient.get(`/student/surveys/${surveyId}`)
  },
  
  // 提交问卷
  submitSurvey: async (surveyId: string, answers: Record<string, any>) => {
    return apiClient.post(`/student/surveys/${surveyId}/submit`, { answers })
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
  getSurveys: async () => {
    return apiClient.get('/teacher/surveys')
  },
  
  // 创建问卷（保存解析后的问卷）
  createSurvey: async (surveyData: any) => {
    return apiClient.post('/teacher/surveys', surveyData)
  },
  
  // 发布问卷
  publishSurvey: async (surveyId: string) => {
    return apiClient.put(`/teacher/surveys/${surveyId}/publish`)
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
    return apiClient.get(`/teacher/surveys/${surveyId}/results`)
  },
  
  // 上传Word文档并解析
  uploadWord: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    
    return apiClient.post('/teacher/surveys/upload-word', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
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
}

// 为了保持向后兼容，也导出为teacherSurveyApi
export const teacherSurveyApi = surveyApi
