import { useState, useEffect, useRef } from 'react'
import { 
  studentClassService, 
  ClassInfo, 
  changePassword, 
  ChangePasswordRequest,
  getStudentProfile,
  updateStudentProfile,
  uploadStudentAvatar,
  StudentProfile as StudentProfileType
} from '../../../services/student'
import { Icon } from '../../../components/Icon'
import CourseDocumentsDialog from '../../../components/CourseDocumentsDialog'

type TabType = 'info' | 'courses' | 'join' | 'password'

const StudentProfile = () => {
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [enrolledClasses, setEnrolledClasses] = useState<ClassInfo[]>([])
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [studentInfo, setStudentInfo] = useState({
    fullName: '李明',
    studentNumber: 'S202100123',
    major: '计算机科学与技术',
    grade: '2021级',
    email: 'liming@example.com',
    avatar: ''
  })

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    major: '',
    grade: ''
  })

  // 加载个人信息
  const loadProfile = async () => {
    try {
      const data = await getStudentProfile()
      const profileData = {
        fullName: data.full_name || data.username,
        studentNumber: data.student_number,
        major: data.major || '未设置',
        grade: data.grade || '未设置',
        email: data.email,
        avatar: data.avatar_url || ''
      }
      setStudentInfo(profileData)
      setEditForm({
        fullName: profileData.fullName,
        email: profileData.email,
        major: profileData.major,
        grade: profileData.grade
      })
      setAvatarTimestamp(Date.now())
    } catch (error) {
      console.error('加载个人信息失败:', error)
    }
  }

  // 开始编辑
  const handleStartEdit = () => {
    setEditForm({
      fullName: studentInfo.fullName,
      email: studentInfo.email,
      major: studentInfo.major,
      grade: studentInfo.grade
    })
    setIsEditing(true)
    setActiveTab('info') // 切换到个人信息标签页
  }

  // 保存修改
  const handleSaveProfile = async () => {
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editForm.email)) {
      alert('请输入有效的电子邮箱地址')
      return
    }
    
    try {
      // 调用后端API保存到数据库
      const updatedData = await updateStudentProfile({
        full_name: editForm.fullName,
        email: editForm.email,
        major: editForm.major,
        grade: editForm.grade
      })
      
      // 更新本地状态
      setStudentInfo(prev => ({
        ...prev,
        fullName: updatedData.full_name,
        email: updatedData.email,
        major: updatedData.major || '未设置',
        grade: updatedData.grade || '未设置'
      }))
      
      setIsEditing(false)
      alert('个人信息已成功保存到数据库！')
    } catch (error: any) {
      console.error('保存个人信息失败:', error)
      const errorMsg = error.response?.data?.detail || '保存失败，请重试'
      alert(errorMsg)
    }
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({
      fullName: studentInfo.fullName,
      email: studentInfo.email,
      major: studentInfo.major,
      grade: studentInfo.grade
    })
  }

  // 处理头像点击
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  // 处理文件选择
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('开始上传头像:', file.name, file.type, file.size)

    try {
      console.log('调用uploadStudentAvatar API...')
      const response = await uploadStudentAvatar(file)
      console.log('上传响应:', response)
      
      setStudentInfo(prev => ({ ...prev, avatar: response.avatar_url }))
      setAvatarTimestamp(Date.now())
      
      // 触发自定义事件通知 Layout 更新
      window.dispatchEvent(new Event('avatarUpdated'))
      alert('头像上传成功！')
    } catch (error: any) {
      console.error('上传头像失败:', error)
      console.error('错误详情:', error.response?.data || error.message)
      alert(`上传头像失败: ${error.response?.data?.detail || error.message || '未知错误'}`)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 获取学生加入的班级列表
  const loadMyClasses = async () => {
    try {
      const classes = await studentClassService.getMyClasses()
      setEnrolledClasses(classes)
    } catch (err: any) {
      console.error('Failed to load classes:', err)
    }
  }

  // 初始加载
  useEffect(() => {
    loadProfile()
    loadMyClasses()

    const handleAvatarUpdate = () => {
      loadProfile()
    }
    window.addEventListener('avatarUpdated', handleAvatarUpdate)
    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate)
    }
  }, [])

  // 密码表单状态
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // 课程资料对话框状态
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; name: string } | null>(null)

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
      
      alert('密码修改成功！即将退出登录，请使用新密码重新登录')
      
      // 清除本地存储
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      // 跳转到登录页
      window.location.href = '/login'
      
    } catch (error: any) {
      console.error('修改密码失败:', error)
      const errorMessage = error.response?.data?.detail || '修改密码失败，请重试'
      alert(errorMessage)
    } finally {
      setPasswordLoading(false)
    }
  }

  const StatCard = ({ iconName, label, value, color, onClick }: { iconName: any, label: string, value: string | number, color: string, onClick?: () => void }) => (
    <div 
      onClick={onClick}
      className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4 transition-all hover:scale-[1.02] ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-indigo-200' : ''
      }`}
    >
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon name={iconName} size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 顶部背景图 */}
      <div className="h-48 bg-gradient-to-r from-blue-600 to-indigo-700 w-full absolute top-0 left-0 z-0"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        {/* 个人信息卡片 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="p-8 sm:flex sm:items-center sm:justify-between">
            <div className="sm:flex sm:items-center">
              <div className="mb-4 sm:mb-0 relative cursor-pointer group" onClick={handleAvatarClick}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*"
                />
                <div className="h-24 w-24 rounded-full bg-white p-1 shadow-md group-hover:shadow-lg transition-all relative overflow-hidden">
                  {studentInfo.avatar ? (
                    <img src={studentInfo.avatar} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="h-full w-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold">
                      {studentInfo.fullName[0]}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">更换头像</span>
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 h-6 w-6 bg-green-500 border-4 border-white rounded-full"></div>
              </div>
              <div className="sm:ml-6 text-center sm:text-left">
                <h1 className="text-3xl font-bold text-gray-900">{studentInfo.fullName}</h1>
                <p className="text-sm text-gray-500 mt-1 flex items-center justify-center sm:justify-start">
                  <Icon name="award" size={16} className="mr-1" />
                  {studentInfo.major} · {studentInfo.grade}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    <Icon name="description" size={12} className="mr-1" /> {studentInfo.email}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                    <Icon name="user" size={12} className="mr-1" /> 学号: {studentInfo.studentNumber}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6 sm:mt-0 flex gap-3 justify-center">
              <button 
                onClick={handleStartEdit}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                编辑资料
              </button>
            </div>
          </div>
        </div>

        {/* 统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            iconName="class" 
            label="我的班级" 
            value={enrolledClasses.length} 
            color="bg-blue-500" 
            onClick={() => setActiveTab('courses')}
          />
           <StatCard 
            iconName="book" 
            label="所属专业" 
            value={studentInfo.major} 
            color="bg-purple-500" 
          />
           <StatCard 
            iconName="award" 
            label="当前年级" 
            value={studentInfo.grade} 
            color="bg-green-500" 
          />
        </div>

        {/* 主要内容区 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[500px]">
          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {[
                { id: 'info', name: '个人信息', icon: 'user' },
                { id: 'courses', name: '我的课程', icon: 'book' },
                { id: 'join', name: '加入班级', icon: 'add' },
                { id: 'password', name: '修改密码', icon: 'password' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all
                    ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <Icon name={tab.icon as any} size={20} className={`
                    -ml-0.5 mr-2
                    ${activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                  `} />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Panels */}
          <div className="p-6">
            {/* 个人信息面板 */}
            {activeTab === 'info' && (
              <div className="max-w-4xl mx-auto animate-fadeIn">
                <div className="bg-gray-50 rounded-xl p-8 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                    <Icon name="user" size={20} className="mr-2 text-indigo-600" /> 基本资料
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">真实姓名</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.fullName}
                          onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                          className="w-full text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border-2 border-indigo-300 focus:border-indigo-500 outline-none transition-all"
                        />
                      ) : (
                        <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{studentInfo.fullName}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">学号</label>
                      <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{studentInfo.studentNumber}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">专业</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.major}
                          onChange={(e) => setEditForm({ ...editForm, major: e.target.value })}
                          className="w-full text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border-2 border-indigo-300 focus:border-indigo-500 outline-none transition-all"
                        />
                      ) : (
                        <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{studentInfo.major}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">年级</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.grade}
                          onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                          className="w-full text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border-2 border-indigo-300 focus:border-indigo-500 outline-none transition-all"
                        />
                      ) : (
                        <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{studentInfo.grade}</div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">电子邮箱</label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border-2 border-indigo-300 focus:border-indigo-500 outline-none transition-all"
                          placeholder="请输入电子邮箱"
                        />
                      ) : (
                        <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200 flex items-center">
                          <Icon name="description" size={16} className="mr-2 text-gray-400" />
                          {studentInfo.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end gap-3">
                    {isEditing ? (
                      <>
                        <button 
                          onClick={handleCancelEdit}
                          className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg shadow-sm transition-colors"
                        >
                          取消
                        </button>
                        <button 
                          onClick={handleSaveProfile}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                        >
                          保存修改
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={handleStartEdit}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                      >
                        编辑资料
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 我的课程面板 */}
            {activeTab === 'courses' && (
              <div className="animate-fadeIn">
                 <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Icon name="class" size={20} className="mr-2 text-indigo-600" /> 我的班级列表
                  </h3>
                  <button
                    onClick={() => setActiveTab('join')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                  >
                    <Icon name="add" size={16} className="mr-1" /> 加入新班级
                  </button>
                </div>

                {enrolledClasses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {enrolledClasses.map(classInfo => (
                      <div key={classInfo.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:border-indigo-300 transition-all hover:shadow-md group">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">{classInfo.course_name}</h3>
                            <div className="flex items-center text-gray-500 text-sm mb-1">
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs mr-2">{classInfo.course_code}</span>
                              <span>{classInfo.class_name}</span>
                            </div>
                            <p className="text-gray-500 text-sm">学年: {classInfo.academic_year}</p>
                          </div>
                          <div className="text-right">
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {classInfo.current_students} / {classInfo.max_students} 人
                            </span>
                            <p className="text-xs text-gray-400 mt-2">
                              {classInfo.enrollment_date} 加入
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center text-sm text-gray-600">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold mr-2">
                              {classInfo.teacher_name[0]}
                            </div>
                            {classInfo.teacher_name}
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedCourse({ 
                                id: classInfo.course_id, 
                                name: classInfo.course_name 
                              })
                              setShowDocumentsDialog(true)
                            }}
                            className="px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors flex items-center"
                          >
                            <Icon name="description" size={16} className="mr-1" />
                            查看资料
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Icon name="class" size={32} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-lg mb-4">您还没有加入任何班级</p>
                    <button
                      onClick={() => setActiveTab('join')}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm"
                    >
                      立即加入班级
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 加入班级面板 */}
            {activeTab === 'join' && (
              <div className="max-w-2xl mx-auto animate-fadeIn">
                 <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="add" size={32} className="text-indigo-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">加入新班级</h3>
                      <p className="text-gray-500">请输入教师提供的8位邀请码</p>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                      <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start text-sm">
                        <Icon name="close" size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* 成功提示 */}
                    {success && (
                      <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start text-sm">
                         <div className="mr-2 mt-0.5">✓</div>
                        <span>{success}</span>
                      </div>
                    )}
                    
                    <div className="space-y-6">
                      <div>
                        <input
                          type="text"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          placeholder="请输入邀请码"
                          maxLength={8}
                          disabled={loading}
                          className="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none text-center text-3xl font-mono font-bold tracking-widest text-gray-800 placeholder-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase"
                        />
                      </div>
                      
                      <button
                        onClick={handleJoinClass}
                        disabled={inviteCode.length !== 8 || loading}
                        className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-lg flex items-center justify-center"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            正在加入...
                          </>
                        ) : (
                          '确认加入'
                        )}
                      </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center text-sm">
                        <Icon name="description" size={16} className="mr-2 text-gray-400" /> 温馨提示
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-500 list-disc list-inside ml-2">
                        <li>邀请码由任课教师提供，通常在第一节课上公布</li>
                        <li>邀请码由8位大写字母和数字组成</li>
                        <li>加入班级后，您可以访问该班级的所有课程资源</li>
                      </ul>
                    </div>
                  </div>
              </div>
            )}

            {/* 修改密码面板 */}
            {activeTab === 'password' && (
              <div className="max-w-2xl mx-auto animate-fadeIn">
                 <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                      <Icon name="password" size={20} className="mr-2 text-indigo-600" /> 修改登录密码
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          disabled={passwordLoading}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                          placeholder="请再次输入新密码"
                        />
                      </div>
                      
                      <div className="pt-4">
                        <button
                          onClick={handleChangePassword}
                          disabled={passwordLoading}
                          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {passwordLoading ? '正在修改...' : '确认修改密码'}
                        </button>
                      </div>
                    </div>
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 课程资料对话框 */}
      {selectedCourse && (
        <CourseDocumentsDialog
          isOpen={showDocumentsDialog}
          onClose={() => {
            setShowDocumentsDialog(false)
            setSelectedCourse(null)
          }}
          courseId={selectedCourse.id}
          courseName={selectedCourse.name}
        />
      )}
    </div>
  )
}

export default StudentProfile