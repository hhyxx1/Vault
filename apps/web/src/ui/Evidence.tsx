import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocal } from '../local/LocalProvider'
import { database } from '../local/database'
import { TRACE_OBJECTIVE, IMPLEMENT_OBJECTIVE, criterionLabels, type ArtifactRevision } from '../domain/learning'
import { isTraceResult, structuredActivityByVersion, structuredResultCorrect } from '../domain/structured'
import { liveQuery } from 'dexie'
import { helpEventsForCodeAttempt, type CodeAttempt } from '../domain/code'
import { ALGEBRA_PREDICTIONS, ALGEBRA_LABELS } from '../domain/algebra'

const ALGEBRA_MODE_TITLES = {
  group: '有限群运算表实验',
  ring: '环与域双运算表实验',
  homomorphism: '群同构映射实验',
} as const

const ALGEBRA_CRITERION_LABELS: Record<string, string> = {
  ...ALGEBRA_LABELS,
  explanation: '自己的解释',
  independent_transfer: '独立迁移到新结构',
}

function algebraPredictionText(value: string): string {
  return value === 'true' ? '我判定成立' : value === 'false' ? '我判定不成立' : '未检查'
}

export default function Evidence() {
  const { evidence, structuredAttempts, algebraAttempts, help, spaceId } = useLocal()
  const [revisions, setRevisions] = useState<ArtifactRevision[]>([])
  const [codeAttempts, setCodeAttempts] = useState<CodeAttempt[]>([])
  useEffect(() => { setCodeAttempts([]); if (!spaceId) return; const subscription = liveQuery(() => database.codeAttempts.where('spaceId').equals(spaceId).toArray()).subscribe({ next: rows => setCodeAttempts(rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt))), error: () => setError('无法读取代码运行记录。') }); return () => subscription.unsubscribe() }, [spaceId])
  const [error, setError] = useState('')
  useEffect(() => { setRevisions([]); if (!spaceId) return; const subscription = liveQuery(() => database.revisions.where('spaceId').equals(spaceId).toArray()).subscribe({ next: value => setRevisions(value.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))), error: () => setError('暂时无法读取作品版本，请重新打开页面。') }); return () => subscription.unsubscribe() }, [spaceId])
  const verifiedCount = evidence.filter(record => !record.trust).length + codeAttempts.filter(attempt => attempt.result && !attempt.resultTrust).length + structuredAttempts.filter(attempt => attempt.result && !attempt.resultTrust).length + algebraAttempts.filter(attempt => attempt.result && !attempt.resultTrust).length
  const restoredCount = evidence.filter(record => record.trust === 'client_reported').length + codeAttempts.filter(attempt => attempt.resultTrust === 'client_reported').length + structuredAttempts.filter(attempt => attempt.resultTrust === 'client_reported').length + algebraAttempts.filter(attempt => attempt.resultTrust === 'client_reported').length
  return <div className="page evidence-page"><div className="eyebrow">WORK / EVIDENCE</div><div className="page-heading"><div><h1>学过的，留下依据。</h1><p>作品、逐项核验与帮助记录，在同一条路径中可追溯。</p></div><span className="small-tag">当前本地空间</span></div>{error && <p role="alert">{error}</p>}<div className="evidence-overview"><div><strong>{revisions.length}</strong><span>已保存作品版本</span></div><div><strong>{verifiedCount}</strong><span>本机真实核验 · {restoredCount} 条恢复待复核</span></div><div><strong>{help.length}</strong><span>已披露帮助记录</span></div></div>
    {!revisions.length && !codeAttempts.length && !structuredAttempts.length && !algebraAttempts.length && <section className="empty-state"><span className="large-orbit" aria-hidden="true">◌</span><h2>你的第一个作品，从一次尝试开始。</h2><p>目前没有已保存的版本。打开工作台，亲自推演并保存自己的思路。</p><Link className="button primary" to={`/learn/${TRACE_OBJECTIVE}`}>开始栈状态推演 ↗</Link></section>}
    {codeAttempts.length > 0 && <section className="evidence-records">{codeAttempts.map(attempt => {
      const suite = attempt.result?.suite_assessment ?? null
      const relatedHelp = helpEventsForCodeAttempt(help, attempt)
      const helpProvenance = <><h3>此核验关联帮助</h3>{relatedHelp.length ? <><p className="muted">{relatedHelp.length} 条帮助在本版本核验前披露，已绑定到对应活动版本，随账号同步与恢复；查看帮助不代表达标。</p>{relatedHelp.map(event => <p className="field-note" key={event.id}>{event.kind === 'answer' ? '参考答案' : event.kind === 'agent_assist' ? '助教帮助' : '提示'} · {new Date(event.createdAt).toLocaleString('zh-CN')} · 内容版本 {event.disclosureVersion}</p>)}</> : <p className="muted">本版本核验前未查看提示或参考答案。</p>}</>
      if (suite) {
        const independent = suite.cases.filter(c => c.kind === 'independent')
        const fixed = suite.criteria.find(c => c.id === 'fixed_condition')
        const objective = attempt.learning?.context?.objectiveCode ?? ''
        const version = attempt.learning?.context?.courseVersionId ?? ''
        const headline = attempt.resultTrust ? '账号恢复的核验报告 · 待重新运行复核'
          : suite.suspected_hardcoding ? '疑似只针对样例硬编码 · 保密独立输入未通过'
          : fixed?.status === 'met' ? '多组输入核验通过 · 不代表一般掌握'
          : fixed?.status === 'not_met' ? '独立核验未通过 · 存在不符输入'
          : '部分用例待环境复核 · 不计为能力错误'
        return <article className="evidence-record" key={attempt.id}><div className="record-header"><div><span className="eyebrow">{attempt.request.language} / SEMANTIC SUITE</span><h2>独立语义核验作品</h2></div><span>{new Date(attempt.createdAt).toLocaleString('zh-CN')}</span>{objective && <Link className="text-link" to={`/learn/${objective}?courseVersion=${version}`}>回到学习工作台 ↗</Link>}</div><p>{headline}</p>
          <p className="muted">保密独立用例（输入与答案不公开）：共 {independent.length}，通过 {independent.filter(c => c.status === 'met').length}、未通过 {independent.filter(c => c.status === 'not_met').length}、待环境复核 {independent.filter(c => c.status === 'needs_review').length}。有限用例不证明一般正确，不授予独立掌握。</p>
          <details><summary>查看源文件与学习可见用例明细</summary>{Object.entries(attempt.request.files).map(([name, source]) => <div key={name}><h3>{name}</h3><pre className="artifact-source">{source}</pre></div>)}<h3>学习可见用例</h3>{suite.cases.filter(c => c.kind === 'visible').map(c => <p key={c.case_code} className="suite-case"><strong>{c.status === 'met' ? '通过' : c.status === 'not_met' ? '不符' : '待复核'}</strong>（输入 {c.stdin.replace(/\n/g, ' ').trim()}）：期望 {c.expected_stdout.replace(/\n/g, ' ').trim() || '（空）'}，实际 {c.observed_stdout.replace(/\n/g, ' ').trim() || '（空）'}。{c.reason}</p>)}<ul>{suite.criteria.map(c => <li key={c.id}><span>{c.id === 'fixed_condition' ? '本次条件' : c.id === 'explanation' ? '原理解释' : '独立迁移'}</span><span className={`criterion-status ${c.status}`}>{c.status === 'met' ? '满足' : c.status === 'not_met' ? '未满足' : '待复核'}</span></li>)}</ul><p>检查器：{suite.oracle_id}（{suite.comparator}）· {suite.scope_note}</p>{helpProvenance}</details></article>
      }
      return <article className="evidence-record" key={attempt.id}><div className="record-header"><div><span className="eyebrow">{attempt.request.language} / TOOL FACT</span><h2>代码运行作品</h2></div><span>{new Date(attempt.createdAt).toLocaleString('zh-CN')}</span><Link className="text-link" to={`/code?activity=${encodeURIComponent(attempt.activityKey)}&revision=${attempt.id}`}>查看这一版代码 ↗</Link></div><p>{attempt.resultTrust ? '账号恢复的运行报告 · 待重新运行复核' : attempt.result ? '本机实际运行结果 · 不代表课程目标达标' : '代码已保存 · 尚未取得运行结果'}</p><details><summary>查看源文件、输入与实际输出</summary>{Object.entries(attempt.request.files).map(([name, source]) => <div key={name}><h3>{name}</h3><pre className="artifact-source">{source}</pre></div>)}<h3>标准输入</h3><pre>{attempt.request.stdin || '（无输入）'}</pre>{attempt.result && <><h3>标准输出</h3><pre>{attempt.result.stdout || '（无输出）'}</pre><h3>错误输出</h3><pre>{attempt.result.stderr || '（无错误输出）'}</pre><p>运行环境：{attempt.result.runtime_profile}{attempt.result.truncated ? ' · 输出已截断' : ''}</p></>}{helpProvenance}</details></article>
    })}</section>}
    <section className="evidence-records">{revisions.map(revision => {
      const related = evidence.filter(record => record.revisionId === revision.revisionId)
      return <article className="evidence-record" key={revision.revisionId}><div className="record-header"><div><span className="eyebrow">作品版本 {revision.version}</span><h2>{revision.id === TRACE_OBJECTIVE ? '栈状态推演' : '括号匹配实现'}</h2></div><span>{new Date(revision.updatedAt).toLocaleString('zh-CN')}</span><Link className="text-link" to={`/learn/${revision.id}`}>继续编辑 ↗</Link></div><p className="record-goal">{revision.goal}</p><details><summary>查看此版本的作品</summary>{revision.id === TRACE_OBJECTIVE ? <div className="artifact-table"><table><thead><tr><th>步骤</th><th>栈内容</th><th>输出</th><th>下溢</th></tr></thead><tbody>{revision.trace.map((row, index) => <tr key={index}><td>{index + 1}</td><td><code>{row.stack || '未填写'}</code></td><td>{row.output || '无输出／未填写'}</td><td>{row.underflow ? '是' : '否'}</td></tr>)}</tbody></table></div> : <pre className="artifact-source">{revision.code}</pre>}<h3>自己的解释</h3><p className="preserve-lines">{revision.explanation || '此版本没有填写解释。'}</p></details>{related.length ? related.map(record => <div className="stored-result" key={record.id}><strong>{record.trust === 'client_reported' ? '云端恢复的客户端记录 · 待复核' : record.result.trace_correct ? '状态推演正确 · 目标仍待复核' : '有核验条件未满足'}</strong>{record.trust === 'client_reported' && <p className="imported-evidence-note">以下内容是历史客户端报告，尚未经云端重新核验，不计入图谱有效评估或达标目标。</p>}<p>{record.result.summary}</p><ul>{record.result.criteria.map(criterion => <li key={criterion.id}><span>{criterionLabels[criterion.id] ?? criterion.id}</span><span className={`criterion-status ${criterion.status}`}>{record.trust === 'client_reported' ? '历史报告 · 待复核' : criterion.status === 'met' ? '满足' : criterion.status === 'not_met' ? '未满足' : '待人工复核'}</span></li>)}</ul><details><summary>核验依据与帮助范围</summary><dl className="provenance"><dt>标准版本</dt><dd>{record.result.standard_version}</dd><dt>检查器</dt><dd>{record.result.checker_version}</dd><dt>真实运行环境</dt><dd>{typeof record.result.runtime === 'string' ? record.result.runtime : JSON.stringify(record.result.runtime)}</dd><dt>作品 hash</dt><dd>{record.result.artifact_hash}</dd><dt>此核验关联帮助</dt><dd>{record.helpEventIds.length} 条</dd><dt>课程内容状态</dt><dd>局部工程样例，尚未完成教学审校</dd></dl>{help.filter(event => record.helpEventIds.includes(event.id)).map(event => <p className="field-note" key={event.id}>{event.kind === 'answer' ? '参考答案' : '提示'} · {new Date(event.createdAt).toLocaleString('zh-CN')} · {event.disclosureVersion}</p>)}</details></div>) : <p className="unverified-note">已保存作品，尚无核验结果。保存本身不增加达标目标数。</p>}</article>
    })}</section>
    {structuredAttempts.length > 0 && <section className="evidence-records structured-records">{structuredAttempts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(attempt => {
      const activity = structuredActivityByVersion(attempt.activityVersion)
      const correct = attempt.result ? structuredResultCorrect(attempt.result) : false
      const kindLabel = attempt.result ? (isTraceResult(attempt.result) ? '逐条件状态推演' : '括号判定') : '结构化活动'
      return <article className="evidence-record" key={attempt.id}><div className="record-header"><div><span className="eyebrow">{kindLabel}</span><h2>{activity?.title ?? attempt.activityVersion}</h2></div><span>{new Date(attempt.updatedAt).toLocaleString('zh-CN')}</span><Link className="text-link" to={`/practice/${attempt.activityVersion}`}>继续推演 ↗</Link></div>{attempt.result ? <div className="stored-result"><strong>{attempt.resultTrust ? '本机恢复记录 · 待复核' : correct ? '逐条件核验通过 · 目标仍待复核' : '有核验条件未满足'}</strong><p>{attempt.result.summary}</p><ul>{attempt.result.criteria.map(criterion => <li key={criterion.id}><span>{criterion.title}</span><span className={`criterion-status ${criterion.status}`}>{criterion.status === 'met' ? '满足' : criterion.status === 'not_met' ? '未满足' : '待人工复核'}</span></li>)}</ul></div> : <p className="unverified-note">已保存推演，尚无核验结果。保存本身不增加达标目标数。</p>}</article>
    })}</section>}
    {algebraAttempts.length > 0 && <section className="evidence-records algebra-records">{algebraAttempts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(attempt => {
      const result = attempt.result
      return <article className="evidence-record" key={attempt.id}>
        <div className="record-header"><div><span className="eyebrow">{ALGEBRA_MODE_TITLES[attempt.mode]} / FINITE CHECK</span><h2>{attempt.objectiveCode}</h2></div><span>{new Date(attempt.updatedAt).toLocaleString('zh-CN')}</span><Link className="text-link" to={`/learn/${attempt.objectiveCode}?courseVersion=${attempt.courseVersionId}`}>继续这张运算表 ↗</Link></div>
        {result ? <div className="stored-result"><strong>{attempt.resultTrust ? '本机恢复记录 · 待重新穷举复核' : result.prediction_correct ? '完整有限表穷举核验：预测与判定一致 · 目标仍待复核' : '存在预测与穷举判定不一致，已保留具体反例'}</strong>{attempt.resultTrust && <p className="imported-evidence-note">该有限代数记录由云端历史客户端报告恢复，尚未在本机重新穷举核验，不计入图谱有效评估或达标目标。</p>}<ul>{result.criteria.map(criterion => <li key={criterion.id}><span>{ALGEBRA_CRITERION_LABELS[criterion.id] ?? criterion.id}</span><span className={`criterion-status ${criterion.status}`}>{attempt.resultTrust ? '历史报告 · 待复核' : criterion.status === 'met' ? '满足' : criterion.status === 'not_met' ? '未满足' : '待人工复核'}</span></li>)}</ul></div> : <p className="unverified-note">已保存运算表实验，尚无核验结果。保存本身不增加达标目标数。</p>}
        <details><summary>查看性质预测、解释与穷举依据</summary><h3>我的性质预测</h3><ul>{ALGEBRA_PREDICTIONS[attempt.mode].map(key => <li key={key}><span>{ALGEBRA_LABELS[key]}</span><span>{algebraPredictionText(attempt.predictions[key] ?? '')}</span></li>)}</ul><h3>自己的解释</h3><p className="preserve-lines">{attempt.explanation || '此版本没有填写解释。'}</p><dl className="provenance"><dt>标准版本</dt><dd>{result?.standard_version ?? 'finite-algebra-exhaustive-v1'}</dd><dt>检查器</dt><dd>{result?.checker_version ?? 'finite-algebra-exhaustive-v1'}</dd><dt>作品 hash</dt><dd>{result?.artifact_hash || '（尚未核验）'}</dd></dl></details>
      </article>
    })}</section>}
    <div className="evidence-bottom"><p>解释和独立应用没有真实复核时，完整目标保持未达标。</p><Link className="text-link" to={`/learn/${IMPLEMENT_OBJECTIVE}`}>继续括号匹配练习 →</Link></div>
  </div>
}
