import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { message, Input, Button, Spin, Empty } from 'antd'
import { getSharedQA } from '@/services/student'
import { SharedSessionResponse, SharedQAItem } from '@/services/student'

const SharedQAView = () => {
  const { shareCode } = useParams<{ shareCode: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [sharedData, setSharedData] = useState<SharedSessionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSharedContent()
  }, [shareCode])

  const loadSharedContent = async (accessPassword?: string) => {
    if (!shareCode) {
      setError('分享链接无效')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await getSharedQA(shareCode, accessPassword)
      setSharedData(data)
      setPasswordRequired(false)
    } catch (err: any) {
      console.error('加载分享内容失败:', err)
      if (err.response?.status === 403) {
        setPasswordRequired(true)
        message.warning('请输入访问密码')
      } else if (err.response?.status === 410) {
        setError('分享链接已过期')
        message.error('分享链接已过期')
      } else if (err.response?.status === 404) {
        setError('分享链接不存在或已失效')
        message.error('分享链接不存在或已失效')
      } else {
        setError('加载失败，请稍后重试')
        message.error('加载失败，请稍后重试')
      }
    } finally {
      setLoading(false)
      setVerifying(false)
    }
  }

  const handleVerifyPassword = () => {
    if (!password.trim()) {
      message.warning('请输入访问密码')
      return
    }
    setVerifying(true)
    loadSharedContent(password)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button type="primary" onClick={() => navigate('/login')}>
            返回登录
          </Button>
        </div>
      </div>
    )
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-6xl mb-4 text-center">🔐</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">需要访问密码</h2>
          <p className="text-gray-600 mb-6 text-center">请输入访问密码以查看分享内容</p>
          <div className="space-y-4">
            <Input.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入访问密码"
              onPressEnter={handleVerifyPassword}
              size="large"
            />
            <Button
              type="primary"
              block
              size="large"
              loading={verifying}
              onClick={handleVerifyPassword}
            >
              验证密码
            </Button>
            <Button
              block
              onClick={() => navigate('/login')}
            >
              返回登录
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!sharedData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Empty description="暂无内容" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{sharedData.title}</h1>
              {sharedData.description && (
                <p className="text-gray-600 mt-1">{sharedData.description}</p>
              )}
            </div>
            <Button onClick={() => navigate('/login')}>
              返回登录
            </Button>
          </div>
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
            <span>👤 {sharedData.sharer_name}</span>
            <span>📅 {new Date(sharedData.created_at).toLocaleString('zh-CN')}</span>
            {sharedData.expires_at && (
              <span>⏰ {new Date(sharedData.expires_at).toLocaleString('zh-CN')} 过期</span>
            )}
            <span>👁️ {sharedData.view_count} 次查看</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-6">
        <div className="space-y-6">
          {sharedData.items.map((item: SharedQAItem, index: number) => (
            <div key={index} className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[70%] bg-primary-500 text-white rounded-2xl px-6 py-4">
                  <p className="whitespace-pre-wrap">{item.question}</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[70%] bg-white border border-gray-200 text-gray-800 shadow-sm rounded-2xl px-6 py-4">
                  <p className="whitespace-pre-wrap">{item.answer}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(item.timestamp).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SharedQAView
