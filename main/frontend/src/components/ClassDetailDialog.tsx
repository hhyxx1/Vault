import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { getClassStudents, ClassDetail } from '../services/teacher'

interface ClassDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  classId: string
}

const ClassDetailDialog = ({ isOpen, onClose, classId }: ClassDetailDialogProps) => {
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen && classId) {
      loadClassDetail()
    }
  }, [isOpen, classId])

  const loadClassDetail = async () => {
    try {
      setLoading(true)
      const data = await getClassStudents(classId)
      setClassDetail(data)
    } catch (error) {
      console.error('加载班级详情失败:', error)
      alert('加载班级详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyInviteCode = () => {
    if (classDetail?.invite_code) {
      navigator.clipboard.writeText(classDetail.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* 背景遮罩 */}
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>

        {/* 对话框 */}
        <div
          className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <Icon name="class" size={28} className="mr-3" />
                  班级详情
                </h3>
                {classDetail && (
                  <p className="text-green-100 mt-1 text-sm">{classDetail.class_name} · {classDetail.course_name}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <Icon name="close" size={24} />
              </button>
            </div>
          </div>

          {/* 内容 */}
          <div className="px-6 py-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                <p className="mt-4 text-gray-500">加载中...</p>
              </div>
            ) : classDetail ? (
              <>
                {/* 邀请码区域 */}
                <div className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <Icon name="key" size={16} className="mr-2 text-green-600" />
                        班级邀请码
                      </label>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 bg-white px-6 py-4 rounded-lg border-2 border-green-300 shadow-sm">
                          <p className="text-3xl font-mono font-bold text-green-700 tracking-widest text-center">
                            {classDetail.invite_code}
                          </p>
                        </div>
                        <button
                          onClick={handleCopyInviteCode}
                          className={`px-6 py-4 rounded-lg font-medium transition-all shadow-md flex items-center space-x-2 ${
                            copied
                              ? 'bg-green-100 text-green-700 border-2 border-green-300'
                              : 'bg-green-600 hover:bg-green-700 text-white border-2 border-green-600'
                          }`}
                        >
                          {copied ? (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>已复制</span>
                            </>
                          ) : (
                            <>
                              <Icon name="code" size={20} />
                              <span>复制</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-gray-500 flex items-center">
                        <Icon name="description" size={14} className="mr-1" />
                        学生可使用此邀请码加入班级
                      </p>
                    </div>
                  </div>
                </div>

                {/* 班级统计 */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">学年</p>
                    <p className="text-lg font-bold text-gray-900">{classDetail.academic_year}</p>
                  </div>
                  <div className="bg-white border-2 border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">当前人数</p>
                    <p className="text-lg font-bold text-blue-600">{classDetail.student_count}</p>
                  </div>
                  <div className="bg-white border-2 border-orange-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">容量上限</p>
                    <p className="text-lg font-bold text-orange-600">{classDetail.max_students}</p>
                  </div>
                </div>

                {/* 学生列表 */}
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Icon name="user" size={20} className="mr-2 text-gray-600" />
                    班级学生列表
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({classDetail.students.length} 人)
                    </span>
                  </h4>

                  {classDetail.students.length > 0 ? (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                序号
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                姓名
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                学号
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                专业
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                年级
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                加入日期
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {classDetail.students.map((student, index) => (
                              <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold mr-3">
                                      {student.full_name[0]}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                                      <div className="text-xs text-gray-500">{student.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-mono">
                                  {student.student_number}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {student.major || '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {student.grade || '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {student.enrollment_date}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <Icon name="user" size={48} className="mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-500">暂无学生加入</p>
                      <p className="text-sm text-gray-400 mt-1">分享邀请码给学生加入班级</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">加载失败</div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClassDetailDialog
