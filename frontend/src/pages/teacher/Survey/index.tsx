import { useState, useEffect } from 'react'
import { surveyApi } from '@/services'
import { getTeacherClasses } from '@/services/teacher'
import { getCourseDocuments as getKnowledgeBaseCourseDocuments } from '@/services/teacher'
import ManualQuestionForm, { QuestionFormData as BaseQuestionFormData } from '@/components/ManualQuestionForm'
import { Icon, IconName } from '@/components/Icon'

type ReleaseType = 'in_class' | 'homework' | 'practice' | 'ability_test'

// 扩展QuestionFormData以支持更多题型
interface QuestionFormData extends Omit<BaseQuestionFormData, 'questionType'> {
  questionType: 'single_choice' | 'multiple_choice' | 'judgment' | 'fill_blank' | 'essay' | 'text'
  correctAnswer?: string | string[]
}

type CreateMode = 'manual' | 'ai' | 'knowledge_outline' | 'knowledge_material' | null
type SurveyStatus = 'draft' | 'published'

interface Survey {
  id: string
  title: string
  description: string
  questionCount: number
  status: SurveyStatus
  createdAt: string
  publishedAt?: string
  generationMethod?: string  // manual | ai | knowledge_outline | knowledge_material | word_upload 等
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

/** 去掉选项前的 A. / B. / C. / D. 前缀，选项框内只保留内容 */
function stripOptionPrefix(s: string): string {
  const t = (s ?? '').trim()
  const m = t.match(/^[A-D][\.．]\s*(.*)$/s)
  return m ? m[1].trim() : t
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
  
  // 学生成绩管理相关状态
  const [studentScoresData, setStudentScoresData] = useState<any>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [studentAnswersData, setStudentAnswersData] = useState<any>(null)
  const [showStudentAnswerModal, setShowStudentAnswerModal] = useState(false)
  const [editingScore, setEditingScore] = useState<{questionId: string, score: number} | null>(null)
  const [isPublishingScores, setIsPublishingScores] = useState(false)
  // 发布弹窗：选择班级与发布类型
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishSurveyId, setPublishSurveyId] = useState<string | null>(null)
  const [publishClassIds, setPublishClassIds] = useState<string[]>([])
  const [publishReleaseType, setPublishReleaseType] = useState<ReleaseType>('in_class')
  const [publishStartTime, setPublishStartTime] = useState<string>('')
  const [publishEndTime, setPublishEndTime] = useState<string>('')
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: string; class_name: string; course_name?: string }>>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  
  // AI生成相关状态
  const [aiGeneratedData, setAiGeneratedData] = useState<any>(null)
  const [showAiEditor, setShowAiEditor] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [generateStage, setGenerateStage] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string>('')  // 选中的课程ID（知识库模式必选）
  const [knowledgeSourceType, setKnowledgeSourceType] = useState<'outline' | 'material'>('material')  // 基于大纲知识图谱 / 基于上传资料
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')  // 基于资料时可选：指定某篇资料，空则全部资料
  const [materialDocuments, setMaterialDocuments] = useState<Array<{id: string, file_name: string}>>([])  // 当前课程下的资料列表（仅 material 类型）
  const [courses, setCourses] = useState<Array<{id: string, course_name: string}>>([])  // 课程列表
  
  // 加载课程列表
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/teacher/profile/courses', {
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

  // 基于资料模式且已选课程时，加载该课程下的文档列表（与课程知识库页同一接口，显示所有已上传文档）
  useEffect(() => {
    if (createMode !== 'knowledge_material' || !selectedCourse) {
      setMaterialDocuments([])
      setSelectedDocumentId('')
      return
    }
    const load = async () => {
      try {
        const res = await getKnowledgeBaseCourseDocuments(selectedCourse)
        const docs = (res as any).documents ?? (res as any).data?.documents ?? []
        // 只显示资料（material），不显示大纲（outline）
        const materialOnly = docs.filter((d: any) => (d.document_type || 'material') === 'material')
        const list = materialOnly.map((d: any) => ({ id: d.id, file_name: d.file_name || d.fileName || '未命名' }))
        setMaterialDocuments(list)
        setSelectedDocumentId('')
      } catch (e) {
        console.error('加载资料列表失败:', e)
        setMaterialDocuments([])
        setSelectedDocumentId('')
      }
    }
    load()
  }, [createMode, selectedCourse])
  
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
      id: 'knowledge_outline' as CreateMode,
      title: '基于大纲',
      description: '根据课程大纲中的知识点与知识图谱生成题目',
      iconName: 'book' as IconName,
      color: 'green',
    },
    {
      id: 'knowledge_material' as CreateMode,
      title: '基于资料',
      description: '根据已上传到课程的文档资料生成题目',
      iconName: 'book' as IconName,
      color: 'teal',
    },
  ]

  const isKnowledgeMode = createMode === 'knowledge_outline' || createMode === 'knowledge_material'

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const handleGenerate = async () => {
    if (createMode === 'ai' || isKnowledgeMode) {
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
        // 知识库模式：题型与数量由描述解析，未写则后端默认 20 道、三种题型
        if (selectedCourse) payload.course_id = selectedCourse
        payload.knowledge_source_type = createMode === 'knowledge_outline' ? 'outline' : 'material'
        if (createMode === 'knowledge_material' && selectedDocumentId) payload.document_id = selectedDocumentId
      }
      
      const token = localStorage.getItem('token')
      const baseUrl = '/api'
      
      try {
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
              options: q.options ? q.options.map((opt: string, i: number) => ({
                label: ['A', 'B', 'C', 'D'][i] ?? String.fromCharCode(65 + i),
                text: stripOptionPrefix(opt)
              })) : [],
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
              options: q.options ? q.options.map((opt: string, i: number) => ({
                label: ['A', 'B', 'C', 'D'][i] ?? String.fromCharCode(65 + i),
                text: stripOptionPrefix(opt)
              })) : [],
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
        const generationMethod = aiGeneratedData.generationMethod  // 保留 knowledge_outline | knowledge_material | ai，便于分类与发布限制
        const response = await axios.post(`/api/teacher/survey-generation/save`, {
          survey_title: surveyTitle,
          description: surveyDescription,
          questions: questions,
          generation_method: generationMethod,
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
    setPublishStartTime('')
    setPublishEndTime('')
    const survey = surveys.find((s) => s.id === surveyId)
    // 基于大纲生成的问卷只能发布到「测试能力」
    setPublishReleaseType(survey?.generationMethod === 'knowledge_outline' ? 'ability_test' : 'in_class')
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
    
    // 验证时间设置
    if (publishStartTime && publishEndTime) {
      const start = new Date(publishStartTime)
      const end = new Date(publishEndTime)
      if (start >= end) {
        alert('开始时间必须早于结束时间')
        return
      }
    }
    
    try {
      await surveyApi.publishSurvey(publishSurveyId, {
        classIds: publishClassIds,
        releaseType: publishReleaseType,
        startTime: publishStartTime || undefined,
        endTime: publishEndTime || undefined,
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
      
      // 转换题目数据格式（兼容后端 choice/judge 与 single_choice/judgment）
      const questionsData = data.questions || []
      const questions = questionsData.map((q: any) => {
        const rawType = q.questionType ?? q.question_type
        const normalizedType = rawType === 'choice' ? 'single_choice' : rawType === 'judge' ? 'judgment' : rawType
        const questionData: QuestionFormData = {
          id: q.id,
          questionText: q.questionText ?? q.question_text,
          questionType: normalizedType as QuestionFormData['questionType'],
          score: q.score || 0,
          answerExplanation: q.answerExplanation ?? q.answer_explanation ?? ''
        }
        
        // 处理选择题/判断题选项（AI 生成的 choice/judge 也显示选项）
        if (normalizedType === 'single_choice' || normalizedType === 'multiple_choice' || normalizedType === 'judgment') {
          const opts = q.options ?? []
          if (Array.isArray(opts) && opts.length > 0) {
            const correctAns = q.correctAnswer ?? q.correct_answer
            questionData.options = opts.map((opt: any, optIndex: number) => {
              const raw = typeof opt === 'string' ? opt : (opt.value ?? opt.text ?? '')
              const optKey = typeof opt === 'object' && (opt.key || opt.label) ? (opt.key || opt.label) : (['A', 'B', 'C', 'D'][optIndex] ?? String.fromCharCode(65 + optIndex))
              const optValue = stripOptionPrefix(raw)
              let isCorrect = false
              if (Array.isArray(correctAns)) {
                isCorrect = correctAns.includes(optKey) || correctAns.includes(optValue)
              } else if (correctAns != null && correctAns !== '') {
                isCorrect = correctAns === optKey || correctAns === optValue
              }
              return { key: optKey, value: optValue, isCorrect }
            })
          }
        }
        
        // 处理填空题答案
        if (normalizedType === 'fill_blank') {
          questionData.correctAnswer = q.correctAnswer ?? q.correct_answer
        }
        
        // 处理问答题特殊字段（兼容text和essay两种类型）
        if (normalizedType === 'essay' || normalizedType === 'text') {
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

  // 查看统计 - 获取学生成绩列表
  const handleStats = async (surveyId: string) => {
    try {
      // 获取学生成绩列表
      const scoresData = await surveyApi.getStudentScores(surveyId)
      setStudentScoresData(scoresData)
      
      // 同时获取原有统计数据（题目统计）
      const statsResult = await surveyApi.getSurveyResults(surveyId)
      setStatsData(statsResult)
      
      setShowStatsModal(true)
    } catch (error: any) {
      console.error('获取统计数据失败:', error)
      alert(error.response?.data?.detail || '获取统计数据失败')
    }
  }
  
  // 查看学生答卷详情
  const handleViewStudentAnswer = async (studentId: string) => {
    if (!studentScoresData) return
    try {
      const data = await surveyApi.getStudentAnswers(studentScoresData.surveyId, studentId)
      setStudentAnswersData(data)
      setSelectedStudentId(studentId)
      setShowStudentAnswerModal(true)
    } catch (error: any) {
      console.error('获取学生答卷失败:', error)
      alert(error.response?.data?.detail || '获取学生答卷失败')
    }
  }
  
  // 修改学生某道题的分数
  const handleUpdateQuestionScore = async (questionId: string, newScore: number) => {
    if (!studentScoresData || !selectedStudentId) return
    try {
      await surveyApi.updateQuestionScore(
        studentScoresData.surveyId,
        questionId,
        selectedStudentId,
        newScore
      )
      // 重新加载学生答卷
      const data = await surveyApi.getStudentAnswers(studentScoresData.surveyId, selectedStudentId)
      setStudentAnswersData(data)
      // 重新加载成绩列表
      const scoresData = await surveyApi.getStudentScores(studentScoresData.surveyId)
      setStudentScoresData(scoresData)
      // 同时刷新统计数据（平均分等）
      const statsResult = await surveyApi.getSurveyResults(studentScoresData.surveyId)
      setStatsData(statsResult)
      setEditingScore(null)
      alert('分数修改成功')
    } catch (error: any) {
      console.error('修改分数失败:', error)
      alert(error.response?.data?.detail || '修改分数失败')
    }
  }
  
  // 发布成绩
  const handlePublishScores = async () => {
    if (!studentScoresData) return
    setIsPublishingScores(true)
    try {
      await surveyApi.publishScores(studentScoresData.surveyId)
      // 重新加载数据
      const scoresData = await surveyApi.getStudentScores(studentScoresData.surveyId)
      setStudentScoresData(scoresData)
      // 同时刷新统计数据（平均分等）
      const statsResult = await surveyApi.getSurveyResults(studentScoresData.surveyId)
      setStatsData(statsResult)
      alert('成绩发布成功！学生现在可以查看成绩了。')
    } catch (error: any) {
      console.error('发布成绩失败:', error)
      alert(error.response?.data?.detail || '发布成绩失败')
    } finally {
      setIsPublishingScores(false)
    }
  }
  
  // 取消发布成绩
  const handleUnpublishScores = async () => {
    if (!studentScoresData) return
    if (!confirm('确定要取消发布成绩吗？学生将无法查看成绩。')) return
    setIsPublishingScores(true)
    try {
      await surveyApi.unpublishScores(studentScoresData.surveyId)
      const scoresData = await surveyApi.getStudentScores(studentScoresData.surveyId)
      setStudentScoresData(scoresData)
      // 同时刷新统计数据（平均分等）
      const statsResult = await surveyApi.getSurveyResults(studentScoresData.surveyId)
      setStatsData(statsResult)
      alert('已取消发布成绩')
    } catch (error: any) {
      console.error('取消发布成绩失败:', error)
      alert(error.response?.data?.detail || '取消发布成绩失败')
    } finally {
      setIsPublishingScores(false)
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {creationModes.map((mode) => (
                <div
                  key={mode.id}
                  onClick={() => {
                    setCreateMode(mode.id)
                    if (mode.id === 'knowledge_outline') setKnowledgeSourceType('outline')
                    if (mode.id === 'knowledge_material') setKnowledgeSourceType('material')
                    setShowCreateModal(true)
                  }}
                  className="group bg-white rounded-2xl border-2 border-gray-200 p-8 cursor-pointer transition-all hover:shadow-2xl hover:border-transparent hover:-translate-y-2 relative overflow-hidden"
                >
                  {/* 渐变背景 */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${
                    mode.color === 'blue' ? 'bg-gradient-to-br from-blue-400 to-cyan-400' :
                    mode.color === 'purple' ? 'bg-gradient-to-br from-purple-400 to-pink-400' :
                    mode.color === 'teal' ? 'bg-gradient-to-br from-teal-400 to-cyan-400' :
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
                          mode.color === 'teal' ? 'text-teal-500' :
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
              <div className="space-y-10">
                {[
                  { key: 'manual', title: '手动上传', methodFilter: (m: string) => ['manual', 'word_upload'].includes(m || '') },
                  { key: 'ai', title: 'AI生成', methodFilter: (m: string) => m === 'ai' },
                  { key: 'outline', title: '基于大纲', methodFilter: (m: string) => m === 'knowledge_outline' },
                  { key: 'material', title: '基于资料', methodFilter: (m: string) => ['knowledge_material', 'knowledge_based'].includes(m || '') },
                  { key: 'other', title: '其他', methodFilter: (m: string) => !['manual', 'word_upload', 'ai', 'knowledge_outline', 'knowledge_material', 'knowledge_based'].includes(m || '') },
                ].map((cat) => {
                  const list = surveys.filter((s) => cat.methodFilter(s.generationMethod || 'manual'))
                  if (list.length === 0) return null
                  return (
                    <div key={cat.key}>
                      <h4 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <span>{cat.title}</span>
                        <span className="text-gray-400 font-normal">({list.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {list.map((survey) => (
                          <div
                            key={survey.id}
                            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                          >
                            <div className={`h-2 ${survey.status === 'published' ? 'bg-gradient-to-r from-green-400 to-emerald-400' : 'bg-gradient-to-r from-gray-300 to-gray-400'}`}></div>
                            <div className="p-6">
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="text-lg font-bold text-gray-800 line-clamp-2 flex-1">{survey.title}</h4>
                                {survey.status === 'published' ? (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold ml-2 whitespace-nowrap">已发布</span>
                                ) : (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold ml-2 whitespace-nowrap">草稿</span>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[40px]">{survey.description}</p>
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
                                  <button onClick={() => handleEdit(survey.id)} className="py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-all flex items-center justify-center space-x-1">
                                    <Icon name="description" size={14} /><span>编辑</span>
                                  </button>
                                  <button onClick={() => handleStats(survey.id)} className="py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100 transition-all flex items-center justify-center space-x-1">
                                    <Icon name="dashboard" size={14} /><span>统计</span>
                                  </button>
                                  <button onClick={() => handleDelete(survey.id)} className="py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-all flex items-center justify-center space-x-1">
                                    <Icon name="close" size={14} /><span>删除</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 发布问卷弹窗：选择班级与发布类型 */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden transform transition-all scale-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Icon name="send" size={24} className="text-white" />
                发布问卷
              </h3>
              <p className="text-green-50 text-sm mt-1 opacity-90">
                {publishSurveyId && surveys.find((s) => s.id === publishSurveyId)?.generationMethod === 'knowledge_outline'
                  ? '基于大纲生成的问卷只能发布到「测试能力」'
                  : '将问卷分发给指定班级的学生'}
              </p>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* 班级选择 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <Icon name="class" size={18} className="mr-2 text-green-600" />
                  选择班级 <span className="text-red-500 ml-1">*</span>
                </label>
                
                {loadingClasses ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500 mr-2"></div>
                    加载班级列表...
                  </div>
                ) : teacherClasses.length === 0 ? (
                  <div className="text-center py-8 bg-amber-50 rounded-xl border border-amber-100 text-amber-700">
                    <Icon name="alert-triangle" size={24} className="mx-auto mb-2 opacity-50" />
                    <p>暂无班级，请先在个人资料中创建班级</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teacherClasses.map((cls) => {
                      const isSelected = publishClassIds.includes(cls.id);
                      return (
                        <label 
                          key={cls.id} 
                          className={`
                            relative flex items-center p-3 rounded-xl cursor-pointer border-2 transition-all
                            ${isSelected 
                              ? 'border-green-500 bg-green-50 shadow-sm' 
                              : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm'
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setPublishClassIds([...publishClassIds, cls.id])
                              else setPublishClassIds(publishClassIds.filter((id) => id !== cls.id))
                            }}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'}`}>
                            {isSelected && <Icon name="check-circle" size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${isSelected ? 'text-green-800' : 'text-gray-700'}`}>
                              {cls.class_name}
                            </div>
                            {cls.course_name && (
                              <div className={`text-xs truncate ${isSelected ? 'text-green-600' : 'text-gray-500'}`}>
                                {cls.course_name}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 发布类型 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <Icon name="target" size={18} className="mr-2 text-green-600" />
                  发布类型
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    publishSurveyId && surveys.find((s) => s.id === publishSurveyId)?.generationMethod === 'knowledge_outline'
                      ? [{ value: 'ability_test' as ReleaseType, label: '测试能力', icon: 'target', desc: '用于能力评估' }]
                      : [
                          { value: 'in_class' as ReleaseType, label: '课堂检测', icon: 'check-circle', desc: '课上即时反馈' },
                          { value: 'homework' as ReleaseType, label: '课后作业', icon: 'edit', desc: '课后巩固练习' },
                          { value: 'practice' as ReleaseType, label: '自主练习', icon: 'book', desc: '学生自由练习' },
                        ]
                  ).map((opt) => {
                    const isSelected = publishReleaseType === opt.value;
                    return (
                      <label 
                        key={opt.value} 
                        className={`
                          cursor-pointer rounded-xl border-2 p-3 transition-all flex flex-col items-center text-center
                          ${isSelected 
                            ? 'border-green-500 bg-green-50 text-green-700 shadow-md transform scale-105' 
                            : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:shadow-sm'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name="releaseType"
                          checked={isSelected}
                          onChange={() => setPublishReleaseType(opt.value)}
                          className="sr-only"
                        />
                        <div className={`p-2 rounded-full mb-2 ${isSelected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          <Icon name={opt.icon as IconName} size={20} />
                        </div>
                        <span className="font-bold text-sm mb-0.5">{opt.label}</span>
                        <span className={`text-xs ${isSelected ? 'text-green-600' : 'text-gray-400'}`}>{opt.desc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 时间设置 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <Icon name="clock" size={18} className="mr-2 text-green-600" />
                  答题时间 <span className="text-gray-400 text-xs font-normal ml-2">（可选，不填则立即开放）</span>
                </label>
                
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 ml-1">开始时间</label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={publishStartTime}
                          onChange={(e) => setPublishStartTime(e.target.value)}
                          className="w-full pl-3 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 ml-1">结束时间</label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={publishEndTime}
                          onChange={(e) => setPublishEndTime(e.target.value)}
                          className="w-full pl-3 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 text-xs text-gray-500 bg-white p-3 rounded-lg border border-gray-100">
                    <Icon name="info" size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p>未开始：学生只能看到倒计时</p>
                      <p>进行中：学生可以正常答题</p>
                      <p>已结束：显示“已结束”状态</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShowPublishModal(false); setPublishSurveyId(null) }}
                className="px-5 py-2.5 text-gray-600 hover:bg-white hover:text-gray-800 hover:shadow-sm rounded-xl font-medium transition-all border border-transparent hover:border-gray-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handlePublishConfirm}
                disabled={publishClassIds.length === 0 || loadingClasses}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center"
              >
                <Icon name="send" size={18} className="mr-2" />
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
                  {createMode === 'knowledge_outline' && <><Icon name="book" size={28} className="text-green-500" /> 基于大纲生成</>}
                  {createMode === 'knowledge_material' && <><Icon name="book" size={28} className="text-teal-500" /> 基于资料生成</>}
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
                  {/* 知识库模式（基于大纲/基于资料）：仅显示课程选择与描述等，来源已在入口卡片选定 */}
                  {isKnowledgeMode && (
                    <>
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
                        <p className="mt-2 text-xs text-yellow-600 flex items-start gap-1">
                          <Icon name="info" size={14} className="mt-0.5 flex-shrink-0" />
                          <span>不选则在所有知识库中根据描述检索；选择则仅在该课程知识库中检索</span>
                        </p>
                      </div>
                      {createMode === 'knowledge_material' && selectedCourse && (
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                          <label className="block text-sm font-medium text-teal-800 mb-2">
                            选择资料（可选）
                          </label>
                          <select
                            value={selectedDocumentId}
                            onChange={(e) => setSelectedDocumentId(e.target.value)}
                            className="w-full px-4 py-2 border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                          >
                            <option value="">不指定（该课程下所有资料）</option>
                            {materialDocuments.map(doc => (
                              <option key={doc.id} value={doc.id}>{doc.file_name}</option>
                            ))}
                          </select>
                          <p className="mt-2 text-xs text-teal-600 flex items-start gap-1">
                            <Icon name="info" size={14} className="mt-0.5 flex-shrink-0" />
                            <span>不指定则从该课程全部资料中检索并筛选重要知识点出题；指定则仅从该篇资料出题</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {createMode === 'ai' ? 'AI生成描述' : '生成描述'}
                    </label>
                    <textarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder={
                        createMode === 'ai'
                          ? '例如：生成10道关于操作系统的选择题\n例如：生成5道判断题+5道选择题，关于Python基础语法\n不写数量和题型则默认20题、选择题+判断题+问答题'
                          : '例如：生成15道选择题，涵盖进程管理和内存管理\n不写数量和题型则默认20题、三种题型'
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none min-h-[150px] resize-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500 flex items-start gap-1">
                    <span>💡</span>
                    <span>可在描述中指定题目数量和题型，例如"生成10道选择题"、"5道判断题+5道问答题"。不指定则默认生成20题，包含选择题、判断题、问答题。</span>
                  </p>
                </div>
              )}
            </div>

            {/* 生成中时显示进度条（根据后端阶段更新） */}
            {(createMode === 'ai' || isKnowledgeMode) && isGenerating && (
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
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Icon name="file-text" size={28} className="text-blue-600" />
                    问题预览与编辑
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    共解析出 {parsedQuestions.length} 个问题
                    {parseErrors.length > 0 && (
                      <span className="text-red-500 ml-2 flex items-center inline-flex">
                        <Icon name="alert-triangle" size={16} className="mr-1" />
                        {parseErrors.length} 个问题需要修正
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

                        {/* 选项（单选/多选/判断题）；选项框内只显示内容，不带 A、B、C、D 前缀 */}
                        {(question.questionType === 'single_choice' ||
                          question.questionType === 'multiple_choice' ||
                          question.questionType === 'judgment') && question.options && (
                          <div className="mb-3">
                            <label className="block text-xs text-gray-600 mb-2">选项（框内只填内容，无需写 A、B、C、D）</label>
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
                                    placeholder="选项内容"
                                  />
                                  <label className="flex items-center space-x-1 text-sm text-gray-600">
                                    <input
                                      type={question.questionType === 'multiple_choice' ? 'checkbox' : 'radio'}
                                      name={`question_${qIndex}_correct`}
                                      checked={option.isCorrect || false}
                                      onChange={(e) => {
                                        if (question.questionType === 'single_choice' || question.questionType === 'judgment') {
                                          const updated = [...manualQuestions]
                                          const options = updated[qIndex].options?.map((opt: any, i: number) => ({
                                            ...opt,
                                            isCorrect: i === optIndex
                                          }))
                                          updated[qIndex] = { ...updated[qIndex], options }
                                          setManualQuestions(updated)
                                        } else {
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

      {/* 统计模态框 - 学生成绩列表 */}
      {showStatsModal && studentScoresData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6 rounded-t-2xl z-10">
              <div className="flex items-center justify-between text-white">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Icon name="dashboard" size={28} />
                  成绩管理 - {studentScoresData.surveyTitle}
                </h3>
                <button 
                  onClick={() => {
                    setShowStatsModal(false)
                    setStatsData(null)
                    setStudentScoresData(null)
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-8">
              {/* 顶部操作栏 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 ${
                    studentScoresData.scorePublished 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {studentScoresData.scorePublished ? (
                      <><Icon name="check-circle" size={16} /> 成绩已发布</>
                    ) : (
                      <><Icon name="clock" size={16} /> 成绩未发布</>
                    )}
                  </span>
                  <span className="text-gray-500 text-sm">
                    满分: {studentScoresData.totalScore}分 | 及格线: {studentScoresData.passScore}分
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {studentScoresData.scorePublished ? (
                    <button
                      onClick={handleUnpublishScores}
                      disabled={isPublishingScores}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                      取消发布
                    </button>
                  ) : (
                    <button
                      onClick={handlePublishScores}
                      disabled={isPublishingScores || studentScoresData.totalStudents === 0}
                      className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isPublishingScores ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          处理中...
                        </>
                      ) : (
                        <>
                          <Icon name="check-circle" size={18} />
                          发布成绩
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              
              {/* 总体统计 */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                  <div className="text-sm text-blue-600 font-medium mb-2">总提交数</div>
                  <div className="text-3xl font-bold text-blue-700">{studentScoresData.totalStudents}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                  <div className="text-sm text-green-600 font-medium mb-2">平均分</div>
                  <div className="text-3xl font-bold text-green-700">{statsData?.avgScore || '-'}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                  <div className="text-sm text-purple-600 font-medium mb-2">通过人数</div>
                  <div className="text-3xl font-bold text-purple-700">{statsData?.passCount || 0}</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl">
                  <div className="text-sm text-orange-600 font-medium mb-2">通过率</div>
                  <div className="text-3xl font-bold text-orange-700">{statsData?.passRate || 0}%</div>
                </div>
              </div>

              {/* 学生成绩列表 */}
              <div className="space-y-4">
                <h4 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Icon name="user" size={24} className="text-gray-600" />
                  学生成绩列表
                </h4>
                
                {studentScoresData.students && studentScoresData.students.length > 0 ? (
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">学号</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">姓名</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">提交时间</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">得分</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">状态</th>
                          <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {studentScoresData.students.map((student: any) => (
                          <tr key={student.responseId} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4 text-sm text-gray-800 font-medium">{student.studentNumber}</td>
                            <td className="px-6 py-4 text-sm text-gray-800">{student.studentName}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 text-center">
                              {student.submitTime ? new Date(student.submitTime).toLocaleString('zh-CN') : '-'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-lg font-bold ${
                                student.isPassed ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {student.totalScore !== null ? student.totalScore.toFixed(1) : '-'}
                              </span>
                              <span className="text-gray-400 text-sm">/{studentScoresData.totalScore}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {student.isPassed !== null ? (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  student.isPassed 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {student.isPassed ? '及格' : '不及格'}
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  待评分
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handleViewStudentAnswer(student.studentId)}
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-all"
                              >
                                查看答卷
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-xl">
                    <Icon name="file-text" size={48} className="text-gray-300 mx-auto mb-4" />
                    <p>暂无学生提交答卷</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 学生答卷详情模态框 */}
      {showStudentAnswerModal && studentAnswersData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 rounded-t-2xl z-10">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Icon name="file-text" size={24} />
                    {studentAnswersData.studentName} 的答卷
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    学号: {studentAnswersData.studentNumber} | 提交时间: {studentAnswersData.submitTime ? new Date(studentAnswersData.submitTime).toLocaleString('zh-CN') : '-'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowStudentAnswerModal(false)
                    setStudentAnswersData(null)
                    setSelectedStudentId(null)
                    setEditingScore(null)
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-8">
              {/* 总分信息 */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-6 mb-6">
                <div>
                  <span className="text-gray-600 text-sm">总分</span>
                  <div className="text-3xl font-bold text-gray-800">
                    {studentAnswersData.totalScore !== null ? studentAnswersData.totalScore.toFixed(1) : '-'}
                    <span className="text-lg text-gray-400 font-normal">/{studentAnswersData.surveyTotalScore}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-gray-600 text-sm">得分率</span>
                  <div className={`text-2xl font-bold ${
                    studentAnswersData.isPassed ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {studentAnswersData.percentageScore !== null ? studentAnswersData.percentageScore.toFixed(1) : '-'}%
                  </div>
                </div>
                <div>
                  {studentAnswersData.isPassed !== null && (
                    <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                      studentAnswersData.isPassed 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {studentAnswersData.isPassed ? '及格' : '不及格'}
                    </span>
                  )}
                </div>
              </div>
              
              {/* 答题详情 */}
              <div className="space-y-6">
                {studentAnswersData.questions?.map((q: any, index: number) => (
                  <div key={q.questionId} className="bg-gray-50 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            第{index + 1}题
                          </span>
                          <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs">
                            {q.questionType === 'single_choice' ? '单选题' : 
                             q.questionType === 'multiple_choice' ? '多选题' :
                             q.questionType === 'judgment' ? '判断题' :
                             q.questionType === 'essay' ? '问答题' : q.questionType}
                          </span>
                          {q.isCorrect !== null && (
                            <span className={`px-2 py-1 rounded text-xs font-medium flex items-center ${
                              q.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {q.isCorrect ? <><Icon name="check-circle" size={12} className="mr-1" /> 正确</> : <><Icon name="close" size={12} className="mr-1" /> 错误</>}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800 font-medium">{q.questionText}</p>
                      </div>
                      <div className="text-right ml-4">
                        {editingScore?.questionId === q.questionId ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max={q.maxScore}
                              step="0.5"
                              value={editingScore.score}
                              onChange={(e) => setEditingScore({
                                ...editingScore,
                                score: parseFloat(e.target.value) || 0
                              })}
                              className="w-20 px-2 py-1 border rounded text-center"
                            />
                            <button
                              onClick={() => handleUpdateQuestionScore(q.questionId, editingScore.score)}
                              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingScore(null)}
                              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`text-xl font-bold ${
                              q.score >= q.maxScore * 0.6 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {q.score}
                            </span>
                            <span className="text-gray-400">/{q.maxScore}</span>
                            <button
                              onClick={() => setEditingScore({ questionId: q.questionId, score: q.score })}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="修改分数"
                            >
                              <Icon name="edit" size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 选项（如果有） */}
                    {q.options && q.options.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {q.options.map((opt: any, optIndex: number) => {
                          // 处理选项显示格式
                          const optionKey = typeof opt === 'object' ? opt.key : String.fromCharCode(65 + optIndex) // A, B, C, D...
                          const optionValue = typeof opt === 'object' ? opt.value : opt
                          const optionLabel = `${optionKey}. ${optionValue}`
                          
                          // 判断学生是否选择了这个选项
                          const checkStudentSelected = () => {
                            if (!q.studentAnswer) return false
                            const answer = q.studentAnswer
                            if (Array.isArray(answer)) {
                              // 多选题
                              return answer.some((a: string) => {
                                const aStr = String(a).trim().toUpperCase()
                                return aStr === optionKey.toUpperCase() || 
                                       aStr.startsWith(optionKey.toUpperCase() + '.') ||
                                       aStr === optionValue ||
                                       aStr.includes(optionValue)
                              })
                            } else {
                              // 单选题
                              const aStr = String(answer).trim().toUpperCase()
                              return aStr === optionKey.toUpperCase() || 
                                     aStr.startsWith(optionKey.toUpperCase() + '.') ||
                                     aStr === optionValue.toUpperCase() ||
                                     aStr.includes(optionValue)
                            }
                          }
                          
                          // 判断这个选项是否是正确答案
                          const checkIsCorrect = () => {
                            if (!q.correctAnswer) return false
                            const correct = q.correctAnswer
                            if (Array.isArray(correct)) {
                              // 多选题正确答案
                              return correct.some((c: string) => {
                                const cStr = String(c).trim().toUpperCase()
                                return cStr === optionKey.toUpperCase() || 
                                       cStr.startsWith(optionKey.toUpperCase() + '.') ||
                                       cStr === optionValue.toUpperCase()
                              })
                            } else {
                              // 单选题正确答案
                              const cStr = String(correct).trim().toUpperCase()
                              return cStr === optionKey.toUpperCase() || 
                                     cStr.startsWith(optionKey.toUpperCase() + '.') ||
                                     cStr === optionValue.toUpperCase()
                            }
                          }
                          
                          const isSelected = checkStudentSelected()
                          const isCorrect = checkIsCorrect()
                          
                          return (
                            <div
                              key={optIndex}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                isSelected && isCorrect 
                                  ? 'bg-green-100 border-green-500 shadow-sm' 
                                  : isSelected && !isCorrect 
                                    ? 'bg-red-100 border-red-500 shadow-sm' 
                                    : isCorrect 
                                      ? 'bg-green-50 border-green-400 border-dashed' 
                                      : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`flex-1 ${
                                  isSelected ? 'font-semibold' : ''
                                } ${
                                  isCorrect ? 'text-green-700' : isSelected ? 'text-red-700' : 'text-gray-700'
                                }`}>
                                  {optionLabel}
                                </span>
                                <div className="flex items-center gap-2 ml-3">
                                  {isSelected && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                                      isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                    }`}>
                                      <Icon name={isCorrect ? 'check-circle' : 'close'} size={12} />
                                      学生选择
                                    </span>
                                  )}
                                  {isCorrect && !isSelected && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800 flex items-center gap-1">
                                      <Icon name="check-circle" size={12} />
                                      正确答案
                                    </span>
                                  )}
                                  {isCorrect && isSelected && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800 flex items-center gap-1">
                                      <Icon name="check-circle" size={12} />
                                      正确
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    {/* 判断题特殊处理 */}
                    {q.questionType === 'judgment' && !q.options && (
                      <div className="mb-4 space-y-2">
                        {['正确', '错误'].map((option, optIndex) => {
                          const optionKey = optIndex === 0 ? 'true' : 'false'
                          const studentAnswerStr = String(q.studentAnswer || '').toLowerCase()
                          const correctAnswerStr = String(q.correctAnswer || '').toLowerCase()
                          
                          const isSelected = studentAnswerStr === optionKey || 
                                            studentAnswerStr === option ||
                                            (optIndex === 0 && (studentAnswerStr === '对' || studentAnswerStr === '是')) ||
                                            (optIndex === 1 && (studentAnswerStr === '错' || studentAnswerStr === '否'))
                          
                          const isCorrect = correctAnswerStr === optionKey || 
                                           correctAnswerStr === option ||
                                           (optIndex === 0 && (correctAnswerStr === '对' || correctAnswerStr === '是' || correctAnswerStr === 'true')) ||
                                           (optIndex === 1 && (correctAnswerStr === '错' || correctAnswerStr === '否' || correctAnswerStr === 'false'))
                          
                          return (
                            <div
                              key={optIndex}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                isSelected && isCorrect 
                                  ? 'bg-green-100 border-green-500 shadow-sm' 
                                  : isSelected && !isCorrect 
                                    ? 'bg-red-100 border-red-500 shadow-sm' 
                                    : isCorrect 
                                      ? 'bg-green-50 border-green-400 border-dashed' 
                                      : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`flex-1 ${
                                  isSelected ? 'font-semibold' : ''
                                } ${
                                  isCorrect ? 'text-green-700' : isSelected ? 'text-red-700' : 'text-gray-700'
                                }`}>
                                  {option}
                                </span>
                                <div className="flex items-center gap-2 ml-3">
                                  {isSelected && (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                                      isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                    }`}>
                                      <Icon name={isCorrect ? 'check-circle' : 'close'} size={12} />
                                      学生选择
                                    </span>
                                  )}
                                  {isCorrect && !isSelected && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800 flex items-center gap-1">
                                      <Icon name="check-circle" size={12} />
                                      正确答案
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    {/* 问答题答案 */}
                    {q.questionType === 'essay' && (
                      <div className="space-y-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-500 mb-2">学生答案：</div>
                          <p className="text-gray-800 whitespace-pre-wrap">{q.studentAnswer || '(未作答)'}</p>
                        </div>
                        {q.correctAnswer && (
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="text-sm text-green-600 mb-2">参考答案：</div>
                            <p className="text-green-800 whitespace-pre-wrap">{q.correctAnswer}</p>
                          </div>
                        )}
                        {q.gradingResult && (
                          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                            <div className="text-sm text-indigo-600 mb-2 font-medium flex items-center gap-2">
                              <Icon name="sparkles" size={16} className="text-indigo-500" />
                              AI 评分反馈
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <span className="text-gray-500 text-sm">评分等级：</span>
                                <span className="ml-2 font-medium text-indigo-700">{q.gradingResult.level}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-sm">得分：</span>
                                <span className="ml-2 font-medium text-indigo-700">
                                  {q.gradingResult.score}/{q.gradingResult.max_score}
                                </span>
                              </div>
                            </div>
                            {q.gradingResult.strengths && q.gradingResult.strengths.length > 0 && (
                              <div className="mb-2">
                                <span className="text-green-600 text-sm font-medium">优点：</span>
                                <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                                  {q.gradingResult.strengths.map((s: string, i: number) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {q.gradingResult.improvements && q.gradingResult.improvements.length > 0 && (
                              <div>
                                <span className="text-orange-600 text-sm font-medium">改进建议：</span>
                                <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                                  {q.gradingResult.improvements.map((s: string, i: number) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherSurvey
