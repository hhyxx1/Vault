import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import StudentLayout from '@/layouts/StudentLayout'
import TeacherLayout from '@/layouts/TeacherLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import StudentQA from '@/pages/student/QA'
import StudentSurvey from '@/pages/student/Survey'
import StudentSurveyTake from '@/pages/student/Survey/Take'
import StudentSurveyDetail from '@/pages/student/Survey/Detail'
import StudentProfile from '@/pages/student/Profile'
import TeacherDashboard from '@/pages/teacher/Dashboard'
import TeacherSurvey from '@/pages/teacher/Survey'
import TeacherProfile from '@/pages/teacher/Profile'
import CourseKnowledgeBase from '@/pages/teacher/CourseKnowledgeBase'
import AIDashboard from '@/components/Dashboard'
import AIStudentProfile from '@/components/StudentProfile'
import SharedQAView from '@/pages/SharedQA'

const AIStudentProfileRoute = () => {
  const { id } = useParams()
  return <AIStudentProfile studentId={id ?? ''} />
}

const AppRouter = () => {
  return (
    <Routes>
      {/* 登录和注册路由（公开访问） */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 学生端路由（需要登录且角色为student） */}
      <Route 
        path="/student" 
        element={
          <ProtectedRoute requiredRole="student">
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="qa" replace />} />
        <Route path="qa" element={<StudentQA />} />
        <Route path="survey" element={<StudentSurvey />} />
        <Route path="survey/:surveyId/take" element={<StudentSurveyTake />} />
        <Route path="survey/:surveyId/detail" element={<StudentSurveyDetail />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      {/* 教师端路由（需要登录且角色为teacher） */}
      <Route 
        path="/teacher" 
        element={
          <ProtectedRoute requiredRole="teacher">
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="ai/dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="survey" element={<TeacherSurvey />} />
        <Route path="profile" element={<TeacherProfile />} />
        <Route path="course/:courseId/knowledge-base" element={<CourseKnowledgeBase />} />
        <Route path="ai/dashboard" element={<AIDashboard />} />
        <Route path="ai/student/:id" element={<AIStudentProfileRoute />} />
      </Route>

      {/* 分享链接路由（公开访问） */}
      <Route path="/qa/share/:shareCode" element={<SharedQAView />} />

      {/* 默认重定向到登录页 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* 404页面也重定向到登录页 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default AppRouter
