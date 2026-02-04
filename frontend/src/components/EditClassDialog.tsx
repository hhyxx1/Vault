import { useState, useEffect } from 'react'
import { Class, Course, ClassUpdate } from '../services/teacher'
import { Icon } from './Icon'

interface EditClassDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (classId: string, classData: ClassUpdate) => Promise<void>
  courses: Course[]
  classData: Class | null
}

const EditClassDialog = ({ isOpen, onClose, onSubmit, courses, classData }: EditClassDialogProps) => {
  const [formData, setFormData] = useState({
    class_name: '',
    max_students: 100,
    academic_year: '',
    allow_self_enroll: false
  })
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 当打开对话框时，加载班级数据
  useEffect(() => {
    if (isOpen && classData) {
      setFormData({
        class_name: classData.class_name,
        max_students: classData.max_students,
        academic_year: classData.academic_year,
        allow_self_enroll: classData.allow_self_enroll
      })
      // 加载班级原有的课程
      if (classData.course_ids && classData.course_ids.length > 0) {
        setSelectedCourses(classData.course_ids)
      } else if (classData.course_id) {
        // 兼容旧数据
        setSelectedCourses([classData.course_id])
      } else {
        setSelectedCourses([])
      }
      setError('')
    }
  }, [isOpen, classData])

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
    
    if (!classData) return
    
    setLoading(true)

    try {
      const submitData: ClassUpdate = {
        ...formData,
        course_ids: selectedCourses.length > 0 ? selectedCourses : undefined
      }
      await onSubmit(classData.id, submitData)
      // 成功后关闭对话框
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || '更新班级失败')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !classData) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden transform transition-all scale-100">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 px-6 py-5 overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-40 h-40 bg-black/10 rounded-full blur-2xl"></div>
          
          <div className="relative flex justify-between items-center text-white">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                <Icon name="class" className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">编辑班级</h2>
                <p className="text-sm text-white/80 mt-0.5">修改班级信息和课程设置</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 hover:rotate-90"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(85vh-80px)]">
          <div className="p-6 space-y-5">{error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg flex items-start animate-pulse">
              <Icon name="close" size={20} className="mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">操作失败</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Class Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-800 flex items-center">
              <Icon name="class" className="w-4 h-4 mr-1.5 text-purple-600" />
              班级名称
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.class_name}
              onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:bg-white transition-all duration-200 outline-none text-gray-900 placeholder-gray-400"
              placeholder="例如: 计科2021-1班"
            />
          </div>

          {/* Related Courses */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-800 flex items-center justify-between">
              <span className="flex items-center">
                <Icon name="book" className="w-4 h-4 mr-1.5 text-indigo-600" />
                关联课程
              </span>
              <span className="text-xs font-normal text-gray-500">可选择多个课程</span>
            </label>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-4 max-h-72 overflow-y-auto custom-scrollbar">
              {courses.length === 0 ? (
                <div className="text-center py-8">
                  <Icon name="book" className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">暂无可选课程</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {courses.map(course => (
                    <div
                      key={course.id}
                      onClick={() => handleCourseToggle(course.id)}
                      className={`group flex items-start space-x-3 p-3.5 bg-white rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        selectedCourses.includes(course.id)
                          ? 'border-indigo-500 shadow-md shadow-indigo-100 bg-indigo-50/50'
                          : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all mt-0.5 ${
                        selectedCourses.includes(course.id)
                          ? 'bg-indigo-600 border-indigo-600 scale-110'
                          : 'bg-white border-gray-300 group-hover:border-indigo-400'
                      }`}>
                        {selectedCourses.includes(course.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate transition-colors ${
                          selectedCourses.includes(course.id) ? 'text-indigo-900' : 'text-gray-900'
                        }`}>
                          {course.course_name}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            {course.course_code}
                          </span>
                          <span className="text-xs text-gray-500">{course.semester}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCourses.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-xs font-medium text-indigo-700">
                  已选择 {selectedCourses.length} 个课程
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedCourses([])}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                >
                  清空选择
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Academic Year */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800 flex items-center">
                <Icon name="calendar" className="w-4 h-4 mr-1.5 text-pink-600" />
                学年
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.academic_year}
                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 focus:bg-white transition-all duration-200 outline-none text-gray-900 placeholder-gray-400"
                placeholder="例如: 2025-2026学年第1学期"
              />
              <p className="text-xs text-gray-500">格式：2025-2026学年第x学期（x 为 1 或 2）</p>
            </div>

            {/* Max Students */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-800 flex items-center">
                <Icon name="user" className="w-4 h-4 mr-1.5 text-orange-600" />
                最大学生数
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.max_students}
                onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white transition-all duration-200 outline-none text-gray-900 placeholder-gray-400"
                placeholder="例如: 100"
              />
            </div>
          </div>

          {/* Checkbox */}
          <div 
            className={`flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              formData.allow_self_enroll 
                ? 'bg-purple-50 border-purple-300 shadow-sm' 
                : 'bg-gray-50 border-gray-200 hover:border-purple-300'
            }`}
            onClick={() => setFormData({ ...formData, allow_self_enroll: !formData.allow_self_enroll })}
          >
            <div className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
              formData.allow_self_enroll 
                ? 'bg-purple-600 border-purple-600 shadow-md' 
                : 'bg-white border-gray-300'
            }`}>
              {formData.allow_self_enroll && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold select-none transition-colors ${
                formData.allow_self_enroll ? 'text-purple-900' : 'text-gray-700'
              }`}>
                允许学生通过邀请码自主加入
              </p>
              <p className="text-xs text-gray-500 mt-0.5 select-none">
                开启后学生可使用邀请码自行加入班级
              </p>
            </div>
          </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-gray-700 font-semibold hover:bg-gray-200 transition-all duration-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </>
              ) : (
                <>
                  <Icon name="sparkles" className="w-4 h-4 mr-2" />
                  保存修改
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  )
}

export default EditClassDialog
