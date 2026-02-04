import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services'

const Login = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    setLoading(true)

    try {
      const response = await authApi.login(formData.username, formData.password)
      
      // 保存token和用户信息
      localStorage.setItem('token', response.access_token)
      localStorage.setItem('user', JSON.stringify(response.user))
      
      // 根据用户角色跳转
      if (response.user.role === 'teacher') {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
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
          <p className="text-gray-600 font-medium">欢迎登录</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white">
          <form onSubmit={handleSubmit} className="space-y-6">

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
              />
            </div>

            {/* 记住我和忘记密码 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-600">记住我</span>
              </label>
              <a href="#" className="text-sm bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent hover:from-purple-700 hover:to-pink-700 font-medium">
                忘记密码？
              </a>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* 注册链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              还没有账号？
              <button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 font-semibold ml-1"
              >
                立即注册
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

export default Login
