import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { getCourseDocuments, downloadCourseDocument, CourseDocumentsResponse, CourseDocument } from '../services/student'

interface CourseDocumentsDialogProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
}

const CourseDocumentsDialog = ({ isOpen, onClose, courseId, courseName }: CourseDocumentsDialogProps) => {
  const [courseData, setCourseData] = useState<CourseDocumentsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && courseId) {
      loadDocuments()
    }
  }, [isOpen, courseId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const data = await getCourseDocuments(courseId)
      setCourseData(data)
    } catch (error: any) {
      console.error('加载文档失败:', error)
      alert(error.response?.data?.detail || '加载文档失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string): string => {
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word') || fileType.includes('doc')) return '📝'
    if (fileType.includes('powerpoint') || fileType.includes('ppt')) return '📊'
    if (fileType.includes('text')) return '📃'
    return '📁'
  }

  const handleDownload = (doc: CourseDocument) => {
    const downloadUrl = downloadCourseDocument(courseId, doc.id)
    window.open(downloadUrl, '_blank')
  }

  const handlePreview = (doc: CourseDocument) => {
    // 对于PDF文件，可以直接在浏览器中预览
    if (doc.file_type.includes('pdf')) {
      const downloadUrl = downloadCourseDocument(courseId, doc.id)
      window.open(downloadUrl, '_blank')
    } else {
      alert('此文件类型暂不支持在线预览，请下载后查看')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Icon name="book" size={24} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{courseName}</h2>
                {courseData && (
                  <p className="text-sm text-gray-600 mt-1">
                    教师：{courseData.teacher_name} · {courseData.course_code}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="关闭"
            >
              <Icon name="close" size={24} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-gray-500">加载课程资料中...</p>
              </div>
            </div>
          ) : courseData && courseData.documents.length > 0 ? (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  课程资料 <span className="text-sm font-normal text-gray-500">（共 {courseData.total_count} 个文件）</span>
                </h3>
              </div>

              <div className="space-y-3">
                {courseData.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-gray-50 rounded-xl p-5 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1 min-w-0">
                        <div className="text-4xl flex-shrink-0">
                          {getFileIcon(doc.file_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                            {doc.file_name}
                          </h4>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Icon name="description" size={14} className="mr-1" />
                              {formatFileSize(doc.file_size)}
                            </span>
                            <span className="flex items-center">
                              <Icon name="calendar" size={14} className="mr-1" />
                              {doc.uploaded_at}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                        {doc.file_type.includes('pdf') && (
                          <button
                            onClick={() => handlePreview(doc)}
                            className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-sm font-medium transition-colors flex items-center"
                            title="在线预览"
                          >
                            <Icon name="description" size={16} className="mr-1" />
                            预览
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(doc)}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-colors flex items-center"
                          title="下载到本地"
                        >
                          <Icon name="add" size={16} className="mr-1" />
                          下载
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Icon name="description" size={40} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无课程资料</h3>
              <p className="text-gray-500 text-sm">教师还未上传任何课程资料</p>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="px-8 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CourseDocumentsDialog
