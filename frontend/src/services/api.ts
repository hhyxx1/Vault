import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加token等认证信息
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    // 统一错误处理
    console.error('API Error:', error)
    
    // 处理401未授权错误（token过期或无效）
    if (error.response && error.response.status === 401) {
      console.warn('Token过期或无效 (登录绕过模式中，不跳转)')
      // 清除本地存储
      // localStorage.removeItem('token')
      // localStorage.removeItem('user')
      // 跳转到登录页
      // window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)

export default apiClient
