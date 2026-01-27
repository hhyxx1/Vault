import { useState } from 'react'

type TabType = 'info' | 'courses' | 'join'

const StudentProfile = () => {
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [inviteCode, setInviteCode] = useState('')
  const [studentInfo] = useState({
    fullName: '李明',
    studentNumber: 'S202100123',
    major: '计算机科学与技术',
    grade: '2021级',
    email: 'liming@example.com',
    avatar: ''
  })

  const [enrolledCourses] = useState([
    { id: '1', code: 'CS101', name: '数据结构', className: '计科2021-1班', teacher: '张老师', credit: 4 },
    { id: '2', code: 'CS201', name: '算法设计', className: '计科2021-2班', teacher: '王老师', credit: 3 },
  ])

  const handleJoinClass = () => {
    if (inviteCode.trim()) {
      console.log('加入班级，邀请码:', inviteCode)
      // TODO: 调用API加入班级
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
                <h2 className="text-2xl font-bold text-gray-800 mb-6">我的课程</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {enrolledCourses.map(course => (
                    <div key={course.id} className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-lg">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{course.name}</h3>
                          <p className="text-gray-600 text-sm mb-1">课程代码: {course.code}</p>
                          <p className="text-gray-600 text-sm">班级: {course.className}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
                          {course.credit}学分
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-blue-200">
                        <span className="text-sm text-gray-600">👨‍🏫 {course.teacher}</span>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">
                          查看详情
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {enrolledCourses.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg mb-4">您还没有加入任何课程</p>
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
                          className="w-full px-6 py-4 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-2xl font-mono font-bold tracking-widest"
                        />
                      </div>
                      
                      <button
                        onClick={handleJoinClass}
                        disabled={inviteCode.length !== 8}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg text-lg"
                      >
                        加入班级
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentProfile
