import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'

const TeacherLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const navItems = [
    { path: '/teacher/dashboard', label: '教师看板', icon: '📊' },
    { path: '/teacher/survey', label: '问卷生成', icon: '📋' },
  ]

  const handleLogout = () => {
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧导航栏 */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo区域 */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600">Vault CS</h1>
        </div>

        {/* 用户信息 */}
        <div className="p-4 border-b border-gray-200">
          <Link to="/teacher/profile" className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold cursor-pointer">
              师
            </div>
            <div>
              <p className="font-medium text-gray-800">教师用户</p>
              <p className="text-sm text-gray-500">teacher@vault.cs</p>
            </div>
          </Link>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-6 py-3 transition-colors ${
                location.pathname === item.path
                  ? 'bg-indigo-50 text-indigo-600 border-r-4 border-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* 底部信息 */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <div className="text-xs text-gray-400">
            <p>控制台日志</p>
            <p className="text-gray-300">0</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <span>🚪</span>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* 右侧主内容区域 */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  )
}

export default TeacherLayout
