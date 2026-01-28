import { useState } from 'react'
import { Icon } from './Icon'

interface JoinClassDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (inviteCode: string) => Promise<void>
}

const JoinClassDialog = ({ isOpen, onClose, onSubmit }: JoinClassDialogProps) => {
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!inviteCode.trim()) {
      setError('请输入邀请码')
      return
    }
    
    setLoading(true)

    try {
      await onSubmit(inviteCode.trim().toUpperCase())
      setInviteCode('')
      onClose()
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || '加入班级失败，请检查邀请码是否正确'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setInviteCode('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all scale-100 border border-white/20">
        {/* Header with decorative background */}
        <div className="relative bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 px-8 py-6 rounded-t-2xl overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-black/10 rounded-full blur-xl"></div>
          
          <div className="relative flex justify-between items-center text-white">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md flex items-center justify-center">
                <Icon name="add" className="w-6 h-6 text-yellow-300" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">加入班级</h2>
            </div>
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
            >
              <Icon name="close" className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md flex items-start animate-pulse">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 mb-4">
                <Icon name="key" className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-gray-600 text-sm">
                请输入老师提供的班级邀请码以加入班级
              </p>
            </div>

            {/* Invite Code Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block">
                班级邀请码 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none text-center text-2xl font-mono tracking-widest"
                  placeholder="例如: ABC12345"
                  maxLength={8}
                  style={{ letterSpacing: '0.25em' }}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none">
                  <Icon name="key" className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">
                邀请码通常为8位字符
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-4 pt-6 border-t border-gray-100 mt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !inviteCode.trim()}
              className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  加入中...
                </>
              ) : (
                <>
                  <Icon name="add" className="w-4 h-4 mr-2" />
                  立即加入
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default JoinClassDialog
