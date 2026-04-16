import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentSurveyApi, learningPlanApi } from '@/services'
import { Icon } from '@/components/Icon'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
    ability_analysis?: {
      strong_abilities: string[]
      weak_abilities: string[]
      ability_score?: {
        concept_understanding?: number
        application?: number
        analysis?: number
        synthesis?: number
      }
    }
    strengths: string[]
    weaknesses: string[]
    improvement_potential: string
  }
  learning_outline?: {
    title: string
    description: string
    modules: Array<{
      module_name: string
      priority: string
      knowledge_points: Array<{
        name: string
        importance: string
        current_mastery: string
        target_mastery: string
      }>
      prerequisites?: string[]
      learning_order: number
    }>
  }
  focus_areas?: {
    high_priority: Array<{
      knowledge_point: string
      accuracy_rate: number
      reason: string
      study_method: string
      resources: string[]
      practice_type: string
      estimated_time: string
    }>
    medium_priority: Array<{
      knowledge_point: string
      accuracy_rate: number
      reason: string
      study_method: string
      resources: string[]
      practice_type: string
      estimated_time: string
    }>
    consolidation: Array<{
      knowledge_point: string
      accuracy_rate: number
      reason: string
      study_method: string
      resources: string[]
      practice_type: string
      estimated_time: string
    }>
  }
  weak_knowledge_points?: Array<{
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
      focus?: string
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
    applicable_scenarios?: string
    applicable_for?: string[]
    tips: string[]
  }>
  practice_recommendations?: {
    question_types: string[]
    difficulty_progression: string
    review_frequency: string
  }
  motivation_message: string
}

interface PersistedLearningPlan {
  learningPlan: LearningPlan
  analysisData?: any
  generatedAt: string
}

const getCurrentStudentPlanStorageKey = () => {
  try {
    const userStr = localStorage.getItem('user')
    if (!userStr) return 'student_learning_plan:anonymous'

    const user = JSON.parse(userStr)
    const accountId = user?.id || user?.username || user?.email || 'anonymous'
    return `student_learning_plan:${accountId}`
  } catch {
    return 'student_learning_plan:anonymous'
  }
}

const loadPersistedLearningPlan = (storageKey: string): PersistedLearningPlan | null => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed?.learningPlan) return null
    return parsed as PersistedLearningPlan
  } catch {
    return null
  }
}

const savePersistedLearningPlan = (storageKey: string, payload: PersistedLearningPlan | null) => {
  try {
    if (!payload) {
      localStorage.removeItem(storageKey)
      return
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    // 忽略存储异常，避免影响页面主流程
  }
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
  const planStorageKey = useMemo(() => getCurrentStudentPlanStorageKey(), [])
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
  const [generatingSeconds, setGeneratingSeconds] = useState(0)

  // 页面初始化时优先恢复当前账号的已保存学习计划
  useEffect(() => {
    const persisted = loadPersistedLearningPlan(planStorageKey)
    if (!persisted?.learningPlan) return

    setLearningPlan(persisted.learningPlan)
    if (persisted.analysisData) {
      setAnalysisData(persisted.analysisData)
    }
  }, [planStorageKey])

  // 学习计划变化后按账号持久化，保证切页/重新登录后仍可恢复
  useEffect(() => {
    if (!learningPlan) return
    savePersistedLearningPlan(planStorageKey, {
      learningPlan,
      analysisData,
      generatedAt: new Date().toISOString()
    })
  }, [planStorageKey, learningPlan, analysisData])

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

  // 生成计划时的计时器
  useEffect(() => {
    if (!planGenerating) return
    const timer = setInterval(() => {
      setGeneratingSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [planGenerating])

  const loadWeakPoints = async () => {
    setPlanLoading(true)
    try {
      const [analysisResult, currentPlanResult] = await Promise.all([
        learningPlanApi.getAnalysis(),
        learningPlanApi.getCurrentPlan().catch(() => ({ hasPlan: false }))
      ])

      console.log('学习分析数据:', analysisResult)
      if (analysisResult.hasData) {
        setWeakPoints(analysisResult.weakPoints || [])
        setOverallStats(analysisResult.overallStats || null)
        setAnalysisData(analysisResult)
      } else {
        // 没有分析数据时仅重置分析相关状态，避免误清空已保存学习计划
        setWeakPoints([])
        setOverallStats(null)
        setAnalysisData(null)
      }

      if (currentPlanResult?.hasPlan && currentPlanResult.learningPlan) {
        setLearningPlan(currentPlanResult.learningPlan)
        if (currentPlanResult.analysisData) {
          setAnalysisData(currentPlanResult.analysisData)
        }
      }
    } catch (e: any) {
      console.error('加载学习分析失败:', e)
      setWeakPoints([])
      setOverallStats(null)
      setAnalysisData(null)
    } finally {
      setPlanLoading(false)
    }
  }

  // 生成学习计划
  const handleGeneratePlan = async () => {
    const previousPlan = learningPlan
    const previousAnalysisData = analysisData
    setPlanGenerating(true)
    setGeneratingSeconds(0)
    try {
      const result = await learningPlanApi.generatePlan()
      console.log('学习计划生成结果:', result)
      
      if (result.success && result.learningPlan) {
        setLearningPlan(result.learningPlan)
        setAnalysisData(result.analysisData)
        savePersistedLearningPlan(planStorageKey, {
          learningPlan: result.learningPlan,
          analysisData: result.analysisData,
          generatedAt: result.generatedAt || new Date().toISOString()
        })
      } else if (result.rawResponse) {
        // AI返回了非JSON格式，尝试手动解析
        console.warn('AI返回非标准格式，原始响应:', result.rawResponse)
        console.warn('解析错误:', result.parseError)
        
        // 尝试从原始响应中提取JSON
        const rawText = result.rawResponse
        let jsonMatch = rawText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            setLearningPlan(parsed)
            setAnalysisData(result.analysisData)
            savePersistedLearningPlan(planStorageKey, {
              learningPlan: parsed,
              analysisData: result.analysisData,
              generatedAt: result.generatedAt || new Date().toISOString()
            })
            console.log('成功从原始响应中解析出学习计划')
          } catch (e) {
            console.error('手动解析也失败:', e)
            setLearningPlan(previousPlan)
            setAnalysisData(previousAnalysisData)
            alert('重新生成失败，已保留原学习计划。请稍后重试。')
          }
        } else {
          setLearningPlan(previousPlan)
          setAnalysisData(previousAnalysisData)
          alert('重新生成失败，已保留原学习计划。请稍后重试。')
        }
      } else {
        setLearningPlan(previousPlan)
        setAnalysisData(previousAnalysisData)
        alert(result.message || '生成学习计划失败，请重试')
      }
    } catch (e: any) {
      console.error('生成学习计划失败:', e)
      setLearningPlan(previousPlan)
      setAnalysisData(previousAnalysisData)
      alert(e.response?.data?.detail || '重新生成失败，已保留原学习计划。请检查网络后重试。')
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
              学情看板
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
                  {/* 核心数据看板 */}
                  {overallStats && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Icon name="bar-chart" size={20} className="text-indigo-600" />
                        学习数据概览
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-indigo-50 rounded-lg p-4 text-center shadow-sm hover:shadow transition-shadow">
                          <p className="text-2xl font-bold text-indigo-600">{overallStats.totalTests}</p>
                          <p className="text-sm text-gray-600">已完成测试(次)</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 text-center shadow-sm hover:shadow transition-shadow">
                          <p className="text-2xl font-bold text-green-600">{overallStats.totalCorrect}</p>
                          <p className="text-sm text-gray-600">累计答对(题)</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-4 text-center shadow-sm hover:shadow transition-shadow">
                          <p className="text-2xl font-bold text-red-600">{overallStats.totalWrong}</p>
                          <p className="text-sm text-gray-600">累计答错(题)</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 text-center shadow-sm hover:shadow transition-shadow">
                          <p className="text-2xl font-bold text-purple-600">{(overallStats.overallAccuracy * 100).toFixed(0)}%</p>
                          <p className="text-sm text-gray-600">平均正确率</p>
                        </div>
                      </div>

                      {/* 可视化图表 */}
                      {analysisData && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* 雷达图：知识点掌握情况 */}
                          <div className="border border-gray-100 bg-gray-50/50 rounded-xl p-5 shadow-sm">
                            <h4 className="text-md font-bold text-gray-700 text-center mb-4 flex items-center justify-center gap-2">
                              <Icon name="target" size={18} className="text-purple-500" />
                              高频知识点掌握度
                            </h4>
                            <div className="h-64 w-full">
                              {(() => {
                                const rawData = analysisData.knowledgePointStats || {};
                                const kpsRaw = Object.keys(rawData).map(k => ({ name: k, ...rawData[k] }));
                                // 取测试次数最多的前8个知识点展示，避免雷达图太拥挤
                                kpsRaw.sort((a, b) => b.total_questions - a.total_questions);
                                const radarData = kpsRaw.slice(0, 8).map(kp => {
                                  let shortName = kp.name.includes(' - ') ? kp.name.split(' - ').slice(1).join(' ').trim() : kp.name;
                                  if (shortName.length > 8) shortName = shortName.substring(0, 8) + '...';
                                  return {
                                    subject: shortName,
                                    A: Math.round(kp.accuracy_rate * 100),
                                    fullMark: 100
                                  };
                                });

                                return radarData.length > 2 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                      <PolarGrid stroke="#e5e7eb" />
                                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12 }} />
                                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                                      <Radar name="正确率(%)" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
                                      <Tooltip />
                                    </RadarChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="flex bg-white rounded-lg h-full border border-dashed border-gray-300 items-center justify-center text-gray-400 text-sm">
                                    数据过少，至少需要做3个知识点才能分析雷达图
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* 折线图：近期测试趋势 */}
                          <div className="border border-gray-100 bg-gray-50/50 rounded-xl p-5 shadow-sm">
                            <h4 className="text-md font-bold text-gray-700 text-center mb-4 flex items-center justify-center gap-2">
                              <Icon name="activity" size={18} className="text-indigo-500" />
                              近期能力测试得分趋势
                            </h4>
                            <div className="h-64 w-full">
                              {(() => {
                                const lineData = [...(analysisData.testResults || [])]
                                  .sort((a: any, b: any) => new Date(a.submitTime).getTime() - new Date(b.submitTime).getTime())
                                  .map((item: any) => {
                                    let shortName = item.surveyTitle;
                                    if (shortName.length > 6) shortName = shortName.substring(0, 6) + '...';
                                    return {
                                      name: shortName,
                                      score: item.percentageScore,
                                      fullTitle: item.surveyTitle
                                    };
                                  });

                                return lineData.length > 0 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={lineData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                      <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
                                      />
                                      <Line type="monotone" dataKey="score" name="得分" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 0 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="flex bg-white rounded-lg h-full border border-dashed border-gray-300 items-center justify-center text-gray-400 text-sm">
                                    暂无能力测试历史成绩
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 薄弱知识点 */}
                  {weakPoints.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Icon name="alert-triangle" size={20} className="text-orange-500" />
                        薄弱知识点分析
                      </h3>
                      
                      {/* 图表区域 */}
                      <div className="space-y-6">
                        {/* 横向柱状图 */}
                        <div className="grid gap-4">
                          {weakPoints.map((point, index) => {
                            const accuracy = point.accuracyRate * 100
                            const colorClass = 
                              accuracy < 30 ? 'from-red-500 to-red-600' :
                              accuracy < 50 ? 'from-orange-500 to-orange-600' :
                              accuracy < 70 ? 'from-yellow-500 to-yellow-600' :
                              'from-green-500 to-green-600'
                            
                            const bgColorClass = 
                              accuracy < 30 ? 'bg-red-50 border-red-100' :
                              accuracy < 50 ? 'bg-orange-50 border-orange-100' :
                              accuracy < 70 ? 'bg-yellow-50 border-yellow-100' :
                              'bg-green-50 border-green-100'
                            
                            const textColorClass = 
                              accuracy < 30 ? 'text-red-700' :
                              accuracy < 50 ? 'text-orange-700' :
                              accuracy < 70 ? 'text-yellow-700' :
                              'text-green-700'

                            // 提取纯净的知识点名称，去掉文档名前缀
                            const cleanName = point.name.includes(' - ') 
                              ? point.name.split(' - ').slice(1).join(' - ').trim()
                              : point.name

                            return (
                              <div key={index} className={`rounded-xl p-4 border transition-all hover:shadow-md ${bgColorClass}`}>
                                {/* 知识点名称和正确率 */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${colorClass} flex items-center justify-center text-white text-xs font-bold`}>
                                      {index + 1}
                                    </div>
                                    <span className="font-semibold text-gray-800 text-sm">{cleanName}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">
                                      {point.correctCount}/{point.totalQuestions} 题
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${textColorClass}`}>
                                      {accuracy.toFixed(0)}%
                                    </span>
                                  </div>
                                </div>

                                {/* 可视化柱状图 */}
                                <div className="relative">
                                  {/* 背景网格线 */}
                                  <div className="absolute inset-0 flex justify-between px-0.5">
                                    {[0, 25, 50, 75, 100].map((val) => (
                                      <div key={val} className="w-px bg-gray-200 h-full"></div>
                                    ))}
                                  </div>
                                  
                                  {/* 进度条 */}
                                  <div className="relative h-8 bg-white/60 rounded-lg overflow-hidden">
                                    <div 
                                      className={`h-full bg-gradient-to-r ${colorClass} rounded-lg flex items-center justify-end pr-2 transition-all duration-700 ease-out`}
                                      style={{ width: `${accuracy}%` }}
                                    >
                                      {accuracy > 15 && (
                                        <span className="text-white text-xs font-bold drop-shadow">
                                          {accuracy.toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* 刻度标签 */}
                                  <div className="flex justify-between mt-1 px-0.5">
                                    {[0, 25, 50, 75, 100].map((val) => (
                                      <span key={val} className="text-xs text-gray-400">{val}</span>
                                    ))}
                                  </div>
                                </div>

                                {/* 答题详情 */}
                                <div className="flex items-center gap-4 mt-3 text-xs">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-gray-600">答对 <span className="font-semibold text-green-600">{point.correctCount}</span> 题</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <span className="text-gray-600">答错 <span className="font-semibold text-red-600">{point.wrongCount}</span> 题</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* 总体分析提示 */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
                          <div className="flex items-start gap-3">
                            <Icon name="info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-gray-800 mb-1">薄弱知识点建议</p>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                正确率低于 <span className="font-semibold text-red-600">30%</span> 需要重点学习，
                                <span className="font-semibold text-orange-600">30-50%</span> 需要加强练习，
                                <span className="font-semibold text-yellow-600">50-70%</span> 需要巩固提高。
                                建议优先复习正确率最低的知识点。
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 生成学习计划按钮 */}
                  {!learningPlan && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                      {planGenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">AI 正在生成学习计划...</h3>
                          <p className="text-gray-500 mb-2">
                            正在分析您的薄弱知识点并制定个性化学习方案，请耐心等待
                          </p>
                          <p className="text-sm text-purple-600 font-medium">
                            已用时 {Math.floor(generatingSeconds / 60)}:{(generatingSeconds % 60).toString().padStart(2, '0')}
                            {generatingSeconds < 60 && ' · 预计需要2-3分钟'}
                            {generatingSeconds >= 60 && generatingSeconds < 120 && ' · 即将完成，请继续等待'}
                            {generatingSeconds >= 120 && ' · 还需一点时间，请稍候'}
                          </p>
                          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(95, generatingSeconds / 180 * 100)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <Icon name="book" size={48} className="text-purple-400 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-gray-800 mb-2">生成个性化学习计划</h3>
                          <p className="text-gray-500 mb-6">
                            AI 将根据您的薄弱知识点，为您制定详细的学习计划和建议
                          </p>
                          <button
                            onClick={handleGeneratePlan}
                            disabled={weakPoints.length === 0}
                            className={`px-8 py-3 rounded-lg font-medium transition-all ${
                              weakPoints.length === 0
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                            }`}
                          >
                            {weakPoints.length === 0 ? '暂无薄弱知识点需要改进' : '生成学习计划'}
                          </button>
                          {weakPoints.length === 0 && overallStats && (
                            <p className="text-sm text-green-600 mt-4">
                              太棒了！您的知识掌握情况良好，继续保持！
                            </p>
                          )}
                        </>
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
                          
                          {/* 能力分析 */}
                          {learningPlan.overall_assessment.ability_analysis && (
                            <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
                              <h4 className="font-medium text-indigo-800 mb-3 flex items-center gap-2">
                                <Icon name="bar-chart" size={16} className="text-indigo-600" />
                                能力分析
                              </h4>
                              
                              {/* 能力雷达图数据展示 */}
                              {learningPlan.overall_assessment.ability_analysis.ability_score && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                  {Object.entries(learningPlan.overall_assessment.ability_analysis.ability_score).map(([key, value]) => {
                                    const abilityNames: Record<string, string> = {
                                      concept_understanding: '概念理解',
                                      application: '应用能力',
                                      analysis: '分析能力',
                                      synthesis: '综合能力'
                                    }
                                    const color = value >= 70 ? 'text-green-600 bg-green-100' : 
                                                  value >= 50 ? 'text-yellow-600 bg-yellow-100' : 
                                                  'text-red-600 bg-red-100'
                                    return (
                                      <div key={key} className={`rounded-lg p-3 text-center ${color}`}>
                                        <p className="text-2xl font-bold">{value}</p>
                                        <p className="text-xs">{abilityNames[key] || key}</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-medium text-indigo-600 mb-2">已具备的能力</p>
                                  <div className="flex flex-wrap gap-2">
                                    {learningPlan.overall_assessment.ability_analysis.strong_abilities?.map((a, i) => (
                                      <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                        {a}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-indigo-600 mb-2">需提升的能力</p>
                                  <div className="flex flex-wrap gap-2">
                                    {learningPlan.overall_assessment.ability_analysis.weak_abilities?.map((a, i) => (
                                      <span key={i} className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                                        {a}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

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

                      {/* 个性化学习大纲 */}
                      {learningPlan.learning_outline && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Icon name="file-text" size={20} className="text-purple-600" />
                            {learningPlan.learning_outline.title}
                          </h3>
                          <p className="text-sm text-gray-500 mb-4">{learningPlan.learning_outline.description}</p>
                          
                          <div className="space-y-4">
                            {learningPlan.learning_outline.modules
                              .sort((a, b) => a.learning_order - b.learning_order)
                              .map((module, index) => (
                              <div key={index} className={`border rounded-lg p-4 ${
                                module.priority === 'high' ? 'border-red-200 bg-red-50' :
                                module.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                                'border-gray-200 bg-gray-50'
                              }`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                      {module.learning_order}
                                    </span>
                                    <h4 className="font-medium text-gray-800">{module.module_name}</h4>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(module.priority)}`}>
                                    {getPriorityText(module.priority)}
                                  </span>
                                </div>
                                
                                {module.prerequisites && module.prerequisites.length > 0 && (
                                  <p className="text-xs text-gray-500 mb-2">
                                    前置知识：{module.prerequisites.join('、')}
                                  </p>
                                )}
                                
                                <div className="space-y-2">
                                  {module.knowledge_points.map((kp, kpIndex) => (
                                    <div key={kpIndex} className="flex items-center justify-between bg-white rounded p-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${
                                          kp.importance === '核心' ? 'bg-red-500' :
                                          kp.importance === '重要' ? 'bg-orange-500' :
                                          'bg-gray-400'
                                        }`} />
                                        <span className="text-sm text-gray-700">{kp.name}</span>
                                        <span className="text-xs text-gray-400">({kp.importance})</span>
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        <span className="text-red-500">{kp.current_mastery}</span>
                                        <span className="mx-1">→</span>
                                        <span className="text-green-600">{kp.target_mastery}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 重点学习内容 */}
                      {learningPlan.focus_areas && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Icon name="target" size={20} className="text-red-600" />
                            重点学习内容
                          </h3>
                          
                          {/* 高优先级 */}
                          {learningPlan.focus_areas.high_priority && learningPlan.focus_areas.high_priority.length > 0 && (
                            <div className="mb-6">
                              <h4 className="font-medium text-red-700 mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                                高优先级 - 必须重点攻克
                              </h4>
                              <div className="space-y-3">
                                {learningPlan.focus_areas.high_priority.map((item, index) => (
                                  <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="font-medium text-gray-800">{item.knowledge_point}</h5>
                                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                        正确率 {(item.accuracy_rate * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">{item.reason}</p>
                                    <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
                                      <div>
                                        <p className="font-medium text-gray-700">学习方法</p>
                                        <p className="text-gray-600">{item.study_method}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-700">练习类型</p>
                                        <p className="text-gray-600">{item.practice_type}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-red-200">
                                      <div className="flex flex-wrap gap-1">
                                        {item.resources.map((r, i) => (
                                          <span key={i} className="text-xs bg-white text-gray-600 px-2 py-1 rounded">
                                            {r}
                                          </span>
                                        ))}
                                      </div>
                                      <span className="text-xs text-red-600 font-medium">{item.estimated_time}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 中优先级 */}
                          {learningPlan.focus_areas.medium_priority && learningPlan.focus_areas.medium_priority.length > 0 && (
                            <div className="mb-6">
                              <h4 className="font-medium text-yellow-700 mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                                中优先级 - 需要加强
                              </h4>
                              <div className="space-y-3">
                                {learningPlan.focus_areas.medium_priority.map((item, index) => (
                                  <div key={index} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="font-medium text-gray-800">{item.knowledge_point}</h5>
                                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                        正确率 {(item.accuracy_rate * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">{item.reason}</p>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs text-gray-500">学习方法：{item.study_method}</span>
                                      <span className="text-xs text-yellow-600 font-medium">{item.estimated_time}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 巩固性 */}
                          {learningPlan.focus_areas.consolidation && learningPlan.focus_areas.consolidation.length > 0 && (
                            <div>
                              <h4 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                巩固性内容 - 保持复习
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {learningPlan.focus_areas.consolidation.map((item, index) => (
                                  <div key={index} className="inline-flex items-center gap-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                                    <span className="text-sm text-gray-700">{item.knowledge_point}</span>
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                      {(item.accuracy_rate * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                                {method.applicable_scenarios && (
                                  <p className="text-xs text-gray-500 mb-2">适用场景：{method.applicable_scenarios}</p>
                                )}
                                {method.applicable_for && method.applicable_for.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    <span className="text-xs text-gray-500">适用于：</span>
                                    {method.applicable_for.map((item, i) => (
                                      <span key={i} className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {method.tips && method.tips.length > 0 && (
                                  <ul className="space-y-1">
                                    {method.tips.map((tip, i) => (
                                      <li key={i} className="text-xs text-yellow-700 flex items-start gap-1">
                                        <Icon name="info" size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
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
                  {!overallStats && !planLoading && !learningPlan && (
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
