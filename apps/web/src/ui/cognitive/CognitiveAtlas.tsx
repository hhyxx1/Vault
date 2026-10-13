import { useCallback, useMemo, useRef, useState } from 'react'
import type { AtlasPackage } from '../../domain/course-packages'
import type { CognitiveEdge, CognitiveGraph } from '../../domain/cognitive-graph'
import { constellationLayout } from '../../domain/cognitive-graph'
import type { ObjectiveState } from '../../domain/course-map'
import { stateLabels } from '../../domain/learning'
import { CosmicCanvas, type CosmicCanvasHandle } from './CosmicCanvas'
import { CognitivePanel, type LearnTarget } from './CognitivePanel'

const STATE_ORDER: ObjectiveState[] = ['verified', 'partial', 'consolidate', 'unknown']
const EDGE_TOGGLES: { kind: CognitiveEdge['kind']; label: string; hint: string }[] = [
  { kind: 'mandatory_prerequisite', label: '严格先修', hint: '课程声明的必要条件' },
  { kind: 'application', label: '后续应用', hint: '课程声明的应用关系' },
  { kind: 'conceptual_association', label: '概念关联', hint: '课程声明的概念联系' },
  { kind: 'influence', label: '潜在影响', hint: '依据该生证据推断，可能影响后续学习' },
]

export function CognitiveAtlas({ data, graph, courses, activeCourse, onCourseChange, learnTargetOf, initialGoal }: {
  data: AtlasPackage
  graph: CognitiveGraph
  courses: { code: string; title: string }[]
  activeCourse: string
  onCourseChange: (code: string) => void
  learnTargetOf: (code: string) => LearnTarget
  initialGoal?: string | null
}) {
  const canvas = useRef<CosmicCanvasHandle>(null)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (!initialGoal) return null
    return graph.nodes.find(node => node.objectiveCode === initialGoal)?.id ?? null
  })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | ObjectiveState>('all')
  const [panelOpen, setPanelOpen] = useState(false)
  const [visibleEdgeKinds, setVisibleEdgeKinds] = useState<Set<CognitiveEdge['kind']>>(
    () => new Set<CognitiveEdge['kind']>(['mandatory_prerequisite', 'application', 'influence']),
  )
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const layout = useMemo(() => constellationLayout(graph, { width: 2400, height: 1700 }), [graph])

  const objectiveNodes = useMemo(() => graph.nodes.filter(node => node.layer === 'objective'), [graph])
  const trimmed = search.trim().toLocaleLowerCase()
  const searchResults = useMemo(() => {
    if (!trimmed) return []
    return objectiveNodes.filter(node => node.label.toLocaleLowerCase().includes(trimmed)).slice(0, 8)
  }, [objectiveNodes, trimmed])
  const filteredCount = useMemo(
    () => objectiveNodes.filter(node => filter === 'all' || node.state === filter).length,
    [filter, objectiveNodes],
  )
  const matchCodes = useMemo(() => {
    if (!trimmed && filter === 'all') return null
    const codes = new Set<string>()
    for (const node of objectiveNodes) {
      if (filter !== 'all' && node.state !== filter) continue
      if (trimmed && !node.label.toLocaleLowerCase().includes(trimmed)) continue
      if (node.objectiveCode) codes.add(node.objectiveCode)
    }
    return codes
  }, [filter, objectiveNodes, trimmed])

  const selectedNode = graph.nodes.find(node => node.id === selectedId) ?? null
  const recommendation = graph.recommendation
  const recommendationNode = recommendation
    ? graph.nodes.find(node => node.objectiveCode === recommendation.code) ?? null
    : null

  const toggleEdge = (kind: CognitiveEdge['kind']) => {
    setVisibleEdgeKinds(current => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const select = useCallback((nodeId: string) => {
    setSelectedId(nodeId)
    setPanelOpen(true)
    canvas.current?.focusNode(nodeId)
  }, [])

  const selectByCode = useCallback((code: string) => {
    const node = graph.nodes.find(item => item.objectiveCode === code)
    if (node) select(node.id)
  }, [graph, select])

  const clearFocus = () => {
    setSelectedId(null)
    setSearch('')
    setFilter('all')
    canvas.current?.fitAll()
  }

  return <div className="cog-atlas">
    <header className="cog-topbar">
      <div className="cog-topbar-left">
        <p className="cog-eyebrow">认知宇宙 · {data.status === 'structured_validated' ? '核心范围' : '待审校范围样例'}</p>
        <h1>{data.title}<span>{data.version}</span></h1>
        <details className="cog-scope">
          <summary>范围与版本说明</summary>
          <p>{data.scope_note}</p>
          <p className="cog-scope-meta">同步恢复、自述与旧版本记录不会自动升级为达标证据；未评估的目标保持未知，不会被自动标成薄弱。</p>
        </details>
      </div>
      <div className="cog-topbar-right">
        <label className="cog-course-picker">课程
          <select value={activeCourse} onChange={event => onCourseChange(event.target.value)}>
            {courses.map(item => <option key={item.code} value={item.code}>{item.title}</option>)}
          </select>
        </label>
        <div className="cog-tally" aria-label="课程目标证据分布">
          <div className="cog-tally-total"><strong>{graph.summary.verified}</strong><span>/ {graph.summary.total}</span><small>有达标证据</small></div>
          <div className="cog-tally-bar" role="img" aria-label={`${graph.summary.verified} 项达标，${graph.summary.partial} 项部分满足，${graph.summary.consolidate} 项需巩固，${graph.summary.unknown} 项尚未评估`}>
            {STATE_ORDER.map(state => graph.summary[state] > 0
              ? <i key={state} className={`state-${state}`} style={{ flexGrow: graph.summary[state] }} />
              : null)}
          </div>
        </div>
        <a className="cog-icon-button" href="/evidence">查看学习证据</a>
      </div>
    </header>

    <div className="cog-toolbar">
      <div className="cog-search-wrap">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5" /><path d="m12 12 5 5" /></svg>
        <input
          type="search"
          value={search}
          placeholder="搜索知识目标…"
          aria-label="搜索知识目标"
          onChange={event => setSearch(event.target.value)}
        />
        {searchResults.length > 0 && <ul className="cog-search-results">
          {searchResults.map(node => <li key={node.id}>
            <button type="button" onClick={() => { select(node.id); setSearch('') }}>
              <span>{node.label}</span>
              <span className={`cog-mini-state state-${node.state ?? 'unknown'}`}>{stateLabels[node.state ?? 'unknown']}</span>
            </button>
          </li>)}
        </ul>}
      </div>

      <label className="cog-filter">
        状态
        <select value={filter} onChange={event => setFilter(event.target.value as 'all' | ObjectiveState)}>
          <option value="all">全部状态</option>
          {STATE_ORDER.map(state => <option key={state} value={state}>{stateLabels[state]}</option>)}
        </select>
      </label>

      <div className="cog-toolbar-actions">
        <button type="button" onClick={() => canvas.current?.fitAll()}>适应画布</button>
        <button type="button" onClick={clearFocus}>回到全景</button>
        <button
          type="button"
          className="cog-mobile-only"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(open => !open)}
        >认知详情</button>
        {(trimmed || filter !== 'all') && <span className="cog-match-count" role="status">{filter === 'all' ? `匹配 ${filteredCount} 个目标` : `「${stateLabels[filter]}」${filteredCount} 个目标`}</span>}
      </div>
    </div>

    <div className="cog-legend" aria-label="图例">
      <div className="cog-legend-states">
        <span className="cog-legend-title">认知状态</span>
        {STATE_ORDER.map(state => <span key={state} className="cog-legend-item">
          <i className={`cog-legend-dot state-${state}`} aria-hidden="true" />{stateLabels[state]}
          <b>{graph.summary[state]}</b>
        </span>)}
      </div>
      <div className="cog-legend-edges">
        <span className="cog-legend-title">关系图层</span>
        {EDGE_TOGGLES.map(toggle => <button
          key={toggle.kind}
          type="button"
          className={`cog-legend-toggle ${visibleEdgeKinds.has(toggle.kind) ? 'is-on' : ''}`}
          aria-pressed={visibleEdgeKinds.has(toggle.kind)}
          title={toggle.hint}
          onClick={() => toggleEdge(toggle.kind)}
        ><i className={`cog-line kind-${toggle.kind}`} aria-hidden="true" />{toggle.label}</button>)}
      </div>
    </div>

    {recommendation && <div className="cog-recommend-banner">
      <span className="cog-recommend-tag">建议下一步</span>
      <div>
        <strong>{recommendation.title}</strong>
        <p>{recommendation.reason}</p>
        <small>{recommendation.basis}</small>
      </div>
      <button type="button" className="cog-button primary" onClick={() => recommendationNode && select(recommendationNode.id)}>定位到目标</button>
    </div>}

    <div className={`cog-workspace ${panelOpen ? 'is-panel-open' : ''}`}>
      <div className="cog-canvas-wrap">
        <CosmicCanvas
          ref={canvas}
          graph={graph}
          layout={layout}
          selectedId={selectedId}
          hoveredId={hoveredId}
          matchCodes={matchCodes}
          visibleEdgeKinds={visibleEdgeKinds}
          reducedMotion={reducedMotion}
          onSelect={select}
          onHover={setHoveredId}
        />
        {!panelOpen && <button type="button" className="cog-mobile-open" onClick={() => setPanelOpen(true)}>认知详情</button>}
      </div>
      <div className="cog-panel-shell">
        <button type="button" className="cog-panel-close" onClick={() => setPanelOpen(false)} aria-label="收起认知详情">收起详情</button>
        <CognitivePanel node={selectedNode} graph={graph} onSelect={select} learnTargetOf={learnTargetOf} />
      </div>
    </div>

    <details className="cog-text-nav">
      <summary>用文字浏览全部 {objectiveNodes.length} 个知识目标</summary>
      <ol>{objectiveNodes.map(node => <li key={node.id}>
        <button type="button" aria-pressed={node.id === selectedId} onClick={() => selectByCode(node.objectiveCode!)}>
          <span className="cog-text-title">{node.label}</span>
          <span className={`cog-mini-state state-${node.state ?? 'unknown'}`}>{stateLabels[node.state ?? 'unknown']}</span>
        </button>
      </li>)}</ol>
    </details>
  </div>
}
