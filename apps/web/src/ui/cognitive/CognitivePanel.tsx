import type { CognitiveEdge, CognitiveGraph, CognitiveNode } from '../../domain/cognitive-graph'
import { courseRelationLabels } from '../../domain/course-map'
import { stateLabels } from '../../domain/learning'
import type { ObjectiveCognition } from '../../domain/learner-cognition'

export type LearnTarget = {
  href: string
  canLearn: boolean
  label: string
  note: string
}

const edgeLabels: Record<CognitiveEdge['kind'], string> = {
  contains: '包含',
  mandatory_prerequisite: '严格先修',
  conceptual_association: '概念关联',
  application: '后续应用',
  recommendation: '推荐',
  influence: '潜在影响（学习者推断）',
}

const strengthLabels: Record<string, string> = {
  verified: '达标级证据',
  partial: '部分级证据',
  caution: '显示需要修正',
  unverified: '仅记录',
}

const conditionStatusLabels: Record<string, string> = { met: '满足', not_met: '未满足', needs_review: '待复核' }

const stateMeaning: Record<string, string> = {
  verified: '在记录条件下已满足该目标的当前必要标准，并有可核验的作品或审阅签署。',
  partial: '有可信依据支持部分条件（或在使用帮助后完成），仍缺独立解释或迁移等条件。',
  consolidate: '有效证据显示当前必要表现不足，需要针对具体条件继续修正。',
  unknown: '尚无足够可靠的依据。未评估保持未知，不等于未掌握，也不自动标为薄弱。',
}

function timeText(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN') : '时间未记录'
}

function CognitionBody({ cognition, graph, learnTargetOf, onSelect }: {
  cognition: ObjectiveCognition
  graph: CognitiveGraph
  learnTargetOf: (code: string) => LearnTarget
  onSelect: (nodeId: string) => void
}) {
  const nodeId = `objective:${cognition.objectiveId}`
  const nodeByCode = new Map(graph.nodes.filter(item => item.objectiveCode).map(item => [item.objectiveCode!, item]))
  const relations = graph.edges.filter(edge =>
    (edge.kind === 'mandatory_prerequisite' || edge.kind === 'conceptual_association' || edge.kind === 'application' || edge.kind === 'influence')
    && (edge.from === nodeId || edge.to === nodeId),
  )
  const target = learnTargetOf(cognition.code)
  const actionNote = target.note

  return <>
    <div className="cog-panel-state-block">
      <span className={`cog-state-pill state-${cognition.state}`}>{stateLabels[cognition.state]}</span>
      <p>{stateMeaning[cognition.state]}</p>
    </div>

    <section className="cog-section">
      <h3>判断依据</h3>
      {cognition.evidence.length ? <ul className="cog-evidence-list">{cognition.evidence.map(item => <li key={item.kind}>
        <div className="cog-evidence-head"><strong>{item.label}</strong><span className={`cog-strength strength-${item.strength}`}>{strengthLabels[item.strength]}</span></div>
        <p>{item.detail}</p>
        <small>{timeText(item.at)}</small>
      </li>)}</ul> : <p className="cog-muted">这个目标还没有任何可信记录。打开页面、阅读或聊天不会产生依据，也不会点亮它。</p>}
      {(cognition.help.hint || cognition.help.answer || cognition.help.agent) ? <p className="cog-help-note">
        已记录帮助披露：提示 {cognition.help.hint} 次 · 参考答案 {cognition.help.answer} 次 · 助手协助 {cognition.help.agent} 次。使用帮助的记录与独立完成分开评估。
      </p> : <p className="cog-help-note">该目标没有记录到帮助披露，说明相关结论来自独立完成的学习记录。</p>}
    </section>

    <section className="cog-section">
      <h3>必要表现与当前依据</h3>
      {cognition.criteria?.length ? <ul className="cog-criteria-list">{cognition.criteria.map(row => <li key={row.id}>
        <div><strong>{row.id}</strong><span className={`cog-condition-status ${row.status}`}>{conditionStatusLabels[row.status]}</span></div>
        {row.reason && <p>{row.reason}</p>}
      </li>)}</ul> : <p className="cog-muted">当前证据没有逐条件报告，无法确定每一项必要表现的满足情况。</p>}
    </section>

    <section className="cog-section">
      <h3>已发现的问题</h3>
      {cognition.flags.length ? <ul className="cog-flag-list">{cognition.flags.map(flag => <li key={flag.id} className={`tone-${flag.tone}`}>
        <strong>{flag.label}</strong><p>{flag.detail}</p>
      </li>)}</ul> : <p className="cog-muted">尚未发现需要修正的记录；缺少诊断依据时保持空白，不做推测。</p>}
    </section>

    <section className="cog-section">
      <h3>知识关联与影响</h3>
      {relations.length ? <ul className="cog-relation-list">{relations.map(edge => {
        const otherId = edge.from === nodeId ? edge.to : edge.from
        const other = graph.nodes.find(item => item.id === otherId)
        const direction = edge.kind === 'conceptual_association' ? '↔' : edge.from === nodeId ? '→' : '←'
        return <li key={edge.id} className={`origin-${edge.origin}`}>
          <button type="button" onClick={() => other && onSelect(other.id)}>
            <span className={`cog-relation-kind kind-${edge.kind}`}>{edgeLabels[edge.kind]}</span>
            <span className="cog-relation-text">{direction} {other?.label ?? '未知目标'}</span>
            {other?.objectiveCode && nodeByCode.get(other.objectiveCode) && <span className={`cog-mini-state state-${nodeByCode.get(other.objectiveCode)!.state}`}>{stateLabels[nodeByCode.get(other.objectiveCode)!.state ?? 'unknown']}</span>}
          </button>
          {edge.origin === 'learner' && <small>依据该生真实证据推断，不代表后继目标一定受限，也不会传播掌握结论。</small>}
          {edge.origin === 'curriculum' && <small>课程声明关系{edge.source ? ` · 来源：${edge.source === 'engineering_example_pending_review' ? '工程样例，待教研审校' : edge.source}` : ''}</small>}
        </li>
      })}</ul> : <p className="cog-muted">这个目标在当前课程版本没有声明的前修、关联或应用关系。</p>}
    </section>

    <section className="cog-section cog-next-action">
      <h3>下一步</h3>
      <p>{roadmapText(cognition)}</p>
      <div className="cog-actions">
        {target.canLearn
          ? <a className="cog-button primary" href={target.href}>{target.label}</a>
          : <span className="cog-chip">当前活动待建设</span>}
        <a className="cog-button ghost" href={target.href}>检查先修与作品</a>
        <a className="cog-button ghost" href="/evidence">查看学习证据</a>
      </div>
      {!target.canLearn && <p className="cog-muted">该目标保留在声明范围内；尚未提供可提交的实践或核验路径，状态保持未评估。</p>}
      <p className="cog-muted">{actionNote}</p>
    </section>
  </>
}

function roadmapText(cognition: ObjectiveCognition) {
  if (cognition.state === 'consolidate') return '先回到具体条件：对照上面未满足的条件逐项修正，再重新核验；不要一次答对就判定掌握。'
  if (cognition.state === 'partial') return '保留已有依据，补上原理解释与独立迁移的新情境尝试，再把结论提交人工资讯复核。'
  if (cognition.state === 'verified') return '已有达标证据。可以继续向后继目标推进；如长时间未再检验，可安排一次独立迁移复核。'
  return '先亲自预测与解释，再提交一次固定条件的核验，建立第一份可信证据。'
}

export function CognitivePanel({ node, graph, onSelect, learnTargetOf }: {
  node: CognitiveNode | null
  graph: CognitiveGraph
  onSelect: (nodeId: string) => void
  learnTargetOf: (code: string) => LearnTarget
}) {
  if (!node) {
    return <aside className="cog-panel cog-panel-empty" aria-label="认知详情">
      <div className="cog-empty-orbit" aria-hidden="true" />
      <h2>这是一张属于你的认知宇宙</h2>
      <p>课程知识结构构成它的骨架；你的真实学习证据决定哪些节点被点亮、哪些仍待验证、哪些需要继续修正。</p>
      <dl className="cog-empty-stats">
        <div><dt>知识目标</dt><dd>{graph.summary.total}</dd></div>
        <div><dt>有达标证据</dt><dd>{graph.summary.verified}</dd></div>
        <div><dt>未评估</dt><dd>{graph.summary.unknown}</dd></div>
      </dl>
      <p className="cog-muted">选择任意节点查看它的认知状态、判断依据与下一步。未评估的目标保持未知，不会被自动标成薄弱。</p>
    </aside>
  }

  if (node.layer !== 'objective') {
    const objectives = graph.nodes.filter(child => {
      if (child.layer !== 'objective') return false
      if (node.layer === 'unit') return child.parentId === node.id
      if (node.layer === 'chapter') return child.chapterId === node.chapterId
      return true
    })
    return <aside className="cog-panel" aria-label="认知详情">
      <p className="cog-path">{node.layer === 'course' ? '整课范围' : node.layer === 'chapter' ? '章节' : '单元'}</p>
      <h2>{node.label}</h2>
      {node.summary && <div className="cog-summary-row">
        <span className="state-verified">达标 {node.summary.verified}</span>
        <span className="state-partial">部分 {node.summary.partial}</span>
        <span className="state-consolidate">巩固 {node.summary.consolidate}</span>
        <span className="state-unknown">未评估 {node.summary.unknown}</span>
      </div>}
      <section className="cog-section">
        <h3>包含的知识目标</h3>
        <ul className="cog-child-list">{objectives.map(child => <li key={child.id}>
          <button type="button" onClick={() => onSelect(child.id)}>
            <span>{child.label}</span>
            <span className={`cog-mini-state state-${child.state ?? 'unknown'}`}>{stateLabels[child.state ?? 'unknown']}</span>
          </button>
        </li>)}</ul>
        {!objectives.length && <p className="cog-muted">这个容器还没有声明任何可检验目标。</p>}
      </section>
      <p className="cog-muted">范围统计按唯一目标去重；章节与单元只聚合其包含的目标，不会整体变成“已掌握”。</p>
    </aside>
  }

  const cognition = node.cognition
  const chapter = node.chapterId ? graph.nodes.find(item => item.id === `chapter:${node.chapterId}`) : undefined
  const unit = node.parentId && node.parentId.startsWith('unit:') ? graph.nodes.find(item => item.id === node.parentId) : undefined
  return <aside className="cog-panel" aria-label="认知详情">
    <p className="cog-path">{chapter?.label ?? '已声明目标'}{unit ? ` / ${unit.label}` : ''}</p>
    <h2>{node.label}</h2>
    {node.recommended && <p className="cog-recommend-note">系统建议从这里继续，理由见下方“下一步”。</p>}
    {cognition
      ? <CognitionBody cognition={cognition} graph={graph} learnTargetOf={learnTargetOf} onSelect={onSelect} />
      : <p className="cog-muted">缺少该目标的认知记录投影。</p>}
  </aside>
}
