import React, { useState, useEffect } from 'react';
import { Card, Statistic, Table, Button, Modal, Checkbox, message } from 'antd';
import { Line, Pie } from '@ant-design/plots';
import { mockApi } from '../../mock/data';
import type { Student, StudentStats, DashboardData, TableHeader } from '../../types/aiagent';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);
  const [tableHeaders, setTableHeaders] = useState<TableHeader[]>([]);
  const [visibleHeaders, setVisibleHeaders] = useState<TableHeader[]>([]);
  const [isHeaderModalVisible, setIsHeaderModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, studentsRes, statsRes, headersRes] = await Promise.all([
        mockApi.getDashboardData(),
        mockApi.getStudents(),
        mockApi.getStudentStats(),
        mockApi.getTableHeaders()
      ]);
      setDashboardData(dashboardRes);
      setStudents(studentsRes);
      setStudentStats(statsRes);
      setTableHeaders(headersRes);
      setVisibleHeaders(headersRes.filter(header => header.visible));
     } finally {
      setLoading(false);
    }
  };

  const handleHeaderConfig = () => {
    setIsHeaderModalVisible(true);
  };

  const handleHeaderSave = () => {
    setVisibleHeaders(tableHeaders.filter(header => header.visible));
    setIsHeaderModalVisible(false);
    message.success('表头配置已保存');
  };

  const handleHeaderChange = (id: string, visible: boolean) => {
    setTableHeaders(prev => prev.map(header => 
      header.id === id ? { ...header, visible } : header
    ));
  };

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    return student ? student.name : '未知学生';
  };

  const columns = visibleHeaders.map(header => {
    switch (header.key) {
      case 'name':
        return {
          title: header.title,
          dataIndex: 'studentId',
          key: header.key,
          render: (studentId: string) => getStudentName(studentId)
        };
      case 'questionCount':
        return {
          title: header.title,
          dataIndex: 'questionCount',
          key: header.key
        };
      case 'participationRate':
        return {
          title: header.title,
          dataIndex: 'participationRate',
          key: header.key,
          render: (rate: number) => `${(rate * 100).toFixed(0)}%`
        };
      case 'avgQuestionScore':
        return {
          title: header.title,
          dataIndex: 'avgQuestionScore',
          key: header.key
        };
      case 'lastActiveDate':
        return {
          title: header.title,
          dataIndex: 'lastActiveDate',
          key: header.key
        };
      case 'highFrequencyQuestions':
        return {
          title: header.title,
          dataIndex: 'highFrequencyQuestions',
          key: header.key,
          render: (questions: string[]) => questions.join(', ')
        };
      default:
        return {
          title: header.title,
          dataIndex: header.key,
          key: header.key
        };
    }
  });

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
        <h1 className="text-2xl font-bold text-gray-800">AI智能教学看板</h1>
        <Button 
          type="primary" 
          onClick={handleHeaderConfig}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          自定义表头
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card className="shadow-sm">
          <Statistic title="总学生数" value={dashboardData?.totalStudents || 0} />
        </Card>
        <Card className="shadow-sm">
          <Statistic title="总提问数" value={dashboardData?.totalQuestions || 0} />
        </Card>
        <Card className="shadow-sm">
          <Statistic 
            title="平均参与度" 
            value={(dashboardData?.avgParticipationRate || 0) * 100} 
            suffix="%" 
          />
        </Card>
        <Card className="shadow-sm">
          <Statistic 
            title="活跃学生数" 
            value={studentStats.filter(stat => stat.participationRate > 0.7).length} 
          />
        </Card>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
        <Card title="问题分类分布" className="shadow-sm">
          {dashboardData?.categoryDistribution && (
            <Pie
              data={dashboardData.categoryDistribution}
              angleField="count"
              colorField="category"
              radius={0.8}
              label={{
                type: 'outer',
                content: '{name}: {value}'
              }}
            />
          )}
        </Card>
      </div>

      {/* 学生数据表格 */}
      <Card title="学生数据" className="shadow-sm">
        <Table
          columns={columns}
          dataSource={studentStats}
          rowKey="studentId"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 自定义表头模态框 */}
      <Modal
        title="自定义表头"
        open={isHeaderModalVisible}
        onOk={handleHeaderSave}
        onCancel={() => setIsHeaderModalVisible(false)}
      >
        <div className="max-h-[300px] overflow-y-auto">
          {tableHeaders.map(header => (
            <div key={header.id} className="mb-3">
              <Checkbox
                checked={header.visible}
                onChange={(e) => handleHeaderChange(header.id, e.target.checked)}
              >
                {header.title}
              </Checkbox>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;