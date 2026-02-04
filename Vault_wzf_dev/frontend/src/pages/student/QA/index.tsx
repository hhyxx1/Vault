import { useState } from 'react'

const StudentQA = () => {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setMessages([...messages, { role: 'user', content: question }])
    setQuestion('')

    // 模拟AI回答
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '这是对您问题的回答。实际应用中会调用AI模型。',
        },
      ])
    }, 1000)
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
                  className={`max-w-[70%] rounded-2xl px-6 py-4 ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
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
