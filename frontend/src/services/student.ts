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

// 修改密码请求
export interface ChangePasswordRequest {
  current_password: string
  new_password: string
  confirm_password: string
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

export default studentClassService
