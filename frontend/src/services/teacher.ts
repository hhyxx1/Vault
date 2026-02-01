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
  course_id: string
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

// 获取教师个人资料
export const getTeacherProfile = async (): Promise<TeacherProfile> => {
  return await apiClient.get('/teacher/profile/')
}

// 更新教师个人资料
export const updateTeacherProfile = async (profileData: TeacherProfileUpdate): Promise<TeacherProfile> => {
  return await apiClient.put('/teacher/profile/', profileData)
}

// 上传头像
export const uploadAvatar = async (file: File): Promise<{ avatar_url: string }> => {
  console.log('uploadAvatar 函数被调用, 文件:', file.name, file.size, 'bytes')
  const formData = new FormData()
  formData.append('file', file)
  
  console.log('FormData 内容:', formData.get('file'))
  console.log('发送POST请求到: /teacher/profile/avatar')
  
  try {
    const response = await apiClient.post('/teacher/profile/avatar', formData, {
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

// 获取教师的所有课程
export const getTeacherCourses = async (): Promise<Course[]> => {
  return await apiClient.get('/teacher/profile/courses')
}

// 创建新课程
export const createCourse = async (courseData: CourseCreate): Promise<Course> => {
  return await apiClient.post('/teacher/profile/courses', courseData)
}

// 删除课程
export const deleteCourse = async (courseId: string): Promise<void> => {
  return await apiClient.delete(`/teacher/profile/courses/${courseId}`)
}

// 获取教师的所有班级
export const getTeacherClasses = async (): Promise<Class[]> => {
  return await apiClient.get('/teacher/profile/classes')
}

// 创建新班级
export const createClass = async (classData: ClassCreate): Promise<Class> => {
  return await apiClient.post('/teacher/profile/classes', classData)
}

// 删除班级
export const deleteClass = async (classId: string): Promise<void> => {
  return await apiClient.delete(`/teacher/profile/classes/${classId}`)
}

// 获取班级学生列表
export const getClassStudents = async (classId: string): Promise<ClassDetail> => {
  return await apiClient.get(`/teacher/profile/classes/${classId}/students`)
}

// 修改密码
export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
}

export const changePassword = async (passwordData: ChangePasswordRequest): Promise<{ message: string }> => {
  return await apiClient.post('/auth/change-password', passwordData)
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
  
  return await apiClient.post(`/teacher/knowledge-base/courses/${courseId}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// 获取课程的所有文档
export const getCourseDocuments = async (courseId: string): Promise<CourseDocumentsResponse> => {
  return await apiClient.get(`/teacher/knowledge-base/courses/${courseId}/documents`)
}

// 获取知识库统计信息
export const getKnowledgeBaseStats = async (): Promise<KnowledgeBaseStats> => {
  return await apiClient.get('/teacher/knowledge-base/knowledge-base/stats')
}

// 删除文档
export const deleteDocument = async (documentId: string): Promise<void> => {
  return await apiClient.delete(`/teacher/knowledge-base/documents/${documentId}`)
}
