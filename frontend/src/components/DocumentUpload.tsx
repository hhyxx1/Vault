import React, { useState, useCallback, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface DocumentUploadProps {
  courseId: string;
  onUploadComplete?: () => void;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  documentId?: string;
  error?: string;
  processingProgress?: number;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ courseId, onUploadComplete }) => {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  // 轮询处理进度
  useEffect(() => {
    const processingUploads = uploads.filter(u => u.status === 'processing' && u.documentId);
    
    if (processingUploads.length === 0) return;

    const interval = setInterval(async () => {
      for (const upload of processingUploads) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `http://localhost:8000/api/teacher/documents/${upload.documentId}/progress`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            
            setUploads(prev => prev.map(u => 
              u.documentId === upload.documentId
                ? {
                    ...u,
                    processingProgress: data.progress,
                    status: data.status === 'completed' ? 'completed' : 
                           data.status === 'failed' ? 'error' : 'processing',
                    error: data.error_message
                  }
                : u
            ));

            // 如果完成，触发回调
            if (data.status === 'completed' || data.status === 'failed') {
              onUploadComplete?.();
            }
          }
        } catch (error) {
          console.error('获取进度失败:', error);
        }
      }
    }, 2000); // 每2秒轮询一次

    return () => clearInterval(interval);
  }, [uploads, onUploadComplete]);

  const handleFileSelect = useCallback((documentType: 'outline' | 'material') => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files, documentType);
    }
  }, []);

  const handleFiles = async (files: File[], documentType: 'outline' | 'material') => {
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.ppt', '.pptx'];
    
    for (const file of files) {
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!allowedExtensions.includes(fileExt)) {
        alert(`不支持的文件格式: ${file.name}\n支持的格式: ${allowedExtensions.join(', ')}`);
        continue;
      }

      // 添加到上传列表
      const uploadProgress: UploadProgress = {
        file,
        progress: 0,
        status: 'uploading'
      };
      
      setUploads(prev => [...prev, uploadProgress]);
      
      // 开始上传
      await uploadFile(file, uploadProgress, documentType);
    }
  };

  const uploadFile = async (file: File, uploadProgress: UploadProgress, documentType: 'outline' | 'material') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    try {
      const token = localStorage.getItem('token');
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploads(prev => prev.map(u => 
            u.file === file ? { ...u, progress } : u
          ));
        }
      });

      // 监听完成
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setUploads(prev => prev.map(u => 
            u.file === file
              ? {
                  ...u,
                  progress: 100,
                  status: 'processing',
                  documentId: response.document_id,
                  processingProgress: 0
                }
              : u
          ));
        } else {
          const error = JSON.parse(xhr.responseText);
          setUploads(prev => prev.map(u => 
            u.file === file
              ? { ...u, status: 'error', error: error.detail || '上传失败' }
              : u
          ));
        }
      });

      // 监听错误
      xhr.addEventListener('error', () => {
        setUploads(prev => prev.map(u => 
          u.file === file
            ? { ...u, status: 'error', error: '网络错误' }
            : u
        ));
      });

      xhr.open('POST', `http://localhost:8000/api/teacher/courses/${courseId}/documents/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

    } catch (error) {
      setUploads(prev => prev.map(u => 
        u.file === file
          ? { ...u, status: 'error', error: String(error) }
          : u
      ));
    }
  };

  const removeUpload = (index: number) => {
    setUploads(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* 两个上传按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 上传大纲按钮 */}
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 bg-blue-50 hover:bg-blue-100 transition-colors">
          <input
            type="file"
            id="outlineInput"
            multiple
            accept=".pdf,.docx,.doc,.txt,.ppt,.pptx"
            onChange={handleFileSelect('outline')}
            className="hidden"
          />
          <label htmlFor="outlineInput" className="cursor-pointer block text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-blue-500 text-white rounded-full p-4">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-1">上传课程大纲</h3>
                <p className="text-sm text-blue-700">点击选择大纲文件</p>
              </div>
              <div className="text-xs text-blue-600 bg-white px-3 py-1 rounded-full">
                支持 PDF, Word, TXT, PPT
              </div>
            </div>
          </label>
        </div>

        {/* 上传资料按钮 */}
        <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-green-50 hover:bg-green-100 transition-colors">
          <input
            type="file"
            id="materialInput"
            multiple
            accept=".pdf,.docx,.doc,.txt,.ppt,.pptx"
            onChange={handleFileSelect('material')}
            className="hidden"
          />
          <label htmlFor="materialInput" className="cursor-pointer block text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-green-500 text-white rounded-full p-4">
                <Upload className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-1">上传课程资料</h3>
                <p className="text-sm text-green-700">点击选择资料文件</p>
              </div>
              <div className="text-xs text-green-600 bg-white px-3 py-1 rounded-full">
                支持 PDF, Word, TXT, PPT
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 上传列表 */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">上传进度</h3>
          
          {uploads.map((upload, index) => (
            <div key={index} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{upload.file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(upload.file.size)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {upload.status === 'uploading' && (
                    <Loader className="h-5 w-5 text-blue-500 animate-spin" />
                  )}
                  {upload.status === 'processing' && (
                    <Loader className="h-5 w-5 text-yellow-500 animate-spin" />
                  )}
                  {upload.status === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {upload.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  
                  <button
                    onClick={() => removeUpload(index)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* 进度条 */}
              {upload.status === 'uploading' && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">上传中... {upload.progress}%</p>
                </div>
              )}

              {/* 处理进度 */}
              {upload.status === 'processing' && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upload.processingProgress || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    正在提取知识点... {upload.processingProgress || 0}%
                  </p>
                </div>
              )}

              {/* 完成状态 */}
              {upload.status === 'completed' && (
                <p className="text-xs text-green-600">✓ 文档处理完成，知识点已提取</p>
              )}

              {/* 错误信息 */}
              {upload.status === 'error' && upload.error && (
                <p className="text-xs text-red-600">✗ {upload.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
