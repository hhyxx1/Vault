import apiClient from './api'

// Chatbox 问答
export interface SourceItem {
  content: string
  file_name: string
  page_label: string
  score?: number
}

export interface AskQuestionResponse {
  answer: string
  question_id: string
  sources: SourceItem[]
}

export const askQuestion = async (
  question: string,
  courseId?: string
): Promise<AskQuestionResponse> => {
  return await apiClient.post('/student/qa/ask', {
    question,
    course_id: courseId ?? null
  })
}

export interface QAHistoryItem {
  id: string
  question: string
  answer: string
  timestamp: string
  course_id?: string
}

export const getQAHistory = async (): Promise<QAHistoryItem[]> => {
  return await apiClient.get<QAHistoryItem[]>('/student/qa/history')
}

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
    const response = await apiClient.post<{ avatar_url: string }>('/student/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    console.log('上传响应:', response)
    return response as unknown as { avatar_url: string }
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
  const data = await apiClient.get<Blob>(
    `/student/courses/${courseId}/documents/${documentId}/download`,
    { responseType: 'blob' }
  )
  return data as unknown as Blob
}

/** 以 PDF 形式预览文档（完整页数）。PPTX 会由服务端转为 PDF（需 LibreOffice）。失败时抛出。 */
export const getCourseDocumentPreviewPdf = async (
  courseId: string,
  documentId: string
): Promise<Blob> => {
  const data = await apiClient.get<Blob>(
    `/student/courses/${courseId}/documents/${documentId}/preview-pdf`,
    { responseType: 'blob' }
  )
  return data as unknown as Blob
}

// QA上传文档
export interface UploadDocumentResponse {
  message: string
  file_name: string
  status: string
}

export const uploadQADocument = async (
  file: File,
  courseId?: string
): Promise<UploadDocumentResponse> => {
  const formData = new FormData()
  formData.append('file', file)
  if (courseId) {
    formData.append('course_id', courseId)
  }
  
  return await apiClient.post<UploadDocumentResponse>('/student/qa/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// QA分享相关接口
export interface ShareRequest {
  title: string
  description?: string
  access_password?: string
  expires_in_hours?: number
  session_id?: string
  qa_record_id?: string
  limit?: number
}

export interface ShareResponse {
  share_code: string
  share_url: string
  expires_at: string
  access_required: boolean
}

export interface SharedQAItem {
  question: string
  answer: string
  timestamp: string
}

export interface SharedSessionResponse {
  share_code: string
  title: string
  description?: string
  sharer_name: string
  created_at: string
  expires_at?: string
  view_count: number
  items: SharedQAItem[]
}

export const createQAShare = async (shareData: ShareRequest): Promise<ShareResponse> => {
  return await apiClient.post<ShareResponse>('/student/qa/share', shareData)
}

export const getSharedQA = async (
  shareCode: string,
  accessPassword?: string
): Promise<SharedSessionResponse> => {
  const params: any = {}
  if (accessPassword) {
    params.access_password = accessPassword
  }
  
  return await apiClient.get<SharedSessionResponse>(`/student/qa/share/${shareCode}`, { params })
}

export const deleteQAShare = async (shareCode: string): Promise<{ message: string }> => {
  return await apiClient.delete<{ message: string }>(`/student/qa/share/${shareCode}`)
}

export default studentClassService
