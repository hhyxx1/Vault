import { useState, useEffect, useRef } from 'react'
import { 
  getTeacherCourses, 
  getTeacherClasses, 
  createCourse, 
  createClass,
  deleteCourse,
  deleteClass,
  changePassword,
  getTeacherProfile,
  updateTeacherProfile,
  uploadAvatar,
  uploadCourseDocument,
  Course, 
  Class,
  CourseCreate,
  ClassCreate,
  ChangePasswordRequest
} from '../../../services/teacher'
import { useNavigate } from 'react-router-dom'
import CreateCourseDialog from '../../../components/CreateCourseDialog'
import CreateClassDialog from '../../../components/CreateClassDialog'
import ClassDetailDialog from '../../../components/ClassDetailDialog'
import { Icon } from '../../../components/Icon'

type TabType = 'info' | 'courses' | 'classes' | 'password'

const TeacherProfile = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('courses')
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now())
  const [teacherInfo, setTeacherInfo] = useState<{
    fullName: string
    teacherNumber: string
    department: string | null
    title: string | null
    email: string
    joinDate: string
    avatar: string
  }>({
    fullName: '张老师',
    teacherNumber: 'T20240001',
    department: '计算机学院',
    title: '副教授',
    email: 'teacher@vault.cs',
    joinDate: '2020-09-01',
    avatar: ''
  })

  const [courses, setCourses] = useState<Course[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(false)
  const [showCourseDialog, setShowCourseDialog] = useState(false)
  const [showClassDialog, setShowClassDialog] = useState(false)
  const [showClassDetailDialog, setShowClassDetailDialog] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const courseFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  // 密码表单状态
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    department: '',
    title: ''
  })

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
      console.log('调用uploadAvatar API...')
      const response = await uploadAvatar(file)
      console.log('上传响应:', response)
      
      setTeacherInfo(prev => ({ ...prev, avatar: response.avatar_url }))
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

  // 加载个人信息
  const loadProfile = async () => {
    try {
      const data = await getTeacherProfile()
      const profileData = {
        fullName: data.full_name || data.username,
        teacherNumber: data.teacher_number,
        department: data.department || '未设置',
        title: data.title || '未设置',
        email: data.email,
        joinDate: data.join_date || '',
        avatar: data.avatar_url || ''
      }
      setTeacherInfo(profileData)
      setEditForm({
        fullName: profileData.fullName,
        email: profileData.email,
        department: profileData.department,
        title: profileData.title
      })
      setAvatarTimestamp(Date.now())
    } catch (error) {
      console.error('加载个人信息失败:', error)
    }
  }

  // 开始编辑
  const handleStartEdit = () => {
    setEditForm({
      fullName: teacherInfo.fullName,
      email: teacherInfo.email,
      department: teacherInfo.department,
      title: teacherInfo.title
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
      const updatedData = await updateTeacherProfile({
        full_name: editForm.fullName,
        email: editForm.email,
        department: editForm.department,
        title: editForm.title
      })
      
      // 更新本地状态
      setTeacherInfo(prev => ({
        ...prev,
        fullName: updatedData.full_name,
        email: updatedData.email,
        department: updatedData.department,
        title: updatedData.title
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
      fullName: teacherInfo.fullName,
      email: teacherInfo.email,
      department: teacherInfo.department,
      title: teacherInfo.title
    })
  }

  // 加载课程数据
  const loadCourses = async () => {
    try {
      setLoading(true)
      const data = await getTeacherCourses()
      setCourses(data)
    } catch (error) {
      console.error('加载课程失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载班级数据
  const loadClasses = async () => {
    try {
      setLoading(true)
      const data = await getTeacherClasses()
      setClasses(data)
    } catch (error) {
      console.error('加载班级失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadProfile()
    loadCourses()
    loadClasses()

    const handleAvatarUpdate = () => {
      loadProfile()
    }
    window.addEventListener('avatarUpdated', handleAvatarUpdate)
    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate)
    }
  }, [])

  // 创建课程
  const handleCreateCourse = async (courseData: CourseCreate) => {
    await createCourse(courseData)
    await loadCourses()
  }

  // 创建班级
  const handleCreateClass = async (classData: ClassCreate) => {
    await createClass(classData)
    await loadClasses()
  }

  // 删除课程
  const handleDeleteCourse = async (courseId: string) => {
    if (window.confirm('确定要删除这个课程吗？')) {
      await deleteCourse(courseId)
      await loadCourses()
    }
  }

  // 上传课程文档
  const handleUploadDocument = (courseId: string) => {
    const fileInput = courseFileInputRefs.current[courseId]
    if (fileInput) {
      fileInput.click()
    }
  }

  // 处理文件上传（支持多文件）
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, courseId: string) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const allowedTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.md']
    const maxFileSize = 50 * 1024 * 1024 // 50MB
    
    // 验证所有文件
    const invalidFiles: string[] = []
    const oversizedFiles: string[] = []
    const validFiles: File[] = []

    Array.from(files).forEach(file => {
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      
      if (!allowedTypes.includes(fileExt)) {
        invalidFiles.push(file.name)
      } else if (file.size > maxFileSize) {
        oversizedFiles.push(file.name)
      } else {
        validFiles.push(file)
      }
    })

    // 显示验证错误
    if (invalidFiles.length > 0) {
      alert(`以下文件类型不支持：\n${invalidFiles.join('\n')}\n\n支持的格式: PDF, Word, PowerPoint, TXT, MD`)
    }
    if (oversizedFiles.length > 0) {
      alert(`以下文件超过50MB限制：\n${oversizedFiles.join('\n')}`)
    }

    if (validFiles.length === 0) {
      event.target.value = ''
      return
    }

    const course = courses.find(c => c.id === courseId)
    const fileCount = validFiles.length
    const fileNames = validFiles.map(f => f.name).join('、')
    
    if (!confirm(`确定要将 ${fileCount} 个文件上传到课程「${course?.course_name}」的知识库吗？\n\n文件列表：\n${fileNames}`)) {
      event.target.value = ''
      return
    }

    // 上传所有有效文件
    const results = {
      success: [] as string[],
      failed: [] as { name: string, error: string }[]
    }

    try {
      // 显示上传提示
      const uploadingMsg = `正在上传 ${fileCount} 个文件，请稍候...`
      console.log(uploadingMsg)

      // 串行上传每个文件（避免并发过多）
      for (const file of validFiles) {
        try {
          console.log(`上传文件: ${file.name}`)
          await uploadCourseDocument(courseId, file)
          results.success.push(file.name)
        } catch (error: any) {
          console.error(`上传文件失败: ${file.name}`, error)
          const errorMsg = error.response?.data?.detail || error.message || '未知错误'
          results.failed.push({ name: file.name, error: errorMsg })
        }
      }

      // 显示上传结果
      let message = ''
      if (results.success.length > 0) {
        message += `✅ 成功上传 ${results.success.length} 个文件：\n${results.success.join('\n')}`
      }
      if (results.failed.length > 0) {
        if (message) message += '\n\n'
        message += `❌ 上传失败 ${results.failed.length} 个文件：\n${results.failed.map(f => `${f.name}: ${f.error}`).join('\n')}`
      }
      
      alert(message || '上传完成！')
      
    } catch (error: any) {
      console.error('上传过程出错:', error)
      alert(`上传过程出错: ${error.message || '未知错误'}`)
    } finally {
      // 清空文件输入
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  // 查看课程详情（知识库）
  const handleViewCourseDetails = (courseId: string) => {
    navigate(`/teacher/course/${courseId}/knowledge-base`)
  }

  // 删除班级
  const handleDeleteClass = async (classId: string) => {
    if (window.confirm('确定要删除这个班级吗？')) {
      await deleteClass(classId)
      await loadClasses()
    }
  }

  // 查看班级详情
  const handleViewClassDetail = (classId: string) => {
    setSelectedClassId(classId)
    setShowClassDetailDialog(true)
  }

  // 复制邀请码
  const handleCopyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode)
    alert('邀请码已复制到剪贴板！')
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

  // 计算所有班级的学生总数
  const totalStudents = classes.reduce((sum, cls) => sum + (cls.student_count || 0), 0)

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
                  {teacherInfo.avatar ? (
                    <img src={teacherInfo.avatar} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="h-full w-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold">
                      {teacherInfo.fullName[0]}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">更换头像</span>
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 h-6 w-6 bg-green-500 border-4 border-white rounded-full"></div>
              </div>
              <div className="sm:ml-6 text-center sm:text-left">
                <h1 className="text-3xl font-bold text-gray-900">{teacherInfo.fullName}</h1>
                <p className="text-sm text-gray-500 mt-1 flex items-center justify-center sm:justify-start">
                  <Icon name="award" size={16} className="mr-1" />
                  {teacherInfo.title} · {teacherInfo.department}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    <Icon name="description" size={12} className="mr-1" /> {teacherInfo.email}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                    <Icon name="user" size={12} className="mr-1" /> 工号: {teacherInfo.teacherNumber}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            iconName="book" 
            label="授课课程" 
            value={courses.length} 
            color="bg-blue-500" 
            onClick={() => setActiveTab('courses')}
          />
          <StatCard 
            iconName="class" 
            label="管理班级" 
            value={classes.length} 
            color="bg-green-500" 
            onClick={() => setActiveTab('classes')}
          />
          <StatCard 
            iconName="class" 
            label="所属学院" 
            value={teacherInfo.department} 
            color="bg-purple-500" 
          />
          <StatCard 
            iconName="user" 
            label="学生总数" 
            value={totalStudents} 
            color="bg-orange-500" 
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
                { id: 'classes', name: '我的班级', icon: 'class' },
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
                        <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{teacherInfo.fullName}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">工号</label>
                      <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{teacherInfo.teacherNumber}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">所属院系</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.department}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          className="w-full text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border-2 border-indigo-300 focus:border-indigo-500 outline-none transition-all"
                        />
                      ) : (
                        <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{teacherInfo.department}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">职称</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border-2 border-indigo-300 focus:border-indigo-500 outline-none transition-all"
                        />
                      ) : (
                        <div className="text-gray-900 font-medium bg-white px-4 py-3 rounded-lg border border-gray-200">{teacherInfo.title}</div>
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
                          {teacherInfo.email}
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

            {/* 课程列表面板 */}
            {activeTab === 'courses' && (
              <div className="animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">课程管理</h3>
                  <button
                    onClick={() => setShowCourseDialog(true)}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                  >
                    <Icon name="add" size={16} className="mr-2" /> 新建课程
                  </button>
                </div>
                
                {loading ? (
                  <div className="text-center py-12 text-gray-500">加载中...</div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <Icon name="book" size={48} className="mx-auto text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">暂无课程</h3>
                    <p className="mt-1 text-sm text-gray-500">点击上方按钮创建新课程</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
                      <div key={course.id} className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                                <Icon name="book" size={20} />
                              </div>
                              <div>
                                <p className="text-lg font-bold text-gray-900">{course.course_name}</p>
                                <p className="text-sm text-gray-500">{course.course_code}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                {course.semester || '2024 春季'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCourse(course.id)
                                }}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="删除课程"
                              >
                                <Icon name="close" size={20} />
                              </button>
                            </div>
                          </div>
                          
                          {/* 操作按钮区域 */}
                          <div className="flex gap-2 pt-4 border-t border-gray-100">
                            <input
                              type="file"
                              ref={(el) => courseFileInputRefs.current[course.id] = el}
                              onChange={(e) => handleFileUpload(e, course.id)}
                              className="hidden"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                              multiple
                            />
                            <button
                              onClick={() => handleUploadDocument(course.id)}
                              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-colors"
                              title="上传单个或多个文档到知识库"
                            >
                              <Icon name="add" size={16} className="mr-1" />
                              上传资料
                            </button>
                            <button
                              onClick={() => handleViewCourseDetails(course.id)}
                              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium rounded-lg transition-colors"
                              title="查看课程知识库"
                            >
                              <Icon name="description" size={16} className="mr-1" />
                              查看详情
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 班级列表面板 */}
            {activeTab === 'classes' && (
              <div className="animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">班级管理</h3>
                  <button
                    onClick={() => setShowClassDialog(true)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                  >
                    <Icon name="add" size={16} className="mr-2" /> 新建班级
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-12 text-gray-500">加载中...</div>
                ) : classes.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <Icon name="class" size={48} className="mx-auto text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">暂无班级</h3>
                    <p className="mt-1 text-sm text-gray-500">点击上方按钮创建新班级</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classes.map((cls) => (
                      <div key={cls.id} className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="p-6">
                          <div className="flex items-center space-x-4 mb-4">
                            <div className="flex-shrink-0">
                              <div className="p-3 bg-green-100 rounded-lg text-green-600">
                                <Icon name="class" size={24} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-lg font-bold text-gray-900 truncate">
                                {cls.class_name}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {cls.course_name}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteClass(cls.id)}
                              className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                              <Icon name="close" size={20} />
                            </button>
                          </div>

                          {/* 邀请码区域 */}
                          <div className="mb-4 bg-green-50 rounded-lg p-3 border border-green-200">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-xs text-gray-600 mb-1 flex items-center">
                                  <Icon name="key" size={12} className="mr-1" />
                                  邀请码
                                </p>
                                <p className="text-lg font-mono font-bold text-green-700 tracking-wider">
                                  {cls.invite_code}
                                </p>
                              </div>
                              <button
                                onClick={() => handleCopyInviteCode(cls.invite_code)}
                                className="ml-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center"
                                title="复制邀请码"
                              >
                                <Icon name="code" size={14} className="mr-1" />
                                复制
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 mb-4">
                            <div className="text-center">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">学生人数</p>
                              <p className="mt-1 text-lg font-semibold text-gray-900">
                                {cls.student_count || 0} / {cls.max_students}
                              </p>
                            </div>
                            <div className="text-center border-l border-gray-100">
                              <p className="text-xs text-gray-500 uppercase tracking-wide">平均成绩</p>
                              <p className="mt-1 text-lg font-semibold text-gray-900">
                                {cls.average_score !== null ? cls.average_score.toFixed(1) : '暂无'}
                              </p>
                            </div>
                          </div>

                          {/* 查看详情按钮 */}
                          <button
                            onClick={() => handleViewClassDetail(cls.id)}
                            className="w-full px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                          >
                            <Icon name="user" size={16} className="mr-1" />
                            查看学生列表
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 修改密码面板 */}
            {activeTab === 'password' && (
              <div className="max-w-2xl mx-auto animate-fadeIn">
                <div className="bg-gray-50 rounded-xl p-8 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                    <Icon name="password" size={20} className="mr-2 text-indigo-600" /> 修改密码
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
                      <input 
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        disabled={passwordLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="请再次输入新密码"
                      />
                    </div>
                    <div className="pt-4 flex justify-end">
                      <button 
                        onClick={handleChangePassword}
                        disabled={passwordLoading}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
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

      <CreateCourseDialog
        isOpen={showCourseDialog}
        onClose={() => setShowCourseDialog(false)}
        onSubmit={handleCreateCourse}
      />

      <CreateClassDialog
        isOpen={showClassDialog}
        onClose={() => setShowClassDialog(false)}
        onSubmit={handleCreateClass}
        courses={courses}
      />

      <ClassDetailDialog
        isOpen={showClassDetailDialog}
        onClose={() => setShowClassDetailDialog(false)}
        classId={selectedClassId}
      />
    </div>
  )
}

export default TeacherProfile
