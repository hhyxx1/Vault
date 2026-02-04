import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studentSurveyApi } from '@/services'

interface Question {
  id: string
  text: string
  type: string
  options: string[] | null
  required: boolean
}

interface SurveyDetail {
  id: string
  title: string
  description: string
  status: string
  questions: Question[]
}

const StudentSurveyTake = () => {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<SurveyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!surveyId) return
    studentSurveyApi
      .getSurveyDetail(surveyId)
      .then((data: any) => setSurvey(data))
      .catch((e: any) => setError(e.response?.data?.detail || e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [surveyId])

  const setAnswer = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    if (!surveyId || !survey) return
    const requiredIds = survey.questions.filter((q) => q.required).map((q) => q.id)
    const missing = requiredIds.filter((id) => {
      const v = answers[id]
      return v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
    })
    if (missing.length > 0) {
      alert('请完成所有必答题')
      return
    }
    setSubmitting(true)
    try {
      await studentSurveyApi.submitSurvey(surveyId, answers)
      alert('提交成功')
      navigate(`/student/survey/${surveyId}/detail`, { replace: true })
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }
  if (error || !survey) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error || '问卷不存在'}</p>
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

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/student/survey')}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          ← 返回问卷列表
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{survey.title}</h1>
        {survey.description && (
          <p className="text-gray-600 text-sm mb-4">{survey.description}</p>
        )}
      </div>
      <div className="space-y-6">
        {survey.questions.map((q, index) => (
          <div
            key={q.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <p className="font-medium text-gray-800 mb-3">
              {index + 1}. {q.text}
              {q.required && <span className="text-red-500 ml-1">*</span>}
            </p>
            {['single_choice', 'choice', 'judgment', 'judgement'].includes(q.type) && (q.options?.length || 0) > 0 ? (
              <div className="space-y-2">
                {(Array.isArray(q.options) ? q.options : []).map((opt: any) => {
                  const label = typeof opt === 'string' ? opt : (opt?.value ?? opt?.text ?? opt?.label ?? String(opt))
                  const value = typeof opt === 'string' ? opt : (opt?.key ?? opt?.value ?? opt?.text ?? label)
                  return (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={q.id}
                      value={value}
                      checked={(answers[q.id] as string) === value}
                      onChange={() => setAnswer(q.id, value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">{label}</span>
                  </label>
                  )
                })}
              </div>
            ) : q.type === 'multiple_choice' && (q.options?.length || 0) > 0 ? (
              <div className="space-y-2">
                {(Array.isArray(q.options) ? q.options : []).map((opt: any) => {
                  const label = typeof opt === 'string' ? opt : (opt?.value ?? opt?.text ?? opt?.label ?? String(opt))
                  const value = typeof opt === 'string' ? opt : (opt?.key ?? opt?.value ?? opt?.text ?? label)
                  const arr = (answers[q.id] as string[]) || []
                  const checked = arr.includes(value)
                  return (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked ? arr.filter((x) => x !== value) : [...arr, value]
                          setAnswer(q.id, next)
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-gray-700">{label}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <textarea
                value={(answers[q.id] as string) || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="请输入答案"
                className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px]"
                rows={4}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '提交中...' : '提交答卷'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/student/survey')}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
        >
          取消
        </button>
      </div>
    </div>
  )
}

export default StudentSurveyTake
