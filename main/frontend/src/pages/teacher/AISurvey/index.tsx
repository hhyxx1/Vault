/**
 * AI问卷生成页面
 * 
 * 功能流程：
 * 1. 点击"AI生成"或"知识库生成"按钮
 * 2. 填写描述，选择题型和数量
 * 3. AI生成题目后展示编辑器
 * 4. 用户编辑题目
 * 5. 保存到数据库
 * 6. 显示在问卷列表中
 */
import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  Input,
  Select,
  InputNumber,
  Space,
  message,
  Spin,
  Row,
  Col,
  Card,
  Empty,
  Tabs
} from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  BookOutlined,
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { surveyGenerationApi, SSEEventData } from '@/services/surveyGeneration';
import { getTeacherCourses, Course } from '@/services/teacher';
import SurveyEditor from '@/components/SurveyEditor';
import SurveyCard from '@/components/SurveyCard';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface GenerateModalProps {
  visible: boolean;
  mode: 'ai' | 'knowledge_based';
  onCancel: () => void;
  onGenerate: (data: any) => void;
}

// AI生成配置弹窗
const GenerateModal: React.FC<GenerateModalProps> = ({
  visible,
  mode,
  onCancel,
  onGenerate
}) => {
  const [description, setDescription] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [includeTypes, setIncludeTypes] = useState<string[]>([]);
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamProgress, setStreamProgress] = useState<{
    stage: string;
    progress: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      loadCourses();
      setStreamProgress(null);
    }
  }, [visible]);

  const loadCourses = async () => {
    try {
      const data = await getTeacherCourses();
      setCourses(data);
    } catch (error) {
      console.error('加载课程失败:', error);
      message.error('无法获取课程列表');
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      message.error('请输入问卷描述');
      return;
    }

    if (mode === 'knowledge_based' && !courseId) {
      message.error('请选择课程');
      return;
    }

    setLoading(true);
    
    const payload: any = {
      description,
      question_count: questionCount,
      include_types: includeTypes.length > 0 ? includeTypes : undefined,
      auto_save: false,
      course_id: courseId || undefined
    };

    if (mode === 'ai') {
      // AI 模式使用流式接口
      surveyGenerationApi.generateAIStream(payload, (event: SSEEventData) => {
        if (event.stage === 'error') {
          message.error(event.message || '生成失败');
          setLoading(false);
          setStreamProgress(null);
          return;
        }

        setStreamProgress({
          stage: event.stage,
          progress: event.progress,
          message: event.message
        });

        if (event.stage === 'done' && event.data) {
          message.success('问卷生成成功！');
          onGenerate({
            surveyData: event.data,
            generationMethod: mode,
            generationPrompt: description,
            courseId: courseId || undefined
          });
          
          // 重置表单
          setDescription('');
          setQuestionCount(10);
          setIncludeTypes([]);
          setCourseId('');
          setLoading(false);
          setStreamProgress(null);
        }
      });
    } else {
      // 知识库模式暂不使用流式接口
      try {
        const response: any = await surveyGenerationApi.generateKnowledgeBased(payload);

        if (response.success) {
          message.success('问卷生成成功！');
          onGenerate({
            surveyData: response.data,
            generationMethod: mode,
            generationPrompt: description,
            courseId: courseId || undefined
          });
          
          // 重置表单
          setDescription('');
          setQuestionCount(10);
          setIncludeTypes([]);
          setCourseId('');
        }
      } catch (error: any) {
        console.error('生成失败:', error);
        message.error(error.response?.data?.detail || '生成失败，请重试');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          {mode === 'ai' ? <RobotOutlined /> : <BookOutlined />}
          {mode === 'ai' ? 'AI生成问卷' : '基于知识库生成问卷'}
        </Space>
      }
      open={visible}
      onCancel={loading ? undefined : onCancel}
      footer={streamProgress ? null : [
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="generate"
          type="primary"
          loading={loading}
          onClick={handleGenerate}
        >
          生成问卷
        </Button>
      ]}
      width={600}
      closable={!loading}
      maskClosable={!loading}
    >
      <Spin spinning={loading && !streamProgress}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {streamProgress ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ marginBottom: 20, fontSize: 16 }}>{streamProgress.message}</div>
              <div style={{ 
                width: '100%', 
                height: 8, 
                backgroundColor: '#f5f5f5', 
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${streamProgress.progress}%`, 
                  height: '100%', 
                  backgroundColor: '#1890ff',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ marginTop: 10, color: '#999' }}>进度: {streamProgress.progress}%</div>
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  AI生成描述 <span style={{ color: 'red' }}>*</span>
                </label>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    mode === 'ai'
                      ? '例如：帮我生成一套包含选择、判断和解答题的关于操作系统的问题'
                      : '例如：生成关于进程管理章节的测试题'
                  }
                  rows={4}
                  maxLength={500}
                  showCount
                />
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <label style={{ display: 'block', marginBottom: 8 }}>题目数量</label>
                  <InputNumber
                    value={questionCount}
                    onChange={(value) => setQuestionCount(value || 10)}
                    min={5}
                    max={50}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={12}>
                  <label style={{ display: 'block', marginBottom: 8 }}>题型</label>
                  <Select
                    mode="multiple"
                    value={includeTypes}
                    onChange={setIncludeTypes}
                    placeholder="不选则包含所有题型"
                    style={{ width: '100%' }}
                  >
                    <Option value="choice">选择题</Option>
                    <Option value="judge">判断题</Option>
                    <Option value="essay">问答题</Option>
                  </Select>
                </Col>
              </Row>

              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>
                  {mode === 'knowledge_based' ? '选择课程 *' : '选择关联课程 (可选)'}
                </label>
                <Select
                  value={courseId}
                  onChange={setCourseId}
                  placeholder="请选择课程"
                  style={{ width: '100%' }}
                  allowClear={mode !== 'knowledge_based'}
                >
                  {courses.map(course => (
                    <Option key={course.id} value={course.id}>
                      {course.course_name} ({course.course_code})
                    </Option>
                  ))}
                </Select>
              </div>
            </>
          )}
        </Space>
      </Spin>
    </Modal>
  );
};

const AISurveyPage: React.FC = () => {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateMode, setGenerateMode] = useState<'ai' | 'knowledge_based'>('ai');
  const [showEditor, setShowEditor] = useState(false);
  const [editorData, setEditorData] = useState<any>(null);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // 加载问卷列表
  const loadSurveys = async () => {
    setLoading(true);
    try {
      const response: any = await surveyGenerationApi.listSurveys({
        limit: 50
      });

      if (response.success) {
        setSurveys(response.surveys);
      }
    } catch (error) {
      console.error('加载问卷列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  // 打开生成弹窗
  const handleOpenGenerate = (mode: 'ai' | 'knowledge_based') => {
    setGenerateMode(mode);
    setShowGenerateModal(true);
  };

  // 生成完成，打开编辑器
  const handleGenerated = (data: any) => {
    setEditorData(data);
    setShowGenerateModal(false);
    setShowEditor(true);
  };

  // 保存成功
  const handleSaveSuccess = (surveyId: string) => {
    message.success('问卷保存成功！');
    setShowEditor(false);
    setEditorData(null);
    loadSurveys();  // 刷新列表
  };

  // 取消编辑
  const handleCancelEdit = () => {
    Modal.confirm({
      title: '确认取消',
      content: '取消后将丢失所有编辑内容，确定要取消吗？',
      okText: '确定',
      cancelText: '返回编辑',
      onOk: () => {
        setShowEditor(false);
        setEditorData(null);
      }
    });
  };

  // 过滤问卷
  const filteredSurveys = surveys.filter(survey => {
    if (activeTab === 'all') return true;
    if (activeTab === 'ai') return survey.generation_method === 'ai';
    if (activeTab === 'knowledge') return survey.generation_method === 'knowledge_based';
    if (activeTab === 'draft') return survey.status === 'draft';
    if (activeTab === 'published') return survey.status === 'published';
    return true;
  });

  // 如果正在编辑，显示编辑器
  if (showEditor && editorData) {
    return (
      <SurveyEditor
        surveyData={editorData.surveyData}
        generationMethod={editorData.generationMethod}
        generationPrompt={editorData.generationPrompt}
        courseId={editorData.courseId}
        onSaveSuccess={handleSaveSuccess}
        onCancel={handleCancelEdit}
      />
    );
  }

  // 主界面
  return (
    <div style={{ padding: '24px' }}>
      {/* 头部操作栏 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>问卷管理</h2>
            <p style={{ color: '#666', margin: '8px 0 0 0' }}>
              创建、编辑和发布问卷
            </p>
          </div>
          
          <Space>
            <Button
              icon={<RobotOutlined />}
              onClick={() => handleOpenGenerate('ai')}
              type="primary"
            >
              AI生成问卷
            </Button>
            <Button
              icon={<BookOutlined />}
              onClick={() => handleOpenGenerate('knowledge_based')}
            >
              基于知识库生成
            </Button>
            <Button icon={<FileTextOutlined />}>
              手动创建
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSurveys}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      {/* 标签页 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="全部问卷" key="all" />
        <TabPane tab="AI生成" key="ai" />
        <TabPane tab="知识库生成" key="knowledge" />
        <TabPane tab="草稿" key="draft" />
        <TabPane tab="已发布" key="published" />
      </Tabs>

      {/* 问卷列表 */}
      <Spin spinning={loading}>
        {filteredSurveys.length === 0 ? (
          <Empty
            description="暂无问卷"
            style={{ marginTop: 60 }}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenGenerate('ai')}
            >
              创建第一份问卷
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {filteredSurveys.map(survey => (
              <Col key={survey.id} xs={24} sm={12} lg={8} xl={6}>
                <SurveyCard
                  survey={survey}
                  onView={(id) => message.info(`查看问卷: ${id}`)}
                  onEdit={(id) => message.info(`编辑问卷: ${id}`)}
                  onDelete={(id) => {
                    Modal.confirm({
                      title: '确认删除',
                      content: '删除后无法恢复，确定要删除这份问卷吗？',
                      okText: '删除',
                      cancelText: '取消',
                      okType: 'danger',
                      onOk: () => {
                        message.success('删除成功');
                        loadSurveys();
                      }
                    });
                  }}
                  onPublish={(id) => {
                    Modal.confirm({
                      title: '确认发布',
                      content: '发布后学生将能看到这份问卷，确定要发布吗？',
                      okText: '发布',
                      cancelText: '取消',
                      onOk: () => {
                        message.success('发布成功');
                        loadSurveys();
                      }
                    });
                  }}
                />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* 生成配置弹窗 */}
      <GenerateModal
        visible={showGenerateModal}
        mode={generateMode}
        onCancel={() => setShowGenerateModal(false)}
        onGenerate={handleGenerated}
      />
    </div>
  );
};

export default AISurveyPage;
