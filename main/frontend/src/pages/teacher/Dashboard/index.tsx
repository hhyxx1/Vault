import { Icon } from '../../../components/Icon'

const TeacherDashboard = () => {
  const stats = {
    avgScore: 84.9,
    passRate: 92,
    maxScore: 98,
    completionRate: 100,
    totalStudents: 45,
    activeStudents: 42,
  }

  const insights = [
    {
      question: '这个班最不了解课程概念的同学是谁？',
      students: ['张伟', '李娜', '王强'],
      skills: ['选择状态转换错误率达 85%', 'PCB 概念混淆', '未完成相关实验'],
    },
    {
      question: '这个班最活跃的五名同学是谁？',
      students: ['陈晨', '刘洋', '赵敏', '孙浩', '周杰'],
      stats: ['平均每周提问 8 次', '完成所有作业', '参与度 98%'],
    },
    {
      question: '本周学习进度落后的学生有哪些？',
      students: ['林小明', '吴芳'],
      suggestions: ['建议加强基础知识复习', '推荐观看录播课程', '安排一对一答疑'],
    },
  ]

  const recentActivities = [
    { type: 'submit', student: '张三', content: '提交了《数据结构》作业', time: '10分钟前' },
    { type: 'question', student: '李四', content: '在智能问答中提出了新问题', time: '25分钟前' },
    { type: 'complete', student: '王五', content: '完成了期中测验', time: '1小时前' },
    { type: 'survey', student: '赵六', content: '完成了课程反馈问卷', time: '2小时前' },
  ]

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 overflow-y-auto">
      {/* 顶部标题 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              教师看板
            </h2>
            <p className="text-gray-500 text-sm mt-2">实时监控班级学情与自定义多维分析</p>
          </div>
          <div className="flex items-center space-x-3">
            <select className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option>数据结构基础2026</option>
              <option>算法设计与分析</option>
            </select>
            <button className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-md text-sm">
              自定义看板
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 核心数据统计 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <span className="mr-2">
                <Icon name="dashboard" size={24} className="text-blue-600" />
              </span>
              核心数据概览
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
              {/* 班级平均分 */}
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600 font-medium">班级平均分</p>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center">
                    <Icon name="sparkles" size={24} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-1">{stats.avgScore}</p>
                <p className="text-xs text-green-600 font-medium">↑ 较上周 +1.2</p>
              </div>

              {/* 及格率 */}
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600 font-medium">及格率</p>
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                    <Icon name="award" size={24} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-1">{stats.passRate}%</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-emerald-500 h-1.5 rounded-full"
                    style={{ width: `${stats.passRate}%` }}
                  ></div>
                </div>
              </div>

              {/* 最高分 */}
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600 font-medium">最高分</p>
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center">
                    <Icon name="award" size={24} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-1">{stats.maxScore}</p>
                <p className="text-xs text-gray-500">获得者: 林晓雪</p>
              </div>

              {/* 作业提交率 */}
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600 font-medium">作业提交率</p>
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center">
                    <Icon name="survey" size={24} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-1">{stats.completionRate}%</p>
                <p className="text-xs text-gray-500">全员已提交</p>
              </div>

              {/* 学生总数 */}
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600 font-medium">学生总数</p>
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                    <Icon name="class" size={24} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-1">{stats.totalStudents}</p>
                <p className="text-xs text-gray-500">本学期在读</p>
              </div>

              {/* 活跃学生 */}
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600 font-medium">活跃学生</p>
                  <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl flex items-center justify-center">
                    <Icon name="sparkles" size={24} className="text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-800 mb-1">{stats.activeStudents}</p>
                <p className="text-xs text-green-600 font-medium">活跃度 93%</p>
              </div>
            </div>
          </div>

          {/* AI智能分析 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <span className="mr-2">
                <Icon name="sparkles" size={24} className="text-purple-600" />
              </span>
              AI 智能分析与建议
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {insights.map((insight, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md hover:shadow-xl transition-all">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
                      <Icon name="description" size={24} className="text-white" />
                    </div>
                    <h4 className="text-gray-800 font-bold flex-1 text-lg">{insight.question}</h4>
                  </div>

                  <div className="space-y-4">
                    {insight.students && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2 font-medium">相关学生：</p>
                        <div className="flex flex-wrap gap-2">
                          {insight.students.map((student, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-sm border border-blue-200 font-medium"
                            >
                              {student}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {insight.skills && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2 font-medium">问题分析：</p>
                        <div className="space-y-2">
                          {insight.skills.map((skill, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="mt-1">
                                <Icon name="close" size={14} className="text-red-500" />
                              </span>
                              <span className="text-gray-700">{skill}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insight.stats && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2 font-medium">表现统计：</p>
                        <div className="space-y-2">
                          {insight.stats.map((stat, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="mt-1">
                                <Icon name="award" size={14} className="text-green-500" />
                              </span>
                              <span className="text-gray-700">{stat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {insight.suggestions && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2 font-medium">改进建议：</p>
                        <div className="space-y-2">
                          {insight.suggestions.map((suggestion, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="mt-1">
                                <Icon name="chevron-right" size={14} className="text-purple-500" />
                              </span>
                              <span className="text-gray-700">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 最近动态 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <span className="mr-2">
                <Icon name="description" size={24} className="text-blue-600" />
              </span>
              最近动态
            </h3>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              <div className="divide-y divide-gray-100">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        activity.type === 'submit' ? 'bg-blue-100' :
                        activity.type === 'question' ? 'bg-purple-100' :
                        activity.type === 'complete' ? 'bg-green-100' :
                        'bg-orange-100'
                      }`}>
                        {activity.type === 'submit' && <Icon name="add" size={20} className="text-blue-600" />}
                        {activity.type === 'question' && <Icon name="description" size={20} className="text-purple-600" />}
                        {activity.type === 'complete' && <Icon name="award" size={20} className="text-green-600" />}
                        {activity.type === 'survey' && <Icon name="survey" size={20} className="text-orange-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-800 font-medium">
                          <span className="text-blue-600 font-semibold">{activity.student}</span> {activity.content}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard
