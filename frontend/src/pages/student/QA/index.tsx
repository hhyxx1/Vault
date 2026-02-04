import { useState, useEffect, useRef } from 'react'
import { message, Modal, Input, Button, Collapse } from 'antd'
import { askQuestion, uploadQADocument, createQAShare, getQAHistory, SourceItem } from '@/services/student'

const { Panel } = Collapse

const StudentQA = () => {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; id?: string; sources?: SourceItem[] }>>([])
  const [loading, setLoading] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [shareTitle, setShareTitle] = useState('')
  const [shareDescription, setShareDescription] = useState('')
  const [sharePassword, setSharePassword] = useState('')
  const [sharing, setSharing] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const history = await getQAHistory()
      const formattedMessages: Array<{ role: 'user' | 'assistant'; content: string; id?: string; sources?: SourceItem[] }> = []
      history.forEach(item => {
        formattedMessages.push({ role: 'user', content: item.question, id: item.id })
        formattedMessages.push({ role: 'assistant', content: item.answer, id: item.id })
      })
      setMessages(formattedMessages)
      setHistoryLoaded(true)
      setTimeout(scrollToBottom, 100)
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setMessages([...messages, { role: 'user', content: question }])
    setQuestion('')
    setLoading(true)

    try {
      const response = await askQuestion(question)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          id: response.question_id,
          sources: response.sources
        },
      ])
      setTimeout(scrollToBottom, 100)
    } catch (error) {
      console.error('Error asking question:', error)
      message.error('抱歉，问答服务暂时不可用，请稍后再试。')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，问答服务暂时不可用，请稍后再试。',
        },
      ])
      setTimeout(scrollToBottom, 100)
    } finally {
      setLoading(false)
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setQuestion('')
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      message.warning('请选择要上传的文件')
      return
    }

    setUploading(true)
    try {
      const response = await uploadQADocument(uploadFile)
      message.success(`${response.message} (${response.file_name})`)
      setUploadModalVisible(false)
      setUploadFile(null)
    } catch (error) {
      console.error('上传失败:', error)
      message.error('文件上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleShare = async () => {
    if (!shareTitle.trim()) {
      message.warning('请输入分享标题')
      return
    }

    if (messages.length === 0) {
      message.warning('没有可分享的对话内容')
      return
    }

    const shareData = {
      title: shareTitle,
      description: shareDescription || undefined,
      access_password: sharePassword || undefined,
      limit: Math.max(1, Math.ceil(messages.length / 2))
    }
    
    console.log('分享请求数据:', shareData)

    setSharing(true)
    try {
      const response = await createQAShare(shareData)
      message.success('分享链接已创建')
      setShareModalVisible(false)
      setShareTitle('')
      setShareDescription('')
      setSharePassword('')
      
      const shareUrl = `${window.location.origin}/qa/share/${response.share_code}`
      navigator.clipboard.writeText(shareUrl)
      message.success('分享链接已复制到剪贴板')
    } catch (error) {
      console.error('分享失败:', error)
      message.error('创建分享失败，请重试')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🤖</span>
            <h2 className="text-2xl font-bold text-gray-800">智能问答</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setUploadModalVisible(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              📤 上传文档
            </button>
            <button
              onClick={() => setShareModalVisible(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              🔗 分享对话
            </button>
            <button
              onClick={handleNewChat}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              + 新对话
            </button>
          </div>
        </div>
      </div>

      {/* 对话区域 */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="text-6xl mb-4">💡</div>
            <p className="text-xl font-medium mb-2">今天需要我做什么？</p>
            <p className="text-sm">开始提问吧！</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-6 py-4 ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <Collapse
                      ghost
                      className="mt-4"
                      items={[
                        {
                          key: 'sources',
                          label: `引用来源 (${msg.sources.length})`,
                          children: (
                            <div className="space-y-2 text-sm text-gray-600">
                              {msg.sources.map((source, idx) => (
                                <div key={idx} className="p-2 bg-gray-50 rounded">
                                  <div className="flex justify-between items-start">
                                    <span className="font-medium">{source.file_name}</span>
                                    <span className="text-xs text-gray-400">
                                      {source.page_label ? `页${source.page_label}` : ''}
                                      {source.score && ` · 相似度${(source.score * 100).toFixed(1)}%`}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                                    {source.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="bg-white border-t border-gray-200 px-8 py-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="请输入您的问题..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
              />
            </div>
            <button
            type="submit"
            disabled={!question.trim() || loading}
            className="px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-12 flex items-center justify-center"
          >
            {loading ? '发送中...' : '发送'}
          </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">按 Enter 发送，Shift + Enter 换行</p>
        </form>
      </div>

      {/* 上传文档模态框 */}
      <Modal
        title="上传文档"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false)
          setUploadFile(null)
        }}
        footer={[
          <Button key="cancel" onClick={() => setUploadModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploading}
            onClick={handleUpload}
            disabled={!uploadFile}
          >
            上传
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">选择要上传的文件（PDF、TXT、MD、Python、JS、TS、Java、C、CPP）</p>
            <input
              type="file"
              accept=".pdf,.txt,.md,.py,.js,.ts,.java,.c,.cpp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setUploadFile(file)
                }
              }}
              className="w-full"
            />
          </div>
          {uploadFile && (
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm">
                <strong>文件名：</strong>{uploadFile.name}
              </p>
              <p className="text-sm">
                <strong>大小：</strong>{(uploadFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* 分享对话模态框 */}
      <Modal
        title="分享对话"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setShareModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="share"
            type="primary"
            loading={sharing}
            onClick={handleShare}
            disabled={!shareTitle.trim()}
          >
            创建分享
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分享标题 *
            </label>
            <Input
              value={shareTitle}
              onChange={(e) => setShareTitle(e.target.value)}
              placeholder="例如：Python学习笔记"
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分享描述（可选）
            </label>
            <Input.TextArea
              value={shareDescription}
              onChange={(e) => setShareDescription(e.target.value)}
              placeholder="描述这个对话的内容..."
              rows={3}
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              访问密码（可选）
            </label>
            <Input.Password
              value={sharePassword}
              onChange={(e) => setSharePassword(e.target.value)}
              placeholder="留空则无需密码"
              minLength={4}
              maxLength={20}
            />
          </div>
          <div className="text-xs text-gray-500">
            <p>• 分享链接将复制到剪贴板</p>
            <p>• 默认有效期为24小时</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default StudentQA
