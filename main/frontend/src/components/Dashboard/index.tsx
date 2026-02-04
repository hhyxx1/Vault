import React, { useState, useEffect } from 'react';
import { Card, Statistic, Table, Button, Modal, Checkbox, message } from 'antd';
import { Line, Pie } from '@ant-design/plots';
import { getDashboardData, getStudents, getStudentStats } from '../../services/teacher';
import type { Student, StudentStats, DashboardData } from '../../services/teacher';

const TeacherDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);
  const [isBoardModalVisible, setIsBoardModalVisible] = useState(false);
  const [availableComponents, setAvailableComponents] = useState<any[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [activeComponents, setActiveComponents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    fetchAvailableComponents();
  }, []);

  const fetchData = async () => {
    try {
        setLoading(true);
        // 从后端获取真实数据
        const [dashboardRes, studentsRes, statsRes] = await Promise.all([
          getDashboardData(),
          getStudents(),
          getStudentStats()
        ]);
        setDashboardData(dashboardRes);
        setStudents(studentsRes);
        setStudentStats(statsRes);
        console.log('从后端获取数据成功:', {
          dashboardData: dashboardRes,
          students: studentsRes.length,
          studentStats: statsRes.length
        });
    } catch (error) {
      console.error('从后端获取数据失败:', error);
      message.error('获取数据失败，请检查网络连接或登录状态');
      // 不再使用模拟数据，确保数据来自数据库
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableComponents = async () => {
    try {
      // 获取可选的看板组件列表，只包含数据库中有对应数据的组件
      const components = [
        { id: 'total-students', name: '总学生数', description: '显示系统中的总学生数量' },
        { id: 'total-questions', name: '总提问数', description: '显示系统中的总提问数量' },
        { id: 'avg-participation', name: '平均参与度', description: '显示学生的平均参与度' },
        { id: 'active-students', name: '活跃学生数', description: '显示系统中的活跃学生数量' },
        { id: 'question-trend', name: '提问趋势', description: '展示学生提问数量的变化趋势' },
        { id: 'category-distribution', name: '问题分类分布', description: '展示学生提问的分类分布情况' },
        { id: 'performance-stats', name: '成绩统计', description: '显示学生表现统计数据' }
      ];
      setAvailableComponents(components);
      
      // 默认选择所有组件
      setSelectedComponents(components.map(comp => comp.id));
      setActiveComponents(components.map(comp => comp.id));
    } catch (error) {
      console.error('获取组件列表失败:', error);
      
      // 使用默认组件列表
      const defaultComponents = [
        { id: 'total-students', name: '总学生数', description: '显示系统中的总学生数量' },
        { id: 'total-questions', name: '总提问数', description: '显示系统中的总提问数量' },
        { id: 'avg-participation', name: '平均参与度', description: '显示学生的平均参与度' },
        { id: 'active-students', name: '活跃学生数', description: '显示系统中的活跃学生数量' },
        { id: 'question-trend', name: '提问趋势', description: '展示学生提问数量的变化趋势' },
        { id: 'category-distribution', name: '问题分类分布', description: '展示学生提问的分类分布情况' },
        { id: 'performance-stats', name: '成绩统计', description: '显示学生表现统计数据' }
      ];
      setAvailableComponents(defaultComponents);
      setSelectedComponents(defaultComponents.map(comp => comp.id));
      setActiveComponents(defaultComponents.map(comp => comp.id));
    }
  };

  const handleBoardConfig = () => {
    setIsBoardModalVisible(true);
  };

  const handleBoardSave = () => {
    // 保存看板配置
    setActiveComponents([...selectedComponents]);
    setIsBoardModalVisible(false);
    message.success('看板配置已保存');
  };

  const handleComponentToggle = (componentId: string) => {
    setSelectedComponents(prev => 
      prev.includes(componentId) 
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
  };

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student ? student.name : '未知学生';
  };

  const columns = [
    {
      title: '学生姓名',
      dataIndex: 'studentId',
      key: 'name',
      render: (studentId: string) => getStudentName(studentId)
    },
    {
      title: '提问数',
      dataIndex: 'questionCount',
      key: 'questionCount'
    },
    {
      title: '参与度',
      dataIndex: 'participationRate',
      key: 'participationRate',
      render: (rate: number) => `${(rate * 100).toFixed(0)}%`
    },
    {
      title: '问题质量评分',
      dataIndex: 'avgQuestionScore',
      key: 'avgQuestionScore'
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActiveDate',
      key: 'lastActiveDate'
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[400px] font-medium text-gray-600">
        加载中...
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题和操作按钮 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">教师看板</h1>
        <Button 
          type="primary" 
          onClick={handleBoardConfig}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          自定义看板
        </Button>
      </div>

      {/* 统计卡片组件 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* 总学生数 */}
        {activeComponents.includes('total-students') && (
          <Card className="shadow-sm">
            <Statistic title="总学生数" value={dashboardData?.totalStudents || 0} />
          </Card>
        )}
        
        {/* 总提问数 */}
        {activeComponents.includes('total-questions') && (
          <Card className="shadow-sm">
            <Statistic title="总提问数" value={dashboardData?.totalQuestions || 0} />
          </Card>
        )}
        
        {/* 平均参与度 */}
        {activeComponents.includes('avg-participation') && (
          <Card className="shadow-sm">
            <Statistic 
              title="平均参与度" 
              value={(dashboardData?.avgParticipationRate || 0) * 100} 
              suffix="%" 
            />
          </Card>
        )}
        
        {/* 活跃学生数 */}
        {activeComponents.includes('active-students') && (
          <Card className="shadow-sm">
            <Statistic 
              title="活跃学生数" 
              value={studentStats.filter(stat => stat.participationRate > 0.7).length} 
            />
          </Card>
        )}
      </div>

      {/* 提问分析组件 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 提问趋势 */}
        {activeComponents.includes('question-trend') && (
          <Card title="提问趋势" className="shadow-sm">
            {dashboardData?.questionTrend && (
              <Line
                data={dashboardData.questionTrend}
                xField="date"
                yField="count"
                smooth
                point={{
                  size: 5,
                  shape: 'diamond'
                }}
              />
            )}
          </Card>
        )}
        
        {/* 问题分类分布 */}
        {activeComponents.includes('category-distribution') && (
          <Card title="问题分类分布" className="shadow-sm">
            {dashboardData?.categoryDistribution && (
              <Pie
                data={dashboardData.categoryDistribution.map((item, index) => ({
                  ...item,
                  name: item.category, // 添加name字段，确保Pie组件能正确识别
                  index // 添加index字段，用于默认分类名
                }))}
                angleField="count"
                colorField="name" // 使用name字段作为颜色字段
                radius={0.8}
                label={{
                  type: 'outer',
                  content: (data) => {
                    // 尝试修复中文编码问题
                    try {
                      // 检查data对象的结构
                      console.log('Pie data:', data);
                      // 确保data.name存在且不为空
                      if (data.name && typeof data.name === 'string') {
                        return `${data.name}: ${data.count}`;
                      } else {
                        // 如果name不存在，使用默认分类名
                        return `分类${data.index || ''}: ${data.count}`;
                      }
                    } catch (error) {
                      console.error('Label error:', error);
                      return `分类: ${data.count}`;
                    }
                  }
                }}
                legend={{
                  position: 'bottom',
                  formatter: (value) => {
                    try {
                      return value;
                    } catch (error) {
                      return '分类';
                    }
                  }
                }}
              />
            )}
          </Card>
        )}
      </div>

      {/* 成绩统计组件 */}
      {activeComponents.includes('performance-stats') && (
        <Card title="学生数据" className="shadow-sm mb-6">
          <Table
            columns={columns}
            dataSource={studentStats}
            rowKey="studentId"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}



      {/* 自定义看板模态框 */}
      <Modal
        title="自定义看板"
        open={isBoardModalVisible}
        onOk={handleBoardSave}
        onCancel={() => setIsBoardModalVisible(false)}
        width={600}
      >
        <div className="max-h-[400px] overflow-y-auto">
          <p className="mb-4 text-gray-600">选择要在看板上显示的组件：</p>
          {availableComponents.map(component => (
            <div key={component.id} className="mb-4 p-3 border rounded-lg bg-gray-50">
              <div className="flex items-start">
                <Checkbox
                  checked={selectedComponents.includes(component.id)}
                  onChange={(e) => handleComponentToggle(component.id)}
                  className="mt-1"
                />
                <div className="ml-3 flex-1">
                  <h4 className="font-medium text-gray-800">{component.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{component.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default TeacherDashboard;