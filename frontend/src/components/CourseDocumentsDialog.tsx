import { useEffect, useState, useRef } from 'react'
import { init as initPptxPreview } from 'pptx-preview'
import { Icon } from './Icon'
import {
  getCourseDocuments,
  downloadCourseDocumentAsBlob,
  getCourseDocumentPreviewPdf,
  CourseDocumentsResponse,
  CourseDocument,
} from '../services/student'

interface CourseDocumentsDialogProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  courseName: string
}

const CourseDocumentsDialog = ({ isOpen, onClose, courseId, courseName }: CourseDocumentsDialogProps) => {
  const [courseData, setCourseData] = useState<CourseDocumentsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  /** 当前在页面内查看的资料：弹窗内直接显示内容 */
  const [viewingDoc, setViewingDoc] = useState<CourseDocument | null>(null)
  const [viewingBlobUrl, setViewingBlobUrl] = useState<string | null>(null)
  const [viewingLoading, setViewingLoading] = useState(false)
  /** 当前是否以 PDF 形式预览（含 PPTX 转 PDF），可显示完整页数 */
  const [viewingAsPdf, setViewingAsPdf] = useState(false)
  const pptxContainerRef = useRef<HTMLDivElement>(null)
  const pptxWrapperRef = useRef<HTMLDivElement>(null)
  const [pptxContainerSize, setPptxContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

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

  const handleDownload = async (doc: CourseDocument) => {
    try {
      setDownloadingId(doc.id)
      const blob = await downloadCourseDocumentAsBlob(courseId, doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name || 'download'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : null
      alert(msg || '下载失败，请重试')
    } finally {
      setDownloadingId(null)
    }
  }

  // 在页面内直接查看：PPTX 优先尝试服务端转 PDF（完整页数），否则用 pptx-preview（可能仅 2 页）
  const handleView = async (doc: CourseDocument) => {
    if (viewingBlobUrl) {
      URL.revokeObjectURL(viewingBlobUrl)
      setViewingBlobUrl(null)
    }
    setViewingDoc(doc)
    setViewingLoading(true)
    setViewingAsPdf(false)

    const isPptx = doc.file_type.includes('ppt') || doc.file_type.includes('powerpoint')
    const isPdf = doc.file_type.includes('pdf')

    try {
      if (isPptx) {
        try {
          const pdfBlob = await getCourseDocumentPreviewPdf(courseId, doc.id)
          const url = URL.createObjectURL(pdfBlob)
          setViewingBlobUrl(url)
          setViewingAsPdf(true)
          return
        } catch {
          // 服务端未装 LibreOffice 或转换失败，回退到 pptx-preview
        }
      }
      const blob = await downloadCourseDocumentAsBlob(courseId, doc.id)
      const url = URL.createObjectURL(blob)
      setViewingBlobUrl(url)
      setViewingAsPdf(isPdf)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : null
      alert(msg || '加载失败，请重试')
      setViewingDoc(null)
    } finally {
      setViewingLoading(false)
    }
  }

  const closeViewer = () => {
    if (viewingBlobUrl) {
      URL.revokeObjectURL(viewingBlobUrl)
      setViewingBlobUrl(null)
    }
    setViewingDoc(null)
    setViewingAsPdf(false)
    setPptxContainerSize({ w: 0, h: 0 })
  }

  const handleClose = () => {
    closeViewer()
    onClose()
  }

  const canPreviewInPage = (fileType: string) => fileType.includes('pdf')
  const canPreviewPptxInPage = (fileType: string) =>
    fileType.includes('ppt') || fileType.includes('powerpoint')

  // 根据 PPT 容器实际尺寸更新宽高，使每页幻灯片完整适配显示
  useEffect(() => {
    if (!viewingDoc || !canPreviewPptxInPage(viewingDoc.file_type) || !pptxWrapperRef.current) return
    const el = pptxWrapperRef.current
    const setSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      setPptxContainerSize((prev) => {
        if (prev.w === width && prev.h === height) return prev
        return { w: Math.floor(width), h: Math.floor(height) }
      })
    }
    setSize(el.clientWidth, el.clientHeight)
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 }
      setSize(width, height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewingDoc?.id, viewingDoc?.file_type])

  // PPTX 页面内预览：容器尺寸未就绪时用默认尺寸，确保内容能显示；有尺寸后按容器适配
  const pptxW = pptxContainerSize.w > 0 ? pptxContainerSize.w : 960
  const pptxH = pptxContainerSize.h > 0 ? pptxContainerSize.h : 540

  useEffect(() => {
    if (
      !viewingDoc ||
      !viewingBlobUrl ||
      !canPreviewPptxInPage(viewingDoc.file_type) ||
      !pptxContainerRef.current
    ) {
      return
    }
    let viewer: ReturnType<typeof initPptxPreview> | null = null
    fetch(viewingBlobUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (!pptxContainerRef.current) return
        viewer = initPptxPreview(pptxContainerRef.current, {
          width: pptxW,
          height: pptxH,
          mode: 'slide',
        })
        return viewer.preview(buf)
      })
      .catch((err) => {
        console.error('PPTX 预览失败:', err)
      })
    return () => {
      if (viewer) viewer.destroy()
    }
  }, [viewingBlobUrl, viewingDoc?.id, viewingDoc?.file_type, pptxW, pptxH])

  if (!isOpen) return null

  const isViewingContent = Boolean(viewingDoc)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-all ${
          isViewingContent
            ? 'min-w-[1000px] max-w-[96vw] w-[min(1000px,96vw)]'
            : 'max-w-4xl'
        }`}
      >
        {/* 标题栏 */}
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Icon name="book" size={24} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{courseName}</h2>
                {courseData && !viewingDoc && (
                  <p className="text-sm text-gray-600 mt-1">
                    教师：{courseData.teacher_name} · {courseData.course_code}
                  </p>
                )}
                {viewingDoc && (
                  <p className="text-sm text-indigo-600 mt-1 truncate max-w-md" title={viewingDoc.file_name}>
                    正在查看：{viewingDoc.file_name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {viewingDoc && (
                <button
                  onClick={closeViewer}
                  className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors flex items-center"
                  title="返回资料列表"
                >
                  <Icon name="chevron-left" size={18} className="mr-1" />
                  返回列表
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="关闭"
              >
                <Icon name="close" size={24} className="text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* 内容区域：列表 或 页面内查看 */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {viewingDoc ? (
            /* 页面内查看：PDF 内嵌显示，其他格式提示下载 */
            <div className="flex-1 flex flex-col min-h-0 p-4">
              {viewingLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
                    <p className="text-gray-500">加载中…</p>
                  </div>
                </div>
              ) : (canPreviewInPage(viewingDoc.file_type) || viewingAsPdf) && viewingBlobUrl ? (
                <div className="flex-1 min-h-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
                  <iframe
                    src={viewingBlobUrl}
                    title={viewingDoc.file_name}
                    className="w-full h-full min-h-[60vh] border-0"
                  />
                </div>
              ) : canPreviewPptxInPage(viewingDoc.file_type) && viewingBlobUrl && !viewingAsPdf ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <p className="text-xs text-amber-600 mb-2 px-1">
                    当前为网页预览，仅显示前 2 页。完整页数请：① 下载到本地用 Office/WPS 打开，或 ② 在<strong>运行后端的电脑</strong>上安装 LibreOffice 后刷新重试（将自动转 PDF 显示全部页）。
                  </p>
                  <div
                    ref={pptxWrapperRef}
                    className="flex-1 min-h-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 flex flex-col"
                  >
                    <div
                      ref={pptxContainerRef}
                      className="flex-1 min-h-0 w-full bg-white rounded shadow-inner"
                      style={{ minHeight: 400 }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center max-w-md">
                    <div className="text-5xl mb-4">📄</div>
                    <p className="text-gray-700 font-medium mb-2">此格式无法在网页内预览</p>
                    <p className="text-gray-500 text-sm mb-6">
                      {viewingDoc.file_name} 需在本地打开，请下载后使用 Office 或 WPS 等软件查看。
                    </p>
                    <button
                      onClick={() => handleDownload(viewingDoc)}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                    >
                      下载到本地
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
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
                      {/* 点击文件名/整块区域直接查看 */}
                      <button
                        type="button"
                        onClick={() => handleView(doc)}
                        disabled={downloadingId !== null}
                        className="flex items-start space-x-4 flex-1 min-w-0 text-left rounded-lg hover:bg-gray-100/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="点击直接查看"
                      >
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
                      </button>

                      {/* 操作按钮 */}
                      <div className="flex items-center space-x-2 flex-shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleView(doc)}
                          disabled={downloadingId !== null}
                          className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-sm font-medium transition-colors flex items-center disabled:opacity-50"
                          title="直接查看"
                        >
                          {downloadingId === doc.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <Icon name="description" size={16} className="mr-1" />
                          )}
                          查看
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId !== null}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-colors flex items-center disabled:opacity-50"
                          title="下载到本地"
                        >
                          {downloadingId === doc.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-1" />
                          ) : (
                            <Icon name="add" size={16} className="mr-1" />
                          )}
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
          )}
        </div>

        {/* 底部按钮栏：仅列表时显示 */}
        {!viewingDoc && (
          <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CourseDocumentsDialog
