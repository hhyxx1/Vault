import { useState } from 'react'

type CreateMode = 'manual' | 'ai' | 'knowledge' | null

const TeacherSurvey = () => {
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const creationModes = [
    {
      id: 'manual' as CreateMode,
      title: '手动上传',
      description: '手动添加题目或上传Word文档自动识别',
      icon: '📝',
      color: 'blue',
    },
    {
      id: 'ai' as CreateMode,
      title: 'AI生成',
      description: '给出描述，AI自动生成问卷',
      icon: '🤖',
      color: 'purple',
    },
    {
      id: 'knowledge' as CreateMode,
      title: '基于知识库',
      description: '描述需求，AI基于知识库生成问卷',
      icon: '📚',
      color: 'green',
    },
  ]

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      alert(`文件已选择: ${file.name}`)
    }
  }

  const handleGenerate = () => {
    if (createMode === 'ai' || createMode === 'knowledge') {
      if (!aiDescription.trim()) {
        alert('请输入描述')
        return
      }
      alert(`正在使用${createMode === 'ai' ? 'AI' : 'AI+知识库'}生成问卷...\\n描述: ${aiDescription}`)
    } else if (createMode === 'manual') {
      if (!uploadedFile) {
        alert('请上传文件或手动添加题目')
        return
      }
      alert(`正在处理文件: ${uploadedFile.name}`)
    }
    setShowCreateModal(false)
    setCreateMode(null)
    setAiDescription('')
    setUploadedFile(null)
  }

  return (
    <div className="h-full bg-gray-50">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">出题思路看板</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md"
          >
            <span>🎯</span>
            <span>出题助手</span>
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          {/* 出题方式选择卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {creationModes.map((mode) => (
              <div
                key={mode.id}
                onClick={() => {
                  setCreateMode(mode.id)
                  setShowCreateModal(true)
                }}
                className={`bg-white rounded-lg border-2 p-6 cursor-pointer transition-all hover:shadow-lg ${
                  mode.color === 'blue'
                    ? 'border-blue-200 hover:border-blue-400'
                    : mode.color === 'purple'
                    ? 'border-purple-200 hover:border-purple-400'
                    : 'border-green-200 hover:border-green-400'
                }`}
              >
                <div className="text-4xl mb-4">{mode.icon}</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{mode.title}</h3>
                <p className="text-sm text-gray-600">{mode.description}</p>
              </div>
            ))}
          </div>

          {/* 功能说明 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
            <h3 className="font-semibold text-gray-800 mb-3">💡 出题功能说明</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>手动上传:</strong> 支持手动添加题目或上传Word文档，系统自动识别题目格式</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>AI生成:</strong> 输入题目要求描述，AI智能生成相关试题</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>基于知识库:</strong> 结合课程知识库，生成符合教学大纲的高质量题目</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 创建问卷模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {creationModes.find((m) => m.id === createMode)?.title}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateMode(null)
                  setAiDescription('')
                  setUploadedFile(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {createMode === 'manual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      上传Word文档
                    </label>
                    <input
                      type="file"
                      accept=".doc,.docx"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    {uploadedFile && (
                      <p className="mt-2 text-sm text-green-600">已选择: {uploadedFile.name}</p>
                    )}
                  </div>
                  <div className="text-center text-gray-400 py-4">或</div>
                  <div>
                    <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors">
                      + 手动添加题目
                    </button>
                  </div>
                </>
              )}

              {(createMode === 'ai' || createMode === 'knowledge') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    输入问卷要求描述
                  </label>
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder={`例如: 生成一份关于${
                      createMode === 'knowledge' ? '数据结构中链表' : 'React组件'
                    }的测试题，包含10道选择题和5道简答题`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={6}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {createMode === 'knowledge'
                      ? '💡 系统将基于已上传的课程知识库内容生成题目'
                      : '💡 请详细描述题目要求，AI将根据描述生成相应题目'}
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateMode(null)
                    setAiDescription('')
                    setUploadedFile(null)
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  生成问卷
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherSurvey
