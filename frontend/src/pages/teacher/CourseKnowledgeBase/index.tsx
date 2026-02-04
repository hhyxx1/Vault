import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  getCourseDocuments, 
  deleteDocument,
  CourseDocumentsResponse,
  DocumentResponse 
} from '../../../services/teacher'
import { Icon } from '../../../components/Icon'
import DocumentUpload from '../../../components/DocumentUpload'

const CourseKnowledgeBase = () => {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(false)
  const [courseData, setCourseData] = useState<CourseDocumentsResponse | null>(null)

  // 加载课程文档
  const loadDocuments = async () => {
    if (!courseId) return
    
    try {
      setLoading(true)
      const data = await getCourseDocuments(courseId)
      setCourseData(data)
    } catch (error) {
      console.error('加载文档失败:', error)
      alert('加载文档失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [courseId])

  // 删除文档
  const handleDeleteDocument = async (doc: DocumentResponse) => {
    if (!window.confirm(`确定要删除文档「${doc.file_name}」吗？`)) return

    try {
      await deleteDocument(doc.id)
      alert('文档删除成功！')
      await loadDocuments()
    } catch (error: any) {
      console.error('删除文档失败:', error)
      alert(`删除文档失败: ${error.response?.data?.detail || error.message || '未知错误'}`)
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  // 获取文件类型图标
  const getFileIcon = (fileType: string) => {
    if (fileType === '.pdf') return 'description'
    if (['.doc', '.docx'].includes(fileType)) return 'description'
    if (['.ppt', '.pptx'].includes(fileType)) return 'description'
    return 'description'
  }

  // 获取文件类型颜色
  const getFileTypeColor = (fileType: string) => {
    if (fileType === '.pdf') return 'bg-red-100 text-red-600'
    if (['.doc', '.docx'].includes(fileType)) return 'bg-blue-100 text-blue-600'
    if (['.ppt', '.pptx'].includes(fileType)) return 'bg-orange-100 text-orange-600'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* 顶部背景 */}
      <div className="h-48 bg-gradient-to-r from-blue-600 to-indigo-700 w-full absolute top-0 left-0 z-0"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        {/* 返回按钮和标题 */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/teacher/profile')}
            className="inline-flex items-center px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors mb-4 shadow-sm font-medium"
          >
            <Icon name="arrow_back" size={20} className="mr-2" />
            返回个人中心
          </button>
          
          {courseData && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{courseData.course_name}</h1>
                  <p className="text-gray-500 mt-2">课程知识库管理</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">文档总数</p>
                  <p className="text-3xl font-bold text-indigo-600">{courseData.document_count}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 主内容区 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">知识库文档</h3>
            
            {/* 文档上传组件 */}
            {courseId && (
              <DocumentUpload 
                courseId={courseId} 
                onUploadComplete={loadDocuments}
              />
            )}

            {/* 文档列表 */}
            <div className="mt-8">
              {loading ? (
                <div className="text-center py-12 text-gray-500">加载中...</div>
              ) : !courseData || courseData.documents.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <Icon name="description" size={48} className="mx-auto text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无文档</h3>
                  <p className="mt-1 text-sm text-gray-500">点击上方按钮上传课程资料到知识库</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {courseData.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                          <div className={`p-3 rounded-lg ${getFileTypeColor(doc.file_type)}`}>
                            <Icon name={getFileIcon(doc.file_type)} size={24} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-gray-900 truncate">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-500">
                                {formatFileSize(doc.file_size)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(doc.created_at).toLocaleString('zh-CN')}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                doc.upload_status === 'completed' 
                                  ? 'bg-green-100 text-green-600' 
                                  : 'bg-yellow-100 text-yellow-600'
                              }`}>
                                {doc.upload_status === 'completed' ? '已上传' : '处理中'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="删除文档"
                          >
                            <Icon name="close" size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <Icon name="description" size={20} className="text-blue-600 mr-3 flex-shrink-0" />
              <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">知识库说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>支持上传 PDF、Word、PowerPoint、TXT、MD 等格式的文档</li>
                <li>单个文件大小不超过 50MB</li>
                <li>支持单个上传或批量上传多个文件</li>
                <li>每个课程拥有独立的知识库集合，实现课程间知识隔离</li>
                <li>上传的文档将自动提取内容并向量化，用于智能问答和内容检索</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CourseKnowledgeBase
