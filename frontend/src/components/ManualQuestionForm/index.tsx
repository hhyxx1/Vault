import { useState } from 'react'
import { Icon } from '@/components/Icon'

interface QuestionOption {
  key: string
  value: string
  isCorrect: boolean
}

interface GradingCriteria {
  totalScore: number
  scoreDistribution: Array<{
    item: string
    score: number
    description?: string
  }>
  keywords: string[]
  requirements: string[]
}

export interface QuestionFormData {
  id?: string
  questionType: 'single_choice' | 'fill_blank' | 'essay'
  questionText: string
  score: number
  // 选择题字段
  options?: QuestionOption[]
  // 填空题字段
  correctAnswers?: string[]
  // 问答题字段
  referenceFiles?: File[]
  minWordCount?: number
  gradingCriteria?: GradingCriteria
  answerExplanation?: string
}

interface ManualQuestionFormProps {
  onSave: (question: QuestionFormData) => void
  onCancel: () => void
  onSaveAll?: (questions: QuestionFormData[]) => void
}

// 定义简化的题目数据接口
interface SimpleQuestion {
  questionText: string
  answer: string
  score: number
  explanation: string
  options?: string[] // 选择题的选项
}

const ManualQuestionForm = ({ onSave, onCancel, onSaveAll }: ManualQuestionFormProps) => {
  // 修改为多选题型
  const [selectedTypes, setSelectedTypes] = useState<Set<'single_choice' | 'fill_blank' | 'essay'>>(new Set(['single_choice']))
  
  // 为每个题型维护独立的题目列表
  const [singleChoiceQuestions, setSingleChoiceQuestions] = useState<SimpleQuestion[]>([])
  const [fillBlankQuestions, setFillBlankQuestions] = useState<SimpleQuestion[]>([])
  const [essayQuestions, setEssayQuestions] = useState<SimpleQuestion[]>([])
  
  // 当前正在编辑的题目类型
  const [activeTab, setActiveTab] = useState<'single_choice' | 'fill_blank' | 'essay'>('single_choice')
  
  // 当前题目表单的状态
  const [currentQuestion, setCurrentQuestion] = useState<SimpleQuestion>({
    questionText: '',
    answer: '',
    score: 10,
    explanation: '',
    options: ['', '', '', ''] // 默认4个选项
  })

  // 切换题型选择
  const handleToggleType = (type: 'single_choice' | 'fill_blank' | 'essay') => {
    const newTypes = new Set(selectedTypes)
    if (newTypes.has(type)) {
      if (newTypes.size > 1) {
        newTypes.delete(type)
      }
    } else {
      newTypes.add(type)
    }
    setSelectedTypes(newTypes)
    // 如果当前激活的tab被取消选择，切换到第一个选中的类型
    if (!newTypes.has(activeTab)) {
      setActiveTab(Array.from(newTypes)[0])
    }
  }
  
  // 添加题目到当前题型列表
  const handleAddQuestion = () => {
    if (!currentQuestion.questionText.trim()) {
      alert('请输入题目内容')
      return
    }
    
    // 如果是选择题，验证选项
    if (activeTab === 'single_choice') {
      const filledOptions = (currentQuestion.options || []).filter(opt => opt.trim() !== '')
      if (filledOptions.length < 4) {
        alert('选择题至少需要填写4个选项')
        return
      }
    }
    
    if (!currentQuestion.answer.trim()) {
      alert('请输入答案')
      return
    }
    if (currentQuestion.score <= 0) {
      alert('请输入有效的分值')
      return
    }
    
    const newQuestion = { ...currentQuestion }
    
    switch (activeTab) {
      case 'single_choice':
        setSingleChoiceQuestions([...singleChoiceQuestions, newQuestion])
        break
      case 'fill_blank':
        setFillBlankQuestions([...fillBlankQuestions, newQuestion])
        break
      case 'essay':
        setEssayQuestions([...essayQuestions, newQuestion])
        break
    }
    
    // 重置当前题目表单
    setCurrentQuestion({
      questionText: '',
      answer: '',
      score: 10,
      explanation: '',
      options: ['', '', '', '']
    })
  }
  
  // 删除题目
  const handleDeleteQuestion = (type: 'single_choice' | 'fill_blank' | 'essay', index: number) => {
    switch (type) {
      case 'single_choice':
        setSingleChoiceQuestions(singleChoiceQuestions.filter((_, i) => i !== index))
        break
      case 'fill_blank':
        setFillBlankQuestions(fillBlankQuestions.filter((_, i) => i !== index))
        break
      case 'essay':
        setEssayQuestions(essayQuestions.filter((_, i) => i !== index))
        break
    }
  }

  // 保存所有题目
  const handleSaveAll = () => {
    const totalQuestions = singleChoiceQuestions.length + fillBlankQuestions.length + essayQuestions.length
    
    if (totalQuestions === 0) {
      alert('请至少添加一道题目')
      return
    }
    
    // 将所有题目转换为标准格式并保存
    const allQuestions: QuestionFormData[] = []
    
    // 处理选择题
    singleChoiceQuestions.forEach(q => {
      // 解析答案，假设答案格式为"A,B,C" 或 "A"
      const answers = q.answer.split(',').map(a => a.trim().toUpperCase())
      const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      const options: QuestionOption[] = (q.options || ['', '', '', '']).map((optValue, index) => ({
        key: keys[index],
        value: optValue,
        isCorrect: answers.includes(keys[index])
      })).filter(opt => opt.value.trim() !== '') // 过滤空选项
      
      allQuestions.push({
        questionType: 'single_choice',
        questionText: q.questionText,
        score: q.score,
        options: options,
        answerExplanation: q.explanation || undefined
      })
    })
    
    // 处理填空题
    fillBlankQuestions.forEach(q => {
      const answers = q.answer.split(',').map(a => a.trim())
      allQuestions.push({
        questionType: 'fill_blank',
        questionText: q.questionText,
        score: q.score,
        correctAnswers: answers,
        answerExplanation: q.explanation || undefined
      })
    })
    
    // 处理问答题
    essayQuestions.forEach(q => {
      allQuestions.push({
        questionType: 'essay',
        questionText: q.questionText,
        score: q.score,
        answerExplanation: q.explanation || undefined,
        minWordCount: 100,
        gradingCriteria: {
          totalScore: q.score,
          scoreDistribution: [
            { item: '内容完整性', score: Math.floor(q.score * 0.5), description: '' },
            { item: '逻辑清晰度', score: Math.floor(q.score * 0.3), description: '' },
            { item: '语言表达', score: Math.ceil(q.score * 0.2), description: '' },
          ],
          keywords: [],
          requirements: []
        }
      })
    })
    
    // 如果有 onSaveAll 回调，调用它；否则逐个调用 onSave
    if (onSaveAll) {
      onSaveAll(allQuestions)
    } else {
      // 依次保存所有题目
      allQuestions.forEach(q => onSave(q))
    }
    
    // 清空所有列表
    setSingleChoiceQuestions([])
    setFillBlankQuestions([])
    setEssayQuestions([])
    setCurrentQuestion({
      questionText: '',
      answer: '',
      score: 10,
      explanation: '',
      options: ['', '', '', '']
    })
  }

  // 获取当前题型的题目列表和标签信息
  const getQuestionListAndInfo = () => {
    const info = {
      single_choice: {
        list: singleChoiceQuestions,
        label: '选择题',
        color: 'blue',
        icon: 'survey' as const
      },
      fill_blank: {
        list: fillBlankQuestions,
        label: '填空题',
        color: 'purple',
        icon: 'code' as const
      },
      essay: {
        list: essayQuestions,
        label: '问答题',
        color: 'green',
        icon: 'description' as const
      }
    }
    return info[activeTab]
  }
  
  const currentInfo = getQuestionListAndInfo()
  const totalQuestions = singleChoiceQuestions.length + fillBlankQuestions.length + essayQuestions.length

  return (
    <div className="space-y-6">
      {/* 题目类型多选 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <label className="block text-sm font-bold text-gray-800 mb-4 flex items-center">
          <Icon name="class" size={18} className="mr-2 text-indigo-600" />
          题目类型 <span className="text-red-500 ml-1">*</span>
          <span className="ml-3 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            可多选，每种题型独立管理
          </span>
        </label>
        <div className="grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => handleToggleType('single_choice')}
            className={`flex items-center justify-center py-4 px-4 rounded-xl border-2 transition-all duration-200 ${
              selectedTypes.has('single_choice')
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-md'
                : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
            }`}
          >
            <div className={`mr-2 p-1.5 rounded-full ${selectedTypes.has('single_choice') ? 'bg-blue-200' : 'bg-gray-200'}`}>
               <Icon name="survey" size={16} className={selectedTypes.has('single_choice') ? 'text-blue-700' : 'text-gray-500'} />
            </div>
            <div className="flex flex-col items-start">
              <span>选择题</span>
              {singleChoiceQuestions.length > 0 && (
                <span className="text-xs mt-1">已添加 {singleChoiceQuestions.length} 题</span>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleToggleType('fill_blank')}
            className={`flex items-center justify-center py-4 px-4 rounded-xl border-2 transition-all duration-200 ${
              selectedTypes.has('fill_blank')
                ? 'border-purple-500 bg-purple-50 text-purple-700 font-bold shadow-md'
                : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
            }`}
          >
             <div className={`mr-2 p-1.5 rounded-full ${selectedTypes.has('fill_blank') ? 'bg-purple-200' : 'bg-gray-200'}`}>
               <Icon name="code" size={16} className={selectedTypes.has('fill_blank') ? 'text-purple-700' : 'text-gray-500'} />
            </div>
            <div className="flex flex-col items-start">
              <span>填空题</span>
              {fillBlankQuestions.length > 0 && (
                <span className="text-xs mt-1">已添加 {fillBlankQuestions.length} 题</span>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleToggleType('essay')}
            className={`flex items-center justify-center py-4 px-4 rounded-xl border-2 transition-all duration-200 ${
              selectedTypes.has('essay')
                ? 'border-green-500 bg-green-50 text-green-700 font-bold shadow-md'
                : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
            }`}
          >
             <div className={`mr-2 p-1.5 rounded-full ${selectedTypes.has('essay') ? 'bg-green-200' : 'bg-gray-200'}`}>
               <Icon name="description" size={16} className={selectedTypes.has('essay') ? 'text-green-700' : 'text-gray-500'} />
            </div>
            <div className="flex flex-col items-start">
              <span>问答题</span>
              {essayQuestions.length > 0 && (
                <span className="text-xs mt-1">已添加 {essayQuestions.length} 题</span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* 题型切换标签 */}
      {selectedTypes.size > 1 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 font-medium">当前编辑：</span>
            {Array.from(selectedTypes).map((type) => {
              const typeInfo = {
                single_choice: { label: '选择题', color: 'blue' },
                fill_blank: { label: '填空题', color: 'purple' },
                essay: { label: '问答题', color: 'green' }
              }[type]
              
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === type
                      ? typeInfo.color === 'blue' ? 'bg-blue-500 text-white' :
                        typeInfo.color === 'purple' ? 'bg-purple-500 text-white' :
                        'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {typeInfo.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 已添加题目列表 */}
      {currentInfo.list.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-gray-800 flex items-center">
              <Icon name={currentInfo.icon} size={18} className={`mr-2 text-${currentInfo.color}-600`} />
              已添加 {currentInfo.label} ({currentInfo.list.length})
            </h4>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {currentInfo.list.map((q, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 bg-${currentInfo.color}-100 text-${currentInfo.color}-800 rounded text-xs font-medium`}>
                        题目 {index + 1}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                        {q.score} 分
                      </span>
                    </div>
                    <p className="text-gray-800 font-medium mb-1 line-clamp-2">{q.questionText}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, optIdx) => (
                          opt && <p key={optIdx} className="text-xs text-gray-600">
                            {String.fromCharCode(65 + optIdx)}. {opt}
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 mt-2">答案: {q.answer}</p>
                    {q.explanation && (
                      <p className="text-xs text-gray-500 mt-1">解析: {q.explanation}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(activeTab, index)}
                    className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 简化的题目输入表单 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
          <Icon name="add" size={18} className="mr-2 text-indigo-600" />
          添加新 {currentInfo.label}
        </h4>
        
        {/* 题目内容 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            题目内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={currentQuestion.questionText}
            onChange={(e) => setCurrentQuestion({ ...currentQuestion, questionText: e.target.value })}
            placeholder={`请输入${currentInfo.label}内容...`}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[100px] resize-none transition-all"
            rows={3}
          />
        </div>

        {/* 选择题选项 */}
        {activeTab === 'single_choice' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选项 <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500">（至少填写4个选项）</span>
            </label>
            <div className="space-y-2">
              {(currentQuestion.options || ['', '', '', '']).map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="w-8 h-10 flex items-center justify-center bg-gray-100 rounded-lg font-bold text-gray-700">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(currentQuestion.options || ['', '', '', ''])]
                      newOptions[index] = e.target.value
                      setCurrentQuestion({ ...currentQuestion, options: newOptions })
                    }}
                    placeholder={`输入选项 ${String.fromCharCode(65 + index)} 的内容`}
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                  {index >= 4 && (currentQuestion.options?.length || 0) > 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newOptions = (currentQuestion.options || []).filter((_, i) => i !== index)
                        setCurrentQuestion({ ...currentQuestion, options: newOptions })
                      }}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Icon name="close" size={20} />
                    </button>
                  )}
                </div>
              ))}
              {(currentQuestion.options?.length || 0) < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = [...(currentQuestion.options || []), '']
                    setCurrentQuestion({ ...currentQuestion, options: newOptions })
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                  <Icon name="add" size={16} className="mr-1" />
                  添加选项
                </button>
              )}
            </div>
          </div>
        )}

        {/* 答案 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            答案 <span className="text-red-500">*</span>
            {activeTab === 'single_choice' && (
              <span className="ml-2 text-xs text-gray-500">（填写正确选项，如：A 或 A,B,C）</span>
            )}
            {activeTab === 'fill_blank' && (
              <span className="ml-2 text-xs text-gray-500">（多个答案用逗号分隔）</span>
            )}
          </label>
          <input
            type="text"
            value={currentQuestion.answer}
            onChange={(e) => setCurrentQuestion({ ...currentQuestion, answer: e.target.value })}
            placeholder={
              activeTab === 'single_choice' ? '例如：A' :
              activeTab === 'fill_blank' ? '例如：答案1,答案2' :
              '输入参考答案'
            }
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        {/* 分值 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            分值 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={currentQuestion.score}
            onChange={(e) => setCurrentQuestion({ ...currentQuestion, score: Number(e.target.value) })}
            min="1"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        {/* 解析 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            答案解析 <span className="text-gray-400 text-xs">（可选）</span>
          </label>
          <textarea
            value={currentQuestion.explanation}
            onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })}
            placeholder="输入答案解析，帮助学生理解..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[80px] resize-none transition-all"
            rows={2}
          />
        </div>

        {/* 添加题目按钮 */}
        <button
          type="button"
          onClick={handleAddQuestion}
          className={`w-full px-6 py-3 bg-gradient-to-r text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center ${
            currentInfo.color === 'blue' ? 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' :
            currentInfo.color === 'purple' ? 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800' :
            'from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
          }`}
        >
          <Icon name="add" size={20} className="mr-2 text-white" />
          添加{currentInfo.label}
        </button>
      </div>

      {/* 底部统计和保存按钮 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
        {totalQuestions > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-base font-bold text-gray-800">已添加题目总览</h4>
              <div className="flex items-center space-x-3 text-sm flex-wrap gap-2">
                {singleChoiceQuestions.length > 0 && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-medium">
                    选择题 {singleChoiceQuestions.length} 题
                  </span>
                )}
                {fillBlankQuestions.length > 0 && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium">
                    填空题 {fillBlankQuestions.length} 题
                  </span>
                )}
                {essayQuestions.length > 0 && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg font-medium">
                    问答题 {essayQuestions.length} 题
                  </span>
                )}
                <span className="px-3 py-1 bg-gray-800 text-white rounded-lg font-medium">
                  共 {totalQuestions} 题
                </span>
              </div>
            </div>
            
            {/* 保存问卷按钮 */}
            <button
              type="button"
              onClick={handleSaveAll}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
            >
              <Icon name="award" size={20} className="mr-2 text-white" />
              保存问卷 ({totalQuestions} 题)
            </button>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-gray-500 text-sm">还没有添加题目，添加题目后可以保存问卷</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManualQuestionForm