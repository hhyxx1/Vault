import { useEffect, useId, useRef, useState } from 'react'
import { courseRelationLabels, type ObjectiveState } from '../domain/course-map'
import { stateLabels } from '../domain/learning'
import './atlas-map.css'
export type MapGoal = { id: string; code: string; title: string }
export type MapUnit = { id: string; title: string; objective_refs: string[] }
export type MapChapter = { id: string; title: string; children: MapUnit[] }
export type MapRelation = { from: string; to: string; kind: string; source?: string }
const kindsList = ['mandatory_prerequisite', 'conceptual_association', 'application'] as const
export type MapKind = typeof kindsList[number]
const label = (kind: string) => courseRelationLabels[kind as MapKind] ?? kind
export function AtlasMap({ goals, chapters, relations, chapter, selected, kinds, toggleKind, stateOf, matches, onChapter, onGoal }: {
  goals: MapGoal[]; chapters: MapChapter[]; relations: MapRelation[]; chapter?: MapChapter; selected?: MapGoal;
  kinds: Set<MapKind>; toggleKind: (kind: MapKind) => void; stateOf: (code: string) => ObjectiveState; matches: (code: string) => boolean;
  onChapter: (chapter: MapChapter, unit?: MapUnit) => void; onGoal: (code: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(850)
  const [zoom, setZoom] = useState(1)
  const [activeRelation, setActiveRelation] = useState<string | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const previousView = useRef(`${chapter?.id ?? ''}:${selected?.code ?? ''}`)
  const marker = useId().replace(/:/g, '')
  const panorama = !chapter && !selected && chapters.length > 0
  const byCode = new Map(goals.map(goal => [goal.code, goal]))
  const owners = (code: string) => chapters.filter(entry => entry.children.some(unit => unit.objective_refs.includes(code)))
  const internal = chapter?.children.find(unit => unit.objective_refs.includes(selected?.code ?? ''))?.objective_refs ?? goals.map(goal => goal.code)
  const chapterRefs = chapter ? [...new Set(chapter.children.flatMap(unit => unit.objective_refs))] : goals.map(goal => goal.code)
  const links = selected ? relations.filter(r => kinds.has(r.kind as MapKind) && (r.from === selected.code || r.to === selected.code)) : []
  const neighbors = [...new Set(links.flatMap(r => [r.from, r.to]))].filter(code => code !== selected?.code && !internal.includes(code))
  const incoming = neighbors.filter(code => links.some(r => r.from === code && r.to === selected?.code && r.kind !== 'conceptual_association'))
  const outgoing = [...new Set([...internal.filter(code => code !== selected?.code), ...neighbors.filter(code => !incoming.includes(code))])]
  const compact = window.matchMedia('(max-width: 640px)').matches
  const width = compact ? size : Math.max(640, size)
  const nodeWidth = compact ? width - 48 : Math.floor((width - 100) / 3)
  const columns = selected ? [{ title: links.filter(r => incoming.includes(r.from)).every(r => r.kind === 'mandatory_prerequisite') ? '先修准备' : '先修或应用来源', codes: incoming }, { title: '当前学习目标', codes: [selected.code] }, { title: '同单元目标与相关应用', codes: outgoing }] : [{ title: '已声明目标', codes: internal }]
  const populatedColumns = columns.filter(column => column.codes.length)
  const sparse = !!selected && populatedColumns.length < 3
  const groupInset = (width - (populatedColumns.length * nodeWidth + (populatedColumns.length - 1) * 30)) / 2
  const positions = new Map<string, { x: number; y: number }>()
  let cursor = 18
  const headings = columns.map((column, index) => {
    const slot = sparse ? populatedColumns.indexOf(column) : index
    const x = compact || !selected ? 24 : (sparse ? groupInset : 20) + slot * (nodeWidth + 30)
    const y = compact ? cursor : 24
    if (compact && column.codes.length) cursor += 34
    column.codes.forEach((code, row) => { positions.set(code, { x, y: compact ? cursor : 100 + row * 148 }); if (compact) cursor += 142 })
    return { ...column, x, y }
  })
  const height = compact ? cursor + 32 : Math.max(400, Math.max(...columns.map(c => c.codes.length)) * 148 + 140)
  useEffect(() => {
    const observer = new ResizeObserver(entries => setSize(Math.floor(entries[0].contentRect.width)))
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { setActiveRelation(null) }, [selected?.code])
  useEffect(() => {
    const next = `${chapter?.id ?? ''}:${selected?.code ?? ''}`
    if (previousView.current !== next) setHasInteracted(true)
    previousView.current = next
  }, [chapter?.id, selected?.code])
  const edgePath = (r: MapRelation) => {
    const a = positions.get(r.from)!, b = positions.get(r.to)!
    if (compact || a.x === b.x) {
      const lane = compact ? width - 8 : a.x + nodeWidth + 25
      return `M ${a.x + nodeWidth} ${a.y + 53} C ${lane} ${a.y + 53}, ${lane} ${b.y + 53}, ${b.x + nodeWidth} ${b.y + 53}`
    }
    const forward = a.x < b.x, sx = a.x + (forward ? nodeWidth : 0), tx = b.x + (forward ? 0 : nodeWidth)
    return `M ${sx} ${a.y + 53} C ${(sx + tx) / 2} ${a.y + 53}, ${(sx + tx) / 2} ${b.y + 53}, ${tx} ${b.y + 53}`
  }
  const showLinks = links.filter(r => positions.has(r.from) && positions.has(r.to))
  const chosen = showLinks.find(r => `${r.from}:${r.to}:${r.kind}` === activeRelation)
  return <div className={`atlas-map ${panorama ? 'is-panorama' : ''} ${hasInteracted ? 'has-interacted' : ''}`}>
    {panorama ? <div className="overview-grid">{chapters.map((entry, index) => {
      const refs = [...new Set(entry.children.flatMap(unit => unit.objective_refs))]
      return <section className="chapter-region" key={entry.id} aria-label={entry.title}><button className="region-heading" onClick={() => onChapter(entry)}><span className="region-mark">{String(index + 1).padStart(2, '0')}</span><strong>{entry.title}</strong><span>{refs.filter(code => stateOf(code) === 'verified').length} / {refs.length}</span></button><div className="chapter-distribution" aria-hidden="true">{refs.map(code => <i key={code} className={stateOf(code)} />)}</div><div className="unit-nodes">{entry.children.filter(unit => unit.objective_refs.some(matches)).map(unit => <button className="unit-node" key={unit.id} onClick={() => onChapter(entry, unit)}><strong>{unit.title}</strong><small><span className="dots" aria-hidden="true">{unit.objective_refs.map(code => <i key={code} className={stateOf(code)} />)}</span>{unit.objective_refs.filter(matches).length} 个目标</small></button>)}</div>{!refs.some(matches) && <p className="region-empty">此章没有匹配目标</p>}</section>
    })}</div> : <>
      <div className="map-relation-bar" role="group" aria-label="关系类型筛选"><span>关系</span>{kindsList.map(kind => <button key={kind} aria-label={label(kind)} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}><i className={`relation-line ${kind}`} />{label(kind)}</button>)}<button onClick={() => { setZoom(1); viewport.current?.scrollTo({ left: 0, top: 0 }) }}>回到焦点</button></div>
      <p className="selection-note">{selected ? `聚焦「${chapter?.children.find(unit => unit.objective_refs.includes(selected.code))?.title ?? '已声明目标'}」 · ${internal.length} 个目标。跨章节点是引用，不会新增统计目标。` : `${internal.length} 个已声明目标，章节结构尚未建设。选择目标查看它的直接关系。`}</p>
    </>}
    <div ref={viewport} className={`atlas-map-viewport ${compact ? 'is-compact' : ''}`} style={panorama ? { height: 0 } : compact ? { height: height * zoom } : { height: Math.min(650, height * zoom) }} aria-hidden={panorama || undefined} role={panorama ? undefined : 'region'} tabIndex={panorama ? -1 : 0} aria-label="局部知识关系图，可横向滚动">
      {!panorama && <div style={{ width: width * zoom, height: height * zoom }}><div className={`atlas-map-plane ${!selected ? 'overview-grid' : ''}`} style={{ width, height, transform: `scale(${zoom})` }}><svg className="network-edges" width={width} height={height} aria-hidden="true"><defs><marker id={`${marker}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" /></marker></defs>{showLinks.map(r => <path key={`${selected?.code}:${r.from}:${r.to}:${r.kind}`} className={r.kind} data-kind={r.kind} data-relation={`${r.from}:${r.to}`} d={edgePath(r)} markerEnd={r.kind === 'conceptual_association' ? undefined : `url(#${marker}-arrow)`} />)}</svg>{headings.filter(c => c.codes.length).map(c => <h3 className="network-column-label" key={c.title} style={{ left: c.x, top: c.y, width: nodeWidth }}>{c.title}</h3>)}{[...positions].map(([code, p]) => <button key={code} className={`map-point network-node ${!internal.includes(code) ? 'is-external' : ''} ${!matches(code) && selected?.code !== code ? 'is-muted' : ''}`} style={{ left: p.x, top: p.y, width: nodeWidth }} aria-pressed={selected?.code === code} onClick={() => onGoal(code)}><span className="node-path">{owners(code).map(o => o.title).join(' / ') || '已声明目标'}{!chapterRefs.includes(code) && <span className="outside">跨章关系</span>}</span><strong>{byCode.get(code)?.title}</strong><span className={`evidence-pill ${stateOf(code)}`}>{stateLabels[stateOf(code)]}</span></button>)}<p className="network-help">目标可用 Tab 与 Enter 选择 · 关系来源见下方</p></div></div>}
    </div>
    {!panorama && <><details className="map-tools"><summary>画布工具</summary><div className="map-control-dock"><button aria-label="缩小图谱" disabled={zoom <= .75} onClick={() => setZoom(z => Math.max(.75, z - .25))}>−</button><output aria-label="图谱缩放">{Math.round(zoom * 100)}%</output><button aria-label="放大图谱" disabled={zoom >= 1.5} onClick={() => setZoom(z => Math.min(1.5, z + .25))}>＋</button><button onClick={() => { setZoom(1); viewport.current?.scrollTo({ left: 0, top: 0 }) }}>适应画布</button></div></details><div className="relation-chips" aria-label="可查看来源的知识关系">{showLinks.map(r => <button key={`${r.from}:${r.to}:${r.kind}`} aria-pressed={activeRelation === `${r.from}:${r.to}:${r.kind}`} onClick={() => setActiveRelation(`${r.from}:${r.to}:${r.kind}`)}>{label(r.kind)}：{byCode.get(r.from)?.title} {r.kind === 'conceptual_association' ? '↔' : '→'} {byCode.get(r.to)?.title}</button>)}</div>{chosen && <p className="relation-source" role="status">{label(chosen.kind)} · 来源：{chosen.source === 'engineering_example_pending_review' ? '工程关系样例，待教研审校' : chosen.source ?? '待补充'}。关系不传播掌握状态。</p>}<details className="other-goals"><summary>{chapter ? '本章' : '当前范围'}全部 {chapterRefs.length} 个目标</summary><div className="context-list">{chapterRefs.filter(matches).map(code => <button className="goal-pick" key={code} onClick={() => onGoal(code)}><span>{byCode.get(code)?.title}</span><span className={`evidence-pill ${stateOf(code)}`}>{stateLabels[stateOf(code)]}</span></button>)}</div></details></>}
  </div>
}
