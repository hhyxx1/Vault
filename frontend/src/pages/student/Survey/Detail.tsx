import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studentSurveyApi } from '@/services'

interface MyResult {
  submitted: boolean
  scorePublished?: boolean
  totalScore?: number
  percentageScore?: number
  submitTime?: string
  isPassed?: boolean
}

const StudentSurveyDetail = () => {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<MyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!surveyId) return
    studentSurveyApi
      .getMyResult(surveyId)
      .then((data: any) => setResult(data))
      .catch((e: any) => setError(e.response?.data?.detail || e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [surveyId])

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/student/survey')}
          className="mt-4 px-4 py-2 bg-gray-200 rounded-lg"
        >
          返回问卷列表
        </button>
      </div>
    )
  }

  const submitted = result?.submitted ?? false
  const scorePublished = result?.scorePublished ?? false

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/student/survey')}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          ← 返回问卷列表
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        {!submitted ? (
          <>
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">您还未作答</h2>
            <p className="text-gray-500 mb-6">请先完成该问卷的作答后再查看详情。</p>
            <button
              type="button"
              onClick={() => navigate(`/student/survey/${surveyId}/take`)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              开始答题
            </button>
          </>
        ) : !scorePublished ? (
          <>
            <div className="text-6xl mb-4">⏳</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">等待老师公布成绩</h2>
            <p className="text-gray-500">您已提交答卷，成绩公布后可在此查看得分与详情。</p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">成绩详情</h2>
            <div className="space-y-2 text-left max-w-xs mx-auto">
              {result?.totalScore != null && (
                <p className="text-gray-700">
                  <span className="font-medium">得分：</span>
                  {result.totalScore} 分
                </p>
              )}
              {result?.percentageScore != null && (
                <p className="text-gray-700">
                  <span className="font-medium">得分率：</span>
                  {result.percentageScore}%
                </p>
              )}
              {result?.isPassed != null && (
                <p className="text-gray-700">
                  <span className="font-medium">结果：</span>
                  {result.isPassed ? '通过' : '未通过'}
                </p>
              )}
              {result?.submitTime && (
                <p className="text-gray-500 text-sm">
                  提交时间：{new Date(result.submitTime).toLocaleString()}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default StudentSurveyDetail
