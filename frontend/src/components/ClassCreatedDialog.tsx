import { Icon } from './Icon'

interface ClassCreatedDialogProps {
  isOpen: boolean
  onClose: () => void
  className: string
  inviteCode: string
  courseName: string
}

const ClassCreatedDialog = ({ isOpen, onClose, className, inviteCode, courseName }: ClassCreatedDialogProps) => {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode)
    // 可以添加一个Toast提示，这里暂时用alert
    // alert('邀请码已复制到剪贴板！')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all scale-100 border border-white/20 overflow-hidden">
        {/* Header with success indicator */}
        <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-8 py-8 text-center overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-md mb-4 shadow-lg ring-4 ring-white/10 flex items-center justify-center">
              <Icon name="sparkles" className="w-8 h-8 text-yellow-300" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight shadow-sm">班级创建成功！</h2>
          </div>
        </div>
        
        <div className="p-8 space-y-8">
          {/* Success Message */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2 text-gray-700">
              <Icon name="class" className="w-5 h-5 text-emerald-500" />
              <span className="text-base">
                班级 <span className="font-bold text-gray-900">{className}</span> 已就绪
              </span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-gray-700">
              <Icon name="book" className="w-5 h-5 text-emerald-500" />
              <span className="text-base">所属课程：{courseName}</span>
            </div>
          </div>

          {/* Invite Code Display */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-1 border border-indigo-100 shadow-sm relative group mt-2">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-sm border border-indigo-100 flex items-center justify-center">
              <Icon name="password" className="w-5 h-5 text-indigo-500" />
            </div>
            
            <div className="bg-white/60 rounded-xl p-6 text-center backdrop-blur-sm pt-8">
              <div className="text-xs font-bold text-indigo-600 tracking-wide uppercase mb-2">班级邀请码</div>
              <div 
                className="text-4xl font-mono font-bold tracking-[0.2em] text-indigo-600 select-all cursor-pointer hover:text-indigo-700 transition-colors py-2"
                onClick={handleCopyCode}
                title="点击复制"
              >
                {inviteCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="mt-4 inline-flex items-center px-4 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold rounded-lg transition-colors duration-200 gap-1.5"
              >
                <Icon name="code" className="w-3.5 h-3.5" />
                复制邀请码
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Icon name="description" className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-sm text-amber-800 leading-relaxed">
              <span className="font-bold text-amber-900">温馨提示：</span> 
              请将上方的邀请码分享给您的学生。学生在加入班级时输入此验证码，即可自动完成入班流程。
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>我知道了</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClassCreatedDialog