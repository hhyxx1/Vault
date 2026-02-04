import apiClient from './api';

export interface DocumentInfo {
  id: string;
  file_name: string;
  document_type: 'outline' | 'material';
  file_type: string;
  file_size: number;
  processing_status: string;
  processing_progress: number;
  uploaded_at: string;
  error_message?: string;
}

export interface DocumentListResponse {
  course_id: string;
  course_name: string;
  total_documents: number;
  documents: DocumentInfo[];
}

export interface UploadDocumentResponse {
  message: string;
  document_id: string;
  document_type: string;
  file_name: string;
  file_size: number;
  processing_status: string;
}

export interface ProcessingProgressResponse {
  document_id: string;
  task_id?: string;
  status: string;
  progress: number;
  current_step: number | null;
  total_steps: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  result_summary?: any;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  level: number;
  difficulty: string;
  importance: number;
  keywords: string[];
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relation_type: string;
  weight?: number;
}

export interface KnowledgeGraphResponse {
  course_id: string;
  course_name: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  statistics: {
    total_nodes: number;
    total_edges: number;
  };
  updated_at?: string;
}

// 上传课程文档
export const uploadDocument = async (
  courseId: string,
  file: File,
  documentType: 'outline' | 'material',
  onProgress?: (progress: number) => void
): Promise<UploadDocumentResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 监听上传进度
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });
    }

    // 监听完成
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.detail || '上传失败'));
        } catch (e) {
          reject(new Error('上传失败'));
        }
      }
    });

    // 监听错误
    xhr.addEventListener('error', () => {
      reject(new Error('网络错误'));
    });

    const token = localStorage.getItem('token');
    // 使用与 apiClient 一致的 base URL
    const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');
    xhr.open('POST', `${baseURL}/teacher/documents/courses/${courseId}/documents/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

// 获取课程文档列表
export const getCourseDocuments = async (
  courseId: string,
  documentType?: 'outline' | 'material'
): Promise<DocumentListResponse> => {
  const params = documentType ? { document_type: documentType } : {};
  return await apiClient.get(`/teacher/documents/courses/${courseId}/documents`, { params });
};

// 获取文档处理进度
export const getDocumentProgress = async (
  documentId: string
): Promise<ProcessingProgressResponse> => {
  return await apiClient.get(`/teacher/documents/${documentId}/progress`);
};

// 获取课程知识图谱
export const getCourseKnowledgeGraph = async (
  courseId: string
): Promise<KnowledgeGraphResponse> => {
  return await apiClient.get(`/teacher/documents/courses/${courseId}/knowledge-graph`);
};

// 获取旧版文档列表 (兼容性)
export const getOldCourseDocuments = async (courseId: string): Promise<any> => {
  return await apiClient.get(`/teacher/knowledge-base/courses/${courseId}/documents`);
};

// 获取知识库统计信息 (兼容性)
export const getKnowledgeBaseStats = async (): Promise<any> => {
  return await apiClient.get('/teacher/knowledge-base/knowledge-base/stats');
};

// 删除文档
export const deleteDocument = async (documentId: string): Promise<void> => {
  return await apiClient.delete(`/teacher/documents/${documentId}`);
};
