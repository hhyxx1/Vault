import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { studentSurveyApi } from '@/services'
import { Icon } from '@/components/Icon'

interface Question {
  id: string
  questionType: string
  questionText: string
  options?: Array<{ key: string; value: string }>
  correctAnswer?: any
  score: number
  knowledgePoints?: string[]
  answerExplanation?: string
}

interface SurveyDetail {
  id: string
  title: string
  description: string
  totalScore: number
  passScore: number
  questions: Question[]
}

interface MyResult {
  submitted: boolean
  scorePublished?: boolean
  totalScore?: number
  percentageScore?: number
  submitTime?: string
  isPassed?: boolean
  answers?: Array<{
    questionId: string
    studentAnswer: any
    isCorrect?: boolean
    score?: number
    gradingResult?: {
      score: number
      max_score: number
      percentage: number
      level: string
      score_breakdown: {
        content_completeness: number
        accuracy: number
        depth: number
        expression: number
      }
      strengths: string[]
      areas_for_improvement: string[]
      comment: string
      detailed_feedback: Array<{
        point: string
        score: number
        max_score: number
        feedback: string
      }>
    }
  }>
  // my-result API 返回的完整问卷信息
  survey?: SurveyDetail
}

const StudentSurveyDetail = () => {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [survey, setSurvey] = useState<SurveyDetail | null>(null)
  const [result, setResult] = useState<MyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 判断返回路径
  const getBackPath = () => {
    // 检查 referrer 或 state
    const from = (location.state as any)?.from
    if (from === 'ability-test') return '/student/ability-test'
    // 默认检查当前路径判断
    if (location.pathname.includes('ability')) return '/student/ability-test'
    return '/student/survey'
  }

  const backPath = getBackPath()
  const backLabel = backPath.includes('ability') ? '返回能力检测' : '返回问卷测验'

  useEffect(() => {
    if (!surveyId) return
    
    setLoading(true)
    
    // 获取作答结果（包含完整问卷信息）
    studentSurveyApi.getMyResult(surveyId)
      .then((resultData) => {
        setResult(resultData)
        // 优先使用 my-result 返回的完整问卷信息
        if (resultData.survey) {
          setSurvey(resultData.survey)
        } else {
          // 兜底：如果 my-result 没有返回问卷信息，单独获取
          return studentSurveyApi.getSurveyDetail(surveyId).then((surveyData) => {
            // 需要转换字段名
            const transformedSurvey: SurveyDetail = {
              id: surveyData.id,
              title: surveyData.title,
              description: surveyData.description || '',
              totalScore: surveyData.totalScore || 100,
              passScore: surveyData.passScore || 60,
              questions: (surveyData.questions || []).map((q: any) => ({
                id: q.id,
                questionType: q.type || q.questionType,
                questionText: q.text || q.questionText,
                options: q.options ? q.options.map((opt: any) => {
                  if (typeof opt === 'object' && opt.key) return opt
                  if (typeof opt === 'string' && opt.includes('. ')) {
                    const [key, ...rest] = opt.split('. ')
                    return { key: key.trim(), value: rest.join('. ').trim() }
                  }
                  return { key: String(q.options.indexOf(opt)), value: String(opt) }
                }) : undefined,
                correctAnswer: q.correctAnswer,
                score: q.score || 0,
                knowledgePoints: q.knowledgePoints || [],
                answerExplanation: q.answerExplanation
              }))
            }
            setSurvey(transformedSurvey)
          })
        }
      })
      .catch((e: any) => setError(e.response?.data?.detail || e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [surveyId])

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
      'blank': '填空题',
      'essay': '问答题',
      'short_answer': '简答题',
      'text': '问答题'
    }
    return types[type] || type
  }

  // 获取题目类型颜色
  const getQuestionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'single_choice': 'bg-blue-100 text-blue-700',
      'choice': 'bg-blue-100 text-blue-700',
      'multiple_choice': 'bg-purple-100 text-purple-700',
      'multi_choice': 'bg-purple-100 text-purple-700',
      'true_false': 'bg-green-100 text-green-700',
      'judge': 'bg-green-100 text-green-700',
      'judgment': 'bg-green-100 text-green-700',
      'fill_blank': 'bg-orange-100 text-orange-700',
      'blank': 'bg-orange-100 text-orange-700',
      'essay': 'bg-pink-100 text-pink-700',
      'short_answer': 'bg-cyan-100 text-cyan-700',
      'text': 'bg-pink-100 text-pink-700'
    }
    return colors[type] || 'bg-gray-100 text-gray-700'
  }

  // 判断是否为选择题类型
  const isChoiceType = (type: string) => {
    return ['single_choice', 'choice', 'multiple_choice', 'multi_choice'].includes(type)
  }

  // 判断是否为多选题
  const isMultipleChoice = (type: string) => {
    return ['multiple_choice', 'multi_choice'].includes(type)
  }

  // 判断是否为判断题类型
  const isJudgeType = (type: string) => {
    return ['true_false', 'judge', 'judgment'].includes(type)
  }

  // 判断是否为填空题或问答题类型
  const isTextType = (type: string) => {
    return ['fill_blank', 'blank', 'essay', 'short_answer', 'text'].includes(type)
  }

  // 格式化答案显示
  const formatAnswer = (answer: any, questionType: string, options?: Array<{ key: string; value: string }>) => {
    if (answer === null || answer === undefined) return '未作答'
    
    if (questionType === 'true_false') {
      return answer === true || answer === 'true' ? '正确 ✓' : '错误 ✗'
    }
    
    if (questionType === 'single_choice' && options) {
      const option = options.find(o => o.key === answer)
      return option ? `${answer}. ${option.value}` : answer
    }
    
    if (questionType === 'multiple_choice' && options) {
      const selected = Array.isArray(answer) ? answer : [answer]
      return selected.map(key => {
        const option = options.find(o => o.key === key)
        return option ? `${key}. ${option.value}` : key
      }).join('、')
    }
    
    if (typeof answer === 'string') return answer
    return JSON.stringify(answer)
  }

  // 格式化正确答案显示
  const formatCorrectAnswer = (correctAnswer: any, questionType: string, options?: Array<{ key: string; value: string }>) => {
    if (correctAnswer === null || correctAnswer === undefined) return null
    
    if (questionType === 'true_false') {
      return correctAnswer === true || correctAnswer === 'true' ? '正确 ✓' : '错误 ✗'
    }
    
    if (questionType === 'single_choice' && options) {
      const option = options.find(o => o.key === correctAnswer)
      return option ? `${correctAnswer}. ${option.value}` : correctAnswer
    }
    
    if (questionType === 'multiple_choice' && options) {
      const selected = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]
      return selected.map(key => {
        const option = options.find(o => o.key === key)
        return option ? `${key}` : key
      }).join('、')
    }
    
    if (typeof correctAnswer === 'string') return correctAnswer
    return JSON.stringify(correctAnswer)
  }

  // 获取等级颜色
  const getLevelColor = (level: string) => {
    switch (level) {
      case '满分': return 'text-emerald-600 bg-emerald-50 border-emerald-200'
      case '优秀': return 'text-blue-600 bg-blue-50 border-blue-200'
      case '良好': return 'text-amber-600 bg-amber-50 border-amber-200'
      case '及格': return 'text-orange-600 bg-orange-50 border-orange-200'
      default: return 'text-red-600 bg-red-50 border-red-200'
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="alert-triangle" size={32} className="text-red-500" />
            </div>
            <p className="text-red-600 mb-4">{error}</p>
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

  const submitted = result?.submitted ?? false
  const scorePublished = result?.scorePublished ?? false
  const questions = survey?.questions || []
  const answerMap = new Map(result?.answers?.map(a => [a.questionId, a]) || [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <Icon name="arrow-left" size={20} />
            <span className="font-medium">{backLabel}</span>
          </button>
          {survey && (
            <h1 className="text-lg font-bold text-gray-800 hidden md:block">{survey.title}</h1>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 问卷标题（移动端显示） */}
        {survey && (
          <div className="md:hidden mb-6">
            <h1 className="text-xl font-bold text-gray-800">{survey.title}</h1>
            {survey.description && (
              <p className="text-gray-500 mt-1 text-sm">{survey.description}</p>
            )}
          </div>
        )}

        {/* 未作答状态 */}
        {!submitted && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="file-text" size={40} className="text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">您还未作答</h2>
            <p className="text-gray-500 mb-8">请先完成该问卷的作答后再查看详情</p>
            <button
              type="button"
              onClick={() => navigate(`/student/survey/${surveyId}/take`, { state: location.state })}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              开始答题
            </button>
          </div>
        )}

        {/* 等待公布成绩 */}
        {submitted && !scorePublished && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="clock" size={40} className="text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">等待老师公布成绩</h2>
            <p className="text-gray-500 mb-6">您已提交答卷，成绩公布后可在此查看得分与详情</p>
            {result?.submitTime && (
              <p className="text-sm text-gray-400">
                提交时间: {new Date(result.submitTime).toLocaleString('zh-CN')}
              </p>
            )}
          </div>
        )}

        {/* 成绩详情 */}
        {submitted && scorePublished && (
          <div className="space-y-6">
            {/* 成绩概览卡片 */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
              {/* 背景装饰 */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <p className="text-white/80 text-sm mb-1">总成绩</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-bold">{result?.totalScore ?? 0}</span>
                      <span className="text-2xl text-white/70">/ {survey?.totalScore || 100} 分</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-3">
                    <div className={`px-5 py-2 rounded-full font-semibold text-sm ${
                      result?.isPassed 
                        ? 'bg-emerald-400/30 text-emerald-100 border border-emerald-300/30' 
                        : 'bg-red-400/30 text-red-100 border border-red-300/30'
                    }`}>
                      {result?.isPassed ? '🎉 恭喜通过' : '😢 未通过'}
                    </div>
                    <div className="text-white/80 text-sm space-y-1">
                      <p>得分率: <span className="font-semibold text-white">{result?.percentageScore?.toFixed(1)}%</span></p>
                      <p>及格线: <span className="font-semibold text-white">{((survey?.totalScore || 100) * 0.6).toFixed(0)} 分 (60%)</span></p>
                    </div>
                  </div>
                </div>
                {result?.submitTime && (
                  <div className="mt-6 pt-4 border-t border-white/20 flex items-center gap-2 text-sm text-white/70">
                    <Icon name="clock" size={16} />
                    <span>提交时间: {new Date(result.submitTime).toLocaleString('zh-CN')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 答题统计 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-3xl font-bold text-indigo-600">{questions.length}</p>
                <p className="text-sm text-gray-500">总题数</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600">
                  {result?.answers?.filter(a => a.isCorrect).length || 0}
                </p>
                <p className="text-sm text-gray-500">答对</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-3xl font-bold text-red-500">
                  {result?.answers?.filter(a => !a.isCorrect).length || 0}
                </p>
                <p className="text-sm text-gray-500">答错</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {((result?.answers?.filter(a => a.isCorrect).length || 0) / questions.length * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-gray-500">正确率</p>
              </div>
            </div>

            {/* 详细答题情况 */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Icon name="file-text" size={24} className="text-indigo-600" />
                详细答题情况
              </h3>
              
              {questions.map((question, index) => {
                const answer = answerMap.get(question.id)
                const isCorrect = answer?.isCorrect ?? false
                const studentScore = answer?.score ?? 0
                
                return (
                  <div 
                    key={question.id} 
                    className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all ${
                      isCorrect ? 'border-emerald-200' : 'border-red-200'
                    }`}
                  >
                    {/* 题目头部 */}
                    <div className={`px-6 py-4 flex items-start justify-between gap-4 ${
                      isCorrect ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-start gap-3 flex-1">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                          isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${getQuestionTypeColor(question.questionType)}`}>
                              {getQuestionTypeName(question.questionType)}
                            </span>
                            <span className="text-sm text-gray-500">({question.score}分)</span>
                            {question.knowledgePoints && question.knowledgePoints.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {question.knowledgePoints.map((kp, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                    {kp}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-gray-800 font-medium leading-relaxed">{question.questionText}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-xl font-bold text-lg shrink-0 ${
                        isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {isCorrect ? (
                          <span className="flex items-center gap-1">
                            <Icon name="check-circle" size={18} />
                            {studentScore}分
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Icon name="close" size={18} />
                            {studentScore}分
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 题目内容 */}
                    <div className="p-6 space-y-4">
                      {/* 选项（选择题和判断题） */}
                      {isChoiceType(question.questionType) && question.options && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-500 mb-2">选项：</p>
                          <div className="grid gap-2">
                            {question.options.map((opt) => {
                              const studentAnswer = answer?.studentAnswer
                              const correctAnswer = question.correctAnswer
                              
                              // 灵活匹配学生答案：可能是 key、value、或完整格式
                              const matchAnswer = (ans: any, optKey: string, optValue: string) => {
                                if (!ans) return false
                                const ansStr = String(ans).trim()
                                return ansStr === optKey || 
                                       ansStr === optValue ||
                                       ansStr === `${optKey}. ${optValue}` ||
                                       ansStr === `${optKey}.${optValue}` ||
                                       ansStr === `${optKey}、${optValue}` ||
                                       ansStr.toUpperCase() === optKey.toUpperCase()
                              }
                              
                              const isSelected = isMultipleChoice(question.questionType)
                                ? (Array.isArray(studentAnswer) 
                                    ? studentAnswer.some(a => matchAnswer(a, opt.key, opt.value))
                                    : false)
                                : matchAnswer(studentAnswer, opt.key, opt.value)
                              
                              const isCorrectOption = isMultipleChoice(question.questionType)
                                ? (Array.isArray(correctAnswer) 
                                    ? correctAnswer.some(a => matchAnswer(a, opt.key, opt.value))
                                    : false)
                                : matchAnswer(correctAnswer, opt.key, opt.value)
                              
                              return (
                                <div
                                  key={opt.key}
                                  className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all ${
                                    isCorrectOption && isSelected
                                      ? 'bg-emerald-50 border-emerald-300'
                                      : isSelected && !isCorrectOption
                                      ? 'bg-red-50 border-red-300'
                                      : isCorrectOption
                                      ? 'bg-emerald-50 border-emerald-200 border-dashed'
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                    isCorrectOption
                                      ? 'bg-emerald-500 text-white'
                                      : isSelected
                                      ? 'bg-red-500 text-white'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    {opt.key}
                                  </span>
                                  <span className="text-gray-700 flex-1">{opt.value}</span>
                                  {isSelected && (
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      isCorrectOption ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      你的选择
                                    </span>
                                  )}
                                  {isCorrectOption && !isSelected && (
                                    <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                                      正确答案
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* 判断题选项 */}
                      {isJudgeType(question.questionType) && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-500 mb-2">选项：</p>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { key: true, label: '正确 ✓' },
                              { key: false, label: '错误 ✗' }
                            ].map((opt) => {
                              const studentAnswer = answer?.studentAnswer
                              const correctAnswer = question.correctAnswer
                              
                              // 灵活匹配判断题答案
                              const matchJudgeAnswer = (ans: any, isTrue: boolean) => {
                                if (ans === null || ans === undefined) return false
                                // 布尔值匹配
                                if (typeof ans === 'boolean') return ans === isTrue
                                // 数字匹配 (1=正确, 0=错误)
                                if (typeof ans === 'number') return isTrue ? ans === 1 : ans === 0
                                // 字符串匹配
                                const ansStr = String(ans).toLowerCase().trim()
                                if (isTrue) {
                                  return ['true', '正确', '对', '是', 'yes', '1', 't'].includes(ansStr)
                                } else {
                                  return ['false', '错误', '错', '否', 'no', '0', 'f'].includes(ansStr)
                                }
                              }
                              
                              const isSelected = matchJudgeAnswer(studentAnswer, opt.key)
                              const isCorrectOption = matchJudgeAnswer(correctAnswer, opt.key)
                              
                              return (
                                <div
                                  key={String(opt.key)}
                                  className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 ${
                                    isCorrectOption && isSelected
                                      ? 'bg-emerald-50 border-emerald-300'
                                      : isSelected && !isCorrectOption
                                      ? 'bg-red-50 border-red-300'
                                      : isCorrectOption
                                      ? 'bg-emerald-50 border-emerald-200 border-dashed'
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <span className="font-medium text-lg">{opt.label}</span>
                                  {isSelected && (
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      isCorrectOption ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      你的选择
                                    </span>
                                  )}
                                  {isCorrectOption && !isSelected && (
                                    <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                                      正确答案
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* 填空题和问答题 */}
                      {isTextType(question.questionType) && (
                        <div className="space-y-4">
                          {/* 学生答案 */}
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                              <Icon name="edit" size={14} />
                              你的答案
                            </p>
                            <div className={`p-4 rounded-lg border-2 ${
                              isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                            }`}>
                              <p className="text-gray-800 whitespace-pre-wrap">
                                {formatAnswer(answer?.studentAnswer, question.questionType)}
                              </p>
                            </div>
                          </div>
                          
                          {/* 参考答案 */}
                          {question.correctAnswer && (
                            <div>
                              <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                                <Icon name="check-circle" size={14} className="text-emerald-500" />
                                参考答案
                              </p>
                              <div className="p-4 rounded-lg bg-emerald-50 border-2 border-emerald-200">
                                <p className="text-gray-800 whitespace-pre-wrap">
                                  {typeof question.correctAnswer === 'string' 
                                    ? question.correctAnswer 
                                    : JSON.stringify(question.correctAnswer)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 答案解析 */}
                      {question.answerExplanation && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1">
                            <Icon name="info" size={14} />
                            答案解析
                          </p>
                          <p className="text-sm text-blue-800">{question.answerExplanation}</p>
                        </div>
                      )}

                      {/* AI评分结果（问答题） */}
                      {answer?.gradingResult && (
                        <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                          <div className="flex items-center gap-2 text-indigo-600">
                            <Icon name="sparkles" size={20} />
                            <span className="font-semibold">AI 智能评分</span>
                          </div>

                          {/* 得分和等级 */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                              <p className="text-sm text-gray-600 mb-1">得分</p>
                              <p className="text-3xl font-bold text-indigo-600">
                                {answer.gradingResult.score}
                                <span className="text-lg text-gray-400 font-normal"> / {answer.gradingResult.max_score}</span>
                              </p>
                            </div>
                            <div className={`rounded-xl p-4 border ${getLevelColor(answer.gradingResult.level)}`}>
                              <p className="text-sm text-gray-600 mb-1">等级</p>
                              <p className="text-3xl font-bold">{answer.gradingResult.level}</p>
                            </div>
                          </div>

                          {/* 优点和改进建议 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {answer.gradingResult.strengths?.length > 0 && (
                              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                                <p className="text-sm font-medium text-emerald-700 mb-3 flex items-center gap-1">
                                  <Icon name="check-circle" size={16} />
                                  优点
                                </p>
                                <ul className="space-y-2">
                                  {answer.gradingResult.strengths.map((s, i) => (
                                    <li key={i} className="text-sm text-emerald-800 flex items-start gap-2">
                                      <span className="text-emerald-400 mt-1">•</span>
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {answer.gradingResult.areas_for_improvement?.length > 0 && (
                              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                <p className="text-sm font-medium text-amber-700 mb-3 flex items-center gap-1">
                                  <Icon name="alert-triangle" size={16} />
                                  改进建议
                                </p>
                                <ul className="space-y-2">
                                  {answer.gradingResult.areas_for_improvement.map((s, i) => (
                                    <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                                      <span className="text-amber-400 mt-1">•</span>
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* 综合评语 */}
                          {answer.gradingResult.comment && (
                            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                              <p className="text-sm font-medium text-indigo-700 mb-2 flex items-center gap-1">
                                <Icon name="description" size={16} />
                                综合评语
                              </p>
                              <p className="text-sm text-indigo-800 leading-relaxed">{answer.gradingResult.comment}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 底部返回按钮 */}
            <div className="text-center pt-6">
              <button
                type="button"
                onClick={() => navigate(backPath)}
                className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                {backLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentSurveyDetail
