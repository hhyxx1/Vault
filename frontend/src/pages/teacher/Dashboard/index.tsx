import { useState, useEffect } from 'react'
import { Icon } from '../../../components/Icon'
import { dashboardApi } from '../../../services'

interface DashboardStats {
  total_students: number
  total_questions: number
  avg_participation_rate: number
  active_students: number
}

interface StudentStatsItem {
  student_id: string
  student_name: string
  question_count: number
  participation_rate: number
  avg_score: number
  last_active_date: string | null
}

interface QuestionTrendItem {
  date: string
  count: number
}

interface DashboardOverview {
  stats: DashboardStats
  question_trend: QuestionTrendItem[]
  student_stats: StudentStatsItem[]
}

interface ClassInfo {
  id: string
  class_name: string
  course_name: string
  course_code: string
  academic_year: string
  invite_code: string
  current_students: number
  max_students: number
}

interface RecentQuestion {
  id: string
  student: string
  question: string
  time: string
}

const TeacherDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [recentQuestions, setRecentQuestions] = useState<RecentQuestion[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('[Dashboard] 开始获取数据...')
      
      // 并行获取所有数据
      const [overviewRes, classesRes, questionsRes] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getClasses(),
        dashboardApi.getRecentQuestions()
      ])
      
      console.log('[Dashboard] Overview数据:', overviewRes.data)
      console.log('[Dashboard] Classes数据:', classesRes.data)
      console.log('[Dashboard] Questions数据:', questionsRes.data)
      
      setOverview(overviewRes.data)
      setClasses(classesRes.data || [])
      setRecentQuestions(questionsRes.data || [])
    } catch (err: any) {
      console.error('获取看板数据失败:', err)
      console.error('错误详情:', err.response)
      setError(err.response?.data?.detail || '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 计算统计数据
  const stats = overview?.stats
  const participationRate = stats?.avg_participation_rate 
    ? Math.round(stats.avg_participation_rate * 100) 
    : 0

  // 获取最活跃的学生（按提问数排序）
  const topActiveStudents = overview?.student_stats
    ?.filter(s => s.question_count > 0)
    ?.sort((a, b) => b.question_count - a.question_count)
    ?.slice(0, 5) || []

  // 获取平均分最高的学生
  const topScoreStudents = overview?.student_stats
    ?.filter(s => s.avg_score > 0)
    ?.sort((a, b) => b.avg_score - a.avg_score)
    ?.slice(0, 5) || []

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 overflow-y-auto">
      {/* 顶部标题 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              教师看板
            </h2>
            <p className="text-gray-500 text-sm mt-2">实时监控班级学情与数据分析</p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Icon name="refresh" size={18} className={loading ? 'animate-spin' : ''} />
            刷新数据
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 加载状态 */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Icon name="refresh" size={40} className="text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-500">加载数据中...</p>
              </div>
            </div>
          )}

          {/* 错误状态 */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <Icon name="alert-triangle" size={40} className="text-red-500 mx-auto mb-4" />
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
              >
                重试
              </button>
            </div>
          )}

          {/* 数据展示 */}
          {!loading && !error && (
            <>
              {/* 核心数据统计 */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                  <span className="mr-2">
                    <Icon name="dashboard" size={24} className="text-blue-600" />
                  </span>
                  核心数据概览
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* 学生总数 */}
                  <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600 font-medium">学生总数</p>
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                        <Icon name="class" size={24} className="text-white" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800 mb-1">{stats?.total_students || 0}</p>
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
                    <p className="text-3xl font-bold text-gray-800 mb-1">{stats?.active_students || 0}</p>
                    <p className="text-xs text-green-600 font-medium">
                      活跃度 {participationRate}%
                    </p>
                  </div>

                  {/* 问题总数 */}
                  <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600 font-medium">问题总数</p>
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center">
                        <Icon name="description" size={24} className="text-white" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800 mb-1">{stats?.total_questions || 0}</p>
                    <p className="text-xs text-gray-500">近30天提问</p>
                  </div>

                  {/* 参与率 */}
                  <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200 hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600 font-medium">参与率</p>
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                        <Icon name="award" size={24} className="text-white" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-800 mb-1">{participationRate}%</p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-gradient-to-r from-green-400 to-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${participationRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 班级列表和最近提问 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 我的班级 */}
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                    <span className="mr-2">
                      <Icon name="class" size={24} className="text-indigo-600" />
                    </span>
                    我的班级
                  </h3>
                  <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                    {classes.length > 0 ? (
                      classes.map((cls) => (
                        <div
                          key={cls.id}
                          className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-800">{cls.class_name}</h4>
                              <p className="text-sm text-gray-500">{cls.course_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-indigo-600">
                                {cls.current_students}/{cls.max_students} 人
                              </p>
                              <p className="text-xs text-gray-400">邀请码: {cls.invite_code}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <Icon name="class" size={40} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">暂无班级</p>
                        <p className="text-xs text-gray-400 mt-1">请在个人中心创建班级</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 最近提问 */}
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                    <span className="mr-2">
                      <Icon name="description" size={24} className="text-purple-600" />
                    </span>
                    最近学生提问
                  </h3>
                  <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                    {recentQuestions.length > 0 ? (
                      recentQuestions.map((q) => (
                        <div
                          key={q.id}
                          className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Icon name="description" size={16} className="text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-800">{q.student}</span>
                                <span className="text-xs text-gray-400">{q.time}</span>
                              </div>
                              <p className="text-sm text-gray-600 truncate">{q.question}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <Icon name="description" size={40} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">暂无提问</p>
                        <p className="text-xs text-gray-400 mt-1">学生提问后将在此显示</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 问题趋势图 */}
              {overview?.question_trend && overview.question_trend.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                    <span className="mr-2">
                      <Icon name="description" size={24} className="text-indigo-600" />
                    </span>
                    近7天提问趋势
                  </h3>
                  <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
                    <div className="flex items-end justify-between h-40 gap-2">
                      {overview.question_trend.map((item, index) => {
                        const maxCount = Math.max(...overview.question_trend.map(t => t.count), 1)
                        const height = (item.count / maxCount) * 100
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center">
                            <div className="w-full flex flex-col items-center">
                              <span className="text-xs text-gray-600 mb-1">{item.count}</span>
                              <div
                                className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg transition-all hover:from-blue-600 hover:to-purple-600"
                                style={{ height: `${Math.max(height, 5)}px`, minHeight: '4px' }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500 mt-2">
                              {item.date.slice(5)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 学生排行 */}
              {(topActiveStudents.length > 0 || topScoreStudents.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 最活跃学生 */}
                  {topActiveStudents.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                        <span className="mr-2">
                          <Icon name="sparkles" size={24} className="text-amber-500" />
                        </span>
                        最活跃学生
                      </h3>
                      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                        {topActiveStudents.map((student, index) => (
                          <div
                            key={student.student_id}
                            className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                index === 0 ? 'bg-amber-500' :
                                index === 1 ? 'bg-gray-400' :
                                index === 2 ? 'bg-orange-400' :
                                'bg-blue-400'
                              }`}>
                                {index + 1}
                              </div>
                              <span className="font-medium text-gray-800">{student.student_name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-blue-600">{student.question_count} 次提问</p>
                              {student.last_active_date && (
                                <p className="text-xs text-gray-500">最近活跃: {student.last_active_date}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 成绩最好的学生 */}
                  {topScoreStudents.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                        <span className="mr-2">
                          <Icon name="award" size={24} className="text-green-500" />
                        </span>
                        成绩优秀学生
                      </h3>
                      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                        {topScoreStudents.map((student, index) => (
                          <div
                            key={student.student_id}
                            className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                index === 0 ? 'bg-amber-500' :
                                index === 1 ? 'bg-gray-400' :
                                index === 2 ? 'bg-orange-400' :
                                'bg-green-400'
                              }`}>
                                {index + 1}
                              </div>
                              <span className="font-medium text-gray-800">{student.student_name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">{student.avg_score.toFixed(1)} 分</p>
                              <p className="text-xs text-gray-500">平均成绩</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard
