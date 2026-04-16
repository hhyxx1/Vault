import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services'
import { Icon } from '@/components/Icon'

const Register = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    full_name: '',
    // 学生专属字段
    student_number: '',
    major: '',
    grade: '',
    // 教师专属字段
    teacher_number: '',
    department: '',
    title: '',
  })

  // 检查是否已登录，如果已登录则跳转到对应页面
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        if (user.role === 'teacher') {
          navigate('/teacher', { replace: true })
        } else if (user.role === 'student') {
          navigate('/student', { replace: true })
        }
      } catch (error) {
        // 用户信息解析失败，清除localStorage
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (formData.password.length < 6) {
      setError('密码长度不能少于6位')
      return
    }

    setLoading(true)

    try {
      // 准备注册数据
      const registerData: Record<string, string> = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: formData.role
      }

      if (formData.role === 'student') {
        if (!formData.student_number || !formData.major || !formData.grade) {
          setError('请填写所有必填字段（学号、专业、年级）')
          setLoading(false)
          return
        }
        registerData.student_number = formData.student_number
        registerData.major = formData.major
        registerData.grade = formData.grade
      } else if (formData.role === 'teacher') {
        if (!formData.teacher_number || !formData.department || !formData.title) {
          setError('请填写所有必填字段（工号、院系、职称）')
          setLoading(false)
          return
        }
        registerData.teacher_number = formData.teacher_number
        registerData.department = formData.department
        registerData.title = formData.title
      }

      const data = await authApi.register(registerData)
      
      // 保存token和用户信息
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      // 根据角色跳转
      if (data.user.role === 'teacher') {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || '注册失败，请检查输入信息')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg transform hover:scale-105 transition-transform">
            <Icon name="book" size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">智能教学平台</h1>
          <p className="text-gray-600 font-medium">创建新账号</p>
        </div>

        {/* 注册表单 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 角色选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                注册身份
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'student' })}
                  className={`py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center ${
                    formData.role === 'student'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 border-2 border-transparent hover:border-blue-200'
                  }`}
                >
                  <Icon name="award" size={20} className="mr-2" /> 学生
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'teacher' })}
                  className={`py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center ${
                    formData.role === 'teacher'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 border-2 border-transparent hover:border-purple-200'
                  }`}
                >
                  <Icon name="user" size={20} className="mr-2" /> 教师
                </button>
              </div>
            </div>

            {/* 用户名 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                用户名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="请输入用户名"
                required
              />
            </div>

            {/* 邮箱 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="请输入邮箱"
                required
              />
            </div>

            {/* 真实姓名 */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                真实姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="请输入真实姓名"
                required
              />
            </div>

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="请输入密码（至少6位）"
                required
                minLength={6}
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                确认密码 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="请再次输入密码"
                required
              />
            </div>

            {/* 学生专属字段 */}
            {formData.role === 'student' && (
              <>
                <div>
                  <label htmlFor="studentNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    学号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="studentNumber"
                    value={formData.student_number}
                    onChange={(e) => setFormData({ ...formData, student_number: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    placeholder="请输入学号"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="major" className="block text-sm font-medium text-gray-700 mb-2">
                      专业 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="major"
                      value={formData.major}
                      onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="请输入专业"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
                      年级 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="grade"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="如: 2024"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* 教师专属字段 */}
            {formData.role === 'teacher' && (
              <>
                <div>
                  <label htmlFor="teacherNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    工号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="teacherNumber"
                    value={formData.teacher_number}
                    onChange={(e) => setFormData({ ...formData, teacher_number: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    placeholder="请输入工号"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                      所属院系 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="请输入院系"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                      职称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="如: 教授/副教授"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* 注册按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          {/* 登录链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              已有账号？
              <button
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 font-semibold ml-1"
              >
                立即登录
              </button>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Register
