/**
 * AI问卷生成API服务
 */
import axios from 'axios';

const API_BASE = '/api/teacher/survey-generation';

export interface GenerateRequest {
  description: string;
  question_count: number;
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

export const surveyGenerationApi = {
  /**
   * AI生成问卷
   */
  async generateAI(data: GenerateRequest) {
    const response = await axios.post(`${API_BASE}/generate/ai`, data);
    return response.data;
  },

  /**
   * 基于知识库生成问卷
   */
  async generateKnowledgeBased(data: GenerateRequest) {
    const response = await axios.post(`${API_BASE}/generate/knowledge-based`, data);
    return response.data;
  },

  /**
   * 保存问卷
   */
  async saveSurvey(data: SaveSurveyRequest) {
    const response = await axios.post(`${API_BASE}/save`, data);
    return response.data;
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
    const response = await axios.get(`${API_BASE}/list`, { params });
    return response.data;
  },

  /**
   * 测试技能加载
   */
  async testSkills() {
    const response = await axios.get(`${API_BASE}/test-skills`);
    return response.data;
  }
};

export default surveyGenerationApi;
