/**
 * 问卷卡片组件
 * 
 * 显示问卷的标题、描述、题目数量等信息
 */
import React from 'react';
import { Card, Tag, Space, Tooltip, Button } from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  RobotOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import moment from 'moment';

interface SurveyCardProps {
  survey: {
    id: string;
    title: string;
    description: string;
    generation_method: 'ai' | 'knowledge_based' | 'manual';
    status: string;
    total_score: number;
    question_count: number;
    created_at: string;
    updated_at: string;
  };
  onEdit?: (surveyId: string) => void;
  onView?: (surveyId: string) => void;
  onDelete?: (surveyId: string) => void;
  onPublish?: (surveyId: string) => void;
}

const SurveyCard: React.FC<SurveyCardProps> = ({
  survey,
  onEdit,
  onView,
  onDelete,
  onPublish
}) => {
  // 状态映射
  const statusMap: Record<string, { text: string; color: string }> = {
    draft: { text: '草稿', color: 'default' },
    published: { text: '已发布', color: 'green' },
    closed: { text: '已关闭', color: 'red' },
    archived: { text: '已归档', color: 'gray' }
  };

  // 生成方式映射
  const methodMap: Record<string, { text: string; icon: React.ReactNode; color: string }> = {
    ai: { 
      text: 'AI生成', 
      icon: <RobotOutlined />, 
      color: 'purple' 
    },
    knowledge_based: { 
      text: '知识库生成', 
      icon: <BookOutlined />, 
      color: 'blue' 
    },
    manual: { 
      text: '手动创建', 
      icon: <FileTextOutlined />, 
      color: 'cyan' 
    }
  };

  const currentStatus = statusMap[survey.status] || statusMap.draft;
  const currentMethod = methodMap[survey.generation_method] || methodMap.manual;

  return (
    <Card
      hoverable
      style={{ height: '100%' }}
      actions={[
        <Tooltip title="查看" key="view">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => onView?.(survey.id)}
          >
            查看
          </Button>
        </Tooltip>,
        <Tooltip title="编辑" key="edit">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => onEdit?.(survey.id)}
            disabled={survey.status === 'published'}
          >
            编辑
          </Button>
        </Tooltip>,
        survey.status === 'draft' ? (
          <Tooltip title="发布" key="publish">
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={() => onPublish?.(survey.id)}
            >
              发布
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title="删除" key="delete">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete?.(survey.id)}
            >
              删除
            </Button>
          </Tooltip>
        )
      ]}
    >
      {/* 标题 */}
      <Card.Meta
        title={
          <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            {survey.title}
          </div>
        }
        description={
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {/* 描述 */}
            <div
              style={{
                color: '#666',
                fontSize: 14,
                height: 40,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {survey.description || '暂无描述'}
            </div>

            {/* 标签 */}
            <Space wrap>
              <Tag color={currentStatus.color}>{currentStatus.text}</Tag>
              <Tag color={currentMethod.color} icon={currentMethod.icon}>
                {currentMethod.text}
              </Tag>
              <Tag>{survey.question_count} 题</Tag>
              <Tag color="green">{survey.total_score} 分</Tag>
            </Space>

            {/* 时间信息 */}
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              <Space split="|" size="small">
                <span>
                  <ClockCircleOutlined /> 创建于 {moment(survey.created_at).format('YYYY-MM-DD HH:mm')}
                </span>
                {survey.updated_at !== survey.created_at && (
                  <span>
                    更新于 {moment(survey.updated_at).fromNow()}
                  </span>
                )}
              </Space>
            </div>
          </Space>
        }
      />
    </Card>
  );
};

export default SurveyCard;
