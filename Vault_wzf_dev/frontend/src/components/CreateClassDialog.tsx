import { useState, useEffect } from 'react'
import { ClassCreate, Course } from '../services/teacher'
import { Icon } from './Icon'

interface CreateClassDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (classData: ClassCreate) => Promise<void>
  courses: Course[]
}

const CreateClassDialog = ({ isOpen, onClose, onSubmit, courses }: CreateClassDialogProps) => {
  const [formData, setFormData] = useState<ClassCreate>({
    class_name: '',
    course_id: '',
    max_students: 100,
    academic_year: '',
    allow_self_enroll: false
  })
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 重置表单
  useEffect(() => {
    if (isOpen) {
      setSelectedCourses([])
      setFormData({
        class_name: '',
        course_id: '',
        max_students: 100,
        academic_year: '',
        allow_self_enroll: false
      })
    }
  }, [isOpen])

  // 处理课程选择
  const handleCourseToggle = (courseId: string) => {
    setSelectedCourses(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId)
      } else {
        return [...prev, courseId]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (selectedCourses.length === 0) {
      setError('请至少选择一个课程')
      return
    }
    
    setLoading(true)

    try {
      // 将选中的课程ID数组传递给后端
      const submitData = {
        ...formData,
        course_ids: selectedCourses
      }
      await onSubmit(submitData as any)
      // 重置表单
      setFormData({
        class_name: '',
        course_id: '',
        max_students: 100,
        academic_year: '',
        allow_self_enroll: false
      })
      setSelectedCourses([])
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || '创建班级失败')
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
              <h2 className="text-2xl font-bold tracking-tight">创建新班级</h2>
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

          {courses.length === 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 px-4 py-3 rounded-md flex items-center">
              <Icon name="book" className="w-5 h-5 mr-2" />
              请先创建课程，才能创建班级
            </div>
          )}

          {/* Class Name */}
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 block">
              班级名称 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none"
                placeholder="例如: 计科2021-1班"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none">
                <Icon name="class" className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Related Course */}
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 block">
              关联课程 <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">(可选择多个)</span>
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-64 overflow-y-auto">
              {courses.length === 0 ? (
                <p className="text-sm text-gray-500">暂无可选课程</p>
              ) : (
                <div className="space-y-2">
                  {courses.map(course => (
                    <div
                      key={course.id}
                      onClick={() => handleCourseToggle(course.id)}
                      className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 cursor-pointer transition-all"
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                        selectedCourses.includes(course.id) 
                          ? 'bg-indigo-600 border-indigo-600' 
                          : 'bg-white border-gray-300'
                      }`}>
                        {selectedCourses.includes(course.id) && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{course.course_name}</p>
                        <p className="text-xs text-gray-500">{course.course_code} • {course.semester}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCourses.length > 0 && (
              <p className="text-xs text-indigo-600 mt-2">
                已选择 {selectedCourses.length} 个课程
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Academic Year */}
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-gray-700 block">
                学年 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none"
                  placeholder="例如: 2025-2026学年第1学期"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-500 pointer-events-none">
                  <Icon name="calendar" className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs text-gray-500">格式：2025-2026学年第x学期（x 为 1 或 2）</p>
            </div>

            {/* Max Students */}
            <div className="space-y-2 group">
              <label className="text-sm font-medium text-gray-700 block">
                最大学生数 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.max_students}
                  onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:bg-white transition-all duration-200 outline-none"
                  placeholder="例如: 100"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none">
                  <Icon name="user" className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-xl border border-gray-200 hover:border-purple-200 transition-colors cursor-pointer" onClick={() => setFormData({ ...formData, allow_self_enroll: !formData.allow_self_enroll })}>
            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${formData.allow_self_enroll ? 'bg-purple-600 border-purple-600' : 'bg-white border-gray-300'}`}>
              {formData.allow_self_enroll && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700 font-medium select-none">
              允许学生通过邀请码自主加入
            </span>
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
              disabled={loading || courses.length === 0 || selectedCourses.length === 0}
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

export default CreateClassDialog