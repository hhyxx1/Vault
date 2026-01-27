import { Routes, Route, Navigate } from 'react-router-dom'
import StudentLayout from '@/layouts/StudentLayout'
import TeacherLayout from '@/layouts/TeacherLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import StudentQA from '@/pages/student/QA'
import StudentSurvey from '@/pages/student/Survey'
import StudentProfile from '@/pages/student/Profile'
import TeacherDashboard from '@/pages/teacher/Dashboard'
import TeacherSurvey from '@/pages/teacher/Survey'
import TeacherProfile from '@/pages/teacher/Profile'

const AppRouter = () => {
  return (
    <Routes>
      {/* 登录和注册路由 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 学生端路由 */}
      <Route path="/student" element={<StudentLayout />}>
        <Route index element={<Navigate to="qa" replace />} />
        <Route path="qa" element={<StudentQA />} />
        <Route path="survey" element={<StudentSurvey />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      {/* 教师端路由 */}
      <Route path="/teacher" element={<TeacherLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="survey" element={<TeacherSurvey />} />
        <Route path="profile" element={<TeacherProfile />} />
      </Route>

      {/* 默认重定向到登录页 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default AppRouter
