/**
 * AI问卷生成API服务
 */
import apiClient from './api';

const API_BASE = '/teacher/survey-generation';

export interface GenerateRequest {
  description: string;
  question_count?: number; // 改为可选，因为 AI 生成可以由描述解析
  include_types?: string[];
  course_id?: string;
  auto_save?: boolean;
}

export interface SaveSurveyRequest {
  survey_title: string;
  description?: string;
  questions: any[];
  course_id?: string;
  generation_method: string;
  generation_prompt?: string;
}

/**
 * 格式化为 SSE 单条事件数据的类型
 */
export interface SSEEventData {
  stage: 'start' | 'generating' | 'parsing' | 'done' | 'error';
  progress: number;
  message: string;
  data?: any;
}

export const surveyGenerationApi = {
  /**
   * AI生成问卷
   */
  async generateAI(data: GenerateRequest) {
    return await apiClient.post(`${API_BASE}/generate/ai`, data);
  },

  /**
   * AI生成问卷（流式接口，带进度）
   */
  generateAIStream(data: GenerateRequest, onEvent: (event: SSEEventData) => void) {
    const url = `${apiClient.defaults.baseURL}${API_BASE}/generate/ai/stream`;
    const token = localStorage.getItem('token');

    const eventSource = new fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    // 这里需要处理流式响应，由于 fetch 不直接支持 SSE，我们使用 ReadableStream
    eventSource.then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData: SSEEventData = JSON.parse(line.slice(6));
              onEvent(eventData);
            } catch (e) {
              console.error('Error parsing SSE event:', e);
            }
          }
        }
      }
    }).catch(err => {
      onEvent({
        stage: 'error',
        progress: 0,
        message: err.message || '网络请求失败'
      });
    });
  },

  /**
   * 基于知识库生成问卷
   */
  async generateKnowledgeBased(data: GenerateRequest) {
    return await apiClient.post(`${API_BASE}/generate/knowledge-based`, data);
  },

  /**
   * 保存问卷
   */
  async saveSurvey(data: SaveSurveyRequest) {
    return await apiClient.post(`${API_BASE}/save`, data);
  },

  /**
   * 获取问卷列表
   */
  async listSurveys(params?: {
    course_id?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) {
    return await apiClient.get(`${API_BASE}/list`, { params });
  },

  /**
   * 测试技能加载
   */
  async testSkills() {
    return await apiClient.get(`${API_BASE}/test-skills`);
  }
};

export default surveyGenerationApi;
