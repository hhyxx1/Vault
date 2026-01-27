import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Register = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    fullName: '',
    // 学生专属字段
    studentNumber: '',
    major: '',
    grade: '',
    className: '',
    // 教师专属字段
    teacherNumber: '',
    department: '',
    title: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      alert('两次输入的密码不一致')
      return
    }

    // TODO: 实际注册逻辑（调用后端API）
    console.log('注册信息:', formData)

    // 注册成功后跳转到登录页
    navigate('/login')
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
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
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
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    formData.role === 'student'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 border-2 border-transparent hover:border-blue-200'
                  }`}
                >
                  🎓 学生
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'teacher' })}
                  className={`py-3 px-4 rounded-lg font-medium transition-all ${
                    formData.role === 'teacher'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg transform scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 border-2 border-transparent hover:border-purple-200'
                  }`}
                >
                  👨‍🏫 教师
                </button>
              </div>
            </div>

            {/* 用户名 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                用户名
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
                邮箱
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
                真实姓名
              </label>
              <input
                type="text"
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="请输入真实姓名"
                required
              />
            </div>

            {/* 学生专属字段 */}
            {formData.role === 'student' && (
              <>
                <div>
                  <label htmlFor="studentNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    学号
                  </label>
                  <input
                    type="text"
                    id="studentNumber"
                    value={formData.studentNumber}
                    onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    placeholder="请输入学号"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="major" className="block text-sm font-medium text-gray-700 mb-2">
                      专业
                    </label>
                    <input
                      type="text"
                      id="major"
                      value={formData.major}
                      onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="请输入专业"
                    />
                  </div>
                  <div>
                    <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
                      年级
                    </label>
                    <input
                      type="text"
                      id="grade"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="如: 2024"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-2">
                    班级
                  </label>
                  <input
                    type="text"
                    id="className"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    placeholder="请输入班级"
                  />
                </div>
              </>
            )}

            {/* 教师专属字段 */}
            {formData.role === 'teacher' && (
              <>
                <div>
                  <label htmlFor="teacherNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    工号
                  </label>
                  <input
                    type="text"
                    id="teacherNumber"
                    value={formData.teacherNumber}
                    onChange={(e) => setFormData({ ...formData, teacherNumber: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                    placeholder="请输入工号"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                      所属院系
                    </label>
                    <input
                      type="text"
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="请输入院系"
                    />
                  </div>
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                      职称
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      placeholder="如: 教授/副教授"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 密码 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 focus:bg-white"
                placeholder="请输入密码"
                required
                minLength={6}
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                确认密码
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

            {/* 注册按钮 */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 mt-6"
            >
              注册
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

        {/* 页脚 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© 2026 智能教学平台. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

export default Register
