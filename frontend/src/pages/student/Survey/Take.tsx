import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { studentSurveyApi } from '@/services'
import { Icon } from '@/components/Icon'

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
  const location = useLocation()
  const [survey, setSurvey] = useState<SurveyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)

  // 判断返回路径
  const getBackPath = () => {
    const from = (location.state as any)?.from
    if (from === 'ability-test') return '/student/ability-test'
    if (location.pathname.includes('ability')) return '/student/ability-test'
    // 检查 referrer
    const referrer = document.referrer
    if (referrer.includes('ability')) return '/student/ability-test'
    return '/student/survey'
  }

  const backPath = getBackPath()
  const backLabel = backPath.includes('ability') ? '返回能力检测' : '返回问卷列表'

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

  // 获取题目类型中文名
  const getQuestionTypeName = (type: string) => {
    const types: Record<string, string> = {
      'single_choice': '单选题',
      'choice': '单选题',
      'multiple_choice': '多选题',
      'multi_choice': '多选题',
      'true_false': '判断题',
      'judge': '判断题',
      'judgment': '判断题',
      'fill_blank': '填空题',
      'essay': '问答题',
      'short_answer': '简答题',
      'text': '问答题'
    }
    return types[type] || '问答题'
  }

  // 获取题目类型颜色
  const getQuestionTypeStyle = (type: string) => {
    if (['single_choice', 'choice'].includes(type)) {
      return 'bg-blue-100 text-blue-700 border-blue-200'
    }
    if (['multiple_choice', 'multi_choice'].includes(type)) {
      return 'bg-purple-100 text-purple-700 border-purple-200'
    }
    if (['true_false', 'judge', 'judgment'].includes(type)) {
      return 'bg-green-100 text-green-700 border-green-200'
    }
    if (['fill_blank'].includes(type)) {
      return 'bg-orange-100 text-orange-700 border-orange-200'
    }
    return 'bg-pink-100 text-pink-700 border-pink-200'
  }

  // 计算答题进度
  const answeredCount = Object.keys(answers).filter(k => {
    const v = answers[k]
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length
  const totalCount = survey?.questions.length || 0
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0

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
      // 提交后跳转到详情页，保持来源信息
      navigate(`/student/survey/${surveyId}/detail`, { 
        replace: true,
        state: { from: backPath.includes('ability') ? 'ability-test' : 'survey' }
      })
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAskQuestion = async () => {
    if (!surveyId || !questionText.trim()) {
      alert('请输入问题内容')
      return
    }
    setSubmittingQuestion(true)
    try {
      await fetch('/api/student/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          survey_id: surveyId,
          question_text: questionText.trim(),
          question_type: 'survey'
        })
      })
      alert('问题已发送给老师')
      setQuestionText('')
      setShowQuestionModal(false)
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message || '发送失败')
    } finally {
      setSubmittingQuestion(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="alert-triangle" size={32} className="text-red-500" />
            </div>
            <p className="text-red-600 mb-4">{error || '问卷不存在'}</p>
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {backLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <Icon name="arrow-left" size={20} />
              <span className="font-medium">{backLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQuestionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
            >
              <Icon name="help-circle" size={16} />
              向教师提问
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 问卷标题卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
          <div className="relative">
            <h1 className="text-2xl font-bold text-gray-800 mb-3">{survey.title}</h1>
            {survey.description && (
              <p className="text-gray-500 leading-relaxed">{survey.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Icon name="file-text" size={16} className="text-indigo-500" />
                共 {totalCount} 题
              </span>
              <span className="flex items-center gap-1">
                <Icon name="check-circle" size={16} className="text-emerald-500" />
                已答 {answeredCount} 题
              </span>
            </div>
          </div>
        </div>

        {/* 答题进度条 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">答题进度</span>
            <span className="text-sm font-bold text-indigo-600">{answeredCount}/{totalCount}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 题目列表 */}
        <div className="space-y-5">
          {survey.questions.map((q, index) => {
            const isAnswered = (() => {
              const v = answers[q.id]
              return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
            })()

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-300 ${
                  isAnswered ? 'border-emerald-200' : 'border-gray-100 hover:border-indigo-200'
                }`}
              >
                {/* 题目头部 */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                      isAnswered ? 'bg-emerald-500 text-white' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getQuestionTypeStyle(q.type)}`}>
                          {getQuestionTypeName(q.type)}
                        </span>
                        {q.required && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                            必答
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 font-medium leading-relaxed">{q.text}</p>
                    </div>
                  </div>
                  {isAnswered && (
                    <div className="shrink-0">
                      <Icon name="check-circle" size={20} className="text-emerald-500" />
                    </div>
                  )}
                </div>

                {/* 题目选项/输入区 */}
                <div className="px-6 py-5">
                  {['single_choice', 'choice', 'judge', 'judgment', 'judgement', 'true_false'].includes(q.type) && (q.options?.length || 0) > 0 ? (
                    <div className="space-y-3">
                      {(Array.isArray(q.options) ? q.options : []).map((opt: any) => {
                        const label = typeof opt === 'string' ? opt : (opt?.value ?? opt?.text ?? opt?.label ?? String(opt))
                        const value = typeof opt === 'string' ? opt : (opt?.key ?? opt?.value ?? opt?.text ?? label)
                        const displayLabel = String(label)
                        const displayValue = String(value)
                        const isSelected = (answers[q.id] as string) === displayValue

                        return (
                          <label 
                            key={displayValue} 
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                              isSelected 
                                ? 'bg-indigo-50 border-indigo-300 shadow-sm' 
                                : 'bg-gray-50 border-gray-200 hover:bg-indigo-50/50 hover:border-indigo-200'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <input
                              type="radio"
                              name={q.id}
                              value={displayValue}
                              checked={isSelected}
                              onChange={() => setAnswer(q.id, displayValue)}
                              className="sr-only"
                            />
                            <span className={`flex-1 ${isSelected ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>
                              {displayLabel}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ) : ['multiple_choice', 'multi_choice'].includes(q.type) && (q.options?.length || 0) > 0 ? (
                    <div className="space-y-3">
                      {(Array.isArray(q.options) ? q.options : []).map((opt: any) => {
                        const label = typeof opt === 'string' ? opt : (opt?.value ?? opt?.text ?? opt?.label ?? String(opt))
                        const value = typeof opt === 'string' ? opt : (opt?.key ?? opt?.value ?? opt?.text ?? label)
                        const displayLabel = String(label)
                        const displayValue = String(value)
                        const arr = (answers[q.id] as string[]) || []
                        const isSelected = arr.includes(displayValue)

                        return (
                          <label 
                            key={displayValue} 
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                              isSelected 
                                ? 'bg-purple-50 border-purple-300 shadow-sm' 
                                : 'bg-gray-50 border-gray-200 hover:bg-purple-50/50 hover:border-purple-200'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <Icon name="check" size={12} className="text-white" />
                              )}
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const next = isSelected ? arr.filter((x) => x !== displayValue) : [...arr, displayValue]
                                setAnswer(q.id, next)
                              }}
                              className="sr-only"
                            />
                            <span className={`flex-1 ${isSelected ? 'text-purple-700 font-medium' : 'text-gray-700'}`}>
                              {displayLabel}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={(answers[q.id] as string) || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder="请在此输入您的答案..."
                      className="w-full border-2 border-gray-200 rounded-xl p-4 min-h-[120px] focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none"
                      rows={4}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 提交按钮区 */}
        <div className="mt-8 flex gap-4 justify-center">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            暂不提交
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                提交中...
              </>
            ) : (
              <>
                <Icon name="send" size={18} />
                提交答卷
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* 向教师提问弹窗 */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Icon name="help-circle" size={20} className="text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">向教师提问</h3>
            </div>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="请描述您在答题过程中遇到的问题..."
              className="w-full border-2 border-gray-200 rounded-xl p-4 min-h-[150px] focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none mb-4"
              rows={6}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowQuestionModal(false)
                  setQuestionText('')
                }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAskQuestion}
                disabled={submittingQuestion}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submittingQuestion ? '发送中...' : '发送问题'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentSurveyTake
