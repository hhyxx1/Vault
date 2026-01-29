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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'single_choice', label: '选择题', icon: 'survey', color: 'blue', desc: '单选、多选' },
            { id: 'fill_blank', label: '填空题', icon: 'code', color: 'purple', desc: '文本填空' },
            { id: 'essay', label: '问答题', icon: 'description', color: 'green', desc: '主观作答' }
          ].map((type) => {
            const isSelected = selectedTypes.has(type.id as any)
            const colorConfig = {
              blue: {
                active: 'bg-blue-50 border-blue-500 text-blue-700',
                inactive: 'hover:border-blue-200 hover:bg-blue-50/50',
                iconBg: 'bg-blue-200 text-blue-700',
                badge: 'bg-blue-600',
                dot: 'bg-blue-500'
              },
              purple: {
                active: 'bg-purple-50 border-purple-500 text-purple-700',
                inactive: 'hover:border-purple-200 hover:bg-purple-50/50',
                iconBg: 'bg-purple-200 text-purple-700',
                badge: 'bg-purple-600',
                dot: 'bg-purple-500'
              },
              green: {
                active: 'bg-green-50 border-green-500 text-green-700',
                inactive: 'hover:border-green-200 hover:bg-green-50/50',
                iconBg: 'bg-green-200 text-green-700',
                badge: 'bg-green-600',
                dot: 'bg-green-500'
              }
            }[type.color as 'blue' | 'purple' | 'green']
            
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => handleToggleType(type.id as any)}
                className={`relative flex items-center p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                  isSelected ? `shadow-md scale-[1.02] ${colorConfig.active}` : `border-gray-100 bg-white text-gray-600 ${colorConfig.inactive}`
                }`}
              >
                <div className={`mr-4 p-3 rounded-xl transition-colors ${
                  isSelected 
                    ? colorConfig.iconBg
                    : 'bg-gray-100 text-gray-400 group-hover:bg-white group-hover:shadow-sm'
                }`}>
                   <Icon name={type.icon as any} size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg mb-0.5">{type.label}</div>
                  <div className={`text-xs ${isSelected ? 'opacity-80' : 'text-gray-400'}`}>
                    {type.desc}
                  </div>
                </div>
                
                {/* 选中状态下的角标 */}
                {isSelected && (
                  <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${colorConfig.dot}`}></div>
                )}
                
                {/* 题目计数 */}
                {type.id === 'single_choice' && singleChoiceQuestions.length > 0 && (
                  <div className={`absolute -top-2 -right-2 ${colorConfig.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm`}>
                    {singleChoiceQuestions.length}
                  </div>
                )}
                {type.id === 'fill_blank' && fillBlankQuestions.length > 0 && (
                  <div className={`absolute -top-2 -right-2 ${colorConfig.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm`}>
                    {fillBlankQuestions.length}
                  </div>
                )}
                {type.id === 'essay' && essayQuestions.length > 0 && (
                  <div className={`absolute -top-2 -right-2 ${colorConfig.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm`}>
                    {essayQuestions.length}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 题型切换标签 */}
      {selectedTypes.size > 1 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center flex-wrap gap-3">
            <span className="text-sm text-gray-500 font-bold uppercase tracking-wider mr-2">当前编辑</span>
            {Array.from(selectedTypes).map((type) => {
              const typeInfo = {
                single_choice: { label: '选择题', color: 'blue', icon: 'survey' },
                fill_blank: { label: '填空题', color: 'purple', icon: 'code' },
                essay: { label: '问答题', color: 'green', icon: 'description' }
              }[type]
              
              const isActive = activeTab === type
              
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? typeInfo.color === 'blue' ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-105' :
                        typeInfo.color === 'purple' ? 'bg-purple-600 text-white shadow-md shadow-purple-200 scale-105' :
                        'bg-green-600 text-white shadow-md shadow-green-200 scale-105'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Icon name={typeInfo.icon as any} size={16} className={`mr-2 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  {typeInfo.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 已添加题目列表 */}
      {currentInfo.list.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-gray-800 flex items-center">
              <div className={`p-2 rounded-lg mr-3 ${
                currentInfo.color === 'blue' ? 'bg-blue-100 text-blue-600' : 
                currentInfo.color === 'purple' ? 'bg-purple-100 text-purple-600' : 
                'bg-green-100 text-green-600'
              }`}>
                <Icon name={currentInfo.icon} size={20} />
              </div>
              已添加 {currentInfo.label} 
              <span className={`ml-2 text-sm px-2 py-0.5 rounded-full ${
                currentInfo.color === 'blue' ? 'bg-blue-100 text-blue-700' : 
                currentInfo.color === 'purple' ? 'bg-purple-100 text-purple-700' : 
                'bg-green-100 text-green-700'
              }`}>
                {currentInfo.list.length}
              </span>
            </h4>
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {currentInfo.list.map((q, index) => (
              <div
                key={index}
                className={`group relative bg-white rounded-xl p-5 border-l-4 transition-all duration-200 hover:shadow-md ${
                   currentInfo.color === 'blue' ? 'border-l-blue-500 hover:bg-blue-50/30' : 
                   currentInfo.color === 'purple' ? 'border-l-purple-500 hover:bg-purple-50/30' : 
                   'border-l-green-500 hover:bg-green-50/30'
                } border-y border-r border-gray-100`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-8">
                    <div className="flex items-center flex-wrap gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        currentInfo.color === 'blue' ? 'bg-blue-100 text-blue-700' : 
                        currentInfo.color === 'purple' ? 'bg-purple-100 text-purple-700' : 
                        'bg-green-100 text-green-700'
                      }`}>
                        #{index + 1}
                      </span>
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-bold flex items-center">
                        <Icon name="award" size={12} className="mr-1" />
                        {q.score} 分
                      </span>
                    </div>
                    
                    <h5 className="text-gray-900 font-bold text-base mb-2 line-clamp-2 leading-relaxed">
                      {q.questionText}
                    </h5>
                    
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 mb-3">
                        {q.options.map((opt, optIdx) => (
                          opt && (
                            <div key={optIdx} className="flex items-start text-sm text-gray-600">
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold mr-2 flex-shrink-0 ${
                                (q.answer.includes(String.fromCharCode(65 + optIdx))) 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className={q.answer.includes(String.fromCharCode(65 + optIdx)) ? 'text-green-700 font-medium' : ''}>
                                {opt}
                              </span>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-start gap-4 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex-1">
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">参考答案</span>
                         <p className="text-sm font-medium text-gray-800 break-words bg-gray-50 px-3 py-2 rounded-lg inline-block">
                           {q.answer}
                         </p>
                      </div>
                      
                      {q.explanation && (
                        <div className="flex-[2]">
                           <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">解析</span>
                           <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 px-3 py-2 rounded-lg">
                             {q.explanation}
                           </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteQuestion(activeTab, index)}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="删除题目"
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
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
        {/* 装饰背景 */}
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none ${
          currentInfo.color === 'blue' ? 'bg-blue-50' : 
          currentInfo.color === 'purple' ? 'bg-purple-50' : 
          'bg-green-50'
        }`}></div>
        
        <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center relative z-10">
          <div className={`p-2 rounded-lg mr-3 ${
            currentInfo.color === 'blue' ? 'bg-blue-100 text-blue-600' : 
            currentInfo.color === 'purple' ? 'bg-purple-100 text-purple-600' : 
            'bg-green-100 text-green-600'
          }`}>
            <Icon name="add" size={20} />
          </div>
          添加新 {currentInfo.label}
        </h4>
        
        {/* 题目内容 */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            题目内容 <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <div className="absolute top-3 left-3 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
              <Icon name="description" size={20} />
            </div>
            <textarea
              value={currentQuestion.questionText}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, questionText: e.target.value })}
              placeholder={`请输入${currentInfo.label}内容...`}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-h-[100px] resize-none transition-all shadow-sm"
              rows={3}
            />
          </div>
        </div>

        {/* 选择题选项 */}
        {activeTab === 'single_choice' && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              选项 <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500 font-normal">（至少填写4个选项）</span>
            </label>
            <div className="space-y-3">
              {(currentQuestion.options || ['', '', '', '']).map((option, index) => (
                <div key={index} className="flex items-center space-x-3 group">
                  <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold transition-colors ${
                    (currentQuestion.options?.length || 0) > 4 ? 'cursor-pointer hover:bg-red-100 hover:text-red-600' : ''
                  } ${
                    option.trim() ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div className="flex-1 relative">
                     <div className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                        <Icon name="survey" size={16} />
                     </div>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...(currentQuestion.options || ['', '', '', ''])]
                        newOptions[index] = e.target.value
                        setCurrentQuestion({ ...currentQuestion, options: newOptions })
                      }}
                      placeholder={`输入选项 ${String.fromCharCode(65 + index)} 的内容`}
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                    {index >= 4 && (currentQuestion.options?.length || 0) > 4 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOptions = (currentQuestion.options || []).filter((_, i) => i !== index)
                          setCurrentQuestion({ ...currentQuestion, options: newOptions })
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(currentQuestion.options?.length || 0) < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = [...(currentQuestion.options || []), '']
                    setCurrentQuestion({ ...currentQuestion, options: newOptions })
                  }}
                  className="ml-13 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg text-sm font-medium flex items-center transition-all"
                >
                  <Icon name="add" size={16} className="mr-1" />
                  添加选项
                </button>
              )}
            </div>
          </div>
        )}

        {/* 答案 */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            答案 <span className="text-red-500">*</span>
            {activeTab === 'single_choice' && (
              <span className="ml-2 text-xs text-gray-500 font-normal">（填写正确选项，如：A 或 A,B,C）</span>
            )}
            {activeTab === 'fill_blank' && (
              <span className="ml-2 text-xs text-gray-500 font-normal">（多个答案用逗号分隔）</span>
            )}
          </label>
          <div className="relative group">
            <div className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 group-focus-within:text-green-500 transition-colors">
              <Icon name="key" size={18} />
            </div>
            <input
              type="text"
              value={currentQuestion.answer}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, answer: e.target.value })}
              placeholder={
                activeTab === 'single_choice' ? '例如：A' :
                activeTab === 'fill_blank' ? '例如：答案1,答案2' :
                '输入参考答案'
              }
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* 分值 */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            分值 <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
             <div className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 group-focus-within:text-orange-500 transition-colors">
              <Icon name="award" size={18} />
            </div>
            <input
              type="number"
              value={currentQuestion.score}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, score: Number(e.target.value) })}
              min="1"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* 解析 */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            答案解析 <span className="text-gray-400 text-xs font-normal">（可选）</span>
          </label>
          <div className="relative group">
             <div className="absolute top-3 left-3 text-gray-400 group-focus-within:text-purple-500 transition-colors">
              <Icon name="sparkles" size={18} />
            </div>
            <textarea
              value={currentQuestion.explanation}
              onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })}
              placeholder="输入答案解析，帮助学生理解..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none min-h-[80px] resize-none transition-all shadow-sm"
              rows={2}
            />
          </div>
        </div>

        {/* 添加题目按钮 */}
        <button
          type="button"
          onClick={handleAddQuestion}
          className={`w-full px-6 py-4 bg-gradient-to-r text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center ${
            currentInfo.color === 'blue' ? 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' :
            currentInfo.color === 'purple' ? 'from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' :
            'from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
          }`}
        >
          <Icon name="add" size={24} className="mr-2 text-white" />
          添加{currentInfo.label}
        </button>
      </div>

      {/* 底部统计和保存按钮 */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-50 to-purple-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
        
        {totalQuestions > 0 ? (
          <div className="space-y-6 relative z-10">
            <div>
              <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                <Icon name="award" size={20} className="mr-2 text-indigo-600" />
                问卷预览与保存
              </h4>
              <div className="flex flex-wrap gap-3">
                {singleChoiceQuestions.length > 0 && (
                  <div className="flex items-center px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                    <Icon name="survey" size={14} className="mr-1.5" />
                    选择题 {singleChoiceQuestions.length}
                  </div>
                )}
                {fillBlankQuestions.length > 0 && (
                  <div className="flex items-center px-3 py-1.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                    <Icon name="code" size={14} className="mr-1.5" />
                    填空题 {fillBlankQuestions.length}
                  </div>
                )}
                {essayQuestions.length > 0 && (
                  <div className="flex items-center px-3 py-1.5 bg-green-50 border border-green-100 text-green-700 rounded-lg text-sm font-medium">
                    <Icon name="description" size={14} className="mr-1.5" />
                    问答题 {essayQuestions.length}
                  </div>
                )}
                <div className="flex items-center px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm font-medium shadow-sm">
                  共 {totalQuestions} 题
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center group"
              >
                <Icon name="award" size={20} className="mr-2 text-indigo-100 group-hover:text-white transition-colors" />
                保存问卷
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 relative z-10">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="description" size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium mb-4">还没有添加任何题目</p>
            <button
               type="button"
               onClick={onCancel}
               className="px-6 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-all"
            >
               取消返回
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManualQuestionForm