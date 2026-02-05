import apiClient from './api'

// 班级信息
export interface ClassInfo {
  id: string
  class_name: string
  course_id: string
  course_name: string
  course_code: string
  teacher_name: string
  academic_year: string
  max_students: number
  current_students: number
  enrollment_date: string
}

// 学生个人资料
export interface StudentProfile {
  id: string
  username: string
  full_name: string
  email: string
  avatar_url: string | null
  student_number: string
  major: string | null
  grade: string | null
  class_name: string | null
  total_questions: number
  total_scores: number
  join_date: string | null
}

// 学生个人资料更新
export interface StudentProfileUpdate {
  full_name: string
  email: string
  major: string
  grade: string
}

// 修改密码请求
export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
}

// 获取学生个人资料
export const getStudentProfile = async (): Promise<StudentProfile> => {
  return await apiClient.get('/student/profile/')
}

// 更新学生个人资料
export const updateStudentProfile = async (profileData: StudentProfileUpdate): Promise<StudentProfile> => {
  return await apiClient.put('/student/profile/', profileData)
}

// 上传头像
export const uploadStudentAvatar = async (file: File): Promise<{ avatar_url: string }> => {
  console.log('uploadStudentAvatar 函数被调用, 文件:', file.name, file.size, 'bytes')
  const formData = new FormData()
  formData.append('file', file)
  
  console.log('FormData 内容:', formData.get('file'))
  console.log('发送POST请求到: /student/profile/avatar')
  
  try {
    const response = await apiClient.post('/student/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    console.log('上传响应:', response)
    return response
  } catch (error) {
    console.error('上传请求失败:', error)
    throw error
  }
}

// 修改密码
export const changePassword = async (passwordData: ChangePasswordRequest): Promise<{ message: string }> => {
  return await apiClient.post('/auth/change-password', passwordData)
}

// 学生班级服务
export const studentClassService = {
  // 通过邀请码加入班级
  joinClass: async (inviteCode: string): Promise<ClassInfo> => {
    return await apiClient.post('/student/classes/join', {
      invite_code: inviteCode
    })
  },

  // 获取我加入的班级列表
  getMyClasses: async (): Promise<ClassInfo[]> => {
    return await apiClient.get('/student/classes/my-classes')
  }
}

// 课程文档相关接口
export interface CourseDocument {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_at: string
}

export interface CourseDocumentsResponse {
  course_id: string
  course_code: string
  course_name: string
  teacher_name: string
  documents: CourseDocument[]
  total_count: number
}

// 获取课程文档列表
export const getCourseDocuments = async (courseId: string): Promise<CourseDocumentsResponse> => {
  return await apiClient.get(`/student/courses/${courseId}/documents`)
}

// 通过带认证的请求下载课程文档（返回 Blob，用于触发下载或预览）
export const downloadCourseDocumentAsBlob = async (
  courseId: string,
  documentId: string
): Promise<Blob> => {
  const data = await apiClient.get(
    `/student/courses/${courseId}/documents/${documentId}/download`,
    { responseType: 'blob' }
  )
  return data as Blob
}

/** 以 PDF 形式预览文档（完整页数）。PPTX 会由服务端转为 PDF（需 LibreOffice）。失败时抛出。 */
export const getCourseDocumentPreviewPdf = async (
  courseId: string,
  documentId: string
): Promise<Blob> => {
  const data = await apiClient.get(
    `/student/courses/${courseId}/documents/${documentId}/preview-pdf`,
    { responseType: 'blob' }
  )
  return data as Blob
}

// 智能问答相关接口
export interface QuestionRequest {
  question: string
  session_id?: string
}

export interface QuestionResponse {
  answer: string
  session_id: string
  sources: Array<{
    filename?: string
    source?: string
    page?: number
    content?: string
  }>
  intent?: string
  skill_used?: string
}

export interface UploadFileResponse {
  success: boolean
  session_id: string
  file_id: string
  filename: string
  file_info: {
    category: string
    icon: string
    color: string
    extension: string
    is_code: boolean
    is_document: boolean
  }
  chunk_count: number
  can_analyze: boolean
  can_summarize: boolean
  message: string
}

export interface ShareResponse {
  success: boolean
  share_code?: string
  share_url?: string
  message_count?: number
  error?: string
}

export interface SharedConversation {
  success: boolean
  title?: string
  messages?: Array<{
    role: 'user' | 'assistant'
    content: string
    sources?: any[]
    timestamp?: string
  }>
  created_at?: string
  error?: string
}

export interface FileUploadEnhancedResponse {
  success: boolean
  file_id: string
  filename: string
  file_info: {
    category: string
    icon: string
    color: string
    extension: string
    is_code: boolean
    is_document: boolean
  }
  preview?: string
  can_analyze: boolean
  can_summarize: boolean
  message: string
}

export interface FileAnalysisRequest {
  file_id: string
  analysis_type: 'code_analysis' | 'document_summary'
  session_id?: string
}

export interface FileAnalysisResponse {
  success: boolean
  answer: string
  session_id: string
  filename: string
  analysis_type: string
}

// 智能问答服务
export const studentQAService = {
  // 提问
  ask: async (data: QuestionRequest): Promise<QuestionResponse> => {
    return await apiClient.post('/student/qa/ask', data)
  },

  // 上传文件（旧版）
  uploadFile: async (formData: FormData): Promise<UploadFileResponse> => {
    return await apiClient.post('/student/qa/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 上传文件（增强版 - 支持预览和分析）
  uploadFileEnhanced: async (formData: FormData): Promise<FileUploadEnhancedResponse> => {
    return await apiClient.post('/student/qa/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  // 分析文件（代码分析或文档总结）
  analyzeFile: async (data: FileAnalysisRequest): Promise<FileAnalysisResponse> => {
    return await apiClient.post('/student/qa/analyze-file', data)
  },

  // 获取历史记录
  getHistory: async (): Promise<any[]> => {
    return await apiClient.get('/student/qa/history')
  },

  // 创建分享
  createShare: async (sessionId: string): Promise<ShareResponse> => {
    return await apiClient.post('/student/qa/share', { session_id: sessionId })
  },

  // 获取分享的对话
  getSharedConversation: async (shareCode: string): Promise<SharedConversation> => {
    return await apiClient.get(`/student/qa/shared/${shareCode}`)
  },

  // 获取会话消息
  getSessionMessages: async (sessionId: string): Promise<{ messages: any[], session_id: string }> => {
    return await apiClient.get(`/student/qa/session/${sessionId}/messages`)
  }
}

export default studentClassService
