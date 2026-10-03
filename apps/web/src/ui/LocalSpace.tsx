import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocal } from '../local/LocalProvider'
import { database } from '../local/database'
import { TRACE_OBJECTIVE } from '../domain/learning'

export default function LocalSpace() {
  const { spaceId, evidence, help, lastObjective } = useLocal()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function exportSpace() {
    setBusy(true); setMessage('')
    try {
      const data = await database.transaction('r', [database.drafts, database.revisions, database.evidence, database.help, database.teacherDrafts], async () => ({
        schemaVersion: '1', kind: 'qionglong-unbound-local-export', exportedAt: new Date().toISOString(), spaceId,
        drafts: await database.drafts.where('spaceId').equals(spaceId).toArray(), revisions: await database.revisions.where('spaceId').equals(spaceId).toArray(), evidence: await database.evidence.where('spaceId').equals(spaceId).toArray(), help: await database.help.where('spaceId').equals(spaceId).toArray(), teacherDrafts: await database.teacherDrafts.where('spaceId').equals(spaceId).toArray(),
      }))
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `qionglong-local-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('已生成本地导出文件，请妥善保存。其中包含你的作品与学习记录。')
    } catch { setMessage('导出未完成，请检查本地存储后重试。') } finally { setBusy(false) }
  }
  async function persistStorage() {
    try { const accepted = navigator.storage?.persist ? await navigator.storage.persist() : false; setMessage(accepted ? '浏览器已允许持久存储。仍建议定期导出重要作品。' : '浏览器没有授予持久存储。请定期导出，避免浏览器清理造成丢失。') } catch { setMessage('无法申请持久存储。请定期导出重要作品。') }
  }
  return <div className="page local-page"><div className="eyebrow">YOUR LOCAL SPACE</div><div className="page-heading"><div><h1>学习先属于你。</h1><p>不用账号，也能保留自己的思路、作品与实际核验。</p></div><span className="small-tag"><span className="status-dot"/>未登录 · 本地空间</span></div><section className="local-space-layout"><div className="local-statement"><span className="large-orbit" aria-hidden="true">◌</span><h2>保存在这个浏览器里，<br/>回来继续。</h2><p>目前使用未绑定的本地空间。成功保存的记录可以在刷新后恢复；换浏览器、清除站点数据或设备损坏可能造成丢失。</p><Link className="button primary" to={`/learn/${lastObjective ?? TRACE_OBJECTIVE}`}>回到学习工作台 <span aria-hidden="true">↗</span></Link></div><div className="local-detail"><h3>当前保存边界</h3><dl><dt>个人学习档案</dt><dd>本设备 IndexedDB，本人可导出</dd><dt>在线核验</dt><dd>临时处理本次推演与解释；保存结果后请求服务清理</dd><dt>云端同步</dt><dd>账号与同步功能尚未开放，当前没有云端个人档案</dd><dt>教师关联</dt><dd>尚未开放；当前记录没有分享给教师</dd></dl><div className="local-counts"><span>{evidence.length} 条真实核验</span><span>{help.length} 条帮助记录</span></div><div className="local-actions"><button className="button secondary" onClick={exportSpace} disabled={busy || !spaceId}>{busy ? '正在导出…' : '导出全部本地记录 ↓'}</button><button className="text-link" onClick={persistStorage}>申请浏览器持久存储</button></div></div></section><section className="cloud-boundary"><span className="eyebrow">账号与同步 · 后续接入</span><h2>登录后承接，不让已有学习重新开始。</h2><p>账号功能接入后，将确认本地空间归属，再将记录同步到本人账号。当前没有可用的登录入口，不会将点击登录视为已经同步。</p></section>{message && <div className="inline-message" role="status">{message}</div>}</div>
}
