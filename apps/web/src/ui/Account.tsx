import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../local/AuthProvider'
import { useLocal } from '../local/LocalProvider'

type Mode = 'login' | 'register' | 'verify' | 'reset_request' | 'reset_confirm'
const headings: Record<Mode, string> = { login: '继续自己的学习路径。', register: '建立自己的学习档案。', verify: '先确认邮箱属于你。', reset_request: '找回自己的学习路径。', reset_confirm: '为账号设置新密码。' }
const actions: Record<Mode, string> = { login: '登录并关联本机记录', register: '创建账号，确认邮箱', verify: '确认邮箱', reset_request: '申请密码重置', reset_confirm: '确认重置密码' }
export default function AccountPage() {
  const auth = useAuth(); const local = useLocal()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [type, setType] = useState<'student' | 'teacher'>('student'); const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [failed, setFailed] = useState(false)
  const resetMode = mode === 'reset_request' || mode === 'reset_confirm'
  const needsToken = mode === 'verify' || mode === 'reset_confirm'
  const needsPassword = mode === 'login' || mode === 'register' || mode === 'reset_confirm'
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1)); const verify = params.get('verify_token'); const reset = params.get('reset_token')
    if (verify || reset) { setToken((verify || reset)!); setMode(reset ? 'reset_confirm' : 'verify'); window.history.replaceState(window.history.state, '', window.location.pathname) }
  }, [])
  function changeMode(value: Mode) { setMode(value); setMessage(''); setFailed(false); setPassword(''); setToken('') }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setFailed(false)
    try {
      if (mode === 'register') {
        await auth.register(email.trim(), password, name.trim(), type); setPassword(''); setMode('verify')
        setMessage('注册请求已接收，完成邮箱确认后才能登录。当前预览的确认码保存在开发收件箱。')
      } else if (mode === 'verify') {
        await auth.verifyEmail(token.trim()); setToken(''); setMode('login'); setMessage('邮箱已确认。现在可以登录并关联已有学习记录。')
      } else if (mode === 'reset_request') {
        await auth.requestPasswordReset(email.trim()); setMode('reset_confirm'); setMessage('如果该邮箱对应账号，将生成密码重置消息。当前预览请使用开发收件箱中的重置码。')
      } else if (mode === 'reset_confirm') {
        await auth.confirmPasswordReset(token.trim(), password); setPassword(''); setToken(''); setMode('login'); setMessage('密码已重置，旧会话已失效。请使用新密码登录。')
      } else {
        await auth.login(email.trim(), password); setPassword(''); setMessage('已登录。正在关联本机未绑定学习记录；逐项确认后才会显示已同步。')
      }
    } catch (failure) { setFailed(true); setMessage(failure instanceof Error ? failure.message : '账号操作未完成，请重试。') }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true); setFailed(false)
    try { await auth.logout(); setMessage('已退出，当前打开新的访客空间。该账号的本机记录已保留，并与其他账号隔离。') }
    catch (failure) { setFailed(true); setMessage(failure instanceof Error ? failure.message : '退出未完成，请联网后重试。') }
    finally { setBusy(false) }
  }
  return <div className="page account-page">
    <div className="eyebrow">YOUR ACCOUNT / CONTINUITY</div>
    <div className="page-heading"><div><h1>换一台设备，<br className="account-heading-break"/>接着学。</h1><p>把自己的学习路径、作品与记录关联到同一个账号。</p></div><span className="small-tag">{auth.account ? (auth.offline ? '离线 · 本机账号空间' : '已登录 · 独立学习空间') : '访客也可直接学习'}</span></div>
    <section className="account-layout">
      <div className="account-card">
        {auth.account && !resetMode ? <>
          <div className="eyebrow">当前账号</div><h2>{auth.account.display_name}</h2><p className="account-email">{auth.account.email}</p>
          <div className="account-role"><span className="small-tag">{auth.account.account_type === 'teacher' ? '教师账号' : '学生账号'}</span>{auth.account.account_type === 'teacher' && <span className="small-tag">教师认证{({ pending: '待审核', verified: '已通过', rejected: '未通过', suspended: '已暂停' }[auth.account.teacher_verification_state ?? 'pending'])}</span>}</div>
          {auth.account.account_type === 'teacher' && auth.account.teacher_verification_state !== 'verified' && <p className="field-note">教师账号可保留私人备课草稿。认证未通过时不能发布课程或查看学生学习数据。</p>}
          <div className="account-summary"><strong>{local.syncing ? '正在确认与同步…' : local.syncError ? '同步仍需处理' : '查看每条记录的同步状态'}</strong><p>{auth.offline ? '在线会话尚未重新确认，云同步暂停。本机作品可以继续编辑。' : '本机保存和云端确认分别记录。发生冲突时保留本机作品，等待你的选择。'}</p></div>
          <Link className="button primary" to="/local">管理记录与同步 <span aria-hidden="true">↗</span></Link>
          <button className="text-link account-logout" onClick={logout} disabled={busy}>{busy ? '正在退出…' : '退出账号，打开新访客空间'}</button>
          <button className="text-link account-logout" onClick={() => { setEmail(auth.account!.email); changeMode('reset_request') }}>重置账号密码</button>
        </> : <>
          <div className="account-tabs" role="group" aria-label="账号操作">
            <button aria-pressed={mode === 'login'} onClick={() => changeMode('login')}>登录</button>
            <button aria-pressed={mode === 'register'} onClick={() => changeMode('register')}>创建账号</button>
            <button aria-pressed={mode === 'verify'} onClick={() => changeMode('verify')}>确认邮箱</button>
          </div>
          <h2>{headings[mode]}</h2>
          <form onSubmit={submit} className="account-form">
            {!needsToken && <><label htmlFor="account-email">邮箱</label><input id="account-email" type="email" autoComplete="email" value={email} maxLength={320} required onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></>}
            {mode === 'register' && <>
              <label htmlFor="account-name">显示名称</label><input id="account-name" autoComplete="nickname" maxLength={80} value={name} onChange={event => setName(event.target.value)} required/>
              <fieldset className="account-types"><legend>账号类型</legend><label><input type="radio" name="account-type" value="student" checked={type === 'student'} onChange={() => setType('student')}/><span>学生<small>自学与持续练习</small></span></label><label><input type="radio" name="account-type" value="teacher" checked={type === 'teacher'} onChange={() => setType('teacher')}/><span>教师<small>独立账号，认证后教学</small></span></label></fieldset>
            </>}
            {needsToken && <><label htmlFor="account-confirmation">{mode === 'verify' ? '邮箱确认码' : '密码重置码'}</label><input id="account-confirmation" autoComplete="off" type="password" required minLength={32} maxLength={128} value={token} onChange={event => setToken(event.target.value)}/></>}
            {needsPassword && <><label htmlFor="account-password">{mode === 'reset_confirm' ? '新密码' : '密码'} {mode !== 'login' && <span>12 至 128 个字符</span>}</label><input id="account-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)}/></>}
            <button className="button primary" type="submit" disabled={busy || auth.offline}>{busy ? '正在处理…' : actions[mode]}<span aria-hidden="true">→</span></button>
            {mode === 'login' && <><p className="field-note">登录即自动关联尚未绑定的本机记录。关联中的记录始终保留原归属；切换账号不会重新认领。</p><button className="text-link" type="button" onClick={() => changeMode('reset_request')}>忘记密码，申请重置 →</button></>}
            {mode === 'reset_request' && <button className="text-link" type="button" onClick={() => changeMode('reset_confirm')}>已有密码重置码 →</button>}
            {mode === 'reset_confirm' && <p className="field-note">完成重置后，所有旧登录会话失效。作品仍保留在原账号空间。</p>}
            {import.meta.env.DEV && <p className="field-note">本机开发预览，邮件仅保存在开发收件箱，尚未实际投递。</p>}
          </form>
        </>}
        {message && <p className={`inline-message ${failed ? 'account-error' : ''}`} role={failed ? 'alert' : 'status'}>{message}</p>}
        {auth.error && <p className="inline-message" role="status">{auth.error}<button className="text-link" onClick={() => auth.refreshSession()}>重新确认会话</button></p>}
      </div>
      <div className="account-story"><div className="account-path" aria-hidden="true"><span/><i/><span/><i/><span/></div><h2>已有的尝试，<br/>无需重新开始。</h2><p>登录会自动关联这个浏览器中尚未绑定的学习记录。已绑定或正在关联其他账号的记录，不会转给当前账号。</p><ol><li><span>01</span><div><strong>本机先保存</strong><p>没有网络也能继续编辑，记录保留在当前空间。</p></div></li><li><span>02</span><div><strong>确认归属，再逐项同步</strong><p>成功、待重试与冲突分别显示，不把登录等同于已同步。</p></div></li><li><span>03</span><div><strong>其他设备恢复作品</strong><p>同步恢复的历史核验作为待复核记录，不直接增加达标数。</p></div></li></ol><Link className="text-link" to="/atlas">{auth.account ? '继续自己的课程学习 →' : '先以访客身份开始学习 →'}</Link></div>
    </section><div className="account-foot"><span>本机 → 个人账号 → 跨设备继续</span><Link to="/local">查看当前数据边界 ↗</Link></div>
  </div>
}
