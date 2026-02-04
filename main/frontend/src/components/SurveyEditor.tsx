/**
 * 问卷编辑器组件
 * 
 * 功能：
 * 1. 展示AI生成的问卷题目
 * 2. 支持编辑题目、选项、答案、解析
 * 3. 支持删除题目
 * 4. 支持调整题目顺序
 * 5. 验证并保存到数据库
 */
import React, { useState } from 'react';
import {
  Button,
  Card,
  Input,
  Select,
  InputNumber,
  Space,
  message,
  Modal,
  Tooltip,
  Tag
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { surveyGenerationApi } from '@/services/surveyGeneration';

const { TextArea } = Input;
const { Option } = Select;

interface Question {
  question_type: string;
  question_text: string;
  options?: string[];
  correct_answer: string | string[];
  score: number;
  explanation: string;
  knowledge_source?: string;
}

interface SurveyData {
  survey_title: string;
  description: string;
  questions: Question[];
}

interface SurveyEditorProps {
  surveyData: SurveyData;
  generationMethod: 'ai' | 'knowledge_based';
  generationPrompt: string;
  courseId?: string;
  onSaveSuccess?: (surveyId: string) => void;
  onCancel?: () => void;
}

const SurveyEditor: React.FC<SurveyEditorProps> = ({
  surveyData,
  generationMethod,
  generationPrompt,
  courseId,
  onSaveSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState(surveyData.survey_title);
  const [description, setDescription] = useState(surveyData.description);
  const [questions, setQuestions] = useState<Question[]>(surveyData.questions);
  const [saving, setSaving] = useState(false);

  // 题型中文映射
  const questionTypeMap: Record<string, string> = {
    choice: '选择题',
    judge: '判断题',
    essay: '问答题'
  };

  // 更新题目
  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = {
      ...newQuestions[index],
      [field]: value
    };
    setQuestions(newQuestions);
  };

  // 更新选项
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    const options = [...(newQuestions[questionIndex].options || [])];
    options[optionIndex] = value;
    newQuestions[questionIndex].options = options;
    setQuestions(newQuestions);
  };

  // 删除题目
  const deleteQuestion = (index: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这道题吗？',
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        const newQuestions = questions.filter((_, i) => i !== index);
        setQuestions(newQuestions);
        message.success('题目已删除');
      }
    });
  };

  // 移动题目
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;
    
    [newQuestions[index], newQuestions[targetIndex]] = 
    [newQuestions[targetIndex], newQuestions[index]];
    
    setQuestions(newQuestions);
  };

  // 验证问卷
  const validateSurvey = (): boolean => {
    if (!title.trim()) {
      message.error('请输入问卷标题');
      return false;
    }

    if (questions.length === 0) {
      message.error('问卷至少需要一道题目');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.question_text.trim()) {
        message.error(`第${i + 1}题的题目内容不能为空`);
        return false;
      }

      if (q.question_type === 'choice' && (!q.options || q.options.length < 2)) {
        message.error(`第${i + 1}题的选项至少需要2个`);
        return false;
      }

      if (!q.correct_answer) {
        message.error(`第${i + 1}题的正确答案不能为空`);
        return false;
      }

      if (!q.score || q.score <= 0) {
        message.error(`第${i + 1}题的分数必须大于0`);
        return false;
      }
    }

    // 验证总分
    const totalScore = questions.reduce((sum, q) => sum + q.score, 0);
    if (Math.abs(totalScore - 100) > 0.1) {
      Modal.confirm({
        title: '分数提醒',
        content: `当前总分为${totalScore}分，建议调整为100分。是否继续保存？`,
        okText: '继续保存',
        cancelText: '返回修改',
        onOk: () => handleSave()
      });
      return false;
    }

    return true;
  };

  // 保存问卷
  const handleSave = async () => {
    if (!validateSurvey()) return;

    setSaving(true);
    try {
      const response: any = await surveyGenerationApi.saveSurvey({
        survey_title: title,
        description: description,
        questions: questions,
        course_id: courseId,
        generation_method: generationMethod,
        generation_prompt: generationPrompt
      });

      if (response.success) {
        message.success('问卷保存成功！');
        onSaveSuccess?.(response.survey_id);
      }
    } catch (error: any) {
      console.error('保存失败:', error);
      message.error(error.response?.data?.detail || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 计算总分
  const totalScore = questions.reduce((sum, q) => sum + q.score, 0);
  const isScoreValid = Math.abs(totalScore - 100) < 0.1;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 头部 */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              问卷标题 <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入问卷标题"
              size="large"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              问卷描述
            </label>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入问卷描述"
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Tag color="blue">共 {questions.length} 题</Tag>
              <Tag color={isScoreValid ? 'green' : 'orange'}>
                {isScoreValid ? (
                  <><CheckCircleOutlined /> 总分: {totalScore}</>
                ) : (
                  <><ExclamationCircleOutlined /> 总分: {totalScore} (建议100分)</>
                )}
              </Tag>
              <Tag color="purple">
                {generationMethod === 'ai' ? 'AI生成' : '知识库生成'}
              </Tag>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 题目列表 */}
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {questions.map((question, index) => (
          <Card
            key={index}
            title={
              <Space>
                <Tag color="blue">第 {index + 1} 题</Tag>
                <Tag>{questionTypeMap[question.question_type]}</Tag>
                <Tag color="green">{question.score} 分</Tag>
              </Space>
            }
            extra={
              <Space>
                <Tooltip title="上移">
                  <Button
                    icon={<ArrowUpOutlined />}
                    size="small"
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, 'up')}
                  />
                </Tooltip>
                <Tooltip title="下移">
                  <Button
                    icon={<ArrowDownOutlined />}
                    size="small"
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(index, 'down')}
                  />
                </Tooltip>
                <Tooltip title="删除">
                  <Button
                    icon={<DeleteOutlined />}
                    size="small"
                    danger
                    onClick={() => deleteQuestion(index)}
                  />
                </Tooltip>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 题目内容 */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>题目内容</label>
                <TextArea
                  value={question.question_text}
                  onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                  rows={2}
                />
              </div>

              {/* 选项（选择题和判断题） */}
              {(question.question_type === 'choice' || question.question_type === 'judge') && (
                <div>
                  <label style={{ display: 'block', marginBottom: 8 }}>选项</label>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {question.options?.map((option, optionIndex) => (
                      <Input
                        key={optionIndex}
                        value={option}
                        onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                        addonBefore={
                          <span style={{ 
                            color: option.startsWith(question.correct_answer as string) ? '#52c41a' : undefined,
                            fontWeight: option.startsWith(question.correct_answer as string) ? 'bold' : undefined
                          }}>
                            {option.split('.')[0]}
                          </span>
                        }
                      />
                    ))}
                  </Space>
                </div>
              )}

              {/* 正确答案 */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>正确答案</label>
                  {question.question_type === 'choice' || question.question_type === 'judge' ? (
                    <Select
                      value={question.correct_answer as string}
                      onChange={(value) => updateQuestion(index, 'correct_answer', value)}
                      style={{ width: '100%' }}
                    >
                      {question.options?.map((opt) => {
                        const key = opt.split('.')[0];
                        return <Option key={key} value={key}>{key}</Option>;
                      })}
                    </Select>
                  ) : (
                    <TextArea
                      value={question.correct_answer as string}
                      onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                      rows={3}
                    />
                  )}
                </div>

                <div style={{ width: 120 }}>
                  <label style={{ display: 'block', marginBottom: 8 }}>分数</label>
                  <InputNumber
                    value={question.score}
                    onChange={(value) => updateQuestion(index, 'score', value || 0)}
                    min={0}
                    max={100}
                    step={0.5}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* 解析 */}
              <div>
                <label style={{ display: 'block', marginBottom: 8 }}>答案解析</label>
                <TextArea
                  value={question.explanation}
                  onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                  rows={3}
                />
              </div>

              {/* 知识来源 */}
              {question.knowledge_source && (
                <div>
                  <Tag color="purple" icon={<EditOutlined />}>
                    来源: {question.knowledge_source}
                  </Tag>
                </div>
              )}
            </Space>
          </Card>
        ))}
      </Space>

      {/* 底部操作栏 */}
      <Card style={{ marginTop: 24, position: 'sticky', bottom: 0, zIndex: 100 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Tag color="blue">共 {questions.length} 题</Tag>
            <Tag color={isScoreValid ? 'green' : 'orange'}>
              总分: {totalScore} {!isScoreValid && '(建议100分)'}
            </Tag>
          </Space>
          
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
            >
              保存问卷
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default SurveyEditor;
