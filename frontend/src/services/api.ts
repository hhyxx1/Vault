import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 0,  // 无超时限制
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
    // 直接返回完整的response，让调用方自己取.data
    return response
  },
  (error) => {
    // 统一错误处理
    console.error('API Error:', error)
    
    // 处理401未授权错误（token过期或无效）
    // 登录/注册/找回密码接口本身的401应交给页面展示错误，不应强制跳转导致"刷新"。
    const requestUrl = String(error?.config?.url || '')
    const isAuthApi = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register') || requestUrl.includes('/auth/forgot-password')
    const path = window.location.pathname
    const isAuthPage = path === '/login' || path === '/register' || path === '/forgot-password'

    if (error.response && error.response.status === 401 && !isAuthApi && !isAuthPage) {
      console.warn('Token过期或无效，跳转到登录页')
      // 清除本地存储
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // 跳转到登录页
      window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)

export default apiClient
