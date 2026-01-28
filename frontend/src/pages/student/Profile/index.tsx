import { useState, useEffect } from 'react'
import { studentClassService, ClassInfo, changePassword, ChangePasswordRequest } from '../../../services/student'

type TabType = 'info' | 'courses' | 'join' | 'password'

const StudentProfile = () => {
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [enrolledClasses, setEnrolledClasses] = useState<ClassInfo[]>([])
  const [studentInfo] = useState({
    fullName: '李明',
    studentNumber: 'S202100123',
    major: '计算机科学与技术',
    grade: '2021级',
    email: 'liming@example.com',
    avatar: ''
  })

  // 密码表单状态
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // 获取学生加入的班级列表
  useEffect(() => {
    if (activeTab === 'courses') {
      loadMyClasses()
    }
  }, [activeTab])

  const loadMyClasses = async () => {
    try {
      const classes = await studentClassService.getMyClasses()
      setEnrolledClasses(classes)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
    }
  }

  const handleJoinClass = async () => {
    if (!inviteCode.trim()) {
      setError('请输入邀请码')
      return
    }
    
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const result = await studentClassService.joinClass(inviteCode.trim())
      setSuccess(`成功加入班级：${result.class_name}`)
      setInviteCode('')
      // 重新加载班级列表
      await loadMyClasses()
      // 3秒后切换到"我的课程"标签
      setTimeout(() => {
        setActiveTab('courses')
        setSuccess('')
      }, 3000)
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || '加入班级失败，请检查邀请码是否正确'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // 修改密码
  const handleChangePassword = async () => {
    // 验证表单
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      alert('请填写所有密码字段')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      alert('新密码长度至少为6位')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('新密码和确认密码不一致')
      return
    }

    try {
      setPasswordLoading(true)
      const passwordData: ChangePasswordRequest = {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
        confirm_password: passwordForm.confirmPassword
      }
      
      await changePassword(passwordData)
      
      // 清空表单
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      
      alert('密码修改成功！')
      
    } catch (error: any) {
      console.error('修改密码失败:', error)
      const errorMessage = error.response?.data?.detail || '修改密码失败，请重试'
      alert(errorMessage)
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-3xl font-bold">
              {studentInfo.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{studentInfo.fullName}</h1>
              <div className="flex items-center space-x-4 text-gray-600">
                <span className="flex items-center">
                  <span className="font-medium mr-2">学号:</span> {studentInfo.studentNumber}
                </span>
                <span className="flex items-center">
                  <span className="font-medium mr-2">专业:</span> {studentInfo.major}
                </span>
                <span className="flex items-center">
                  <span className="font-medium mr-2">年级:</span> {studentInfo.grade}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="bg-white rounded-t-2xl shadow-lg">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                activeTab === 'info'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              📝 个人信息
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                activeTab === 'courses'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              📚 我的课程
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                activeTab === 'join'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              ➕ 加入班级
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                activeTab === 'password'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              🔒 修改密码
            </button>
          </div>

          {/* 标签页内容 */}
          <div className="p-8">
            {/* 个人信息 */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">个人信息</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">真实姓名</label>
                    <input
                      type="text"
                      value={studentInfo.fullName}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">学号</label>
                    <input
                      type="text"
                      value={studentInfo.studentNumber}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">专业</label>
                    <input
                      type="text"
                      value={studentInfo.major}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">年级</label>
                    <input
                      type="text"
                      value={studentInfo.grade}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                    <input
                      type="email"
                      value={studentInfo.email}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <button className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl">
                  保存修改
                </button>
              </div>
            )}

            {/* 我的课程 */}
            {activeTab === 'courses' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">我的班级</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {enrolledClasses.map(classInfo => (
                    <div key={classInfo.id} className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{classInfo.course_name}</h3>
                          <p className="text-gray-600 text-sm mb-1">课程代码: {classInfo.course_code}</p>
                          <p className="text-gray-600 text-sm mb-1">班级: {classInfo.class_name}</p>
                          <p className="text-gray-600 text-sm">学年: {classInfo.academic_year}</p>
                        </div>
                        <div className="text-right">
                          <div className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium mb-2">
                            {classInfo.current_students}/{classInfo.max_students}人
                          </div>
                          <p className="text-xs text-gray-500">
                            {classInfo.enrollment_date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-blue-200">
                        <span className="text-sm text-gray-600">👨‍🏫 {classInfo.teacher_name}</span>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">
                          查看详情
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {enrolledClasses.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg mb-4">您还没有加入任何班级</p>
                    <button
                      onClick={() => setActiveTab('join')}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      立即加入班级
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 加入班级 */}
            {activeTab === 'join' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">加入班级</h2>
                <div className="max-w-2xl mx-auto">
                  {/* 错误提示 */}
                  {error && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md flex items-start animate-pulse">
                      <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* 成功提示 */}
                  {success && (
                    <div className="mb-4 bg-green-50 border-l-4 border-green-500 text-green-700 px-4 py-3 rounded-md flex items-start">
                      <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{success}</span>
                    </div>
                  )}

                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border-2 border-blue-100">
                    <div className="text-center mb-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">🔑</span>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">输入邀请码</h3>
                      <p className="text-gray-600">请输入教师提供的班级邀请码以加入班级</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">班级邀请码</label>
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          placeholder="请输入8位邀请码"
                          maxLength={8}
                          disabled={loading}
                          className="w-full px-6 py-4 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-2xl font-mono font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                      
                      <button
                        onClick={handleJoinClass}
                        disabled={inviteCode.length !== 8 || loading}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg text-lg flex items-center justify-center"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            加入中...
                          </>
                        ) : (
                          '加入班级'
                        )}
                      </button>
                    </div>

                    <div className="mt-6 pt-6 border-t border-blue-200">
                      <h4 className="font-medium text-gray-700 mb-3">💡 温馨提示：</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>邀请码由任课教师提供，请向教师索取</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>邀请码通常为8位大写字母和数字组合</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>成功加入后，您可以在"我的课程"中查看课程信息</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 修改密码 */}
            {activeTab === 'password' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">修改密码</h2>
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border-2 border-blue-100">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          disabled={passwordLoading}
                          className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="请输入当前使用的密码"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          disabled={passwordLoading}
                          className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="请输入新密码（至少6位）"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          disabled={passwordLoading}
                          className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="请再次输入新密码"
                        />
                      </div>
                      <button
                        onClick={handleChangePassword}
                        disabled={passwordLoading}
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {passwordLoading ? '修改中...' : '确认修改'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentProfile
