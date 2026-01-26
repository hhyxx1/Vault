import { useState } from 'react'

const StudentSurvey = () => {
  const [activeTab, setActiveTab] = useState('survey')
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})

  const mockSurvey = {
    id: '1',
    title: '课程反馈调查',
    questions: [
      {
        id: 'q1',
        text: '您对本课程的整体满意度如何？',
        type: 'radio',
        options: ['非常满意', '满意', '一般', '不满意'],
      },
      {
        id: 'q2',
        text: '您认为课程内容的难度如何？',
        type: 'radio',
        options: ['太简单', '适中', '较难', '非常难'],
      },
    ],
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('提交答案:', selectedAnswers)
    alert('问卷提交成功！')
  }

  return (
    <div className="h-full bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <h2 className="text-2xl font-bold text-gray-800">问卷测验</h2>
      </div>

      {/* Tab切换 */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex space-x-8">
          {[
            { id: 'survey', label: '课程检测', icon: '✅' },
            { id: 'homework', label: '课后作业', icon: '📝' },
            { id: 'practice', label: '自主练习', icon: '📚' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        {activeTab === 'survey' ? (
          <div className="max-w-4xl mx-auto">
            {/* 说明卡片 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <span className="text-blue-500 text-xl">ℹ️</span>
                <div>
                  <p className="font-medium text-blue-900">课程检测说明</p>
                  <p className="text-sm text-blue-700 mt-1">
                    课程检测由教师在课上发起，有时间限制，请在选定时间完成。系统会自动收集结果，可能会继续作业。
                  </p>
                </div>
              </div>
            </div>

            {/* 问卷表单 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <h3 className="text-xl font-bold mb-6">{mockSurvey.title}</h3>

              <form onSubmit={handleSubmit} className="space-y-8">
                {mockSurvey.questions.map((question, index) => (
                  <div key={question.id} className="pb-6 border-b border-gray-100 last:border-0">
                    <h4 className="font-medium text-gray-800 mb-4">
                      {index + 1}. {question.text}
                    </h4>
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <label
                          key={option}
                          className="flex items-center space-x-3 cursor-pointer group"
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option}
                            checked={selectedAnswers[question.id] === option}
                            onChange={(e) =>
                              setSelectedAnswers({
                                ...selectedAnswers,
                                [question.id]: e.target.value,
                              })
                            }
                            className="w-5 h-5 text-primary-500 border-gray-300 focus:ring-primary-500"
                          />
                          <span className="text-gray-700 group-hover:text-gray-900">
                            {option}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md"
                  >
                    提交问卷
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto text-center py-20">
            <p className="text-gray-400">暂无{activeTab === 'homework' ? '作业' : '练习'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentSurvey
