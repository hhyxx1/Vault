import React, { useState, useEffect } from 'react';
import { Card, Tabs, Avatar, Progress, List, Tag, Badge, message } from 'antd';
import { Bar } from '@ant-design/plots';
import { mockApi } from '../../mock/data';
import type { Student, SelfAssessment, Conversation, LearningProgress } from '../../types/aiagent';

interface StudentProfileProps {
  studentId: string;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ studentId }) => {
  const [student, setStudent] = useState<Student | undefined>();
  const [selfAssessments, setSelfAssessments] = useState<SelfAssessment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgress | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const [studentRes, assessmentsRes, conversationsRes, progressRes] = await Promise.all([
        mockApi.getStudentById(studentId),
        mockApi.getSelfAssessments(studentId),
        mockApi.getConversations(studentId),
        mockApi.getLearningProgress(studentId)
      ]);
      setStudent(studentRes);
      setSelfAssessments(assessmentsRes);
      setConversations(conversationsRes);
      setLearningProgress(progressRes);
    } catch (error) {
      message.error('获取学生数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getSkillLevel = (score: number) => {
    if (score >= 90) return { level: '优秀', color: 'green' };
    if (score >= 70) return { level: '良好', color: 'blue' };
    if (score >= 60) return { level: '及格', color: 'orange' };
    return { level: '待提高', color: 'red' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[400px] font-medium text-gray-600">
        加载中...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex justify-center items-center h-[400px] font-medium text-gray-600">
        学生不存在
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">AI学生学习分析</h1>
      </div>

      {/* 学生基本信息 */}
      <Card className="mb-6 shadow-sm">
        <div className="flex items-center">
          <Avatar size={80} src={student.avatar} alt={student.name} />
          <div className="ml-6 flex-1">
            <h2 className="text-2xl font-bold text-gray-800">{student.name}</h2>
            <p className="text-gray-600 mt-2">
              {student.grade} | {student.class} | 入学日期: {student.enrollmentDate}
            </p>
            {learningProgress && (
              <div className="mt-4 flex items-center">
                <span className="text-gray-700 mr-3">整体学习进度: </span>
                <Progress 
                  percent={learningProgress.overallProgress} 
                  size="small" 
                  status="active"
                  className="flex-1"
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 标签页内容 */}
      <Tabs defaultActiveKey="assessments" className="bg-white rounded-lg shadow-sm">
        {/* 自测结果 */}
        <Tabs.TabPane tab="自测结果" key="assessments">
          <div className="p-4">
            <List
              dataSource={selfAssessments}
              renderItem={(assessment) => {
                const skillLevel = getSkillLevel(assessment.score);
                return (
                  <Card className="mb-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-800">自测日期: {assessment.date}</h3>
                      <Badge 
                        status={skillLevel.color as any} 
                        text={`${skillLevel.level} (${assessment.score}分)`} 
                      />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">测试主题</h4>
                        <div className="flex flex-wrap gap-2">
                          {assessment.topics.map(topic => (
                            <Tag key={topic} className="bg-gray-100 text-gray-800">{topic}</Tag>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">优势</h4>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                          {assessment.strengths.map((strength, index) => (
                            <li key={index}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">不足</h4>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600">
                          {assessment.weaknesses.map((weakness, index) => (
                            <li key={index}>{weakness}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                );
              }}
              locale={{ emptyText: '暂无自测记录' }}
            />
          </div>
        </Tabs.TabPane>

        {/* 对话历史 */}
        <Tabs.TabPane tab="对话历史" key="conversations">
          <div className="p-4">
            <List
              dataSource={conversations}
              renderItem={(conversation) => (
                <Card className="mb-4 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-800">对话日期: {conversation.date}</h3>
                    <div className="flex flex-wrap gap-2">
                      {conversation.tags.map(tag => (
                        <Tag key={tag} className="bg-blue-50 text-blue-700">{tag}</Tag>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-800 mb-2">学生:</h4>
                      <p className="text-gray-700">{conversation.content}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">教师:</h4>
                      <p className="text-gray-700">{conversation.response}</p>
                    </div>
                  </div>
                </Card>
              )}
              locale={{ emptyText: '暂无对话记录' }}
            />
          </div>
        </Tabs.TabPane>

        {/* 学习进度分析 */}
        <Tabs.TabPane tab="学习分析" key="analysis">
          <div className="p-4 space-y-6">
            {learningProgress ? (
              <div className="space-y-6">
                {/* 主题进度 */}
                <Card title="主题学习进度" className="shadow-sm">
                  {learningProgress.topicProgress && (
                    <Bar
                      data={learningProgress.topicProgress}
                      xField="topic"
                      yField="progress"
                      yAxis={{
                        max: 100,
                        label: {
                          formatter: (value: number) => `${value}%`
                        }
                      }}
                      color="#6366f1"
                    />
                  )}
                </Card>

                {/* 学习建议 */}
                <Card title="学习建议" className="shadow-sm">
                  <List
                    dataSource={learningProgress.recommendations}
                    renderItem={(recommendation, index) => (
                      <List.Item>
                        <span className="font-semibold w-6 inline-block">{index + 1}.</span>
                        <span className="text-gray-700">{recommendation}</span>
                      </List.Item>
                    )}
                  />
                </Card>

                {/* 风险因素 */}
                {learningProgress.riskFactors && learningProgress.riskFactors.length > 0 && (
                  <Card title="风险因素" className="shadow-sm">
                    <List
                      dataSource={learningProgress.riskFactors}
                      renderItem={(factor) => (
                        <List.Item>
                          <Tag color="red" className="mr-3">需关注</Tag>
                          <span className="text-gray-700">{factor}</span>
                        </List.Item>
                      )}
                    />
                  </Card>
                )}

                {/* 教学策略建议 */}
                <Card title="教学策略建议" className="shadow-sm">
                  <div className="text-gray-700">
                    <p className="mb-4">基于学生的学习数据和大模型分析，建议采取以下教学策略：</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>根据学生的薄弱环节进行针对性辅导</li>
                      <li>设置适合学生当前水平的学习任务</li>
                      <li>定期进行学习进度跟踪和评估</li>
                      <li>鼓励学生多提问，提高参与度</li>
                      <li>结合学生的兴趣点设计教学内容</li>
                    </ul>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="flex justify-center items-center h-[400px] font-medium text-gray-600">
                暂无学习分析数据
              </div>
            )}
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default StudentProfile;