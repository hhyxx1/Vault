import { useEffect, useId, useRef, useState } from 'react'
import { courseRelationLabels, type ObjectiveState } from '../domain/course-map'
import { stateLabels } from '../domain/learning'
import './atlas-map.css'

export type MapGoal = { id: string; code: string; title: string }
export type MapUnit = { id: string; title: string; objective_refs: string[] }
export type MapChapter = { id: string; title: string; children: MapUnit[] }
export type MapRelation = { from: string; to: string; kind: string; source?: string }
export const mapKinds = ['mandatory_prerequisite', 'conceptual_association', 'application'] as const
export type MapKind = typeof mapKinds[number]
const label = (kind: string) => courseRelationLabels[kind as MapKind] ?? kind

export function AtlasMap({ goals, chapters, relations, chapter, selected, kinds, toggleKind, stateOf, matches, onChapter, onGoal }: {
  goals: MapGoal[]; chapters: MapChapter[]; relations: MapRelation[]; chapter?: MapChapter; selected?: MapGoal;
  kinds: Set<MapKind>; toggleKind: (kind: MapKind) => void; stateOf: (code: string) => ObjectiveState;
  matches: (code: string) => boolean; onChapter: (chapter: MapChapter, unit?: MapUnit) => void; onGoal: (code: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [compact, setCompact] = useState(false)
  const marker = useId().replace(/:/g, '')
  const panorama = !chapter && !selected && chapters.length > 0
  const byCode = new Map(goals.map(goal => [goal.code, goal]))
  const owner = (code: string) => chapters.find(entry => entry.children.some(unit => unit.objective_refs.includes(code)))
  const internal = [...new Set(chapter ? chapter.children.flatMap(unit => unit.objective_refs) : goals.map(goal => goal.code))].filter(code => matches(code) || code === selected?.code)
  const external = chapter ? [...new Set(relations.filter(r => kinds.has(r.kind as MapKind) && (internal.includes(r.from) || internal.includes(r.to))).flatMap(r => [r.from, r.to]))].filter(code => !internal.includes(code) && !chapter.children.some(unit => unit.objective_refs.includes(code)) && matches(code)) : []
  const codes = [...internal, ...external]
  const width = compact ? panorama ? 460 : 340 : panorama ? 1100 : codes.length <= 2 ? 720 : external.length ? 1060 : 820
  const height = compact ? panorama ? Math.ceil(chapters.length / 2) * 290 + 50 : codes.length * 170 + 90 : panorama ? Math.max(650, Math.ceil(chapters.length / 4) * 310 + 50) : Math.max(460, Math.ceil(internal.length / 2) * 190 + 130, external.length * 145 + 110)
  const chapterPosition = new Map(chapters.map((entry, index) => [entry.id, { x: compact ? 20 + index % 2 * 220 : 30 + index % 4 * 268, y: 35 + Math.floor(index / (compact ? 2 : 4)) * (compact ? 290 : 310) + (index % 2 ? 20 : 0) }]))
  const positions = new Map(codes.map((code, index) => {
    if (compact) return [code, { x: 70, y: 50 + index * 170 }] as const
    if (external.includes(code)) return [code, { x: 820, y: 100 + external.indexOf(code) * 145 }] as const
    if (internal.length <= 2) return [code, { x: 110 + index * 320, y: 210 + index * 25 }] as const
    const unitIndex = chapter?.children.findIndex(unit => unit.objective_refs.includes(code)) ?? -1
    const row = unitIndex >= 0 ? chapter!.children[unitIndex].objective_refs.filter(ref => matches(ref) || ref === selected?.code).indexOf(code) : Math.floor(index / 2)
    return [code, { x: 110 + (unitIndex >= 0 ? unitIndex % 2 : index % 2) * 380, y: 165 + row * 190 + (unitIndex >= 2 ? Math.floor(unitIndex / 2) * 380 : 0) }] as const
  }))
  const shown = relations.filter(r => kinds.has(r.kind as MapKind) && (panorama ? owner(r.from) && owner(r.to) && owner(r.from)?.id !== owner(r.to)?.id : positions.has(r.from) && positions.has(r.to)))
  const fit = () => {
    const box = viewport.current
    if (!box) return
    setZoom(Math.max(compact && !panorama ? .9 : .7, Math.min(1.1, (box.clientWidth - 24) / width, (box.clientHeight - 24) / height)))
    box.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  }
  const scope = `${panorama}:${chapter?.id ?? ''}:${width}:${height}`
  useEffect(() => {
    fit()
    const observer = new ResizeObserver(() => { setCompact((viewport.current?.clientWidth ?? 1000) < 480); fit() })
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [scope])
  const locateSelected = () => {
    const p = positions.get(selected?.code ?? '')
    const box = viewport.current
    if (box && p) box.scrollTo({ left: Math.max(0, (p.x + 100) * zoom - box.clientWidth / 2), top: Math.max(0, (p.y + 55) * zoom - box.clientHeight / 2), behavior: 'instant' })
  }
  const path = (r: MapRelation) => {
    const a = panorama ? chapterPosition.get(owner(r.from)!.id)! : positions.get(r.from)!
    const b = panorama ? chapterPosition.get(owner(r.to)!.id)! : positions.get(r.to)!
    if (!panorama && Math.abs(a.x - b.x) < 50) {
      const down = a.y < b.y
      const sx = a.x + 21, tx = b.x + 21
      const sy = a.y + (down ? 82 : 40), ty = b.y + (down ? 40 : 82)
      return `M ${sx} ${sy} C ${sx} ${(sy + ty) / 2}, ${tx} ${(sy + ty) / 2}, ${tx} ${ty}`
    }
    const forward = a.x < b.x
    if (!panorama) {
      const sx = a.x + 21, tx = b.x + 21, sy = a.y + 40, ty = b.y + 40
      const bend = Math.min(sy, ty) - 90
      return `M ${sx} ${sy} C ${sx} ${bend}, ${tx} ${bend}, ${tx} ${ty}`
    }
    const sx = a.x + (forward ? panorama ? 240 : 200 : 0), tx = b.x + (forward ? 0 : panorama ? 240 : 200)
    const sy = a.y + (panorama ? 120 : 63), ty = b.y + (panorama ? 120 : 63)
    const tangent = Math.min(75, Math.abs(tx - sx) / 2)
    return `M ${sx} ${sy} C ${sx + (forward ? tangent : -tangent)} ${sy}, ${tx + (forward ? -tangent : tangent)} ${ty}, ${tx} ${ty}`
  }
  return <div className="atlas-map">
    <div className="map-relation-bar" role="group" aria-label="关系类型筛选">{mapKinds.map(kind => <button key={kind} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}><i className={`relation-line ${kind}`} />{label(kind)}</button>)}<span>{panorama ? '跨章节声明关系' : `${codes.length} 个目标 · ${shown.length} 条关系`}</span></div>
    <div className={`atlas-map-viewport ${dragging ? 'is-dragging' : ''}`} ref={viewport} tabIndex={0} role="region" aria-label="知识地图，可拖动画布或用方向键平移" onKeyDown={event => {
      if (event.target !== event.currentTarget) return
      const delta: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }
      if (delta[event.key]) { event.preventDefault(); event.currentTarget.scrollBy({ left: delta[event.key][0], top: delta[event.key][1], behavior: 'instant' }) }
    }} onPointerDown={event => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
      drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true)
    }} onPointerMove={event => {
      if (!drag.current) return
      event.currentTarget.scrollLeft = drag.current.left - event.clientX + drag.current.x
      event.currentTarget.scrollTop = drag.current.top - event.clientY + drag.current.y
    }} onPointerUp={() => { drag.current = null; setDragging(false) }} onPointerCancel={() => { drag.current = null; setDragging(false) }}>
      <div className="atlas-map-size" style={{ width: width * zoom, height: height * zoom }}><div className={`atlas-map-plane ${compact ? 'is-compact' : ''} ${panorama || !selected && !chapter ? 'overview-grid' : ''}`} style={{ width, height, transform: `scale(${zoom})` }}>
        <svg className="network-edges" width={width} height={height} aria-hidden="true"><defs>{mapKinds.filter(kind => kind !== 'conceptual_association').map(kind => <marker key={kind} id={`${marker}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" className={kind} /></marker>)}</defs>{shown.map((r, i) => <path key={`${r.from}:${r.to}:${i}`} className={r.kind} data-kind={r.kind} data-relation={`${r.from}:${r.to}`} d={path(r)} markerEnd={r.kind === 'conceptual_association' ? undefined : `url(#${marker}-${r.kind})`} />)}</svg>
        {panorama ? chapters.map((entry, index) => {
          const p = chapterPosition.get(entry.id)!
          const refs = [...new Set(entry.children.flatMap(unit => unit.objective_refs))]
          const count = refs.filter(code => stateOf(code) === 'verified').length
          return <section className="chapter-region map-island" key={entry.id} aria-label={entry.title} style={{ left: p.x, top: p.y }}>
            <button className="region-heading" onClick={() => onChapter(entry)}><span className="region-mark">{String(index + 1).padStart(2, '0')}</span><strong>{entry.title}</strong><span>{count}/{refs.length}</span></button>
            <div className="island-units">{entry.children.filter(unit => unit.objective_refs.some(matches)).map((unit, i) => <button className="unit-node map-unit" key={unit.id} onClick={() => onChapter(entry, unit)} style={{ marginLeft: i % 2 ? 38 : 0 }}><span className="unit-orbit"><i />{unit.objective_refs.map(code => <b key={code} className={stateOf(code)} />)}</span><strong>{unit.title}</strong><small>{unit.objective_refs.filter(matches).length} 个目标</small></button>)}{!refs.some(matches) && <p className="region-empty">此章没有匹配目标</p>}</div>
          </section>
        }) : <>
          {!compact && chapter && chapter.children.map((unit, index) => <div className="map-unit-label" key={unit.id} style={{ left: 110 + index % 2 * 380, top: 78 }}><span />{unit.title}</div>)}
          {codes.map(code => { const p = positions.get(code)!; const state = stateOf(code); const isOutside = external.includes(code); const adjacent = selected && shown.some(r => r.from === selected.code && r.to === code || r.to === selected.code && r.from === code); return <button className={`map-point network-node ${state} ${isOutside ? 'is-external' : ''} ${selected && selected.code !== code && !adjacent ? 'is-muted' : ''}`} key={code} style={{ left: p.x, top: p.y }} aria-pressed={selected?.code === code} onClick={() => onGoal(code)}>
            <span className="map-node-orbit" aria-hidden="true"><i /></span><span className="map-node-copy"><small>{isOutside ? `${owner(code)?.title ?? '其他范围'} · 跨章引用` : chapter?.children.find(unit => unit.objective_refs.includes(code))?.title ?? '已声明目标'} </small><strong>{byCode.get(code)?.title}</strong><span className={`evidence-pill ${state}`}>{stateLabels[state]}</span></span>
          </button> })}
          {!compact && codes.length <= 2 && <div className="sparse-map-note"><span />当前范围只有 {internal.length} 个已声明目标。<br />图谱随课程内容建设扩展。</div>}
        </>}
      </div></div>
    </div>
    <div className="map-control-dock"><span>{panorama ? '点击章节展开知识网络' : '点击知识点查看证据与下一步'} · 拖动空白处平移</span><div><button aria-label="缩小图谱" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, z - .15))}>−</button><output aria-label="图谱缩放">{Math.round(zoom * 100)}%</output><button aria-label="放大图谱" disabled={zoom >= 1.6} onClick={() => setZoom(z => Math.min(1.6, z + .15))}>＋</button><button onClick={fit}>适应画布</button>{selected && <button onClick={locateSelected}>定位当前目标</button>}</div></div>
    <details className="atlas-relations"><summary>关系与来源 <span>{shown.length} 条已声明关系</span></summary><div className="focus-relations">{shown.map((r, i) => <div className="focus-relation" key={i}><strong>{label(r.kind)}：{byCode.get(r.from)?.title} {r.kind === 'conceptual_association' ? '↔' : '→'} {byCode.get(r.to)?.title}</strong><small>来源：{r.source ?? '待补充'}</small><span>关系不传播掌握状态；同章归属不自动生成先修。</span></div>)}{!shown.length && <p>当前关系类型下没有已声明的关系。</p>}</div></details>
    {!panorama && <details className="other-goals"><summary>{chapter ? '本章' : '当前范围'}全部 {internal.length} 个目标</summary><div className="context-list">{internal.map(code => <button className="goal-pick" key={code} onClick={() => onGoal(code)}><span>{byCode.get(code)?.title}</span><span className={`evidence-pill ${stateOf(code)}`}>{stateLabels[stateOf(code)]}</span></button>)}</div></details>}
  </div>
}
