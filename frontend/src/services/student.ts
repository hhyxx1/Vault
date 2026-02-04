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

// 问答接口模型
export interface QuestionRequest {
  question: string
  session_id?: string
}

export interface QuestionResponse {
  answer: string
  session_id: string
  sources?: Array<{
    source: string
    page?: number
    content?: string
  }>
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

// 智能问答服务
export const studentQAService = {
  ask: async (data: QuestionRequest): Promise<QuestionResponse> => {
    return await apiClient.post('/student/qa/ask', data)
  },
  uploadFile: async (formData: FormData): Promise<{ session_id: string; chunk_count: number }> => {
    return await apiClient.post('/student/qa/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  getHistory: async (): Promise<any[]> => {
    return await apiClient.get('/student/qa/history')
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

export default studentClassService
