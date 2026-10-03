import { useEffect, useState } from 'react'
import { useLocal } from '../local/LocalProvider'
import { database } from '../local/database'
import type { TeacherDraft } from '../domain/learning'

export default function Teacher() {
  const { spaceId } = useLocal()
  const [title, setTitle] = useState('')
  const [outline, setOutline] = useState('')
  const [message, setMessage] = useState('')
  const [records, setRecords] = useState<TeacherDraft[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (spaceId) database.teacherDrafts.where('spaceId').equals(spaceId).toArray().then(setRecords).catch(() => setMessage('无法读取本地备课草稿。')) }, [spaceId])
  async function save() {
    if (!title.trim() || !outline.trim()) { setMessage('请填写课程名称与教学大纲。'); return }
    setBusy(true)
    try {
      const record: TeacherDraft = { id: crypto.randomUUID(), spaceId, title: title.trim(), outline: outline.trim(), studentVisible: false, updatedAt: new Date().toISOString() }
      await database.transaction('rw', database.teacherDrafts, database.meta, async () => { const owner = await database.meta.get('spaceId'); if (owner?.value !== spaceId) throw new Error('本地空间已切换。'); await database.teacherDrafts.add(record) })
      setRecords(current => [...current, record]); setMessage('备课草稿已保存在当前设备，默认不向学生提供。未上传或发布到服务器。'); setTitle(''); setOutline('')
    } catch { setMessage('草稿未保存，请检查浏览器存储权限后重试。') } finally { setBusy(false) }
  }
  return <div className="page teacher-page"><div className="eyebrow">TEACHING / STUDIO</div><div className="page-heading"><div><h1>课程，不止十三门。</h1><p>从你的教学目标出发，组织自己的课程与实践路径。</p></div><span className="small-tag">设备草稿原型</span></div><div className="teacher-boundary"><span className="status-dot"/><p>教师账号、资料上传、AI 建课、学生预览与发布尚未接入。这里可保存设备草稿，不代表已建立教师身份或发布课程。</p></div><section className="teacher-grid"><div className="teacher-intro"><div className="eyebrow">从大纲开始</div><h2>让每个目标，<br/>都有可做的实践。</h2><p>定义学生需要展示什么，安排必要理论与真实操作，并留下适合的核验依据。</p><ol><li><span>01</span>组织目标与先修关系</li><li><span>02</span>连接理论、动作和作品</li><li><span>03</span>检查资料范围与答案规则</li><li><span>04</span>审阅后按明确范围发布</li></ol></div><div className="teacher-form"><label htmlFor="course-title">课程名称</label><input id="course-title" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="例如：分布式系统原理"/><label htmlFor="course-outline">教学大纲与学习目标</label><textarea id="course-outline" rows={9} value={outline} onChange={event => setOutline(event.target.value)} placeholder="写下范围、章节、学生应能完成的表现，以及适合的实践。"/><div className="privacy-default"><span aria-hidden="true">◌</span><div><strong>默认仅在当前设备保留</strong><p>后续资料上传将默认教师私有，只有明确选择学生可见的资料才可提供给学生问答。</p></div></div><button className="button primary" onClick={save} disabled={busy || !spaceId}>{busy ? '正在本地保存…' : '保存设备草稿'}<span aria-hidden="true">↓</span></button></div></section>{message && <div className="inline-message" role="status">{message}</div>}<section className="teacher-drafts"><div className="section-heading"><h2>设备备课草稿</h2><span>{records.length} 份 · 未发布</span></div>{records.length ? records.map(record => <details key={record.id}><summary><span>{record.title}</span><span>仅设备保存 · {new Date(record.updatedAt).toLocaleDateString('zh-CN')}</span></summary><p className="preserve-lines">{record.outline}</p></details>) : <p className="field-note">还没有保存的备课草稿。</p>}</section></div>
}
