import { useState } from 'react'

type TabType = 'info' | 'courses' | 'classes'

const TeacherProfile = () => {
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [teacherInfo] = useState({
    fullName: '张老师',
    teacherNumber: 'T20240001',
    department: '计算机学院',
    title: '副教授',
    email: 'zhang@example.com',
    avatar: ''
  })

  const [courses] = useState([
    { id: '1', code: 'CS101', name: '数据结构', semester: '2024春季', credit: 4 },
    { id: '2', code: 'CS201', name: '算法设计', semester: '2024春季', credit: 3 },
  ])

  const [classes] = useState([
    { id: '1', name: '计科2021-1班', courseName: '数据结构', studentCount: 45, inviteCode: 'ABC12345' },
    { id: '2', name: '计科2021-2班', courseName: '算法设计', studentCount: 38, inviteCode: 'DEF67890' },
  ])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部卡片 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
              {teacherInfo.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{teacherInfo.fullName}</h1>
              <div className="flex items-center space-x-4 text-gray-600">
                <span className="flex items-center">
                  <span className="font-medium mr-2">工号:</span> {teacherInfo.teacherNumber}
                </span>
                <span className="flex items-center">
                  <span className="font-medium mr-2">院系:</span> {teacherInfo.department}
                </span>
                <span className="flex items-center">
                  <span className="font-medium mr-2">职称:</span> {teacherInfo.title}
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
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
              }`}
            >
              📝 个人信息
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                activeTab === 'courses'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
              }`}
            >
              📚 我的课程
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                activeTab === 'classes'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
              }`}
            >
              🏫 我的班级
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
                      value={teacherInfo.fullName}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">工号</label>
                    <input
                      type="text"
                      value={teacherInfo.teacherNumber}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">所属院系</label>
                    <input
                      type="text"
                      value={teacherInfo.department}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">职称</label>
                    <input
                      type="text"
                      value={teacherInfo.title}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                    <input
                      type="email"
                      value={teacherInfo.email}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <button className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
                  保存修改
                </button>
              </div>
            )}

            {/* 我的课程 */}
            {activeTab === 'courses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">我的课程</h2>
                  <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
                    ➕ 创建新课程
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.map(course => (
                    <div key={course.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-100 hover:border-indigo-300 transition-all hover:shadow-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{course.name}</h3>
                          <p className="text-gray-600">课程代码: {course.code}</p>
                        </div>
                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-sm font-medium">
                          {course.credit}学分
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-sm text-gray-600">📅 {course.semester}</span>
                        <div className="space-x-2">
                          <button className="px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-all">
                            编辑
                          </button>
                          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all">
                            查看
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 我的班级 */}
            {activeTab === 'classes' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">我的班级</h2>
                  <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl">
                    ➕ 创建新班级
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {classes.map(cls => (
                    <div key={cls.id} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-100 hover:border-purple-300 transition-all hover:shadow-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{cls.name}</h3>
                          <p className="text-gray-600 mb-4">课程: {cls.courseName}</p>
                          <div className="flex items-center space-x-6 text-sm">
                            <span className="flex items-center text-gray-600">
                              <span className="mr-2">👥</span>
                              <span className="font-medium">{cls.studentCount}</span> 名学生
                            </span>
                            <span className="flex items-center text-gray-600">
                              <span className="mr-2">🔑</span>
                              邀请码: <span className="font-mono font-bold text-indigo-600 ml-2">{cls.inviteCode}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <button className="px-4 py-2 bg-white text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 transition-all">
                            管理学生
                          </button>
                          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all">
                            查看详情
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherProfile
