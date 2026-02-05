import { useState, useRef, useEffect } from 'react'
import { studentQAService } from '@/services/student'
import { Icon } from '@/components/Icon'

// 增强的 Markdown 渲染函数
const renderMarkdown = (text: string): string => {
  if (!text) return ''
  
  // 先处理代码块，避免内部内容被其他规则处理
  const codeBlocks: string[] = []
  let html = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length
    const langLabel = lang ? `<span class="absolute top-2 right-3 text-xs text-gray-400 font-mono">${lang}</span>` : ''
    codeBlocks.push(`<div class="relative my-4 rounded-xl overflow-hidden bg-[#1e1e2e] shadow-lg">${langLabel}<pre class="p-4 overflow-x-auto text-sm leading-relaxed"><code class="text-gray-100 font-mono">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`)
    return `__CODE_BLOCK_${index}__`
  })
  
  html = html
    // 转义 HTML 特殊字符（代码块已处理）
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 行内代码 (`code`)
    .replace(/`([^`]+)`/g, '<code class="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono text-sm border border-purple-100">$1</code>')
    // 标题
    .replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-gray-700 mt-4 mb-2 flex items-center"><span class="w-1 h-4 bg-gray-300 rounded mr-2"></span>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-800 mt-5 mb-2 flex items-center"><span class="w-1 h-5 bg-blue-400 rounded mr-2"></span>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-800 mt-6 mb-3 pb-2 border-b border-gray-200">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-6 mb-4 pb-2 border-b-2 border-primary-500">$1</h1>')
    // 粗体 (**text** 或 __text__)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/__(.+?)__/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    // 斜体 (*text* 或 _text_)
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em class="italic text-gray-700">$1</em>')
    // 无序列表
    .replace(/^[\*\-] (.+)$/gm, '<li class="flex items-start my-1"><span class="text-primary-500 mr-2 mt-1.5">•</span><span>$1</span></li>')
    // 有序列表
    .replace(/^(\d+)\. (.+)$/gm, '<li class="flex items-start my-1"><span class="text-primary-600 font-medium mr-2 min-w-[1.5rem]">$1.</span><span>$2</span></li>')
    // 引用块
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-blue-400 bg-blue-50 pl-4 py-2 my-3 text-gray-700 italic rounded-r">$1</blockquote>')
    // 分隔线
    .replace(/^---$/gm, '<hr class="my-6 border-gray-200"/>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary-600 hover:text-primary-700 underline">$1</a>')
  
  // 处理连续的列表项，包裹在 ul/ol 中
  html = html.replace(/(<li class="flex items-start my-1"><span class="text-primary-500[^"]*">•<\/span>[\s\S]*?<\/li>(\s*)?)+/g, 
    (match) => `<ul class="my-3 space-y-1">${match}</ul>`)
  html = html.replace(/(<li class="flex items-start my-1"><span class="text-primary-600[^"]*">\d+\.<\/span>[\s\S]*?<\/li>(\s*)?)+/g, 
    (match) => `<ol class="my-3 space-y-1">${match}</ol>`)
  
  // 恢复代码块
  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block)
  })
  
  // 段落处理
  html = html
    .replace(/\n\n+/g, '</p><p class="my-3 leading-relaxed">')
    .replace(/\n/g, '<br/>')
  
  return `<div class="text-gray-800 leading-relaxed"><p class="my-2">${html}</p></div>`
}

interface FileInfo {
  name: string
  size: number
  type: string
  status: 'uploading' | 'parsing' | 'done' | 'error'
  chunkCount?: number
  errorMsg?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: any[]
  intent?: string
  skill_used?: string
  file?: FileInfo  // 文件信息
}

interface SourceDetail {
  source_name: string
  content?: string
  similarity?: number
  filename?: string
  chunk_index?: number
  total_chunks?: number
}

// 获取文件类型图标和颜色
const getFileTypeInfo = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const typeMap: Record<string, { icon: string; color: string; label: string }> = {
    pdf: { icon: '📄', color: 'bg-red-50 border-red-200 text-red-600', label: 'PDF' },
    doc: { icon: '📘', color: 'bg-blue-50 border-blue-200 text-blue-600', label: 'DOC' },
    docx: { icon: '📘', color: 'bg-blue-50 border-blue-200 text-blue-600', label: 'DOCX' },
    ppt: { icon: '📊', color: 'bg-orange-50 border-orange-200 text-orange-600', label: 'PPT' },
    pptx: { icon: '📊', color: 'bg-orange-50 border-orange-200 text-orange-600', label: 'PPTX' },
    txt: { icon: '📝', color: 'bg-gray-50 border-gray-200 text-gray-600', label: 'TXT' },
    md: { icon: '📝', color: 'bg-purple-50 border-purple-200 text-purple-600', label: 'MD' },
    py: { icon: '🐍', color: 'bg-yellow-50 border-yellow-200 text-yellow-700', label: 'Python' },
    js: { icon: '📜', color: 'bg-yellow-50 border-yellow-200 text-yellow-600', label: 'JavaScript' },
    ts: { icon: '📜', color: 'bg-blue-50 border-blue-200 text-blue-600', label: 'TypeScript' },
    java: { icon: '☕', color: 'bg-orange-50 border-orange-200 text-orange-700', label: 'Java' },
    cpp: { icon: '⚙️', color: 'bg-blue-50 border-blue-200 text-blue-700', label: 'C++' },
    c: { icon: '⚙️', color: 'bg-gray-50 border-gray-200 text-gray-700', label: 'C' },
  }
  return typeMap[ext] || { icon: '📎', color: 'bg-gray-50 border-gray-200 text-gray-600', label: ext.toUpperCase() || 'FILE' }
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

const StudentQA = () => {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareInfo, setShareInfo] = useState<{ code: string; url: string } | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [history, setHistory] = useState<any[]>([])
  const [showSourceModal, setShowSourceModal] = useState(false)
  const [selectedSource, setSelectedSource] = useState<SourceDetail | null>(null)
  const [allSources, setAllSources] = useState<SourceDetail[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // 打开资料详情弹窗
  const openSourceModal = (source: SourceDetail, sources: SourceDetail[]) => {
    setSelectedSource(source)
    setAllSources(sources)
    setShowSourceModal(true)
  }

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 创建文件信息
    const fileInfo: FileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading'
    }

    // 先添加带文件卡片的用户消息
    const fileMessageIndex = messages.length
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: '',
        file: fileInfo
      }
    ])

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    if (sessionId) formData.append('session_id', sessionId)

    try {
      // 更新状态为解析中
      setMessages((prev) => {
        const newMessages = [...prev]
        if (newMessages[fileMessageIndex]?.file) {
          newMessages[fileMessageIndex] = {
            ...newMessages[fileMessageIndex],
            file: { ...newMessages[fileMessageIndex].file!, status: 'parsing' }
          }
        }
        return newMessages
      })

      const response = await studentQAService.uploadFile(formData)
      setSessionId(response.session_id)
      
      // 更新文件消息状态为完成
      setMessages((prev) => {
        const newMessages = [...prev]
        if (newMessages[fileMessageIndex]?.file) {
          newMessages[fileMessageIndex] = {
            ...newMessages[fileMessageIndex],
            file: { 
              ...newMessages[fileMessageIndex].file!, 
              status: 'done',
              chunkCount: response.chunk_count || 0
            }
          }
        }
        // 添加助手回复
        newMessages.push({
          role: 'assistant',
          content: `文件解析完成！已成功提取 ${response.chunk_count || 0} 个知识片段。您现在可以针对「${file.name}」的内容进行提问了。`,
        })
        return newMessages
      })
    } catch (error) {
      console.error('文件上传失败:', error)
      // 更新状态为错误
      setMessages((prev) => {
        const newMessages = [...prev]
        if (newMessages[fileMessageIndex]?.file) {
          newMessages[fileMessageIndex] = {
            ...newMessages[fileMessageIndex],
            file: { 
              ...newMessages[fileMessageIndex].file!, 
              status: 'error',
              errorMsg: '上传失败，请重试'
            }
          }
        }
        return newMessages
      })
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || loading) return

    const userMessage = question.trim()
    setMessages([...messages, { role: 'user', content: userMessage }])
    setQuestion('')
    setLoading(true)

    try {
      const response = await studentQAService.ask({
        question: userMessage,
        session_id: sessionId
      })

      setSessionId(response.session_id)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          intent: response.intent,
          skill_used: response.skill_used
        },
      ])
    } catch (error) {
      console.error('问答请求失败:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，我现在遇到了一点问题，请稍后再试。',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = async () => {
    if (messages.length > 0 && sessionId) {
      await loadHistory()
    }
    setMessages([])
    setQuestion('')
    setSessionId(undefined)
    setShareInfo(null)
  }

  const loadHistory = async () => {
    try {
      const data = await studentQAService.getHistory()
      setHistory(data)
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }

  const loadSession = async (sid: string) => {
    try {
      const data = await studentQAService.getSessionMessages(sid)
      setMessages(data.messages || [])
      setSessionId(sid)
    } catch (error) {
      console.error('加载会话失败:', error)
    }
  }

  const handleShare = async () => {
    if (!sessionId || messages.length === 0) {
      alert('当前没有可分享的对话')
      return
    }

    setShareLoading(true)
    try {
      const response = await studentQAService.createShare(sessionId)
      if (response.success && response.share_code) {
        // 使用当前页面的origin，这样在不同环境下都能正确工作
        // 如果需要固定域名，可以在环境变量中配置
        const baseUrl = window.location.origin
        const fullUrl = `${baseUrl}/shared/${response.share_code}`
        
        setShareInfo({
          code: response.share_code,
          url: fullUrl
        })
        setShowShareModal(true)
        
        console.log('分享链接已生成:', fullUrl)
      } else {
        alert(response.error || '分享创建失败')
      }
    } catch (error) {
      console.error('分享失败:', error)
      alert('分享创建失败，请稍后再试')
    } finally {
      setShareLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!shareInfo) return
    try {
      await navigator.clipboard.writeText(shareInfo.url)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      const textArea = document.createElement('textarea')
      textArea.value = shareInfo.url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const getIntentLabel = (intent?: string) => {
    const intentMap: Record<string, string> = {
      'concept_question': '概念解释',
      'code_analysis': '代码分析',
      'problem_solving': '问题解决',
      'learning_advice': '学习建议',
      'general_chat': '一般对话'
    }
    return intent ? intentMap[intent] || intent : null
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // 快捷键 Ctrl + J 开启新对话
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [messages, sessionId])

  return (
    <div className="h-full flex bg-white">
      {/* 左侧历史记录侧边栏 */}
      {showHistory && (
        <div className="w-64 border-r border-gray-200 flex flex-col bg-white">
          {/* 顶部标题 */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-xl font-semibold text-gray-800">智能问答</span>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="收起侧边栏"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="11 17 6 12 11 7"></polyline>
                <polyline points="18 17 13 12 18 7"></polyline>
              </svg>
            </button>
          </div>
          
          {/* 新对话按钮 */}
          <div className="px-3 pb-3">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              <span className="font-medium">开启新对话</span>
              <span className="text-xs text-gray-400 ml-1">Ctrl + J</span>
            </button>
          </div>
          
          {/* 历史记录列表 */}
          <div className="flex-1 overflow-y-auto px-2">
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-4">暂无历史记录</p>
            ) : (
              <div className="space-y-1">
                {history.map((item) => (
                  <button
                    key={item.session_id}
                    onClick={() => loadSession(item.session_id)}
                    className={`w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors ${
                      sessionId === item.session_id ? 'bg-gray-100' : ''
                    }`}
                  >
                    <p className="text-sm text-gray-800 truncate">{item.first_question || '未命名对话'}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 主对话区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center">
            {!showHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="显示历史记录"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {messages.length > 0 && sessionId && (
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="flex items-center space-x-1 px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:opacity-50"
                title="分享对话"
              >
                {shareLoading ? (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                )}
                <span>分享</span>
              </button>
            )}
          </div>
        </div>

        {/* 对话内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* 空状态 - 居中显示欢迎语 */
            <div className="h-full flex flex-col items-center justify-center">
              <div className="flex flex-col items-center animate-fade-in-up">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <Icon name="sparkles" size={32} className="text-amber-500" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center tracking-tight">今天需要我做什么？</h1>
              </div>
            </div>
          ) : (
            /* 消息列表 */
            <div className="w-full px-6 sm:px-12 py-6 space-y-6">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 flex-shrink-0 shadow-sm self-start mt-1">
                      <Icon name="robot" size={20} className="text-primary-500" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${
                      msg.role === 'user'
                        ? msg.file ? 'bg-white border border-gray-200' : 'bg-primary-500 text-white'
                        : 'bg-gray-50 text-gray-800 border border-gray-100'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.file ? (
                        // 文件上传卡片
                        <div className="min-w-[280px]">
                          {(() => {
                            const typeInfo = getFileTypeInfo(msg.file.name)
                            return (
                              <div className={`flex items-center p-3 rounded-xl border ${typeInfo.color}`}>
                                <div className="text-3xl mr-3">{typeInfo.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-800 truncate" title={msg.file.name}>
                                    {msg.file.name}
                                  </p>
                                  <div className="flex items-center text-xs text-gray-500 mt-0.5">
                                    <span className="font-medium">{typeInfo.label}</span>
                                    <span className="mx-1.5">•</span>
                                    <span>{formatFileSize(msg.file.size)}</span>
                                  </div>
                                </div>
                                {/* 状态指示 */}
                                <div className="ml-3 flex-shrink-0">
                                  {msg.file.status === 'uploading' && (
                                    <div className="flex items-center text-blue-500">
                                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    </div>
                                  )}
                                  {msg.file.status === 'parsing' && (
                                    <div className="flex items-center text-amber-500">
                                      <svg className="animate-pulse h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                  )}
                                  {msg.file.status === 'done' && (
                                    <div className="flex items-center text-green-500">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                  {msg.file.status === 'error' && (
                                    <div className="flex items-center text-red-500">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                          {/* 状态文字 */}
                          <div className="mt-2 text-xs text-gray-500 text-right">
                            {msg.file.status === 'uploading' && '正在上传...'}
                            {msg.file.status === 'parsing' && '正在解析文件内容...'}
                            {msg.file.status === 'done' && `已解析 ${msg.file.chunkCount} 个知识片段`}
                            {msg.file.status === 'error' && <span className="text-red-500">{msg.file.errorMsg}</span>}
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{msg.content}</p>
                      )
                    ) : (
                      <div 
                        className="prose prose-sm max-w-none leading-relaxed text-sm sm:text-base"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    )}
                    
                    {msg.role === 'assistant' && (msg.skill_used || msg.intent) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.skill_used && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                            {msg.skill_used}
                          </span>
                        )}
                        {getIntentLabel(msg.intent) && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                            {getIntentLabel(msg.intent)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200/50">
                        <p className="text-xs font-medium text-gray-500 mb-2 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          参考资料：
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.slice(0, 5).map((source: any, sIdx: number) => {
                            const sourceName = source.source_name || source.filename || source.doc_name || 
                              source.title || source.knowledge_point_name || 
                              (source.course_id ? `课程知识库` : '知识库');
                            return (
                              <button 
                                key={sIdx}
                                onClick={() => openSourceModal(source, msg.sources || [])}
                                className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-all cursor-pointer flex items-center group shadow-sm"
                                title="点击查看详情"
                              >
                                <span className="mr-1.5 group-hover:scale-110 transition-transform">📄</span>
                                <span className="max-w-[150px] truncate">{sourceName}</span>
                                {source.similarity && (
                                  <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-[10px] font-medium">
                                    {(source.similarity * 100).toFixed(0)}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {msg.sources.length > 5 && (
                            <button 
                              onClick={() => openSourceModal(msg.sources![5], msg.sources || [])}
                              className="text-xs text-primary-500 hover:text-primary-700 px-2 py-1"
                            >
                              +{msg.sources.length - 5} 更多
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 flex-shrink-0 shadow-sm self-start mt-1">
                    <Icon name="robot" size={20} className="text-primary-500" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 底部输入区域 */}
        <div className="border-t border-gray-100 px-4 sm:px-8 py-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit}>
              <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:border-primary-300 focus-within:shadow-md transition-all">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="请输入您的问题..."
                  className="w-full px-4 py-3 bg-transparent border-none outline-none focus:ring-0 focus:outline-none text-gray-800 placeholder-gray-400 resize-none max-h-32 min-h-[48px]"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                />
                
                <div className="flex justify-between items-center px-3 pb-3">
                  <div className="flex items-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.py,.js,.ts,.tsx,.java,.c,.cpp,.go,.rs,.html,.css,.json,.xml,.md"
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="上传文件"
                      disabled={loading}
                    >
                      <Icon name="attachment" size={20} />
                    </button>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={!question.trim() || loading}
                    className={`p-2 rounded-lg transition-all ${
                      !question.trim() || loading 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-white bg-primary-500 hover:bg-primary-600 shadow-sm'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 分享弹窗 */}
      {showShareModal && shareInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">分享对话</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">分享码</p>
              <div className="bg-gray-100 rounded-lg px-4 py-3 font-mono text-lg text-center font-bold text-primary-600">
                {shareInfo.code}
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">分享链接</p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={shareInfo.url}
                  readOnly
                  className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-600 border-none outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    copySuccess 
                      ? 'bg-green-500 text-white' 
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  {copySuccess ? '已复制!' : '复制'}
                </button>
              </div>
            </div>
            
            <p className="text-xs text-gray-400 text-center">
              分享链接可供他人查看此对话内容
            </p>
          </div>
        </div>
      )}

      {/* 参考资料详情弹窗 */}
      {showSourceModal && selectedSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSourceModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center">
                <span className="text-2xl mr-3">📄</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {selectedSource.source_name || selectedSource.filename || '参考资料'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedSource.similarity && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">
                        相似度 {(selectedSource.similarity * 100).toFixed(1)}%
                      </span>
                    )}
                    {selectedSource.chunk_index !== undefined && selectedSource.total_chunks && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                        第 {selectedSource.chunk_index + 1}/{selectedSource.total_chunks} 部分
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSourceModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {/* 资料内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedSource.content ? (
                <div className="prose prose-sm max-w-none">
                  <div 
                    className="text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-100"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSource.content) }}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-50">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  <p>该资料的详细内容暂未加载</p>
                  <p className="text-sm mt-1">此资料来源于知识库检索</p>
                </div>
              )}
            </div>
            
            {/* 其他相关资料列表 */}
            {allSources.length > 1 && (
              <div className="border-t border-gray-100 px-6 py-4">
                <p className="text-xs font-medium text-gray-500 mb-3">其他相关资料：</p>
                <div className="flex flex-wrap gap-2">
                  {allSources.map((source: any, idx: number) => {
                    const isSelected = source === selectedSource
                    const name = source.source_name || source.filename || `资料 ${idx + 1}`
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedSource(source)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                          isSelected 
                            ? 'bg-primary-500 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <span className="max-w-[120px] truncate inline-block align-middle">{name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentQA
