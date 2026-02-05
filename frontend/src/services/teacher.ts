import apiClient from './api'

export interface Course {
  id: string
  course_code: string
  course_name: string
  description?: string
  semester: string
  credit: number
  status: string
}

export interface CourseCreate {
  course_code: string
  course_name: string
  description?: string
  semester: string
  credit: number
}

export interface Class {
  id: string
  class_name: string
  course_id: string
  course_name: string
  max_students: number
  academic_year: string
  invite_code: string
  allow_self_enroll: boolean
  status: string
  student_count: number
  average_score: number | null
  grade?: string
  major?: string
  course_ids?: string[]  // 新增：班级关联的所有课程ID列表
}

export interface StudentInClass {
  id: string
  username: string
  full_name: string
  email: string
  student_number: string
  major: string | null
  grade: string | null
  enrollment_date: string
}

export interface ClassDetail {
  id: string
  class_name: string
  course_id: string
  course_name: string
  max_students: number
  academic_year: string
  invite_code: string
  status: string
  student_count: number
  students: StudentInClass[]
}

export interface ClassCreate {
  class_name: string
  course_ids?: string[]  // 支持多个课程
  course_id?: string     // 兼容旧版单个课程
  max_students: number
  academic_year: string
  allow_self_enroll: boolean
}

export interface ClassUpdate {
  class_name: string
  course_ids?: string[]  // 可选：更新关联的课程
  max_students: number
  academic_year: string
  allow_self_enroll: boolean
}

export interface TeacherProfile {
  id: string
  username: string
  full_name: string
  email: string
  avatar_url: string | null
  teacher_number: string
  department: string | null
  title: string | null
  join_date: string | null
}

export interface TeacherProfileUpdate {
  full_name: string
  email: string
  department: string
  title: string
}

// Dashboard 相关接口
export interface DashboardStats {
  total_students: number
  total_questions: number
  avg_participation_rate: number
  active_students: number
}

export interface StudentStatsItem {
  student_id: string
  student_name: string
  question_count: number
  participation_rate: number
  avg_score: number
  last_active_date: string | null
}

export interface QuestionTrendItem {
  date: string
  count: number
}

export interface CategoryDistributionItem {
  category: string
  count: number
}

export interface DashboardOverview {
  stats: DashboardStats
  question_trend: QuestionTrendItem[]
  category_distribution: CategoryDistributionItem[]
  student_stats: StudentStatsItem[]
}

// 获取教师个人资料
export const getTeacherProfile = async (): Promise<TeacherProfile> => {
  const response = await apiClient.get('/teacher/profile/')
  return response.data
}

// 更新教师个人资料
export const updateTeacherProfile = async (profileData: TeacherProfileUpdate): Promise<TeacherProfile> => {
  const response = await apiClient.put('/teacher/profile/', profileData)
  return response.data
}

// 上传头像
export const uploadAvatar = async (file: File): Promise<{ avatar_url: string }> => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await apiClient.post('/teacher/profile/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

// 获取教师的所有课程
export const getTeacherCourses = async (): Promise<Course[]> => {
  const response = await apiClient.get('/teacher/profile/courses')
  return response.data
}

// 创建新课程
export const createCourse = async (courseData: CourseCreate): Promise<Course> => {
  const response = await apiClient.post('/teacher/profile/courses', courseData)
  return response.data
}

// 删除课程
export const deleteCourse = async (courseId: string): Promise<void> => {
  await apiClient.delete(`/teacher/profile/courses/${courseId}`)
}

// 获取教师的所有班级
export const getTeacherClasses = async (): Promise<Class[]> => {
  const response = await apiClient.get('/teacher/profile/classes')
  return response.data
}

// 创建新班级
export const createClass = async (classData: ClassCreate): Promise<Class> => {
  const response = await apiClient.post('/teacher/profile/classes', classData)
  return response.data
}

// 删除班级
export const deleteClass = async (classId: string): Promise<void> => {
  await apiClient.delete(`/teacher/profile/classes/${classId}`)
}

// 更新班级
export const updateClass = async (classId: string, classData: ClassUpdate): Promise<Class> => {
  const response = await apiClient.put(`/teacher/profile/classes/${classId}`, classData)
  return response.data
}

// 获取班级学生列表
export const getClassStudents = async (classId: string): Promise<ClassDetail> => {
  const response = await apiClient.get(`/teacher/profile/classes/${classId}/students`)
  return response.data
}

// 修改密码
export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
}

export const changePassword = async (passwordData: ChangePasswordRequest): Promise<{ message: string }> => {
  const response = await apiClient.post('/auth/change-password', passwordData)
  return response.data
}

// ===== 知识库相关 =====

export interface DocumentResponse {
  id: string
  course_id: string
  course_name: string
  file_name: string
  file_type: string
  file_size: number
  upload_status: string
  processed_status: string | null
  error_message: string | null
  created_at: string
}

export interface CourseDocumentsResponse {
  course_id: string
  course_name: string
  document_count: number
  documents: DocumentResponse[]
}

export interface KnowledgeBaseStats {
  total_documents: number
  total_courses_with_docs: number
  documents_by_course: Array<{
    course_id: string
    course_name: string
    document_count: number
    total_size: number
  }>
}

// 上传课程文档
export const uploadCourseDocument = async (courseId: string, file: File): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await apiClient.post(`/teacher/knowledge-base/courses/${courseId}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

// 获取课程的所有文档
export const getCourseDocuments = async (courseId: string): Promise<CourseDocumentsResponse> => {
  const response = await apiClient.get(`/teacher/knowledge-base/courses/${courseId}/documents`)
  return response.data
}

// 获取知识库统计信息
export const getKnowledgeBaseStats = async (): Promise<KnowledgeBaseStats> => {
  const response = await apiClient.get('/teacher/knowledge-base/knowledge-base/stats')
  return response.data
}

// 删除文档
export const deleteDocument = async (documentId: string): Promise<void> => {
  await apiClient.delete(`/teacher/knowledge-base/documents/${documentId}`)
}

// 获取教师看板概览数据
export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  const response = await apiClient.get('/teacher/dashboard/overview')
  return response.data
}
