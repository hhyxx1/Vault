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

interface CustomCard {
  id: string
  question: string
  answer: string
  status: 'analyzing' | 'completed' | 'failed'
  created_at: string
}

const TeacherDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [recentQuestions, setRecentQuestions] = useState<RecentQuestion[]>([])
  const [customCards, setCustomCards] = useState<CustomCard[]>([])
  const [showAddCardDialog, setShowAddCardDialog] = useState(false)
  const [cardQuestion, setCardQuestion] = useState('')
  const [creatingCard, setCreatingCard] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    fetchCustomCards()
  }, [])

  // 轮询状态为analyzing的卡片
  useEffect(() => {
    const analyzingCards = customCards.filter(c => c.status === 'analyzing')
    if (analyzingCards.length === 0) return

    const timer = setInterval(async () => {
      for (const card of analyzingCards) {
        try {
          const res = await dashboardApi.getCustomInsight(card.id)
          const updated = res.data
          if (updated.status !== 'analyzing') {
            setCustomCards(prev => prev.map(c => c.id === card.id ? updated : c))
          }
        } catch {
          // ignore poll errors
        }
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [customCards])

  const fetchCustomCards = async () => {
    try {
      const res = await dashboardApi.getCustomInsights()
      setCustomCards(res.data || [])
    } catch (err) {
      console.error('获取洞察卡片失败:', err)
    }
  }

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

  const handleAddCard = async () => {
    if (!cardQuestion.trim()) return
    
    try {
      setCreatingCard(true)
      // 关闭对话框并清空输入
      setShowAddCardDialog(false)
      const questionText = cardQuestion
      setCardQuestion('')
      
      // 调用后端创建卡片（立即返回，status=analyzing）
      const response = await dashboardApi.createCustomInsight({ question: questionText })
      // 卡片立即添加到页面上
      setCustomCards(prev => [response.data, ...prev])
    } catch (err: any) {
      console.error('创建卡片失败:', err)
      alert(err.response?.data?.detail || '创建卡片失败')
    } finally {
      setCreatingCard(false)
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    try {
      await dashboardApi.deleteCustomInsight(cardId)
      setCustomCards(prev => prev.filter(card => card.id !== cardId))
    } catch (err: any) {
      console.error('删除卡片失败:', err)
      // 即使后端失败，也从本地移除
      setCustomCards(prev => prev.filter(card => card.id !== cardId))
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddCardDialog(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2 shadow-md"
            >
              <Icon name="add" size={18} />
              添加卡片
            </button>
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
                    <div className="relative h-48">
                      {/* Y轴刻度 */}
                      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 pr-2">
                        {(() => {
                          const maxCount = Math.max(...overview.question_trend.map(t => t.count), 1)
                          return [
                            <span key="max">{maxCount}</span>,
                            <span key="mid">{Math.round(maxCount / 2)}</span>,
                            <span key="min">0</span>
                          ]
                        })()}
                      </div>
                      
                      {/* 折线图区域 */}
                      <div className="ml-8 h-full relative">
                        {/* 网格线 */}
                        <div className="absolute inset-0 flex flex-col justify-between">
                          <div className="border-t border-gray-100"></div>
                          <div className="border-t border-gray-100"></div>
                          <div className="border-t border-gray-200"></div>
                        </div>
                        
                        {/* SVG折线图 */}
                        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {(() => {
                            const maxCount = Math.max(...overview.question_trend.map(t => t.count), 1)
                            const points = overview.question_trend.map((item, index) => {
                              const x = (index / (overview.question_trend.length - 1)) * 100
                              const y = 100 - (item.count / maxCount) * 90
                              return `${x},${y}`
                            }).join(' ')
                            
                            const fillPoints = `0,100 ${points} 100,100`
                            
                            return (
                              <>
                                {/* 渐变填充区域 */}
                                <defs>
                                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.05" />
                                  </linearGradient>
                                </defs>
                                <polygon
                                  points={fillPoints}
                                  fill="url(#lineGradient)"
                                />
                                {/* 折线 */}
                                <polyline
                                  points={points}
                                  fill="none"
                                  stroke="url(#lineStroke)"
                                  strokeWidth="0.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <defs>
                                  <linearGradient id="lineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="rgb(139, 92, 246)" />
                                    <stop offset="100%" stopColor="rgb(59, 130, 246)" />
                                  </linearGradient>
                                </defs>
                                {/* 数据点 */}
                                {overview.question_trend.map((item, index) => {
                                  const x = (index / (overview.question_trend.length - 1)) * 100
                                  const y = 100 - (item.count / maxCount) * 90
                                  return (
                                    <circle
                                      key={index}
                                      cx={x}
                                      cy={y}
                                      r="1.2"
                                      fill="white"
                                      stroke="rgb(99, 102, 241)"
                                      strokeWidth="0.5"
                                    />
                                  )
                                })}
                              </>
                            )
                          })()}
                        </svg>
                      </div>
                      
                      {/* X轴标签 */}
                      <div className="ml-8 mt-2 flex justify-between">
                        {overview.question_trend.map((item, index) => (
                          <div key={index} className="flex flex-col items-center flex-1">
                            <span className="text-xs text-gray-500">{item.date.slice(5)}</span>
                            <span className="text-xs font-medium text-indigo-600 mt-1">{item.count}</span>
                          </div>
                        ))}
                      </div>
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

              {/* 自定义洞察卡片区域 */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                  <span className="mr-2">
                    <Icon name="sparkles" size={24} className="text-purple-600" />
                  </span>
                  智能洞察
                </h3>

                {customCards.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {customCards.map((card) => (
                      <div
                        key={card.id}
                        className={`rounded-2xl p-6 shadow-md border hover:shadow-xl transition-all ${
                          card.status === 'analyzing'
                            ? 'bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 border-yellow-200'
                            : card.status === 'failed'
                            ? 'bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 border-red-200'
                            : 'bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 border-purple-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              card.status === 'analyzing'
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                                : card.status === 'failed'
                                ? 'bg-gradient-to-br from-red-400 to-pink-500'
                                : 'bg-gradient-to-br from-purple-500 to-blue-500'
                            }`}>
                              {card.status === 'analyzing' ? (
                                <Icon name="refresh" size={20} className="text-white animate-spin" />
                              ) : (
                                <Icon name="sparkles" size={20} className="text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-800 mb-1">{card.question}</h4>
                              <p className="text-xs text-gray-500">{card.created_at}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                          >
                            <Icon name="close" size={20} />
                          </button>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4">
                          {card.status === 'analyzing' ? (
                            <div className="flex items-center gap-3">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <p className="text-sm text-orange-600">正在分析中，请稍候...</p>
                            </div>
                          ) : card.status === 'failed' ? (
                            <p className="text-sm text-red-600">{card.answer || '分析失败，请重新尝试'}</p>
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                              {card.answer}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 自定义卡片添加对话框 */}
      {showAddCardDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Icon name="sparkles" size={24} className="text-purple-600" />
                添加自定义洞察卡片
              </h3>
              <button
                onClick={() => setShowAddCardDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icon name="close" size={24} />
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                你想了解什么？
              </label>
              <textarea
                value={cardQuestion}
                onChange={(e) => setCardQuestion(e.target.value)}
                placeholder="例如：这个班最不了解进程概念的同学是谁？&#10;这个班最活跃的五名同学是谁？&#10;这个班代码风格最好的同学是谁？"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 提示：可以提问关于学生学习情况、活跃度、成绩等问题
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddCardDialog(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
              >
                取消
              </button>
              <button
                onClick={handleAddCard}
                disabled={!cardQuestion.trim() || creatingCard}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creatingCard ? (
                  <>
                    <Icon name="refresh" size={18} className="animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Icon name="sparkles" size={18} />
                    创建卡片
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherDashboard
