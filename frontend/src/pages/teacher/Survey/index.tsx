import { useState, useEffect } from 'react'
import { surveyApi } from '@/services'

type CreateMode = 'manual' | 'ai' | 'knowledge' | null
type SurveyStatus = 'draft' | 'published'

interface Survey {
  id: string
  title: string
  description: string
  questionCount: number
  status: SurveyStatus
  createdAt: string
  publishedAt?: string
}

interface QuestionOption {
  label: string
  text: string
}

interface ParsedQuestion {
  id: string
  question: string
  options: QuestionOption[]
  type: string
  required: boolean
  answer?: string | string[] | null
  score?: number
}

interface ParseResult {
  success: boolean
  file_id: string
  filename: string
  questions: ParsedQuestion[]
  validation: {
    is_valid: boolean
    errors: string[]
    question_count: number
  }
  message: string
}

const TeacherSurvey = () => {
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null)
  const [currentFileId, setCurrentFileId] = useState<string>('')
  const [currentFilename, setCurrentFilename] = useState<string>('')
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [isLoadingSurveys, setIsLoadingSurveys] = useState(false)
  
  // 获取问卷列表
  const loadSurveys = async () => {
    setIsLoadingSurveys(true)
    try {
      const data = await surveyApi.getSurveys()
      setSurveys(data)
    } catch (error: any) {
      console.error('获取问卷列表失败:', error)
      alert(error.response?.data?.detail || '获取问卷列表失败')
    } finally {
      setIsLoadingSurveys(false)
    }
  }
  
  // 组件加载时获取问卷列表
  useEffect(() => {
    loadSurveys()
  }, [])

  const creationModes = [
    {
      id: 'manual' as CreateMode,
      title: '手动上传',
      description: '手动添加题目或上传Word文档自动识别',
      icon: '📝',
      color: 'blue',
    },
    {
      id: 'ai' as CreateMode,
      title: 'AI生成',
      description: '给出描述，AI自动生成问卷',
      icon: '🤖',
      color: 'purple',
    },
    {
      id: 'knowledge' as CreateMode,
      title: '基于知识库',
      description: '描述需求，AI基于知识库生成问卷',
      icon: '📚',
      color: 'green',
    },
  ]

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleGenerate = async () => {
    if (createMode === 'ai' || createMode === 'knowledge') {
      if (!aiDescription.trim()) {
        alert('请输入描述')
        return
      }
      alert(`正在使用${createMode === 'ai' ? 'AI' : 'AI+知识库'}生成问卷...\n描述: ${aiDescription}`)
      setShowCreateModal(false)
      setCreateMode(null)
      setAiDescription('')
      setUploadedFile(null)
    } else if (createMode === 'manual') {
      if (!uploadedFile) {
        alert('请上传文件或手动添加题目')
        return
      }
      
      // 上传并解析Word文档
      setIsUploading(true)
      try {
        const result = await surveyApi.uploadWord(uploadedFile)
        
        if (result.success) {
          setParsedQuestions(result.questions)
          setParseErrors(result.validation.errors)
          setCurrentFileId(result.file_id)
          setCurrentFilename(result.filename)
          
          // 检查是否重复
          if (result.is_duplicate) {
            setIsDuplicate(true)
            setDuplicateInfo(result.duplicate_info)
          } else {
            setIsDuplicate(false)
            setDuplicateInfo(null)
          }
          
          setShowCreateModal(false)
          setShowPreviewModal(true)
        } else {
          alert(`解析失败: ${result.message}`)
        }
      } catch (error: any) {
        console.error('文件上传失败:', error)
        alert(error.response?.data?.detail || '文件上传失败，请重试')
      } finally {
        setIsUploading(false)
      }
    }
  }
  
  const handleQuestionEdit = (index: number, field: string, value: any) => {
    const updated = [...parsedQuestions]
    
    // 处理答案字段
    if (field === 'answer') {
      const question = updated[index]
      if (question.type === 'multiple_choice') {
        // 多选题：将逗号分隔的字符串转换为数组
        updated[index] = { 
          ...updated[index], 
          [field]: value ? value.split(',').map((s: string) => s.trim().toUpperCase()).filter((s: string) => s) : [] 
        }
      } else if (question.type === 'single_choice' || question.type === 'judgment') {
        // 单选题/判断题：转换为大写字母
        updated[index] = { 
          ...updated[index], 
          [field]: value ? value.trim().toUpperCase() : null 
        }
      } else {
        // 解答题：保持原文本
        updated[index] = { ...updated[index], [field]: value }
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    
    setParsedQuestions(updated)
  }
  
  const handleOptionEdit = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...parsedQuestions]
    updated[qIndex].options[optIndex].text = value
    setParsedQuestions(updated)
  }
  
  const handleDeleteQuestion = (index: number) => {
    const updated = parsedQuestions.filter((_, i) => i !== index)
    setParsedQuestions(updated)
  }
  
  const handleSaveQuestions = async () => {
    try {
      console.log('=' .repeat(70))
      console.log('📝 开始保存问卷到数据库')
      console.log('💡 逻辑：先删除同名旧问卷（如果存在），再保存新问卷（覆盖）')
      console.log('题目数量:', parsedQuestions.length)
      console.log('题目数据:', parsedQuestions)
      
      // 1. 先删除PostgreSQL中同名的旧问卷（无论是否重复文件）
      const existingSurveys = await surveyApi.getSurveys()
      const titleToMatch = currentFilename.replace(/\.(docx?|doc)$/i, '')
      const oldSurvey = existingSurveys.find((s: any) => s.title === titleToMatch)
      
      if (oldSurvey) {
        console.log(`🗑️ 发现同名旧问卷，先删除: ${oldSurvey.title} (ID: ${oldSurvey.id})`)
        await surveyApi.deleteSurvey(oldSurvey.id)
      } else {
        console.log('💡 PostgreSQL中没有同名问卷，直接保存')
      }
      
      // 2. 如果是重复文件，更新向量数据库（删除旧文件，保存新文件）
      if (isDuplicate && duplicateInfo) {
        console.log('🔄 处理向量数据库中的重复文件...')
        await surveyApi.confirmNewFile({
          new_file_id: currentFileId,
          old_file_id: duplicateInfo.file_id,
          filename: currentFilename,
          questions: parsedQuestions
        })
      }
      
      // 3. 保存新问卷到PostgreSQL
      const surveyData = {
        file_id: currentFileId,
        filename: currentFilename,
        title: titleToMatch,
        description: `从${currentFilename}自动生成`,
        questions: parsedQuestions
      }
      
      console.log('📤 发送数据到后端:', surveyData)
      
      // 调用后端API保存到PostgreSQL
      const result = await surveyApi.createSurvey(surveyData)
      
      console.log('✅ 后端响应:', result)
      
      if (result.success) {
        alert(`成功保存${parsedQuestions.length}个问题！（已覆盖旧问卷）`)
        
        // 重新加载问卷列表
        await loadSurveys()
        
        // 关闭模态框并清理状态
        setShowPreviewModal(false)
        setParsedQuestions([])
        setUploadedFile(null)
        setParseErrors([])
        setIsDuplicate(false)
        setDuplicateInfo(null)
        setCurrentFileId('')
        setCurrentFilename('')
      }
    } catch (error: any) {
      console.error('保存问卷失败:', error)
      alert(error.response?.data?.detail || '保存问卷失败')
    }
  }

  const handlePublish = async (surveyId: string) => {
    try {
      await surveyApi.publishSurvey(surveyId)
      await loadSurveys()
      alert('问卷发布成功')
    } catch (error: any) {
      console.error('发布问卷失败:', error)
      alert(error.response?.data?.detail || '发布问卷失败')
    }
  }

  const handleUnpublish = async (surveyId: string) => {
    try {
      await surveyApi.unpublishSurvey(surveyId)
      await loadSurveys()
      alert('已取消发布')
    } catch (error: any) {
      console.error('取消发布失败:', error)
      alert(error.response?.data?.detail || '取消发布失败')
    }
  }

  const handleDelete = async (surveyId: string) => {
    if (confirm('确定要删除这个问卷吗？')) {
      try {
        await surveyApi.deleteSurvey(surveyId)
        await loadSurveys()
        alert('问卷删除成功')
      } catch (error: any) {
        console.error('删除问卷失败:', error)
        alert(error.response?.data?.detail || '删除问卷失败')
      }
    }
  }

  const handleDeleteUploadedFile = async () => {
    if (!currentFileId) return
    
    if (confirm('确定要删除这个上传的文件吗？此操作不可恢复。')) {
      try {
        await surveyApi.deleteUploadedFile(currentFileId)
        alert('文件删除成功')
        
        // 关闭模态框并清理状态
        setShowPreviewModal(false)
        setParsedQuestions([])
        setUploadedFile(null)
        setParseErrors([])
        setIsDuplicate(false)
        setDuplicateInfo(null)
        setCurrentFileId('')
        setCurrentFilename('')
      } catch (error: any) {
        console.error('删除文件失败:', error)
        alert(error.response?.data?.detail || '删除文件失败')
      }
    }
  }

  const handleUseDatabaseFile = async () => {
    if (!currentFileId) return
    
    try {
      console.log('📚 用户选择使用数据库文件')
      console.log('💡 逻辑：只删除新上传的临时文件，不改变PostgreSQL数据')
      
      // 调用后端删除新上传的临时文件（因为向量数据库中已经有了）
      await surveyApi.useDatabaseFile(currentFileId)
      
      // ⚠️ 不对PostgreSQL做任何操作（无论数据库中是否已有该问卷）
      console.log('✅ 已删除临时文件，保持PostgreSQL数据不变')
      alert('已使用数据库中的文件！')
      
      // 重新加载问卷列表（显示现有数据）
      await loadSurveys()
      
      // 关闭模态框并清理状态
      setShowPreviewModal(false)
      setParsedQuestions([])
      setUploadedFile(null)
      setParseErrors([])
      setIsDuplicate(false)
      setDuplicateInfo(null)
      setCurrentFileId('')
      setCurrentFilename('')
      
    } catch (error: any) {
      console.error('使用数据库文件失败:', error)
      alert(error.response?.data?.detail || '使用数据库文件失败')
    }
  }

  const handleConfirmNewFile = async () => {
    if (!currentFileId || !duplicateInfo) return
    
    try {
      // 调用后端删除旧文件，保存新文件到向量数据库
      await surveyApi.confirmNewFile({
        new_file_id: currentFileId,
        old_file_id: duplicateInfo.file_id,
        filename: currentFilename,
        questions: parsedQuestions
      })
      
      alert('已使用新文件替换旧文件')
      
      // 继续保存到数据库
      await handleSaveQuestions()
    } catch (error: any) {
      console.error('确认使用新文件失败:', error)
      alert(error.response?.data?.detail || '确认使用新文件失败')
    }
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 overflow-y-auto">
      {/* 顶部标题 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              问卷管理
            </h2>
            <p className="text-sm text-gray-500 mt-2">创建、编辑和发布问卷</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            <span>🎯</span>
            <span>出题助手</span>
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 出题方式选择卡片 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <span className="mr-2">✨</span>
              创建新问卷
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {creationModes.map((mode) => (
                <div
                  key={mode.id}
                  onClick={() => {
                    setCreateMode(mode.id)
                    setShowCreateModal(true)
                  }}
                  className="group bg-white rounded-2xl border-2 border-gray-200 p-8 cursor-pointer transition-all hover:shadow-2xl hover:border-transparent hover:-translate-y-2 relative overflow-hidden"
                >
                  {/* 渐变背景 */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${
                    mode.color === 'blue' ? 'bg-gradient-to-br from-blue-400 to-cyan-400' :
                    mode.color === 'purple' ? 'bg-gradient-to-br from-purple-400 to-pink-400' :
                    'bg-gradient-to-br from-green-400 to-emerald-400'
                  }`}></div>
                  
                  <div className="relative">
                    <div className={`text-5xl mb-4 transform group-hover:scale-110 transition-transform`}>
                      {mode.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition-colors">
                      {mode.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                  
                  {/* 角标装饰 */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                      mode.color === 'blue' ? 'bg-gradient-to-br from-blue-400 to-cyan-400' :
                      mode.color === 'purple' ? 'bg-gradient-to-br from-purple-400 to-pink-400' :
                      'bg-gradient-to-br from-green-400 to-emerald-400'
                    }`}>
                      <span className="text-white text-xs">→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 问卷列表 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <span className="mr-2">📚</span>
              我的问卷
            </h3>
            {isLoadingSurveys ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : surveys.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <h4 className="text-xl font-semibold text-gray-800 mb-2">暂无问卷</h4>
                <p className="text-gray-500">点击上方"出题助手"开始创建您的第一份问卷</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {surveys.map((survey) => (
                  <div
                    key={survey.id}
                    className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    {/* 顶部状态栏 */}
                    <div className={`h-2 ${survey.status === 'published' ? 'bg-gradient-to-r from-green-400 to-emerald-400' : 'bg-gradient-to-r from-gray-300 to-gray-400'}`}></div>
                    
                    {/* 内容区域 */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-lg font-bold text-gray-800 line-clamp-2 flex-1">
                          {survey.title}
                        </h4>
                        {survey.status === 'published' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold ml-2 whitespace-nowrap">
                            已发布
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold ml-2 whitespace-nowrap">
                            草稿
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[40px]">
                        {survey.description}
                      </p>
                      
                      <div className="space-y-2 text-xs text-gray-500 mb-5">
                        <div className="flex items-center">
                          <span className="mr-2">📋</span>
                          <span>{survey.questionCount} 道题目</span>
                        </div>
                        <div className="flex items-center">
                          <span className="mr-2">📅</span>
                          <span>创建于 {survey.createdAt}</span>
                        </div>
                        {survey.publishedAt && (
                          <div className="flex items-center text-green-600">
                            <span className="mr-2">🚀</span>
                            <span>发布于 {survey.publishedAt}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="space-y-2">
                        {survey.status === 'draft' ? (
                          <button
                            onClick={() => handlePublish(survey.id)}
                            className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
                          >
                            🚀 发布问卷
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnpublish(survey.id)}
                            className="w-full py-2.5 bg-gray-500 text-white rounded-xl text-sm font-medium hover:bg-gray-600 transition-all"
                          >
                            📥 取消发布
                          </button>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <button className="py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-all">
                            ✏️ 编辑
                          </button>
                          <button className="py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100 transition-all">
                            📊 统计
                          </button>
                          <button
                            onClick={() => handleDelete(survey.id)}
                            className="py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-all"
                          >
                            🗑️ 删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建问卷模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-800">
                  {createMode === 'manual' && '📝 手动创建问卷'}
                  {createMode === 'ai' && '🤖 AI生成问卷'}
                  {createMode === 'knowledge' && '📚 基于知识库生成'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateMode(null)
                    setAiDescription('')
                    setUploadedFile(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {createMode === 'manual' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      上传Word文档
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept=".doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <div className="text-4xl mb-2">📄</div>
                        <p className="text-gray-600 mb-1">点击上传或拖拽文件</p>
                        <p className="text-sm text-gray-400">支持 .doc, .docx 格式</p>
                        {uploadedFile && (
                          <p className="mt-2 text-blue-600 font-medium">{uploadedFile.name}</p>
                        )}
                      </label>
                    </div>
                  </div>
                  <div className="text-center text-gray-400">或</div>
                  <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    手动添加题目
                  </button>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {createMode === 'ai' ? 'AI生成描述' : '基于知识库生成描述'}
                  </label>
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder={
                      createMode === 'ai'
                        ? '例如：生成一份关于数据结构中栈和队列的测验，包含10道选择题和5道简答题...'
                        : '例如：根据知识库中的数据结构课程资料，生成一份涵盖第三章内容的测验...'
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none min-h-[200px] resize-none"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    {createMode === 'knowledge' && '💡 AI将从您上传的课程资料中提取相关知识点'}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateMode(null)
                  setAiDescription('')
                  setUploadedFile(null)
                }}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={isUploading}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? '上传中...' : (createMode === 'manual' ? '开始识别' : '生成问卷')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 问题预览和编辑模态框 */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">📋 问题预览与编辑</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    共解析出 {parsedQuestions.length} 个问题
                    {parseErrors.length > 0 && (
                      <span className="text-red-500 ml-2">
                        ⚠️ {parseErrors.length} 个问题需要修正
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPreviewModal(false)
                    setParsedQuestions([])
                    setParseErrors([])
                    setIsDuplicate(false)
                    setDuplicateInfo(null)
                    setCurrentFileId('')
                    setCurrentFilename('')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* 重复文件警告 */}
              {isDuplicate && duplicateInfo && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-5">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 text-3xl mr-3">⚠️</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-yellow-900 mb-2 text-lg">检测到重复文件</h4>
                      <p className="text-yellow-800 mb-3">
                        数据库中已存在内容相同的文件，相似度：
                        <span className="font-bold ml-1">
                          {(duplicateInfo.similarity * 100).toFixed(1)}%
                        </span>
                      </p>
                      <div className="bg-white rounded-lg p-3 space-y-1 text-sm">
                        <p><strong>文件名：</strong>{duplicateInfo.filename}</p>
                        <p><strong>上传时间：</strong>{new Date(duplicateInfo.upload_time).toLocaleString('zh-CN')}</p>
                        <p><strong>题目数量：</strong>{duplicateInfo.question_count} 道</p>
                      </div>
                      <p className="text-yellow-800 mt-3 text-sm">
                        💡 您可以选择继续使用当前解析结果，或使用数据库中已有的文件进行出题。
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 错误提示 */}
              {parseErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">⚠️ 解析警告</h4>
                  <ul className="space-y-1 text-sm text-red-700">
                    {parseErrors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 题型统计 */}
              {parsedQuestions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">📊 题型统计</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-gray-500">单选题</div>
                      <div className="text-xl font-bold text-blue-600">
                        {parsedQuestions.filter(q => q.type === 'single_choice').length}
                      </div>
                    </div>
                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-gray-500">多选题</div>
                      <div className="text-xl font-bold text-purple-600">
                        {parsedQuestions.filter(q => q.type === 'multiple_choice').length}
                      </div>
                    </div>
                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-gray-500">判断题</div>
                      <div className="text-xl font-bold text-green-600">
                        {parsedQuestions.filter(q => q.type === 'judgment').length}
                      </div>
                    </div>
                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-gray-500">解答题</div>
                      <div className="text-xl font-bold text-gray-600">
                        {parsedQuestions.filter(q => q.type === 'text').length}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 问题列表 */}
              {parsedQuestions.map((question, qIndex) => (
                <div
                  key={question.id}
                  className="bg-gray-50 border-2 border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                          {qIndex + 1}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          question.type === 'single_choice' ? 'bg-blue-100 text-blue-700' :
                          question.type === 'multiple_choice' ? 'bg-purple-100 text-purple-700' :
                          question.type === 'judgment' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {question.type === 'single_choice' ? '单选题' :
                           question.type === 'multiple_choice' ? '多选题' :
                           question.type === 'judgment' ? '判断题' : '解答题'}
                        </span>
                        {question.required && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                            必答
                          </span>
                        )}
                      </div>
                      <textarea
                        value={question.question}
                        onChange={(e) => handleQuestionEdit(qIndex, 'question', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(qIndex)}
                      className="ml-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除此问题"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* 选项列表 */}
                  {question.options.length > 0 && (
                    <div className="space-y-2 ml-10">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-600 min-w-[30px]">
                            {option.label}.
                          </span>
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => handleOptionEdit(qIndex, optIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 答案和分数 */}
                  <div className="mt-4 ml-10 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        答案
                        {question.type === 'multiple_choice' && <span className="text-gray-500 ml-1">(多个答案用逗号分隔，如：A,B,C)</span>}
                        {question.type === 'text' && <span className="text-gray-500 ml-1">(参考答案)</span>}
                      </label>
                      <input
                        type="text"
                        value={Array.isArray(question.answer) ? question.answer.join(',') : (question.answer || '')}
                        onChange={(e) => handleQuestionEdit(qIndex, 'answer', e.target.value)}
                        placeholder={question.type === 'single_choice' || question.type === 'judgment' ? '例如：A' : question.type === 'multiple_choice' ? '例如：A,B,C' : '输入参考答案'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        分数
                      </label>
                      <input
                        type="number"
                        value={question.score || 5}
                        onChange={(e) => handleQuestionEdit(qIndex, 'score', parseFloat(e.target.value) || 5)}
                        min="0"
                        step="0.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {parsedQuestions.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-lg">未找到任何问题</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPreviewModal(false)
                  setParsedQuestions([])
                  setParseErrors([])
                  setIsDuplicate(false)
                  setDuplicateInfo(null)
                  setCurrentFileId('')
                  setCurrentFilename('')
                }}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDeleteUploadedFile}
                disabled={!currentFileId}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ 删除文件
              </button>
              {isDuplicate && duplicateInfo && (
                <button
                  onClick={handleUseDatabaseFile}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                >
                  📚 使用数据库文件
                </button>
              )}
              <button
                onClick={handleSaveQuestions}
                disabled={parsedQuestions.length === 0}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ 保存问题 ({parsedQuestions.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherSurvey
