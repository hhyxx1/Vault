import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppShell, AppError } from './ui/AppShell'
import { LocalProvider } from './local/LocalProvider'
import { AuthProvider } from './local/AuthProvider'
import { Landing } from './ui/Landing'
import './styles.css'

const Atlas = React.lazy(() => import('./ui/Atlas'))
const Workspace = React.lazy(() => import('./ui/Workspace'))
const Evidence = React.lazy(() => import('./ui/Evidence'))
const LocalSpace = React.lazy(() => import('./ui/LocalSpace'))
const Teacher = React.lazy(() => import('./ui/Teacher'))
const Account = React.lazy(() => import('./ui/Account'))
const PersonalCourses = React.lazy(() => import('./ui/PersonalCourses'))
const pending = (child: React.ReactNode) => <Suspense fallback={<div className="page-loading" role="status">正在打开学习空间…</div>}>{child}</Suspense>
const router = createBrowserRouter([
  { element: <AuthProvider><LocalProvider><AppShell /></LocalProvider></AuthProvider>, errorElement: <AppError />, children: [
    { path: '/', element: <Landing /> },
    { path: '/atlas', element: pending(<Atlas />) },
    { path: '/learn/:objectiveId', element: pending(<Workspace />) },
    { path: '/evidence', element: pending(<Evidence />) },
    { path: '/local', element: pending(<LocalSpace />) },
    { path: '/teacher', element: pending(<Teacher />) },
    { path: '/account', element: pending(<Account />) },
    { path: '/my-courses', element: pending(<PersonalCourses />) },
    { path: '/my-courses/:courseId', element: pending(<PersonalCourses />) },
    { path: '*', element: <div className="page"><h1>这条学习路径暂不存在</h1><a href="/">返回学习入口</a></div> },
  ] },
])

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
