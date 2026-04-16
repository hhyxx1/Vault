import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon, IconName } from '../components/Icon'
import { getTeacherProfile, uploadAvatar } from '../services/teacher'

const TeacherLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userInfo, setUserInfo] = useState({
    name: '教师用户',
    email: 'teacher@vault.cs',
    avatar: ''
  })
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now())

  const loadProfile = async () => {
    // 先尝试从localStorage读取用户信息作为初始值
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        console.log('从localStorage读取用户信息:', user)
        const name = (user.full_name && user.full_name.trim()) || (user.username && user.username.trim()) || '教师用户'
        const email = (user.email && user.email.trim()) || '未设置邮箱'
        setUserInfo({
          name,
          email,
          avatar: user.avatar_url || ''
        })
      } catch (e) {
        console.error('Failed to parse user info:', e)
      }
    }
    
    // 然后尝试从API获取最新信息
    try {
      const data = await getTeacherProfile()
      console.log('获取教师信息成功:', data)
      const name = (data.full_name && data.full_name.trim()) || (data.username && data.username.trim()) || '教师用户'
      const email = (data.email && data.email.trim()) || '未设置邮箱'
      setUserInfo({
        name,
        email,
        avatar: data.avatar_url || ''
      })
      setAvatarTimestamp(Date.now())
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // API失败时保持localStorage的数据，如果都没有则使用默认值
      if (!userStr) {
        setUserInfo({
          name: '教师用户',
          email: '未设置邮箱',
          avatar: ''
        })
      }
    }
  }

  useEffect(() => {
    loadProfile()

    const handleAvatarUpdate = () => {
      loadProfile()
    }

    window.addEventListener('avatarUpdated', handleAvatarUpdate)
    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate)
    }
  }, [])

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault() // 阻止跳转
    e.stopPropagation()
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const response = await uploadAvatar(file)
      setUserInfo(prev => ({ ...prev, avatar: response.avatar_url }))
      // 触发自定义事件通知其他组件更新（虽然这里是Layout，但为了保持一致性）
      window.dispatchEvent(new Event('avatarUpdated'))
    } catch (error) {
      console.error('上传头像失败:', error)
      alert('上传头像失败，请重试')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const navItems: { path: string; label: string; icon: IconName }[] = [
    { path: '/teacher/dashboard', label: '教师看板', icon: 'dashboard' },
    { path: '/teacher/survey', label: '问卷生成', icon: 'survey' },
  ]

  const handleLogout = () => {
    // 清除本地存储的token和用户信息
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // 跳转到登录页
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧导航栏 - 仅桌面端显示 */}
      <aside 
        className={`hidden md:flex md:flex-col bg-white border-r border-gray-200 relative z-20 shadow-sm transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Logo区域 */}
        <div className={`h-20 flex items-center border-b border-gray-200 bg-white transition-all duration-300 ${
          isCollapsed ? 'justify-center px-0' : 'px-6'
        }`}>
          <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex items-center gap-3 text-indigo-600 ${isCollapsed ? 'hidden' : 'flex'}`}>
              <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 6.253v13M12 6.253C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h1 className="text-2xl font-bold whitespace-nowrap overflow-hidden text-indigo-600">
                Vault
              </h1>
            </div>
            
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors ${
                isCollapsed ? '' : ''
              }`}
            >
              {isCollapsed ? <Icon name="chevron-right" size={24} /> : <Icon name="chevron-left" size={24} />}
            </button>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.label : ''}
                className={`flex items-center px-3 py-3.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${isCollapsed ? 'justify-center' : 'space-x-4'}`}
              >
                <Icon 
                  name={item.icon} 
                  size={24} 
                  className={`flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}`} 
                />
                <span className={`font-medium text-base whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'
                }`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* 底部信息区域 */}
        <div className="border-t border-gray-200 bg-gray-50/50">
          <div className="p-4 space-y-4">
            {/* 隐藏的文件上传input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*"
            />
            
            {/* 用户信息 - 移到底部 */}
            <div className={`flex items-center rounded-xl transition-colors group ${
              isCollapsed ? 'justify-center' : 'space-x-3 hover:bg-white/50 p-2'
            }`}>
              <div 
                onClick={handleAvatarClick}
                className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold group-hover:bg-indigo-200 transition-colors flex-shrink-0 shadow-sm border border-indigo-50 relative overflow-hidden cursor-pointer"
                title="点击上传头像"
              >
                {userInfo.avatar ? (
                  <img src={`${userInfo.avatar}?t=${avatarTimestamp}`} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Icon name="user" size={24} className="text-indigo-600" />
                )}
                {/* 悬停提示 */}
                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all">
                  <span className="text-white text-[8px] opacity-0 group-hover:opacity-100 font-medium">上传</span>
                </div>
              </div>
              <Link 
                to="/teacher/profile"
                className={`flex-1 min-w-0 overflow-hidden transition-all duration-300 ${
                isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'
              }`}>
                <p className="font-medium text-gray-800 truncate text-base hover:text-indigo-600 transition-colors">{userInfo.name}</p>
                <p className="text-xs text-gray-500 truncate">{userInfo.email}</p>
              </Link>
            </div>

            {/* 退出登录按钮 */}
            <button
              onClick={handleLogout}
              title={isCollapsed ? '退出登录' : ''}
              className={`w-full flex items-center space-x-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium ${
                isCollapsed ? 'justify-center p-2' : 'justify-center px-4 py-3'
              }`}
            >
              <Icon name="logout" size={20} className="text-gray-600 group-hover:text-red-600" />
              <span className={`transition-all duration-300 ${
                isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'
              }`}>
                退出登录
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* 右侧主内容区域 */}
      <main className="flex-1 overflow-y-auto bg-gray-50 relative pt-14 pb-16 md:pt-0 md:pb-0">
        <Outlet />
      </main>

      {/* 手机端顶部标题栏 */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-600">
          <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-lg font-bold text-indigo-600">Vault</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/teacher/profile" className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {userInfo.avatar ? (
              <img src={`${userInfo.avatar}?t=${avatarTimestamp}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Icon name="user" size={18} className="text-indigo-600" />
            )}
          </Link>
          <button onClick={handleLogout} className="p-1.5 text-gray-500 hover:text-red-500 transition-colors">
            <Icon name="logout" size={20} />
          </button>
        </div>
      </header>

      {/* 手机端底部Tab导航 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 flex safe-area-bottom">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <Icon name={item.icon} size={22} />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default TeacherLayout
