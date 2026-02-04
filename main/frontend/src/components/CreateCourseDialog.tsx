import { useState } from 'react'
import { CourseCreate } from '../services/teacher'
import { Icon } from './Icon'

interface CreateCourseDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (courseData: CourseCreate) => Promise<void>
}

const CreateCourseDialog = ({ isOpen, onClose, onSubmit }: CreateCourseDialogProps) => {
  const [formData, setFormData] = useState<CourseCreate>({
    course_code: '',
    course_name: '',
    description: '',
    semester: '',
    credit: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onSubmit(formData)
      // 重置表单
      setFormData({
        course_code: '',
        course_name: '',
        description: '',
        semester: '',
        credit: 0
      })
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || '创建课程失败')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all scale-100 border border-white/20">
        {/* Header with decorative background */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6 rounded-t-2xl overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-black/10 rounded-full blur-xl"></div>
          
          <div className="relative flex justify-between items-center text-white">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md flex items-center justify-center">
                <Icon name="sparkles" className="w-6 h-6 text-yellow-300" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">创建新课程</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
            >
              <Icon name="close" className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md flex items-center animate-pulse">
              <Icon name="close" size={20} className="mr-2" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Course Code */}
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-gray-700 block">
                课程代码 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.course_code}
                  onChange={(e) => setFormData({ ...formData, course_code: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none"
                  placeholder="例如: CS101"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none">
                  <Icon name="code" className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Course Name */}
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-gray-700 block">
                课程名称 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.course_name}
                  onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none"
                  placeholder="例如: 数据结构"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none">
                  <Icon name="book" className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 block">
              课程描述
            </label>
            <div className="relative">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none resize-none"
                placeholder="请简要描述课程的主要内容、教学目标等..."
                rows={4}
              />
              <div className="absolute left-3 top-3.5 text-blue-500 pointer-events-none">
                <Icon name="description" className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Semester */}
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-gray-700 block">
                学期 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none"
                  placeholder="例如: 2024春季"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-500 pointer-events-none">
                  <Icon name="calendar" className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Credit */}
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-gray-700 block">
                学分 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  step="0.5"
                  min="0"
                  value={formData.credit}
                  onChange={(e) => setFormData({ ...formData, credit: parseFloat(e.target.value) })}
                  className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none"
                  placeholder="例如: 4.0"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none">
                  <Icon name="award" className="w-4 h-4" />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
                  分
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-4 pt-6 border-t border-gray-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  创建中...
                </>
              ) : (
                <>
                  <Icon name="sparkles" className="w-4 h-4 mr-2" />
                  立即创建
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateCourseDialog