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
    if (from === 'survey') return '/student/survey'
    if (location.pathname.includes('ability')) return '/student/ability-test'
    // 检查 referrer
    const referrer = document.referrer
    if (referrer.includes('ability')) return '/student/ability-test'
    return '/student/survey'
  }

  const backPath = getBackPath()
  const backLabel = backPath.includes('ability') ? '返回能力检测' : '返回问卷测验'

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
      return 'bg-blue-50 text-blue-600 border-blue-100'
    }
    if (['multiple_choice', 'multi_choice'].includes(type)) {
      return 'bg-purple-50 text-purple-600 border-purple-100'
    }
    if (['true_false', 'judge', 'judgment'].includes(type)) {
      return 'bg-emerald-50 text-emerald-600 border-emerald-100'
    }
    if (['fill_blank'].includes(type)) {
      return 'bg-orange-50 text-orange-600 border-orange-100'
    }
    return 'bg-indigo-50 text-indigo-600 border-indigo-100'
  }

  // 计算答题进度
  const answeredCount = Object.keys(answers).filter(k => {
    const v = answers[k]
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
  }).length
  const totalCount = survey?.questions?.length || 0
  const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0

  const handleSubmit = async () => {
    if (!surveyId || !survey) return
    const requiredIds = (survey.questions || []).filter((q) => q.required).map((q) => q.id)
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
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="alert-triangle" size={40} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">无法加载问卷</h3>
          <p className="text-gray-500 mb-8">{error || '问卷不存在或已被删除'}</p>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="chevron-left" size={20} />
            {backLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* 顶部导航栏 */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                <Icon name="chevron-left" size={20} className="text-gray-500 group-hover:text-indigo-600" />
              </div>
              <span className="font-medium">{backLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQuestionModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium hover:bg-indigo-100 transition-all border border-indigo-100"
            >
              <Icon name="robot" size={18} />
              向教师提问
            </button>
          </div>
        </div>
      </div>

              <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* 问卷标题卡片 */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-60" />
          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{survey.title}</h1>
            {survey.description && (
              <p className="text-gray-600 leading-relaxed max-w-3xl">{survey.description}</p>
            )}
            <div className="flex items-center gap-6 mt-6 text-sm">
              <span className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-gray-600 border border-gray-100">
                <Icon name="file-text" size={16} className="text-indigo-500" />
                共 {totalCount} 题
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg text-green-700 border border-green-100">
                <Icon name="check-circle" size={16} className="text-green-500" />
                已答 {answeredCount} 题
              </span>
            </div>
          </div>
        </div>

        {/* 答题进度条 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 sticky top-24 z-20 backdrop-blur-sm bg-white/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">答题进度</span>
            <span className="text-sm font-bold text-indigo-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 题目列表 */}
        <div className="space-y-6">
          {(!survey.questions || survey.questions.length === 0) && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Icon name="file-text" size={40} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无题目</h3>
              <p className="text-gray-500">该问卷尚未添加题目，请联系教师</p>
            </div>
          )}
          {(survey.questions || []).map((q, index) => {
            const isAnswered = (() => {
              const v = answers[q.id]
              return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)
            })()

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl border-2 transition-all duration-300 ${
                  isAnswered 
                    ? 'border-indigo-100 shadow-sm' 
                    : 'border-transparent shadow-sm hover:shadow-md hover:border-gray-100'
                }`}
              >
                {/* 题目头部 */}
                <div className="p-4 md:p-8 pb-4 flex items-start justify-between gap-4 md:gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 transition-colors ${
                      isAnswered ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getQuestionTypeStyle(q.type)}`}>
                          {getQuestionTypeName(q.type)}
                        </span>
                        {q.required && (
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                            <Icon name="alert-triangle" size={10} />
                            必答
                          </span>
                        )}
                      </div>
                      <p className="text-lg text-gray-900 font-medium leading-relaxed">{q.text}</p>
                    </div>
                  </div>
                  {isAnswered && (
                    <div className="shrink-0 animate-in fade-in zoom-in duration-300">
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                        <Icon name="check-circle" size={20} className="text-green-500" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 题目选项/输入区 */}
                <div className="px-4 md:px-8 pb-4 md:pb-8 pt-2 ml-10 md:ml-14">
                  {['single_choice', 'choice', 'judge', 'judgment', 'judgement', 'true_false'].includes(q.type) && (q.options?.length || 0) > 0 ? (
                    <div className="space-y-3">
                      {(Array.isArray(q.options) ? q.options : []).map((opt: any) => {
                        const label = typeof opt === 'string' ? opt : (opt?.value ?? opt?.text ?? opt?.label ?? String(opt))
                        // 修复：对于字符串格式的选项（如"A. 选项内容"），提取选项字母
                        let value: string
                        if (typeof opt === 'string') {
                          // 从 "A. 选项内容" 中提取 "A"
                          const match = opt.match(/^([A-Z])[\.\s、]/)
                          value = match ? match[1] : opt
                        } else {
                          value = opt?.key ?? opt?.value ?? opt?.text ?? label
                        }
                        const displayLabel = String(label)
                        const displayValue = String(value)
                        const isSelected = (answers[q.id] as string) === displayValue

                        return (
                          <label 
                            key={displayValue} 
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${
                              isSelected 
                                ? 'bg-indigo-50/50 border-indigo-500 shadow-sm' 
                                : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                              isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 group-hover:border-gray-400'
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
                            <span className={`text-base ${isSelected ? 'text-indigo-900 font-medium' : 'text-gray-700'}`}>
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
                        // 修复：对于字符串格式的选项（如"A. 选项内容"），提取选项字母
                        let value: string
                        if (typeof opt === 'string') {
                          // 从 "A. 选项内容" 中提取 "A"
                          const match = opt.match(/^([A-Z])[\.\s、]/)
                          value = match ? match[1] : opt
                        } else {
                          value = opt?.key ?? opt?.value ?? opt?.text ?? label
                        }
                        const displayLabel = String(label)
                        const displayValue = String(value)
                        const arr = (answers[q.id] as string[]) || []
                        const isSelected = arr.includes(displayValue)

                        return (
                          <label 
                            key={displayValue} 
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${
                              isSelected 
                                ? 'bg-purple-50/50 border-purple-500 shadow-sm' 
                                : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                              isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300 group-hover:border-gray-400'
                            }`}>
                              {isSelected && (
                                <Icon name="check-circle" size={14} className="text-white" />
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
                            <span className={`text-base ${isSelected ? 'text-purple-900 font-medium' : 'text-gray-700'}`}>
                              {displayLabel}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="relative">
                      <textarea
                        value={(answers[q.id] as string) || ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        placeholder="请在此输入您的答案..."
                        className="w-full border-2 border-gray-100 rounded-xl p-5 min-h-[160px] focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none text-gray-800 placeholder:text-gray-400 bg-gray-50 focus:bg-white"
                        rows={4}
                      />
                      <div className="absolute bottom-4 right-4 text-gray-400 pointer-events-none">
                        <Icon name="edit" size={16} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 提交按钮区 */}
        <div className="mt-8 md:mt-12 pb-8 md:pb-12 flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center px-4 md:px-0">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="px-6 md:px-8 py-3 md:py-4 bg-white text-gray-700 rounded-2xl font-medium hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm hover:shadow-md flex items-center gap-2 w-full sm:w-auto sm:min-w-[160px] justify-center"
          >
            <Icon name="clock" size={20} className="text-gray-400" />
            暂不提交
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-3 w-full sm:w-auto sm:min-w-[200px] justify-center"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                提交中...
              </>
            ) : (
              <>
                <Icon name="send" size={20} />
                提交答卷
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* 向教师提问弹窗 */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <Icon name="robot" size={24} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">向教师提问</h3>
                  <p className="text-sm text-gray-500">遇到问题？发送消息给老师</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQuestionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <Icon name="close" size={24} />
              </button>
            </div>
            
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="请详细描述您在答题过程中遇到的问题..."
              className="w-full border-2 border-gray-100 rounded-xl p-4 min-h-[160px] focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none mb-6 bg-gray-50 focus:bg-white text-gray-800"
              rows={6}
            />
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAskQuestion}
                disabled={submittingQuestion || !questionText.trim()}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submittingQuestion ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    发送中
                  </>
                ) : (
                  <>
                    <Icon name="send" size={16} />
                    发送问题
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

export default StudentSurveyTake
