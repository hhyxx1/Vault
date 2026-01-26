const TeacherDashboard = () => {
  const stats = {
    avgScore: 84.9,
    passRate: 92,
    maxScore: 98,
    completionRate: 100,
  }

  const insights = [
    {
      question: '这个班最不了解这程概念的同学是谁？',
      students: ['张伟', '李娜', '王强'],
      skills: ['选择状态转换错误率达 85%', 'PCB 概念混淆', '未完成相关安验'],
    },
    {
      question: '这个班最活跃的五名同学是谁？',
      students: ['陈晨', '刘洋', '赵敏', '孙浩', '周杰'],
    },
  ]

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <h2 className="text-2xl font-bold text-gray-800">教师看板</h2>
        <p className="text-gray-500 text-sm mt-1">实时监控班级学情与自定义多维分析</p>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        {/* 固定信息展示 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="text-xl mr-2">📊</span>
            固定信息展示
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 班级平均分 */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
              <p className="text-sm opacity-90 mb-2">班级平均分</p>
              <p className="text-4xl font-bold mb-2">{stats.avgScore}</p>
              <p className="text-xs opacity-75 flex items-center">
                <span className="mr-1">📈</span> 较上周 +1.2
              </p>
            </div>

            {/* 及格率 */}
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">及格率</p>
                <span className="text-2xl">✅</span>
              </div>
              <p className="text-4xl font-bold text-gray-800 mb-2">{stats.passRate}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${stats.passRate}%` }}
                ></div>
              </div>
            </div>

            {/* 最高分 */}
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">最高分</p>
                <span className="text-2xl">🏆</span>
              </div>
              <p className="text-4xl font-bold text-gray-800 mb-2">{stats.maxScore}</p>
              <p className="text-xs text-gray-500">获得者: 林晓雪</p>
            </div>

            {/* 作业提交率 */}
            <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">作业提交率</p>
                <span className="text-2xl">🔄</span>
              </div>
              <p className="text-4xl font-bold text-gray-800 mb-2">{stats.completionRate}%</p>
              <p className="text-xs text-gray-500">全员已提交</p>
            </div>
          </div>
        </div>

        {/* AI实时分析 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="text-xl mr-2">🤖</span>
            自定义信息展示 (AI 实时分析)
          </h3>

          <div className="space-y-6">
            {insights.map((insight, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start space-x-3 mb-4">
                  <span className="text-blue-500 text-xl">❓</span>
                  <h4 className="text-gray-800 font-medium flex-1">{insight.question}</h4>
                </div>

                <div className="pl-8 space-y-3">
                  {insight.students && (
                    <div className="flex flex-wrap gap-2">
                      {insight.students.map((student, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-200"
                        >
                          {idx + 1} {student}
                        </span>
                      ))}
                    </div>
                  )}

                  {insight.skills && (
                    <div className="space-y-2">
                      {insight.skills.map((skill, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-sm">
                          <span className="text-red-500">•</span>
                          <span className="text-gray-700">{skill}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {index === 0 && (
                  <div className="mt-4 text-xs text-gray-400 pl-8">
                    💡 数据实时更新中...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard
