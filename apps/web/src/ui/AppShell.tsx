import { NavLink, Outlet, Link, useLocation, useRouteError } from 'react-router-dom'
import { useLocal } from '../local/LocalProvider'
import { useEffect } from 'react'
import { useAuth } from '../local/AuthProvider'

function Mark() {
  return <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 29a16 16 0 0 1 32 0M11 29a9 9 0 0 1 18 0"/><path d="M20 7v5"/><circle cx="20" cy="9" r="2"/></svg>
}

export function AppShell() {
  const { error } = useLocal()
  const { account } = useAuth()
  const location = useLocation()
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo(0, 0) }, [location.pathname])
  return <>
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className="topbar">
      <Link className="brand" to="/" aria-label="穹隆 学习入口"><Mark /><span>穹隆<small>QIONGLONG</small></span></Link>
      <nav className="main-nav" aria-label="主要导航">
        <NavLink to="/" end>探索</NavLink><NavLink to="/my-courses">我的课程</NavLink><NavLink to="/atlas">知识图谱</NavLink><NavLink to="/evidence">学习证据</NavLink><NavLink className="mobile-teacher-link" to="/teacher">教师备课</NavLink>
      </nav>
      <div className="topbar-actions"><Link className="teacher-link" to="/teacher">教师备课 <span aria-hidden="true">↗</span></Link><Link className="local-indicator" to="/local"><span className="status-dot"/>{account ? '我的记录' : '本地空间'}</Link><Link className="account-nav" to="/account">{account ? '账号' : '登录'}</Link></div>
    </header>
    {error && <div className="global-warning" role="alert">{error}</div>}
    <main id="main-content" tabIndex={-1}><Outlet /></main>
    <footer className="footer"><Link to="/">穹隆 · 让学习留下证据</Link><span>理解 · 实践 · 核验 · 再出发</span><Link to="/local">{account ? '查看本机与云端记录 ↗' : '数据保存在本设备 ↗'}</Link></footer>
  </>
}

export function AppError() {
  const error = useRouteError()
  return <main className="page error-page"><div className="eyebrow">暂时无法打开</div><h1>学习可以稍后继续</h1><p>页面遇到了异常，本地已经成功保存的作品不会因此被清除。</p><pre>{error instanceof Error ? error.message : '请重新打开页面。'}</pre><a className="button primary" href="/">返回学习入口</a></main>
}
