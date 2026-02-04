import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentSurveyApi } from '@/services'

interface Survey {
  id: string
  title: string
  description: string
  questionCount: number
  status: 'published'
  publishedAt: string | null
  dueDate?: string | null
}

const TAB_CONFIG = [
  { id: 'survey', label: '课堂检测', icon: '✅', releaseType: 'in_class' as const, tipTitle: '课堂检测说明', tipText: '以下是教师已发布的问卷测验，请在截止日期前完成。未发布的问卷您暂时无法看到。' },
  { id: 'homework', label: '课后作业', icon: '📝', releaseType: 'homework' as const, tipTitle: '课后作业说明', tipText: '以下是教师发布的课后作业，请在截止日期前完成。' },
  { id: 'practice', label: '自主练习', icon: '📚', releaseType: 'practice' as const, tipTitle: '自主练习说明', tipText: '以下是教师发布的自主练习，可随时作答巩固知识。' },
  { id: 'ability_test', label: '测试能力', icon: '🎯', releaseType: 'ability_test' as const, tipTitle: '测试能力说明', tipText: '以下是教师基于课程大纲发布的测试能力问卷，用于检测知识掌握情况。' },
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
      .then((raw: any) => {
        if (cancelled) return
        const data = Array.isArray(raw) ? raw : (raw?.data ?? raw?.surveys ?? [])
        setSurveys(Array.isArray(data) ? data : [])
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
              <span>{tab.icon}</span>
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
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 text-xl">ℹ️</span>
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
              {surveys.map((survey) => (
                <div
                  key={survey.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-800">{survey.title}</h3>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          ✅ 可作答
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{survey.description}</p>
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span className="flex items-center">
                          <span className="mr-1">📋</span>
                          {survey.questionCount} 道题目
                        </span>
                        <span className="flex items-center">
                          <span className="mr-1">🚀</span>
                          发布于 {survey.publishedAt ?? '-'}
                        </span>
                        {survey.dueDate && (
                          <span className="flex items-center text-orange-600 font-medium">
                            <span className="mr-1">⏰</span>
                            截止日期: {survey.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => navigate(`/student/survey/${survey.id}/take`)}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg"
                      >
                        开始答题
                      </button>
                      <button
                        onClick={() => navigate(`/student/survey/${survey.id}/detail`)}
                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                      >
                        查看详情
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无可用问卷</h3>
              <p className="text-gray-500">
                {activeTab === 'survey' && '教师还没有发布任何课堂检测'}
                {activeTab === 'homework' && '教师还没有发布任何课后作业'}
                {activeTab === 'practice' && '教师还没有发布任何自主练习'}
                {activeTab === 'ability_test' && '教师还没有发布任何测试能力问卷'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentSurvey
