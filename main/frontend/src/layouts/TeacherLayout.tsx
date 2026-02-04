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
    try {
      const data = await getTeacherProfile()
      setUserInfo({
        name: data.full_name || data.username,
        email: data.email,
        avatar: data.avatar_url || ''
      })
      setAvatarTimestamp(Date.now())
    } catch (error) {
      console.error('获取用户信息失败:', error)
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
    { path: '/teacher/ai/dashboard', label: '教师看板', icon: 'sparkles' },
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
      {/* 左侧导航栏 */}
      <aside 
        className={`bg-white border-r border-gray-200 flex flex-col relative z-20 shadow-sm transition-all duration-300 ease-in-out ${
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
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h1 className="text-2xl font-bold whitespace-nowrap overflow-hidden text-indigo-600">
                Vault CS
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
                  className={`flex-shrink-0 ${isActive ? 'bg-indigo-600' : 'bg-gray-400 group-hover:bg-gray-600'}`} 
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
            {/* 用户信息 - 移到底部 */}
            <div className={`flex items-center rounded-xl transition-colors group ${
              isCollapsed ? 'justify-center' : 'space-x-3 hover:bg-white/50 p-2'
            }`}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
              <div 
                className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold group-hover:bg-indigo-200 transition-colors flex-shrink-0 shadow-sm border border-indigo-50 cursor-pointer relative overflow-hidden"
                onClick={handleAvatarClick}
                title="点击更换头像"
              >
                {userInfo.avatar ? (
                  <img src={`${userInfo.avatar}?t=${avatarTimestamp}`} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Icon name="user" size={24} className="bg-indigo-600" />
                )}
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
      <main className="flex-1 overflow-y-auto bg-gray-50 relative">
        <Outlet />
      </main>
    </div>
  )
}

export default TeacherLayout
