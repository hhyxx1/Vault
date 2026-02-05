import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { studentQAService } from '@/services/student'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: any[]
  timestamp?: string
}

const SharedConversation = () => {
  const { shareCode } = useParams<{ shareCode: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  useEffect(() => {
    const fetchSharedConversation = async () => {
      if (!shareCode) {
        setError('无效的分享链接')
        setLoading(false)
        return
      }

      try {
        const response = await studentQAService.getSharedConversation(shareCode)
        if (response.success) {
          setTitle(response.title || '对话分享')
          setMessages(response.messages || [])
          setCreatedAt(response.created_at || null)
        } else {
          setError(response.error || '获取分享内容失败')
        }
      } catch (err) {
        console.error('获取分享内容失败:', err)
        setError('分享链接已失效或不存在')
      } finally {
        setLoading(false)
      }
    }

    fetchSharedConversation()
  }, [shareCode])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">无法加载分享</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link
            to="/student/qa"
            className="inline-block px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            开始新对话
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold">
                V
              </div>
              <div>
                <h1 className="font-bold text-gray-800">{title}</h1>
                {createdAt && (
                  <p className="text-xs text-gray-400">
                    分享于 {new Date(createdAt).toLocaleString('zh-CN')}
                  </p>
                )}
              </div>
            </div>
            <Link
              to="/student/qa"
              className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              开始新对话
            </Link>
          </div>
        </div>
      </div>

      {/* 对话内容 */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3 flex-shrink-0 text-lg shadow-sm self-start mt-1">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                  {msg.content}
                </p>
                
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200/50">
                    <p className="text-xs font-medium text-gray-500 mb-2">参考资料：</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source: any, sIdx: number) => (
                        <span 
                          key={sIdx}
                          className="text-xs bg-gray-100 border border-gray-200 text-gray-600 px-2 py-1 rounded-md"
                        >
                          <span className="mr-1">📄</span>
                          {source.filename || source.source || '未知来源'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center ml-3 flex-shrink-0 text-sm font-medium text-primary-600 self-start mt-1">
                  U
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-400 mb-4">— 对话结束 —</p>
          <Link
            to="/student/qa"
            className="inline-flex items-center space-x-2 text-primary-500 hover:text-primary-600"
          >
            <span>开始你自己的对话</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SharedConversation
