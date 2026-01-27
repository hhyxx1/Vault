import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'student' | 'teacher'
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  // 检查是否已登录
  const token = localStorage.getItem('token')
  const userStr = localStorage.getItem('user')
  
  // 未登录，重定向到登录页
  if (!token || !userStr) {
    return <Navigate to="/login" replace />
  }

  // 如果指定了角色要求，检查用户角色
  if (requiredRole) {
    try {
      const user = JSON.parse(userStr)
      
      // 角色不匹配，重定向到对应角色的首页
      if (user.role !== requiredRole) {
        if (user.role === 'student') {
          return <Navigate to="/student" replace />
        } else if (user.role === 'teacher') {
          return <Navigate to="/teacher" replace />
        }
      }
    } catch (error) {
      // 用户信息解析失败，清除并重定向到登录页
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return <Navigate to="/login" replace />
    }
  }

  // 验证通过，渲染子组件
  return <>{children}</>
}

export default ProtectedRoute
