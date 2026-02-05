import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentSurveyApi, learningPlanApi } from '@/services'
import { Icon } from '@/components/Icon'

interface Survey {
  id: string
  title: string
  description: string
  questionCount: number
  status: 'published'
  publishedAt: string | null
  dueDate?: string | null
  startTime?: string | null
  endTime?: string | null
  timeStatus?: 'available' | 'upcoming' | 'ended'
  submitted?: boolean
  totalScore?: number
  isPassed?: boolean
}

interface WeakPoint {
  name: string
  totalQuestions: number
  correctCount: number
  wrongCount: number
  accuracyRate: number
}

interface LearningPlan {
  overall_assessment: {
    summary: string
    strengths: string[]
    weaknesses: string[]
    improvement_potential: string
  }
  weak_knowledge_points: Array<{
    name: string
    accuracy_rate: number
    priority: string
    problem_analysis: string
    common_mistakes: string[]
  }>
  learning_plan: {
    total_duration: string
    daily_time: string
    phases: Array<{
      phase_number: number
      phase_name: string
      duration: string
      goals: string[]
      tasks: Array<{
        task_name: string
        description: string
        knowledge_points: string[]
        estimated_time: string
        resources: string[]
        practice_suggestions: string
      }>
      milestone: string
    }>
  }
  study_methods: Array<{
    method_name: string
    description: string
    applicable_scenarios: string
    tips: string[]
  }>
  practice_recommendations: {
    question_types: string[]
    difficulty_progression: string
    review_frequency: string
  }
  motivation_message: string
}

// 倒计时组件
const Countdown = ({ targetTime }: { targetTime: string }) => {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime()
      const target = new Date(targetTime).getTime()
      const diff = target - now

      if (diff <= 0) {
        setTimeLeft('已开始')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (days > 0) {
        setTimeLeft(`${days}天 ${hours}小时 ${minutes}分钟`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}小时 ${minutes}分钟 ${seconds}秒`)
      } else {
        setTimeLeft(`${minutes}分钟 ${seconds}秒`)
      }
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [targetTime])

  return <span>{timeLeft}</span>
}

const AbilityTest = () => {
  const navigate = useNavigate()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 学习计划相关状态
  const [activeTab, setActiveTab] = useState<'tests' | 'plan'>('tests')
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([])
  const [overallStats, setOverallStats] = useState<any>(null)
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planGenerating, setPlanGenerating] = useState(false)
  const [analysisData, setAnalysisData] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    studentSurveyApi
      .getSurveys('ability_test')
      .then(async (raw: any) => {
        if (cancelled) return
        const data = Array.isArray(raw) ? raw : (raw?.data ?? raw?.surveys ?? [])
        if (!Array.isArray(data)) {
          setSurveys([])
          return
        }
        
        // 获取每个问卷的作答状态
        const surveysWithStatus = await Promise.all(
          data.map(async (survey: any) => {
            try {
              const result = await studentSurveyApi.getMyResult(survey.id)
              return {
                ...survey,
                submitted: result.submitted,
                totalScore: result.totalScore,
                isPassed: result.isPassed
              }
            } catch {
              return {
                ...survey,
                submitted: false
              }
            }
          })
        )
        
        setSurveys(surveysWithStatus)
      })
      .catch((e: any) => {
        if (!cancelled) {
          setSurveys([])
          setError(e.response?.data?.detail || e.message || '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // 加载薄弱知识点
  useEffect(() => {
    if (activeTab === 'plan') {
      loadWeakPoints()
    }
  }, [activeTab])

  const loadWeakPoints = async () => {
    setPlanLoading(true)
    try {
      const result = await learningPlanApi.getWeakPoints()
      console.log('学习分析数据:', result)
      if (result.hasData) {
        setWeakPoints(result.weakPoints || [])
        setOverallStats(result.overallStats || null)
      } else {
        // 没有数据时重置状态
        setWeakPoints([])
        setOverallStats(null)
      }
    } catch (e: any) {
      console.error('加载薄弱知识点失败:', e)
      setWeakPoints([])
      setOverallStats(null)
    } finally {
      setPlanLoading(false)
    }
  }

  // 生成学习计划
  const handleGeneratePlan = async () => {
    setPlanGenerating(true)
    try {
      const result = await learningPlanApi.generatePlan()
      if (result.success && result.learningPlan) {
        setLearningPlan(result.learningPlan)
        setAnalysisData(result.analysisData)
      } else if (result.rawResponse) {
        // AI返回了非JSON格式，显示原始响应
        alert('学习计划生成成功，但格式解析失败。请稍后重试。')
      } else {
        alert(result.message || '生成学习计划失败')
      }
    } catch (e: any) {
      console.error('生成学习计划失败:', e)
      alert(e.response?.data?.detail || '生成学习计划失败')
    } finally {
      setPlanGenerating(false)
    }
  }

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高优先级'
      case 'medium': return '中优先级'
      case 'low': return '低优先级'
      default: return priority
    }
  }

  return (
    <div className="h-full bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="target" size={28} className="text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800">测试能力</h2>
          </div>
          {/* Tab 切换 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('tests')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'tests'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              测试列表
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'plan'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              学习计划
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'tests' ? (
            // ========== 测试列表 Tab ==========
            <>
              {/* 说明卡片 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Icon name="info" size={20} className="text-indigo-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-indigo-900">测试能力说明</p>
                    <p className="text-sm text-indigo-700 mt-1">
                      以下是教师基于课程大纲发布的测试能力问卷，用于检测知识掌握情况。
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
                  <p className="text-gray-500">加载中...</p>
                </div>
              ) : error ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Icon name="alert-triangle" size={48} className="text-red-500 mx-auto mb-4" />
                  <p className="text-red-600">{error}</p>
                </div>
              ) : surveys.length > 0 ? (
                <div className="space-y-4">
                  {surveys.map((survey) => {
                    const timeStatus = survey.timeStatus || 'available'
                    const isUpcoming = timeStatus === 'upcoming'
                    const isEnded = timeStatus === 'ended'
                    const isAvailable = timeStatus === 'available'
                    
                    return (
                      <div
                        key={survey.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-800">{survey.title}</h3>
                              {survey.submitted ? (
                                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                                  <Icon name="check-circle" size={14} className="text-gray-600" />
                                  已作答
                                </span>
                              ) : isAvailable ? (
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                                  <Icon name="check-circle" size={14} className="text-green-600" />
                                  可作答
                                </span>
                              ) : isUpcoming ? (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1">
                                  <Icon name="clock" size={14} className="text-yellow-600" />
                                  未开始
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                                  <Icon name="close" size={14} className="text-gray-600" />
                                  已结束
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 mb-3">{survey.description}</p>
                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Icon name="file-text" size={16} className="text-gray-400" />
                                {survey.questionCount} 道题目
                              </span>
                              <span className="flex items-center gap-1">
                                <Icon name="calendar" size={16} className="text-gray-400" />
                                发布于 {survey.publishedAt ?? '-'}
                              </span>
                              {survey.dueDate && (
                                <span className="flex items-center gap-1 text-orange-600 font-medium">
                                  <Icon name="clock" size={16} className="text-orange-500" />
                                  截止: {survey.dueDate}
                                </span>
                              )}
                              {/* 显示得分信息 */}
                              {survey.submitted && survey.totalScore !== undefined && (
                                <span className="flex items-center gap-1 text-blue-600 font-medium">
                                  <Icon name="bar-chart" size={16} className="text-blue-500" />
                                  得分: {survey.totalScore}
                                  {survey.isPassed !== undefined && (
                                    <span className={`ml-2 ${survey.isPassed ? 'text-green-600' : 'text-red-600'}`}>
                                      ({survey.isPassed ? '及格' : '不及格'})
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {/* 时间状态提示 */}
                            {isUpcoming && survey.startTime && (
                              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800 font-medium flex items-center gap-2">
                                  <Icon name="clock" size={16} className="text-yellow-600" />
                                  距离开始还有: <Countdown targetTime={survey.startTime} />
                                </p>
                                <p className="text-xs text-yellow-600 mt-1">
                                  开始时间: {new Date(survey.startTime).toLocaleString('zh-CN')}
                                </p>
                              </div>
                            )}
                            {isEnded && survey.endTime && (
                              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm text-gray-700 font-medium flex items-center gap-2">
                                  <Icon name="close" size={16} className="text-gray-500" />
                                  答题已结束
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  结束时间: {new Date(survey.endTime).toLocaleString('zh-CN')}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col space-y-2 ml-4">
                            {survey.submitted ? (
                              <button
                                onClick={() => navigate(`/student/survey/${survey.id}/detail`, { state: { from: 'ability-test' } })}
                                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                              >
                                查看结果
                              </button>
                            ) : isAvailable ? (
                              <>
                                <button
                                  onClick={() => navigate(`/student/survey/${survey.id}/take`, { state: { from: 'ability-test' } })}
                                  className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                                >
                                  开始答题
                                </button>
                                <button
                                  onClick={() => navigate(`/student/survey/${survey.id}/detail`, { state: { from: 'ability-test' } })}
                                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                                >
                                  查看详情
                                </button>
                              </>
                            ) : isUpcoming ? (
                              <button
                                disabled
                                className="px-6 py-2 bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed"
                              >
                                未开始
                              </button>
                            ) : (
                              <button
                                onClick={() => navigate(`/student/survey/${survey.id}/detail`, { state: { from: 'ability-test' } })}
                                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                              >
                                查看详情
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Icon name="target" size={64} className="text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无测试能力问卷</h3>
                  <p className="text-gray-500">教师还没有发布任何测试能力问卷</p>
                </div>
              )}
            </>
          ) : (
            // ========== 学习计划 Tab ==========
            <>
              {/* 说明卡片 */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Icon name="book" size={20} className="text-purple-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-900">智能学习计划</p>
                    <p className="text-sm text-purple-700 mt-1">
                      根据您的测试能力答题情况，AI 会分析薄弱知识点并生成个性化学习计划，帮助您有针对性地提升。
                    </p>
                  </div>
                </div>
              </div>

              {planLoading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
                  <p className="text-gray-500">分析学习数据中...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 整体统计 */}
                  {overallStats && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Icon name="bar-chart" size={20} className="text-indigo-600" />
                        学习数据概览
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-indigo-50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-indigo-600">{overallStats.totalTests}</p>
                          <p className="text-sm text-gray-600">已完成测试</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-green-600">{overallStats.totalCorrect}</p>
                          <p className="text-sm text-gray-600">答对题数</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-red-600">{overallStats.totalWrong}</p>
                          <p className="text-sm text-gray-600">答错题数</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-purple-600">{(overallStats.overallAccuracy * 100).toFixed(0)}%</p>
                          <p className="text-sm text-gray-600">正确率</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 薄弱知识点 */}
                  {weakPoints.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Icon name="alert-triangle" size={20} className="text-orange-500" />
                        薄弱知识点分析
                      </h3>
                      <div className="space-y-3">
                        {weakPoints.map((point, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-800">{point.name}</span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                point.accuracyRate < 0.3 ? 'bg-red-100 text-red-700' :
                                point.accuracyRate < 0.5 ? 'bg-orange-100 text-orange-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                正确率 {(point.accuracyRate * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  point.accuracyRate < 0.3 ? 'bg-red-500' :
                                  point.accuracyRate < 0.5 ? 'bg-orange-500' :
                                  'bg-yellow-500'
                                }`}
                                style={{ width: `${point.accuracyRate * 100}%` }}
                              />
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                              共 {point.totalQuestions} 题，答对 {point.correctCount} 题，答错 {point.wrongCount} 题
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 生成学习计划按钮 */}
                  {!learningPlan && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                      <Icon name="book" size={48} className="text-purple-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">生成个性化学习计划</h3>
                      <p className="text-gray-500 mb-6">
                        AI 将根据您的薄弱知识点，为您制定详细的学习计划和建议
                      </p>
                      <button
                        onClick={handleGeneratePlan}
                        disabled={planGenerating || weakPoints.length === 0}
                        className={`px-8 py-3 rounded-lg font-medium transition-all ${
                          planGenerating || weakPoints.length === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                        }`}
                      >
                        {planGenerating ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            AI 正在生成学习计划...
                          </span>
                        ) : weakPoints.length === 0 ? (
                          '暂无薄弱知识点需要改进'
                        ) : (
                          '生成学习计划'
                        )}
                      </button>
                      {weakPoints.length === 0 && overallStats && (
                        <p className="text-sm text-green-600 mt-4">
                          太棒了！您的知识掌握情况良好，继续保持！
                        </p>
                      )}
                    </div>
                  )}

                  {/* 学习计划详情 */}
                  {learningPlan && (
                    <div className="space-y-6">
                      {/* 整体评估 */}
                      {learningPlan.overall_assessment && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Icon name="clipboard" size={20} className="text-blue-600" />
                            整体评估
                          </h3>
                          <p className="text-gray-700 mb-4">{learningPlan.overall_assessment.summary}</p>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-green-50 rounded-lg p-4">
                              <h4 className="font-medium text-green-800 mb-2">掌握较好的方面</h4>
                              <ul className="space-y-1">
                                {learningPlan.overall_assessment.strengths?.map((s, i) => (
                                  <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                                    <Icon name="check-circle" size={14} className="text-green-500 mt-0.5" />
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-4">
                              <h4 className="font-medium text-orange-800 mb-2">需要加强的方面</h4>
                              <ul className="space-y-1">
                                {learningPlan.overall_assessment.weaknesses?.map((w, i) => (
                                  <li key={i} className="text-sm text-orange-700 flex items-start gap-2">
                                    <Icon name="alert-triangle" size={14} className="text-orange-500 mt-0.5" />
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 薄弱知识点详细分析 */}
                      {learningPlan.weak_knowledge_points && learningPlan.weak_knowledge_points.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Icon name="search" size={20} className="text-purple-600" />
                            知识点详细分析
                          </h3>
                          <div className="space-y-4">
                            {learningPlan.weak_knowledge_points.map((point, index) => (
                              <div key={index} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-gray-800">{point.name}</h4>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(point.priority)}`}>
                                    {getPriorityText(point.priority)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{point.problem_analysis}</p>
                                {point.common_mistakes && point.common_mistakes.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium text-gray-500 mb-1">常见错误：</p>
                                    <ul className="text-sm text-gray-600 space-y-1">
                                      {point.common_mistakes.map((m, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="text-red-400">•</span>
                                          {m}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 学习计划阶段 */}
                      {learningPlan.learning_plan && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Icon name="calendar" size={20} className="text-indigo-600" />
                            学习计划
                          </h3>
                          <p className="text-sm text-gray-500 mb-4">
                            建议学习时长：{learningPlan.learning_plan.total_duration}，
                            每日学习时间：{learningPlan.learning_plan.daily_time}
                          </p>
                          <div className="space-y-6">
                            {learningPlan.learning_plan.phases?.map((phase, phaseIndex) => (
                              <div key={phaseIndex} className="border-l-4 border-indigo-500 pl-4">
                                <div className="flex items-center gap-3 mb-3">
                                  <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                                    {phase.phase_number}
                                  </span>
                                  <div>
                                    <h4 className="font-medium text-gray-800">{phase.phase_name}</h4>
                                    <p className="text-xs text-gray-500">{phase.duration}</p>
                                  </div>
                                </div>
                                
                                {/* 阶段目标 */}
                                <div className="mb-3">
                                  <p className="text-xs font-medium text-gray-500 mb-1">阶段目标：</p>
                                  <ul className="space-y-1">
                                    {phase.goals?.map((goal, i) => (
                                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                        <Icon name="target" size={14} className="text-indigo-500 mt-0.5" />
                                        {goal}
                                      </li>
                                    ))}
                                  </ul>
                                </div>

                                {/* 具体任务 */}
                                <div className="space-y-3">
                                  {phase.tasks?.map((task, taskIndex) => (
                                    <div key={taskIndex} className="bg-gray-50 rounded-lg p-4">
                                      <h5 className="font-medium text-gray-800 mb-2">{task.task_name}</h5>
                                      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                          预计用时：{task.estimated_time}
                                        </span>
                                        {task.knowledge_points?.map((kp, i) => (
                                          <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                            {kp}
                                          </span>
                                        ))}
                                      </div>
                                      {task.resources && task.resources.length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs font-medium text-gray-500 mb-1">推荐资源：</p>
                                          <ul className="text-sm text-gray-600">
                                            {task.resources.map((r, i) => (
                                              <li key={i} className="flex items-center gap-1">
                                                <Icon name="book" size={12} className="text-gray-400" />
                                                {r}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {task.practice_suggestions && (
                                        <p className="text-xs text-indigo-600 mt-2">
                                          练习建议：{task.practice_suggestions}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* 里程碑 */}
                                {phase.milestone && (
                                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800">
                                      <span className="font-medium">里程碑：</span>{phase.milestone}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 学习方法建议 */}
                      {learningPlan.study_methods && learningPlan.study_methods.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Icon name="star" size={20} className="text-yellow-500" />
                            学习方法建议
                          </h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            {learningPlan.study_methods.map((method, index) => (
                              <div key={index} className="bg-yellow-50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-800 mb-2">{method.method_name}</h4>
                                <p className="text-sm text-gray-600 mb-2">{method.description}</p>
                                <p className="text-xs text-gray-500 mb-2">适用场景：{method.applicable_scenarios}</p>
                                {method.tips && method.tips.length > 0 && (
                                  <ul className="space-y-1">
                                    {method.tips.map((tip, i) => (
                                      <li key={i} className="text-xs text-yellow-700 flex items-start gap-1">
                                        <span>💡</span>
                                        {tip}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 练习建议 */}
                      {learningPlan.practice_recommendations && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Icon name="edit" size={20} className="text-green-600" />
                            练习建议
                          </h3>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium text-gray-700">建议多练的题型：</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {learningPlan.practice_recommendations.question_types?.map((type, i) => (
                                  <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                    {type}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">难度递进建议：</p>
                              <p className="text-sm text-gray-600 mt-1">{learningPlan.practice_recommendations.difficulty_progression}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">复习频率：</p>
                              <p className="text-sm text-gray-600 mt-1">{learningPlan.practice_recommendations.review_frequency}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 鼓励语 */}
                      {learningPlan.motivation_message && (
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                          <div className="flex items-start gap-3">
                            <Icon name="heart" size={24} className="text-pink-200" />
                            <p className="text-lg">{learningPlan.motivation_message}</p>
                          </div>
                        </div>
                      )}

                      {/* 重新生成按钮 */}
                      <div className="text-center">
                        <button
                          onClick={handleGeneratePlan}
                          disabled={planGenerating}
                          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                        >
                          {planGenerating ? '重新生成中...' : '重新生成学习计划'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 无数据提示 */}
                  {!overallStats && !planLoading && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                      <Icon name="info" size={48} className="text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无学习数据</h3>
                      <p className="text-gray-500">请先完成测试能力问卷，系统会根据您的答题情况分析薄弱知识点</p>
                      <button
                        onClick={() => setActiveTab('tests')}
                        className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all"
                      >
                        去做测试
                      </button>
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

export default AbilityTest
