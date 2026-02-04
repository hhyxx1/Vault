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
    const response = await apiClient.post<{ avatar_url: string }>('/teacher/profile/avatar', formData, {
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

// 更新班级
export const updateClass = async (classId: string, classData: ClassUpdate): Promise<Class> => {
  return await apiClient.put(`/teacher/profile/classes/${classId}`, classData)
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

// 上传课程文档 (兼容旧版)
export const uploadCourseDocument = async (courseId: string, file: File): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('document_type', 'material') // 默认为资料
  
  return await apiClient.post(`/teacher/documents/courses/${courseId}/documents/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// ===== 知识库相关 (已迁移至 documents.ts) =====
export * from './documents'

// ===== 教师仪表盘相关 =====

export interface DashboardData {
  totalStudents: number
  totalQuestions: number
  avgParticipationRate: number
  topStudents: Array<{
    studentId: string
    name: string
    score: number
  }>
  questionTrend: Array<{
    date: string
    count: number
  }>
  categoryDistribution: Array<{
    category: string
    count: number
  }>
}

export interface Student {
  id: string
  name: string
  avatar: string
  grade: string
  class: string
  enrollmentDate: string
}

export interface StudentStats {
  studentId: string
  questionCount: number
  participationRate: number
  avgQuestionScore: number
  highFrequencyQuestions: string[]
  lastActiveDate: string
}

export interface TableHeader {
  id: string
  title: string
  key: string
  visible: boolean
}

// 获取教师仪表盘数据
export const getDashboardData = async (): Promise<DashboardData> => {
  return await apiClient.get('/teacher/dashboard/')
}

// 获取学生列表
export const getStudents = async (): Promise<Student[]> => {
  return await apiClient.get('/teacher/dashboard/students')
}

// 获取学生统计数据
export const getStudentStats = async (): Promise<StudentStats[]> => {
  return await apiClient.get('/teacher/dashboard/student-stats')
}

// 获取表格表头配置
export const getTableHeaders = async (): Promise<TableHeader[]> => {
  return await apiClient.get('/teacher/dashboard/table-headers')
}
