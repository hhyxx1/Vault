import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentSurveyApi } from '@/services'
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

const TAB_CONFIG = [
  { id: 'survey', label: '课堂检测', icon: 'check-circle' as const, releaseType: 'in_class' as const, tipTitle: '课堂检测说明', tipText: '以下是教师已发布的问卷测验，请在截止日期前完成。未发布的问卷您暂时无法看到。' },
  { id: 'homework', label: '课后作业', icon: 'file-text' as const, releaseType: 'homework' as const, tipTitle: '课后作业说明', tipText: '以下是教师发布的课后作业，请在截止日期前完成。' },
  { id: 'practice', label: '自主练习', icon: 'book' as const, releaseType: 'practice' as const, tipTitle: '自主练习说明', tipText: '以下是教师发布的自主练习，可随时作答巩固知识。' },
]

const StudentSurvey = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('survey')
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentTabConfig = TAB_CONFIG.find((t) => t.id === activeTab) ?? TAB_CONFIG[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    studentSurveyApi
      .getSurveys(currentTabConfig.releaseType)
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
  }, [currentTabConfig.releaseType])

  return (
    <div className="h-full bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <h2 className="text-2xl font-bold text-gray-800">问卷测验</h2>
      </div>

      {/* Tab切换 */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex space-x-8">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon name={tab.icon} size={18} className={activeTab === tab.id ? 'text-primary-600' : 'text-gray-400'} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* 说明卡片 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <Icon name="info" size={20} className="text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">{currentTabConfig.tipTitle}</p>
                <p className="text-sm text-blue-700 mt-1">{currentTabConfig.tipText}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
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
                            onClick={() => navigate(`/student/survey/${survey.id}/detail`, { state: { from: 'survey' } })}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                          >
                            查看结果
                          </button>
                        ) : isAvailable ? (
                          <>
                            <button
                              onClick={() => navigate(`/student/survey/${survey.id}/take`, { state: { from: 'survey' } })}
                              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg"
                            >
                              开始答题
                            </button>
                            <button
                              onClick={() => navigate(`/student/survey/${survey.id}/detail`, { state: { from: 'survey' } })}
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
                            onClick={() => navigate(`/student/survey/${survey.id}/detail`, { state: { from: 'survey' } })}
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
              <Icon name="survey" size={64} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无可用问卷</h3>
              <p className="text-gray-500">
                {activeTab === 'survey' && '教师还没有发布任何课堂检测'}
                {activeTab === 'homework' && '教师还没有发布任何课后作业'}
                {activeTab === 'practice' && '教师还没有发布任何自主练习'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentSurvey
