import { useState, useEffect } from 'react'
import { surveyApi } from '@/services'
import { getTeacherClasses } from '@/services/teacher'
import ManualQuestionForm, { QuestionFormData as BaseQuestionFormData } from '@/components/ManualQuestionForm'
import { Icon, IconName } from '@/components/Icon'

type ReleaseType = 'in_class' | 'homework' | 'practice'

// 扩展QuestionFormData以支持更多题型
interface QuestionFormData extends Omit<BaseQuestionFormData, 'questionType'> {
  questionType: 'single_choice' | 'multiple_choice' | 'judgment' | 'fill_blank' | 'essay' | 'text'
  correctAnswer?: string | string[]
}

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
  
  // 手动添加题目相关状态
  const [showManualQuestionModal, setShowManualQuestionModal] = useState(false)
  const [manualQuestions, setManualQuestions] = useState<QuestionFormData[]>([])
  const [surveyTitle, setSurveyTitle] = useState('')
  const [surveyDescription, setSurveyDescription] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  
  // 编辑和统计相关状态
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<any>(null)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [statsData, setStatsData] = useState<any>(null)
  // 发布弹窗：选择班级与发布类型
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishSurveyId, setPublishSurveyId] = useState<string | null>(null)
  const [publishClassIds, setPublishClassIds] = useState<string[]>([])
  const [publishReleaseType, setPublishReleaseType] = useState<ReleaseType>('in_class')
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: string; class_name: string; course_name?: string }>>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  
  // AI生成相关状态
  const [aiGeneratedData, setAiGeneratedData] = useState<any>(null)
  const [showAiEditor, setShowAiEditor] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [generateStage, setGenerateStage] = useState('')
  const [questionCount, setQuestionCount] = useState<number>(20)  // 题目数量，默认20道
  const [selectedCourse, setSelectedCourse] = useState<string>('')  // 选中的课程ID
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(['choice', 'judge', 'essay'])  // 默认三种题型都有
  const [courses, setCourses] = useState<Array<{id: string, course_name: string}>>([])  // 课程列表
  
  // 加载课程列表
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('http://localhost:8000/api/teacher/profile/courses', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setCourses(data)
        } else {
          console.error('加载课程列表失败')
        }
      } catch (error) {
        console.error('加载课程列表失败:', error)
      }
    }
    loadCourses()
  }, [])
  
  // 获取问卷列表（兼容后端直接返回数组或 { data: [] }）
  const loadSurveys = async () => {
    setIsLoadingSurveys(true)
    try {
      const raw = await surveyApi.getSurveys()
      const data = Array.isArray(raw) ? raw : (raw?.data ?? raw?.surveys ?? [])
      if (!Array.isArray(data)) {
        setSurveys([])
        return
      }
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
      iconName: 'survey' as IconName,
      color: 'blue',
    },
    {
      id: 'ai' as CreateMode,
      title: 'AI生成',
      description: '给出描述，AI自动生成问卷',
      iconName: 'sparkles' as IconName,
      color: 'purple',
    },
    {
      id: 'knowledge' as CreateMode,
      title: '基于知识库',
      description: '描述需求，AI基于知识库生成问卷',
      iconName: 'book' as IconName,
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
      
      setIsGenerating(true)
      setGenerateProgress(0)
      setGenerateStage('')
      
      const payload: any = {
        description: aiDescription,
        auto_save: false
      }
      if (createMode !== 'ai') {
        payload.question_count = questionCount
        if (selectedQuestionTypes.length > 0) payload.include_types = selectedQuestionTypes
        if (selectedCourse) payload.course_id = selectedCourse
      }
      
      const token = localStorage.getItem('token')
      const baseUrl = 'http://localhost:8000/api'
      
      try {
        // AI 生成使用流式接口，带后端真实进度（120 秒超时，避免长时间无响应）
        if (createMode === 'ai') {
          const abort = new AbortController()
          const timeoutId = setTimeout(() => abort.abort(), 120000)
          let res: Response
          try {
            res = await fetch(`${baseUrl}/teacher/survey-generation/generate/ai/stream`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload),
              signal: abort.signal
            })
          } catch (e: any) {
            clearTimeout(timeoutId)
            if (e?.name === 'AbortError') {
              alert('生成超时（约 2 分钟），请重试或缩短描述、减少题目数量')
              return
            }
            throw e
          }
          clearTimeout(timeoutId)
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.detail || res.statusText)
          }
          const reader = res.body?.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let survey_data: any = null
          let error_message = ''
          const processLine = (line: string) => {
            if (!line.startsWith('data: ')) return
            try {
              const ev = JSON.parse(line.slice(6))
              setGenerateProgress(ev.progress ?? 0)
              setGenerateStage(ev.message ?? '')
              if (ev.stage === 'done' && ev.data) survey_data = ev.data
              if (ev.stage === 'error') error_message = ev.message || '生成失败'
            } catch (_) {}
          }
          while (reader) {
            const { value, done } = await reader.read()
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) processLine(line)
            if (done) break
          }
          for (const line of buffer.split('\n')) processLine(line)
          if (error_message) {
            alert(error_message)
            return
          }
          if (!survey_data) {
            alert('未收到生成结果，请重试')
            return
          }
          const result = { success: true, data: survey_data }
          if (result.success && result.data) {
            const questions = result.data.questions.map((q: any, index: number) => ({
              id: `ai-q-${index}`,
              question: q.question_text,
              type: q.question_type,
              options: q.options ? q.options.map((opt: string) => ({ label: opt.charAt(0), text: opt })) : [],
              required: true,
              answer: q.correct_answer,
              score: q.score,
              explanation: q.explanation,
              knowledge_source: q.knowledge_source
            }))
            setParsedQuestions(questions)
            setSurveyTitle(result.data.survey_title)
            setSurveyDescription(result.data.description || aiDescription)
            setAiGeneratedData({ generationMethod: createMode, generationPrompt: aiDescription, originalData: result.data })
            setShowCreateModal(false)
            setShowPreviewModal(true)
            setCreateMode(null)
            setAiDescription('')
          }
        } else {
          // 知识库生成仍用普通接口
          const axios = (await import('axios')).default
          const response = await axios.post(`${baseUrl}/teacher/survey-generation/generate/knowledge-based`, payload, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          })
          const result = response.data
          if (result.success && result.data) {
            const questions = result.data.questions.map((q: any, index: number) => ({
              id: `ai-q-${index}`,
              question: q.question_text,
              type: q.question_type,
              options: q.options ? q.options.map((opt: string) => ({ label: opt.charAt(0), text: opt })) : [],
              required: true,
              answer: q.correct_answer,
              score: q.score,
              explanation: q.explanation,
              knowledge_source: q.knowledge_source
            }))
            setParsedQuestions(questions)
            setSurveyTitle(result.data.survey_title)
            setSurveyDescription(result.data.description || aiDescription)
            setAiGeneratedData({ generationMethod: createMode, generationPrompt: aiDescription, originalData: result.data })
            setShowCreateModal(false)
            setShowPreviewModal(true)
            setCreateMode(null)
            setAiDescription('')
          } else {
            alert(`生成失败: ${result.message || '未知错误'}`)
          }
        }
      } catch (error: any) {
        console.error('AI生成失败:', error)
        alert(error.response?.data?.detail || error.message || error.message || 'AI生成失败，请重试')
      } finally {
        setIsGenerating(false)
        setGenerateProgress(0)
        setGenerateStage('')
      }
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
          
          // 设置问卷标题和描述（从文件名生成）
          const title = result.filename.replace(/\.(docx?|doc)$/i, '')
          setSurveyTitle(title)
          setSurveyDescription(`从${result.filename}自动生成`)
          
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
    setIsPublishing(true)  // 显示保存中状态
    try {
      console.log('='.repeat(70))
      console.log('📝 开始保存问卷到数据库')
      
      // 判断是AI生成还是Word上传
      if (aiGeneratedData) {
        // AI生成的问卷
        console.log('🤖 保存AI生成的问卷')
        console.log('题目数量:', parsedQuestions.length)
        
        // 转换为后端需要的格式
        const questions = parsedQuestions.map((q: any) => ({
          question_type: q.type === 'single_choice' ? 'choice' : 
                        q.type === 'judgment' ? 'judge' : 
                        q.type === 'essay' ? 'essay' : q.type,
          question_text: q.question,
          options: q.options?.map((opt: any) => opt.text) || [],
          correct_answer: q.answer,
          score: q.score || 5,
          explanation: q.explanation || '',
          knowledge_source: q.knowledge_source
        }))
        
        // 调用保存API
        const axios = (await import('axios')).default
        const token = localStorage.getItem('token')
        const response = await axios.post(`http://localhost:8000/api/teacher/survey-generation/save`, {
          survey_title: surveyTitle,
          description: surveyDescription,
          questions: questions,
          generation_method: aiGeneratedData.generationMethod,
          generation_prompt: aiGeneratedData.generationPrompt
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
        
        const result = response.data
        
        if (result.success) {
          alert('✅ 问卷保存成功！')
          setShowPreviewModal(false)
          setShowAiEditor(false)  // 关闭编辑器
          setAiGeneratedData(null)
          setParsedQuestions([])
          setSurveyTitle('')
          setSurveyDescription('')
          await loadSurveys()  // 刷新列表
        } else {
          alert(`❌ 保存失败: ${result.message}`)
        }
        
        return
      }
      
      // 原有的Word上传逻辑
      console.log('💡 逻辑：先删除同名旧问卷（如果存在），再保存新问卷（覆盖）')
      console.log('题目数量:', parsedQuestions.length)
      console.log('题目数据:', parsedQuestions)
      console.log('是否重复文件:', isDuplicate)
      console.log('重复文件信息:', duplicateInfo)
      
      const titleToMatch = currentFilename.replace(/\.(docx?|doc)$/i, '')
      
      // 1. 先删除PostgreSQL中同名的旧问卷（无论是否重复文件）
      const existingSurveys = await surveyApi.getSurveys()
      const oldSurvey = existingSurveys.find((s: any) => s.title === titleToMatch)
      
      if (oldSurvey) {
        console.log(`🗑️ 发现同名旧问卷，先删除: ${oldSurvey.title} (ID: ${oldSurvey.id})`)
        await surveyApi.deleteSurvey(oldSurvey.id)
      } else {
        console.log('💡 PostgreSQL中没有同名问卷，直接保存')
      }
      
      // 2. 如果是重复文件，删除旧的向量数据库记录和本地文件，保存新文件
      if (isDuplicate && duplicateInfo) {
        console.log('🔄 检测到重复文件，删除旧文件并保存新文件')
        console.log('旧文件ID:', duplicateInfo.file_id)
        console.log('新文件ID:', currentFileId)
        console.log('传递给后端的questions:', parsedQuestions)
        
        try {
          // 调用后端API：删除旧文件（向量数据库+本地文件），保存新文件到向量数据库
          const confirmResult = await surveyApi.confirmNewFile({
            new_file_id: currentFileId,
            old_file_id: duplicateInfo.file_id,
            filename: currentFilename,
            questions: parsedQuestions
          })
          console.log('✅ 后端confirmNewFile响应:', confirmResult)
          console.log('✅ 旧文件已删除，新文件已保存到向量数据库')
        } catch (error) {
          console.error('❌ 处理重复文件失败:', error)
          // 即使向量数据库操作失败，也继续保存到PostgreSQL
        }
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
        const message = isDuplicate 
          ? `成功保存${parsedQuestions.length}个问题！已删除旧文件并保存新文件。`
          : `成功保存${parsedQuestions.length}个问题！`
        alert(message)
        
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
        setSurveyTitle('')
        setSurveyDescription('')
      }
    } catch (error: any) {
      console.error('保存问卷失败:', error)
      alert(error.response?.data?.detail || '保存问卷失败')
    } finally {
      setIsPublishing(false)  // 恢复按钮状态
    }
  }

  const openPublishModal = async (surveyId: string) => {
    setPublishSurveyId(surveyId)
    setPublishClassIds([])
    setPublishReleaseType('in_class')
    setShowPublishModal(true)
    setLoadingClasses(true)
    try {
      const list = await getTeacherClasses()
      setTeacherClasses(list)
    } catch (e: any) {
      console.error('获取班级列表失败:', e)
      alert(e.response?.data?.detail || '获取班级列表失败')
    } finally {
      setLoadingClasses(false)
    }
  }

  const handlePublishConfirm = async () => {
    if (!publishSurveyId || publishClassIds.length === 0) {
      alert('请至少选择一个班级')
      return
    }
    try {
      await surveyApi.publishSurvey(publishSurveyId, {
        classIds: publishClassIds,
        releaseType: publishReleaseType,
      })
      await loadSurveys()
      setShowPublishModal(false)
      setPublishSurveyId(null)
      alert('问卷发布成功，对应班级学生将在问卷检测中看到该题目')
    } catch (error: any) {
      console.error('发布问卷失败:', error)
      alert(error.response?.data?.detail || error.message || '发布问卷失败')
    }
  }

  const handlePublish = async (surveyId: string) => {
    openPublishModal(surveyId)
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
    if (confirm('确定要删除这个问卷吗？删除后数据库中的问卷将被删除，但向量数据库中的数据会保留用于重复检测。')) {
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

  // 编辑问卷
  const handleEdit = async (surveyId: string) => {
    try {
      const data = await surveyApi.getSurveyDetail(surveyId)
      console.log('获取到的问卷数据:', data)
      setEditingSurvey(data)
      setSurveyTitle(data.title)
      setSurveyDescription(data.description || '')
      
      // 转换题目数据格式
      const questions = data.questions.map((q: any) => {
        console.log('处理题目:', q)
        console.log('题目类型:', q.questionType, '答案:', q.correctAnswer)
        const questionData: QuestionFormData = {
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          score: q.score || 0,
          answerExplanation: q.answerExplanation || ''
        }
        
        // 处理选择题选项
        if (q.questionType === 'single_choice' || q.questionType === 'multiple_choice' || q.questionType === 'judgment') {
          if (q.options && Array.isArray(q.options)) {
            questionData.options = q.options.map((opt: any) => {
              // 兼容两种格式：{key, value} 或 {label, text}
              const optKey = opt.key || opt.label
              const optValue = opt.value || opt.text
              
              // 判断是否为正确答案
              let isCorrect = false
              if (Array.isArray(q.correctAnswer)) {
                // 多选题：答案是数组
                isCorrect = q.correctAnswer.includes(optKey)
              } else if (q.correctAnswer) {
                // 单选题/判断题：答案是字符串
                isCorrect = q.correctAnswer === optKey
              }
              
              console.log(`选项 ${optKey}: ${optValue}, 正确答案: ${q.correctAnswer}, isCorrect: ${isCorrect}`)
              
              return {
                key: optKey,
                value: optValue,
                isCorrect: isCorrect
              }
            })
          }
        }
        
        // 处理填空题答案
        if (q.questionType === 'fill_blank') {
          questionData.correctAnswer = q.correctAnswer
        }
        
        // 处理问答题特殊字段（兼容text和essay两种类型）
        if (q.questionType === 'essay' || q.questionType === 'text') {
          questionData.correctAnswer = q.correctAnswer  // 添加解答题参考答案
          questionData.referenceFiles = q.referenceFiles
          questionData.minWordCount = q.minWordCount
          questionData.gradingCriteria = q.gradingCriteria
        }
        
        return questionData
      })
      
      console.log('转换后的题目数据:', questions)
      setManualQuestions(questions)
      setShowEditModal(true)
    } catch (error: any) {
      console.error('获取问卷详情失败:', error)
      alert(error.response?.data?.detail || '获取问卷详情失败')
    }
  }

  // 编辑题目字段
  const handleEditQuestion = (index: number, field: string, value: any) => {
    const updated = [...manualQuestions]
    updated[index] = { ...updated[index], [field]: value }
    setManualQuestions(updated)
  }
  
  // 编辑题目选项
  const handleEditOption = (qIndex: number, optIndex: number, field: string, value: any) => {
    const updated = [...manualQuestions]
    const options = [...(updated[qIndex].options || [])]
    options[optIndex] = { ...options[optIndex], [field]: value }
    updated[qIndex] = { ...updated[qIndex], options }
    setManualQuestions(updated)
  }
  
  // 删除编辑中的题目
  const handleDeleteEditQuestion = (index: number) => {
    if (confirm('确定要删除这道题目吗？')) {
      setManualQuestions(manualQuestions.filter((_, i) => i !== index))
    }
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingSurvey) return
    
    if (!surveyTitle.trim()) {
      alert('请输入问卷标题')
      return
    }
    
    if (manualQuestions.length === 0) {
      alert('请至少添加一道题目')
      return
    }
    
    try {
      setIsPublishing(true)
      
      // 准备题目数据
      const questionsData = manualQuestions.map((q, index) => {
        const questionData: any = {
          questionText: q.questionText,
          questionType: q.questionType,
          questionOrder: index + 1,
          score: q.score || 0,
          answerExplanation: q.answerExplanation || null
        }
        
        // 处理选择题
        if (q.questionType === 'single_choice' || q.questionType === 'multiple_choice' || q.questionType === 'judgment') {
          questionData.options = q.options?.map((opt: any) => ({
            key: opt.key,
            value: opt.value
          })) || []
          
          // 设置正确答案
          if (q.questionType === 'single_choice' || q.questionType === 'judgment') {
            const correctOpt = q.options?.find((opt: any) => opt.isCorrect)
            questionData.correctAnswer = correctOpt?.key || null
          } else if (q.questionType === 'multiple_choice') {
            questionData.correctAnswer = q.options?.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.key) || []
          }
        }
        
        // 处理填空题
        if (q.questionType === 'fill_blank') {
          questionData.correctAnswer = q.correctAnswer || []
        }
        
        // 处理问答题（兼容text和essay两种类型）
        if (q.questionType === 'essay' || q.questionType === 'text') {
          questionData.correctAnswer = q.correctAnswer || null
          questionData.referenceFiles = q.referenceFiles || null
          questionData.minWordCount = q.minWordCount || null
          questionData.gradingCriteria = q.gradingCriteria || null
        }
        
        return questionData
      })
      
      const surveyData = {
        title: surveyTitle,
        description: surveyDescription,
        questions: questionsData
      }
      
      console.log('更新问卷数据:', surveyData)
      
      await surveyApi.updateSurvey(editingSurvey.id, surveyData)
      alert('问卷更新成功！')
      setShowEditModal(false)
      setEditingSurvey(null)
      setSurveyTitle('')
      setSurveyDescription('')
      setManualQuestions([])
      await loadSurveys()
    } catch (error: any) {
      console.error('更新问卷失败:', error)
      alert(error.response?.data?.detail || '更新问卷失败')
    } finally {
      setIsPublishing(false)
    }
  }

  // 查看统计
  const handleStats = async (surveyId: string) => {
    try {
      const data = await surveyApi.getSurveyResults(surveyId)
      setStatsData(data)
      setShowStatsModal(true)
    } catch (error: any) {
      console.error('获取统计数据失败:', error)
      alert(error.response?.data?.detail || '获取统计数据失败')
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
      console.log('💡 逻辑：删除新上传的临时文件，但要保存题目到PostgreSQL')
      
      // 确保标题和描述已设置
      const title = surveyTitle.trim() || currentFilename.replace(/\.(docx?|doc)$/i, '')
      const description = surveyDescription || `从${duplicateInfo.filename}自动生成`
      
      // 1. 先删除PostgreSQL中同名的旧问卷（如果存在）
      const existingSurveys = await surveyApi.getSurveys()
      const oldSurvey = existingSurveys.find((s: any) => s.title === title)
      
      if (oldSurvey) {
        console.log(`🗑️ 发现同名旧问卷，先删除: ${oldSurvey.title} (ID: ${oldSurvey.id})`)
        await surveyApi.deleteSurvey(oldSurvey.id)
      }
      
      // 2. 调用后端删除新上传的临时文件（因为向量数据库中已经有了）
      await surveyApi.useDatabaseFile(currentFileId)
      
      // 3. 保存题目到PostgreSQL
      const surveyData = {
        file_id: duplicateInfo.file_id, // 使用数据库中的文件ID
        filename: duplicateInfo.filename,
        title: title,
        description: description,
        questions: parsedQuestions
      }
      
      console.log('📤 保存题目到PostgreSQL:', surveyData)
      const result = await surveyApi.createSurvey(surveyData)
      
      if (result.success) {
        alert(`成功使用数据库文件并保存了${parsedQuestions.length}个问题！`)
        
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
        setSurveyTitle('')
        setSurveyDescription('')
      } else {
        alert('保存失败')
      }
      
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
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 出题方式选择卡片 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <Icon name="sparkles" size={24} className="mr-2 text-blue-600" />
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
                    <div className={`mb-4 transform group-hover:scale-110 transition-transform`}>
                      <Icon 
                        name={mode.iconName} 
                        size={48} 
                        className={
                          mode.color === 'blue' ? 'text-blue-500' :
                          mode.color === 'purple' ? 'text-purple-500' :
                          'text-green-500'
                        }
                      />
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
                      <Icon name="chevron-right" size={16} className="text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 问卷列表 */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
              <Icon name="survey" size={24} className="mr-2 text-blue-600" />
              我的问卷
            </h3>
            {isLoadingSurveys ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="mb-4 flex justify-center">
                   <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : !surveys || surveys.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="mb-4 flex justify-center">
                  <Icon name="survey" size={64} className="text-gray-300" />
                </div>
                <h4 className="text-xl font-semibold text-gray-800 mb-2">暂无问卷</h4>
                <p className="text-gray-500">点击上方创建方式卡片开始创建您的第一份问卷</p>
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
                          <Icon name="description" size={14} className="mr-2 text-gray-400" />
                          <span>{survey.questionCount} 道题目</span>
                        </div>
                        <div className="flex items-center">
                          <Icon name="calendar" size={14} className="mr-2 text-gray-400" />
                          <span>创建于 {survey.createdAt}</span>
                        </div>
                        {survey.publishedAt && (
                          <div className="flex items-center text-green-600">
                            <Icon name="award" size={14} className="mr-2" />
                            <span>发布于 {survey.publishedAt}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="space-y-2">
                        {survey.status === 'draft' ? (
                          <button
                            onClick={() => openPublishModal(survey.id)}
                            className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl text-sm font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                          >
                            <Icon name="award" size={16} className="text-white" />
                            <span>发布问卷</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnpublish(survey.id)}
                            className="w-full py-2.5 bg-gray-500 text-white rounded-xl text-sm font-medium hover:bg-gray-600 transition-all flex items-center justify-center space-x-2"
                          >
                            <Icon name="logout" size={16} className="text-white" />
                            <span>取消发布</span>
                          </button>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <button 
                            onClick={() => handleEdit(survey.id)}
                            className="py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-all flex items-center justify-center space-x-1"
                          >
                            <Icon name="description" size={14} />
                            <span>编辑</span>
                          </button>
                          <button 
                            onClick={() => handleStats(survey.id)}
                            className="py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100 transition-all flex items-center justify-center space-x-1"
                          >
                            <Icon name="dashboard" size={14} />
                            <span>统计</span>
                          </button>
                          <button
                            onClick={() => handleDelete(survey.id)}
                            className="py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-all flex items-center justify-center space-x-1"
                          >
                            <Icon name="close" size={14} />
                            <span>删除</span>
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

      {/* 发布问卷弹窗：选择班级与发布类型 */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Icon name="award" size={24} className="text-green-500" />
              发布问卷
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              选择要发布的班级和类型后，对应班级的学生将在「问卷检测」的对应页面看到该问卷。
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择发布的班级 <span className="text-red-500">*</span></label>
                {loadingClasses ? (
                  <p className="text-gray-500 text-sm">加载班级列表...</p>
                ) : teacherClasses.length === 0 ? (
                  <p className="text-amber-600 text-sm">暂无班级，请先在个人资料中创建班级</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                    {teacherClasses.map((cls) => (
                      <label key={cls.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={publishClassIds.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) setPublishClassIds([...publishClassIds, cls.id])
                            else setPublishClassIds(publishClassIds.filter((id) => id !== cls.id))
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm">{cls.class_name}{cls.course_name ? `（${cls.course_name}）` : ''}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">发布类型</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'in_class' as ReleaseType, label: '课堂检测', icon: '✅' },
                    { value: 'homework' as ReleaseType, label: '课后作业', icon: '📝' },
                    { value: 'practice' as ReleaseType, label: '自主练习', icon: '📚' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="releaseType"
                        checked={publishReleaseType === opt.value}
                        onChange={() => setPublishReleaseType(opt.value)}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="text-sm">{opt.icon} {opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => { setShowPublishModal(false); setPublishSurveyId(null) }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handlePublishConfirm}
                disabled={publishClassIds.length === 0 || loadingClasses}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认发布
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建问卷模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  {createMode === 'manual' && <><Icon name="survey" size={28} className="text-blue-500" /> 手动创建问卷</>}
                  {createMode === 'ai' && <><Icon name="sparkles" size={28} className="text-purple-500" /> AI生成问卷</>}
                  {createMode === 'knowledge' && <><Icon name="book" size={28} className="text-green-500" /> 基于知识库生成</>}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateMode(null)
                    setAiDescription('')
                    setUploadedFile(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="close" size={24} />
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
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors relative">
                      <input
                        type="file"
                        accept=".doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      {!uploadedFile ? (
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <div className="mb-2 text-blue-500 flex justify-center">
                             <Icon name="description" size={48} />
                          </div>
                          <p className="text-gray-600 mb-1">点击上传或拖拽文件</p>
                          <p className="text-sm text-gray-400">支持 .doc, .docx 格式</p>
                        </label>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <div className="text-blue-500">
                             <Icon name="description" size={32} />
                          </div>
                          <div className="flex-1">
                            <p className="text-blue-600 font-medium">{uploadedFile.name}</p>
                            <p className="text-sm text-gray-400">文件已选择</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              setUploadedFile(null)
                              const fileInput = document.getElementById('file-upload') as HTMLInputElement
                              if (fileInput) fileInput.value = ''
                            }}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                            title="删除文件"
                          >
                            <Icon name="close" size={20} className="text-gray-400 group-hover:text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center text-gray-400">或</div>
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setShowManualQuestionModal(true)
                    }}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    手动添加题目
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  {/* 知识库模式需要选择课程 */}
                  {createMode === 'knowledge' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-yellow-800 mb-2">
                        <Icon name="book" size={16} className="inline mr-1" />
                        选择课程（可选）
                      </label>
                      <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none"
                      >
                        <option value="">不选择（在所有知识库中检索）</option>
                        {courses.map(course => (
                          <option key={course.id} value={course.id}>{course.course_name}</option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-yellow-600">
                        💡 选择课程会在该课程知识库中检索，不选则在所有知识库中检索
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {createMode === 'ai' ? 'AI生成描述' : '基于知识库生成描述'}
                    </label>
                    <textarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder={
                        createMode === 'ai'
                          ? '例如：帮我生成一套关于操作系统的测试题...（可在描述中写明题目数量、题型，未写则默认20题、选择题+判断题+问答题）'
                          : '例如：根据知识库中的数据结构课程资料，生成一份涵盖第三章内容的测验...'
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none min-h-[150px] resize-none"
                    />
                  </div>
                  
                  {/* 仅知识库模式显示题目数量与题型选择；AI生成完全根据描述生成，描述未写则默认20题、三种题型 */}
                  {createMode === 'knowledge' && (
                    <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                      <label className="block text-sm font-medium mb-2 text-yellow-800">
                        <Icon name="list" size={16} className="inline mr-1" />
                        题目数量（可选，默认20题）
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={questionCount}
                        placeholder="20"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none border-yellow-300 focus:ring-yellow-500"
                        onChange={(e) => {
                          const count = parseInt(e.target.value) || 20
                          setQuestionCount(count)
                          if (!aiDescription.match(/\d+\s*道题/)) {
                            setAiDescription(prev => {
                              const base = prev.trim()
                              return base ? `${base}\n\n请生成${count}道题目` : `请生成${count}道题目`
                            })
                          } else {
                            setAiDescription(prev => prev.replace(/(\d+)\s*道题/, `${count}道题`))
                          }
                        }}
                      />
                    </div>
                  )}
                  {createMode === 'knowledge' && (
                    <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                      <label className="block text-sm font-medium mb-2 text-green-800">
                        <Icon name="list" size={16} className="inline mr-1" />
                        题型选择（可选，默认全部题型）
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedQuestionTypes.includes('choice')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedQuestionTypes([...selectedQuestionTypes, 'choice'])
                              } else {
                                setSelectedQuestionTypes(selectedQuestionTypes.filter(t => t !== 'choice'))
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm">选择题</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedQuestionTypes.includes('judge')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedQuestionTypes([...selectedQuestionTypes, 'judge'])
                              } else {
                                setSelectedQuestionTypes(selectedQuestionTypes.filter(t => t !== 'judge'))
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm">判断题</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedQuestionTypes.includes('essay')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedQuestionTypes([...selectedQuestionTypes, 'essay'])
                              } else {
                                setSelectedQuestionTypes(selectedQuestionTypes.filter(t => t !== 'essay'))
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm">问答题</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 生成中时显示进度条（根据后端阶段更新） */}
            {(createMode === 'ai' || createMode === 'knowledge') && isGenerating && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                  <span>{createMode === 'ai' ? (generateStage || '准备中…') : '正在生成…'}</span>
                  {createMode === 'ai' && <span className="font-medium text-indigo-600">{generateProgress}%</span>}
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
                    style={{ width: createMode === 'ai' ? `${Math.min(100, generateProgress)}%` : '100%' }}
                  />
                </div>
              </div>
            )}

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
                disabled={isUploading || isGenerating}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? '上传中...' : isGenerating ? (generateStage || 'AI生成中...') : (createMode === 'manual' ? '开始识别' : '生成问卷')}
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
                    <div className="flex-shrink-0 mr-3 text-yellow-600">
                      <Icon name="description" size={32} />
                    </div>
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
                      <div className="flex items-start">
                        <Icon name="sparkles" size={20} className="text-yellow-500 mt-1 mr-2 flex-shrink-0" />
                        <span>您可以选择继续使用当前解析结果，或使用数据库中已有的文件进行出题。</span>
                      </div>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 错误提示 */}
              {parseErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2 flex items-center">
                    <Icon name="description" size={20} className="mr-2" /> 解析警告
                  </h4>
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
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                    <Icon name="dashboard" size={20} className="mr-2" /> 题型统计
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-gray-500">单选题</div>
                      <div className="text-xl font-bold text-blue-600">
                        {parsedQuestions.filter(q => q.type === 'choice' || q.type === 'single_choice').length}
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
                        {parsedQuestions.filter(q => q.type === 'judge' || q.type === 'judgment').length}
                      </div>
                    </div>
                    <div className="bg-white rounded px-3 py-2">
                      <div className="text-gray-500">解答题</div>
                      <div className="text-xl font-bold text-gray-600">
                        {parsedQuestions.filter(q => q.type === 'essay' || q.type === 'text').length}
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
                          question.type === 'single_choice' || question.type === 'choice' ? 'bg-blue-100 text-blue-700' :
                          question.type === 'multiple_choice' ? 'bg-purple-100 text-purple-700' :
                          question.type === 'judgment' || question.type === 'judge' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {question.type === 'single_choice' || question.type === 'choice' ? '选择题' :
                           question.type === 'multiple_choice' ? '多选题' :
                           question.type === 'judgment' || question.type === 'judge' ? '判断题' : '问答题'}
                        </span>
                        {question.required && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                            必答
                          </span>
                        )}
                        {question.knowledge_source && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded flex items-center gap-1">
                            <Icon name="sparkles" size={14} />
                            {question.knowledge_source.substring(0, 20)}...
                          </span>
                        )}
                        {question.score && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                            {question.score}分
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
                      <Icon name="close" size={20} />
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
                  <div className="mt-4 ml-10 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          答案
                          {question.type === 'multiple_choice' && <span className="text-gray-500 ml-1">(多个答案用逗号分隔，如：A,B,C)</span>}
                          {(question.type === 'text' || question.type === 'essay') && <span className="text-gray-500 ml-1">(参考答案)</span>}
                        </label>
                        <input
                          type="text"
                          value={Array.isArray(question.answer) ? question.answer.join(',') : (question.answer || '')}
                          onChange={(e) => handleQuestionEdit(qIndex, 'answer', e.target.value)}
                          placeholder={question.type === 'single_choice' || question.type === 'choice' || question.type === 'judgment' || question.type === 'judge' ? '例如：A' : question.type === 'multiple_choice' ? '例如：A,B,C' : '输入参考答案'}
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
                    
                    {/* 答案解析（Word 中可带解析，也可不加；此处可查看/编辑或手动补充） */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        答案解析 <span className="text-gray-400 font-normal">（可选）</span>
                      </label>
                      <textarea
                        value={question.explanation || ''}
                        onChange={(e) => handleQuestionEdit(qIndex, 'explanation', e.target.value)}
                        placeholder="Word 中可写「解析：xxx」；此处也可手动填写"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        rows={3}
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
                onClick={async () => {
                  // 点击取消时，删除临时上传的文件
                  if (currentFileId) {
                    try {
                      await surveyApi.useDatabaseFile(currentFileId)
                      console.log('✅ 已删除临时文件')
                    } catch (error) {
                      console.error('删除临时文件失败:', error)
                    }
                  }
                  
                  setShowPreviewModal(false)
                  setParsedQuestions([])
                  setUploadedFile(null)
                  setParseErrors([])
                  setIsDuplicate(false)
                  setDuplicateInfo(null)
                  setCurrentFileId('')
                  setCurrentFilename('')
                  setSurveyTitle('')
                  setSurveyDescription('')
                }}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                取消
              </button>
              {isDuplicate && duplicateInfo && (
                <button
                  onClick={handleUseDatabaseFile}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <Icon name="book" size={18} /> 使用数据库文件
                </button>
              )}
              <button
                onClick={handleSaveQuestions}
                disabled={parsedQuestions.length === 0 || isPublishing}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isPublishing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Icon name="add" size={18} /> 保存问题 ({parsedQuestions.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手动添加题目模态框 */}
      {showManualQuestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Icon name="survey" size={28} className="text-blue-500" /> 手动创建问卷
                </h3>
                <button
                  onClick={() => {
                    setShowManualQuestionModal(false)
                    setManualQuestions([])
                    setSurveyTitle('')
                    setSurveyDescription('')
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 问卷基本信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  问卷标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={surveyTitle}
                  onChange={(e) => setSurveyTitle(e.target.value)}
                  placeholder="请输入问卷标题..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  问卷描述（可选）
                </label>
                <textarea
                  value={surveyDescription}
                  onChange={(e) => setSurveyDescription(e.target.value)}
                  placeholder="请输入问卷描述..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[80px] resize-none"
                  rows={3}
                />
              </div>

              {/* 题目列表 */}
              {manualQuestions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">
                      已添加题目 ({manualQuestions.length})
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {manualQuestions.map((q, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                题目 {index + 1}
                              </span>
                              <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                                {q.questionType === 'single_choice' ? '选择题' : 
                                 q.questionType === 'fill_blank' ? '填空题' : '问答题'}
                              </span>
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                {q.score} 分
                              </span>
                            </div>
                            <p className="text-gray-800 font-medium mb-1">{q.questionText}</p>
                            {q.questionType === 'single_choice' && q.options && (
                              <div className="mt-2 space-y-1">
                                {q.options.map((opt) => (
                                  <div key={opt.key} className="text-sm text-gray-600">
                                    {opt.key}. {opt.value}
                                    {opt.isCorrect && (
                                      <span className="ml-2 text-green-600 font-medium">✓ 正确答案</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.questionType === 'fill_blank' && q.correctAnswers && (
                              <div className="mt-2 text-sm text-gray-600">
                                答案: {q.correctAnswers.join(', ')}
                              </div>
                            )}
                            {q.questionType === 'essay' && (
                              <div className="mt-2 text-sm text-gray-600">
                                {q.minWordCount && <div>最少字数: {q.minWordCount}</div>}
                                {q.gradingCriteria && (
                                  <div>评分标准: {q.gradingCriteria.scoreDistribution.length} 项</div>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setManualQuestions(manualQuestions.filter((_, i) => i !== index))
                            }}
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

              {/* 添加题目表单 */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">
                  {manualQuestions.length === 0 ? '添加第一道题目' : '添加下一道题目'}
                </h4>
                <ManualQuestionForm
                  onSave={(question) => {
                    // 转换类型以适配我们的扩展类型
                    const extendedQuestion: QuestionFormData = {
                      ...question,
                      questionType: question.questionType as any
                    }
                    setManualQuestions([...manualQuestions, extendedQuestion])
                    // 滚动到顶部显示新添加的题目
                    setTimeout(() => {
                      const modal = document.querySelector('.max-h-\\[90vh\\]')
                      if (modal) {
                        modal.scrollTop = 0
                      }
                    }, 100)
                  }}
                  onCancel={() => {
                    setShowManualQuestionModal(false)
                    setManualQuestions([])
                    setSurveyTitle('')
                    setSurveyDescription('')
                  }}
                  onSaveAll={async (questions) => {
                    // 将新题目添加到已有题目列表
                    const allQuestions = [...manualQuestions, ...questions]
                    
                    if (!surveyTitle.trim()) {
                      alert('请输入问卷标题')
                      return
                    }
                    
                    if (allQuestions.length === 0) {
                      alert('请至少添加一道题目')
                      return
                    }

                    setIsPublishing(true)
                    try {
                      // 准备题目数据
                      const questionsData = await Promise.all(allQuestions.map(async (q, index) => {
                        const questionData: any = {
                          questionType: q.questionType,
                          questionText: q.questionText,
                          questionOrder: index + 1,
                          score: q.score,
                          answerExplanation: q.answerExplanation,
                        }

                        if (q.questionType === 'single_choice' && q.options) {
                          questionData.options = q.options.map(opt => ({
                            key: opt.key,
                            value: opt.value,
                          }))
                          questionData.correctAnswer = q.options.find(opt => opt.isCorrect)?.key
                        }

                        if (q.questionType === 'fill_blank' && q.correctAnswers) {
                          questionData.correctAnswer = q.correctAnswers
                        }

                        if (q.questionType === 'essay') {
                          // 上传文件（如果有）
                          if (q.referenceFiles && q.referenceFiles.length > 0) {
                            const uploadedFileUrls: string[] = []
                            for (const file of q.referenceFiles) {
                              try {
                                const result = await surveyApi.uploadFile(file)
                                const fileUrl = result.data?.url || result.url
                                if (fileUrl) {
                                  uploadedFileUrls.push(fileUrl)
                                }
                              } catch (error) {
                                console.error('文件上传失败:', error)
                              }
                            }
                            questionData.referenceFiles = uploadedFileUrls
                          }
                          questionData.minWordCount = q.minWordCount
                          questionData.gradingCriteria = q.gradingCriteria
                        }

                        return questionData
                      }))

                      // 创建问卷
                      const surveyData = {
                        title: surveyTitle.trim(),
                        description: surveyDescription.trim() || undefined,
                        questions: questionsData,
                      }

                      const result = await surveyApi.createManualSurvey(surveyData)

                      // 兼容不同返回结构，确保拿到 id
                      const surveyId = result?.id || result?.data?.id || result?.data?.data?.id || result?.survey_id
                      if (!surveyId) {
                        console.error('createManualSurvey 返回值:', result)
                        alert('创建问卷未返回 id，发布失败，请检查后端日志')
                        setIsPublishing(false)
                        return
                      }

                      // 重新加载问卷列表后打开发布弹窗，让教师选择班级与发布类型
                      await loadSurveys()
                      setShowManualQuestionModal(false)
                      setManualQuestions([])
                      setSurveyTitle('')
                      setSurveyDescription('')
                      openPublishModal(surveyId)
                      alert('问卷已保存，请选择发布的班级和类型后点击「确认发布」')
                    } catch (error: any) {
                      console.error('保存失败:', error)
                      const msg =
                        error?.response?.data?.message ||
                        error?.response?.data?.detail ||
                        error?.message ||
                        '保存失败，请重试'
                      alert(msg)
                    } finally {
                      setIsPublishing(false)
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑问卷模态框 */}
      {showEditModal && editingSurvey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between text-white">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Icon name="description" size={28} />
                  编辑问卷
                </h3>
                <button 
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingSurvey(null)
                    setSurveyTitle('')
                    setSurveyDescription('')
                    setManualQuestions([])
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">问卷标题</label>
                <input
                  type="text"
                  value={surveyTitle}
                  onChange={(e) => setSurveyTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="请输入问卷标题"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">问卷描述</label>
                <textarea
                  value={surveyDescription}
                  onChange={(e) => setSurveyDescription(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="请输入问卷描述（可选）"
                  rows={3}
                />
              </div>
              
              {/* 题目列表 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">题目列表</label>
                  <span className="text-sm text-gray-500">共 {manualQuestions.length} 道题目</span>
                </div>
                
                {manualQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {manualQuestions.map((question, qIndex) => (
                      <div key={qIndex} className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50">
                        {/* 题目标题和操作 */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              第 {qIndex + 1} 题
                            </span>
                            <span className="text-gray-500">
                              {question.questionType === 'single_choice' && '单选题'}
                              {question.questionType === 'multiple_choice' && '多选题'}
                              {question.questionType === 'judgment' && '判断题'}
                              {question.questionType === 'fill_blank' && '填空题'}
                              {(question.questionType === 'essay' || question.questionType === 'text') && '问答题'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteEditQuestion(qIndex)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="删除此题"
                          >
                            <Icon name="close" size={20} />
                          </button>
                        </div>

                        {/* 题目文本 */}
                        <div className="mb-3">
                          <label className="block text-xs text-gray-600 mb-1">题目内容</label>
                          <textarea
                            value={question.questionText}
                            onChange={(e) => handleEditQuestion(qIndex, 'questionText', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            rows={2}
                            placeholder="输入题目内容"
                          />
                        </div>

                        {/* 选项（单选/多选/判断题） */}
                        {(question.questionType === 'single_choice' || 
                          question.questionType === 'multiple_choice' || 
                          question.questionType === 'judgment') && question.options && (
                          <div className="mb-3">
                            <label className="block text-xs text-gray-600 mb-2">选项</label>
                            <div className="space-y-2">
                              {question.options.map((option: any, optIndex: number) => (
                                <div key={optIndex} className="flex items-center space-x-2">
                                  <span className="font-medium text-gray-600 min-w-[30px]">
                                    {option.key}.
                                  </span>
                                  <input
                                    type="text"
                                    value={option.value}
                                    onChange={(e) => handleEditOption(qIndex, optIndex, 'value', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                  />
                                  <label className="flex items-center space-x-1 text-sm text-gray-600">
                                    <input
                                      type={question.questionType === 'multiple_choice' ? 'checkbox' : 'radio'}
                                      name={`question_${qIndex}_correct`}
                                      checked={option.isCorrect || false}
                                      onChange={(e) => {
                                        if (question.questionType === 'single_choice' || question.questionType === 'judgment') {
                                          // 单选/判断题：只能选一个
                                          const updated = [...manualQuestions]
                                          const options = updated[qIndex].options?.map((opt: any, i: number) => ({
                                            ...opt,
                                            isCorrect: i === optIndex
                                          }))
                                          updated[qIndex] = { ...updated[qIndex], options }
                                          setManualQuestions(updated)
                                        } else {
                                          // 多选：可以多个
                                          handleEditOption(qIndex, optIndex, 'isCorrect', e.target.checked)
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span>正确</span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 填空题答案 */}
                        {question.questionType === 'fill_blank' && (
                          <div className="mb-3">
                            <label className="block text-xs text-gray-600 mb-1">
                              正确答案（多个答案用逗号分隔）
                            </label>
                            <input
                              type="text"
                              value={Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : question.correctAnswer || ''}
                              onChange={(e) => {
                                const answers = e.target.value.split(',').map(a => a.trim()).filter(a => a)
                                handleEditQuestion(qIndex, 'correctAnswer', answers)
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              placeholder="例如：答案1, 答案2"
                            />
                          </div>
                        )}

                        {/* 解答题参考答案 */}
                        {(question.questionType === 'essay' || question.questionType === 'text') && (
                          <div className="mb-3">
                            <label className="block text-xs text-gray-600 mb-1">
                              参考答案（可选）
                            </label>
                            <textarea
                              value={(typeof question.correctAnswer === 'string' ? question.correctAnswer : '') || ''}
                              onChange={(e) => handleEditQuestion(qIndex, 'correctAnswer', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                              rows={3}
                              placeholder="输入参考答案"
                            />
                          </div>
                        )}

                        {/* 分数 */}
                        <div className="mb-3">
                          <label className="block text-xs text-gray-600 mb-1">分数</label>
                          <input
                            type="number"
                            value={question.score || 0}
                            onChange={(e) => handleEditQuestion(qIndex, 'score', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.5"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>

                        {/* 答案解析 */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">答案解析（可选）</label>
                          <textarea
                            value={question.answerExplanation || ''}
                            onChange={(e) => handleEditQuestion(qIndex, 'answerExplanation', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            rows={2}
                            placeholder="输入答案解析"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-300 rounded-xl">
                    <p>暂无题目</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-4 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingSurvey(null)
                    setSurveyTitle('')
                    setSurveyDescription('')
                    setManualQuestions([])
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isPublishing}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isPublishing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <Icon name="award" size={20} />
                      保存修改
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 统计模态框 */}
      {showStatsModal && statsData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between text-white">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Icon name="dashboard" size={28} />
                  问卷统计 - {statsData.title}
                </h3>
                <button 
                  onClick={() => {
                    setShowStatsModal(false)
                    setStatsData(null)
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-8">
              {/* 总体统计 */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                  <div className="text-sm text-blue-600 font-medium mb-2">总提交数</div>
                  <div className="text-3xl font-bold text-blue-700">{statsData.totalResponses}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                  <div className="text-sm text-green-600 font-medium mb-2">平均分</div>
                  <div className="text-3xl font-bold text-green-700">{statsData.avgScore}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                  <div className="text-sm text-purple-600 font-medium mb-2">通过人数</div>
                  <div className="text-3xl font-bold text-purple-700">{statsData.passCount}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl">
                  <div className="text-sm text-orange-600 font-medium mb-2">通过率</div>
                  <div className="text-3xl font-bold text-orange-700">{statsData.passRate}%</div>
                </div>
              </div>

              {/* 题目统计 */}
              <div className="space-y-6">
                <h4 className="text-xl font-bold text-gray-800 mb-4">题目详细统计</h4>
                {statsData.questionStats && statsData.questionStats.length > 0 ? (
                  statsData.questionStats.map((q: any, index: number) => (
                    <div key={q.questionId} className="bg-gray-50 p-6 rounded-xl">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="text-sm text-gray-500 mb-2">题目 {index + 1}</div>
                          <div className="text-lg font-medium text-gray-800">{q.questionText}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-sm text-gray-500">正确率</div>
                          <div className="text-2xl font-bold text-green-600">{q.correctRate.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      {q.optionStats && Object.keys(q.optionStats).length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-sm font-medium text-gray-600 mb-2">选项统计：</div>
                          {Object.entries(q.optionStats).map(([option, count]: [string, any]) => (
                            <div key={option} className="flex items-center gap-3">
                              <div className="w-24 text-sm text-gray-600">{option}:</div>
                              <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full flex items-center justify-end pr-2 text-white text-xs font-medium transition-all"
                                  style={{ width: `${(count / q.totalAnswers * 100)}%` }}
                                >
                                  {count > 0 && `${count}人`}
                                </div>
                              </div>
                              <div className="w-16 text-sm text-gray-600 text-right">{((count / q.totalAnswers) * 100).toFixed(1)}%</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">暂无答题数据</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherSurvey
