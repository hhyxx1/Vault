import { useState, useEffect } from 'react'
import { Icon } from '../../../components/Icon'
import { getDashboardOverview, DashboardOverview } from '../../../services/teacher'

const EnhancedDashboard = () => {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHeaderModal, setShowHeaderModal] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name', 'questionCount', 'participationRate', 'avgScore', 'lastActive'
  ])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const overview = await getDashboardOverview()
      setData(overview)
    } catch (error) {
      console.error('获取看板数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const allColumns = [
    { key: 'name', label: '学生姓名' },
    { key: 'questionCount', label: '提问次数' },
    { key: 'participationRate', label: '参与度' },
    { key: 'avgScore', label: '平均分' },
    { key: 'lastActive', label: '最后活跃' }
  ]

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">暂无数据</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      {/* 顶部 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">教师看板</h2>
            <p className="text-gray-500 text-sm mt-1">实时监控班级学情与数据分析</p>
          </div>
          <button
            onClick={() => setShowHeaderModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            自定义表头
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">学生总数</p>
                <Icon name="class" size={20} className="text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-gray-800">{data.stats.total_students}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">总提问数</p>
                <Icon name="description" size={20} className="text-green-500" />
              </div>
              <p className="text-3xl font-bold text-gray-800">{data.stats.total_questions}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">平均参与度</p>
                <Icon name="sparkles" size={20} className="text-purple-500" />
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {(data.stats.avg_participation_rate * 100).toFixed(0)}%
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">活跃学生</p>
                <Icon name="award" size={20} className="text-orange-500" />
              </div>
              <p className="text-3xl font-bold text-gray-800">{data.stats.active_students}</p>
            </div>
          </div>

          {/* 图表区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 提问趋势 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">提问趋势</h3>
              <div className="space-y-2">
                {data.question_trend.map((item, index) => {
                  const maxCount = Math.max(...data.question_trend.map(t => t.count))
                  const width = maxCount > 0 ? (item.count / maxCount) * 100 : 0
                  return (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="text-xs text-gray-600 w-20">{item.date.slice(5)}</div>
                      <div className="flex-1">
                        <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-lg flex items-center justify-end pr-2"
                            style={{ width: `${width}%` }}
                          >
                            {item.count > 0 && (
                              <span className="text-xs text-white font-medium">{item.count}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 问题分类分布 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">问题分类分布</h3>
              <div className="space-y-3">
                {data.category_distribution.map((item, index) => {
                  const total = data.category_distribution.reduce((sum, cat) => sum + cat.count, 0)
                  const percentage = total > 0 ? (item.count / total) * 100 : 0
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500']
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{item.category}</span>
                        <span className="text-sm font-medium text-gray-800">{item.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${colors[index % colors.length]} rounded-full`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 学生数据表格 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">学生数据统计</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {allColumns.filter(col => visibleColumns.includes(col.key)).map(col => (
                      <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.student_stats.map((student, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {visibleColumns.includes('name') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.student_name}
                        </td>
                      )}
                      {visibleColumns.includes('questionCount') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {student.question_count}
                        </td>
                      )}
                      {visibleColumns.includes('participationRate') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {(student.participation_rate * 100).toFixed(0)}%
                        </td>
                      )}
                      {visibleColumns.includes('avgScore') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {student.avg_score.toFixed(1)}
                        </td>
                      )}
                      {visibleColumns.includes('lastActive') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.last_active_date || '未活跃'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 自定义表头模态框 */}
      {showHeaderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">自定义表头</h3>
            <div className="space-y-3 mb-6">
              {allColumns.map(col => (
                <label key={col.key} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{col.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowHeaderModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => setShowHeaderModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EnhancedDashboard
