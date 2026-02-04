import { useState, useEffect, useRef } from 'react'
import { studentQAService, QuestionResponse } from '@/services/student'

const StudentQA = () => {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; sources?: any[] }>>([])
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    if (sessionId) formData.append('session_id', sessionId)

    try {
      const response = await studentQAService.uploadFile(formData)
      setSessionId(response.session_id)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `文件「${file.name}」已解析完成！共切分为 ${response.chunk_count} 个知识点。您现在可以针对该文件内容进行提问了。`,
        },
      ])
    } catch (error) {
      console.error('文件上传失败:', error)
      alert('文件上传失败，请稍后再试')
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
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
          sources: response.sources
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

  const handleNewChat = () => {
    setMessages([])
    setQuestion('')
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
          <button
            onClick={handleNewChat}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            + 新对话
          </button>
        </div>
      </div>

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
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
                  className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-2">参考资料：</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, sIdx) => (
                          <span 
                            key={sIdx}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 cursor-help"
                            title={source.content}
                          >
                            📄 {source.source} {source.page ? `(第${source.page}页)` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="bg-white border-t border-gray-200 px-8 py-6">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-4">
            <div className="flex flex-col items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.txt,.py,.js,.ts,.tsx,.java,.c,.cpp"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-primary-500 hover:bg-gray-100 rounded-full transition-colors mb-1"
                title="上传 PDF 或代码文件"
                disabled={loading}
              >
                <span className="text-xl">📎</span>
              </button>
            </div>
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
                    handleSendMessage(e)
                  }
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!question.trim()}
              className="px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-12"
            >
              发送
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">按 Enter 发送，Shift + Enter 换行</p>
        </form>
      </div>
    </div>
  )
}

export default StudentQA
