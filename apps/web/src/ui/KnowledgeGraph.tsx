import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import { stateLabels } from '../domain/learning'
import { courseMapObjectiveNavigation, courseRelationLabels, projectCourseMap, type CourseMapDefinition, type CourseRelationKind, type ObjectiveState } from '../domain/course-map'

export default function KnowledgeGraph({ definition, states, selected, onSelect, coordinateLabel, showCollapseControls = true }: { definition: CourseMapDefinition; states: ReadonlyMap<string, ObjectiveState>; selected: string; onSelect: (id: string) => void; coordinateLabel?: string; showCollapseControls?: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const graph = useRef<cytoscape.Core | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set())
  const [showPrerequisites, setShowPrerequisites] = useState(true)
  const visibleRelationKinds = useMemo(() => new Set<CourseRelationKind>(definition.relations
    .map(relation => relation.kind)
    .filter(kind => showPrerequisites || kind !== 'mandatory_prerequisite')), [definition, showPrerequisites])
  const projection = useMemo(() => projectCourseMap(definition, states, {
    collapsedNodeIds,
    visibleRelationKinds,
  }), [definition, states, collapsedNodeIds, visibleRelationKinds])
  const navigation = useMemo(() => courseMapObjectiveNavigation(definition, states), [definition, states])

  useEffect(() => {
    if (!container.current) return
    const cy = cytoscape({ container: container.current, pixelRatio: 'auto', minZoom: 0.35, maxZoom: 2.5,
      elements: {
        nodes: definition.nodes.map(node => ({ data: {
          id: node.id,
          label: node.title,
          title: node.title,
          kind: node.kind,
          objectiveId: node.objectiveId,
          objectiveRef: node.objectiveRef,
        } })),
        edges: definition.relations.map(relation => ({ data: {
          id: relation.id,
          source: relation.from,
          target: relation.to,
          kind: relation.kind,
        } })),
      },
      style: [
        { selector: 'node', style: { width: 236, height: 84, 'background-color': '#ffffff', 'border-width': 1, 'border-color': '#cbd5e4', label: 'data(label)', 'text-wrap': 'wrap', 'text-max-width': '210px', 'font-size': '12px', color: '#233550', 'text-valign': 'center', 'text-halign': 'center', 'font-family': 'system-ui, sans-serif' } },
        { selector: 'node[kind="course"]', style: { shape: 'round-rectangle', width: 260, height: 88, 'text-max-width': '234px', 'background-color': '#233c61', color: '#ffffff', 'border-color': '#233c61' } },
        { selector: 'node[kind="chapter"]', style: { shape: 'round-rectangle', width: 244, height: 84, 'text-max-width': '218px', 'background-color': '#e8eef9', 'border-color': '#9eafc8' } },
        { selector: 'node[kind="unit"]', style: { shape: 'round-rectangle', width: 228, height: 82, 'text-max-width': '202px', 'background-color': '#f2f5fa', 'border-color': '#bec9d9' } },
        { selector: 'node[kind="objective"]', style: { shape: 'round-rectangle', width: 236, height: 84 } },
        { selector: 'edge', style: { width: 2, 'line-color': '#8795a9', 'curve-style': 'bezier', 'target-arrow-shape': 'none' } },
        { selector: 'edge[kind="mandatory_prerequisite"]', style: { 'line-style': 'dashed', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#9a671f', 'line-color': '#9a671f', color: '#78521b' } },
        { selector: 'edge[kind="conceptual_association"]', style: { 'line-style': 'dotted', 'line-color': '#71839f', 'target-arrow-shape': 'none', color: '#526884' } },
        { selector: 'edge[kind="application"]', style: { 'target-arrow-shape': 'triangle', 'target-arrow-color': '#315fe7', 'line-color': '#315fe7', color: '#315fe7' } },
        { selector: 'edge[kind="evidence_support"]', style: { 'line-style': 'dashed', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#586c87', 'line-color': '#586c87', color: '#586c87' } },
        { selector: 'node.evidence-partial', style: { 'background-color': '#fff0cf', 'border-color': '#bd851e', 'border-width': 2 } },
        { selector: 'node.evidence-consolidate', style: { 'background-color': '#f8e0dc', 'border-color': '#ba5b4b', 'border-width': 2 } },
        { selector: 'node.evidence-verified', style: { 'background-color': '#d9f0e7', 'border-color': '#25826c', 'border-width': 2 } },
        { selector: 'node.current', style: { 'overlay-color': '#315fe7', 'overlay-opacity': 0.08, 'overlay-padding': 7, 'border-color': '#315fe7', 'border-width': 3 } },
      ],
    })
    const applyLayout = () => {
      if (!container.current) return
      const compact = container.current.clientWidth < 560
      const sizes = compact
        ? { courseWidth: 164, chapterWidth: 148, unitWidth: 148, objectiveWidth: 148, textMax: 126, fontSize: '11px', nodeHeight: 96 }
        : { courseWidth: 224, chapterWidth: 212, unitWidth: 204, objectiveWidth: 210, textMax: 184, fontSize: '12px', nodeHeight: 90 }
      cy.nodes().forEach(node => {
        const kind = node.data('kind') as CourseMapDefinition['nodes'][number]['kind']
        const width = kind === 'course' ? sizes.courseWidth : kind === 'chapter' ? sizes.chapterWidth : kind === 'unit' ? sizes.unitWidth : sizes.objectiveWidth
        node.style({ width, height: sizes.nodeHeight, 'text-max-width': `${sizes.textMax}px`, 'font-size': sizes.fontSize })
      })
      const width = container.current.clientWidth
      const height = container.current.clientHeight
      const children = new Map<string, string[]>()
      definition.relations.filter(relation => relation.kind === 'contains').forEach(relation => {
        children.set(relation.from, [...(children.get(relation.from) ?? []), relation.to])
      })
      const depthByNode = new Map<string, number>()
      const measure = (nodeId: string, depth: number): number => {
        if (depthByNode.has(nodeId)) return depthByNode.get(nodeId)!
        depthByNode.set(nodeId, depth)
        return Math.max(depth, ...(children.get(nodeId) ?? []).map(child => measure(child, depth + 1)))
      }
      const maxDepth = Math.max(1, measure(definition.rootNodeId, 0))
      const maxPeers = Math.max(1, ...[...children.values()].map(peers => peers.length))
      const maxNodeWidth = Math.max(sizes.courseWidth, sizes.chapterWidth, sizes.unitWidth, sizes.objectiveWidth)
      const maxNodeHeight = sizes.nodeHeight
      const widthsByDepth = new Map<number, number>()
      const peersByDepth = new Map<number, number>()
      definition.nodes.forEach(node => {
        const depth = depthByNode.get(node.id) ?? 0
        const nodeWidth = node.kind === 'course' ? sizes.courseWidth : node.kind === 'chapter' ? sizes.chapterWidth : node.kind === 'unit' ? sizes.unitWidth : sizes.objectiveWidth
        widthsByDepth.set(depth, Math.max(widthsByDepth.get(depth) ?? 0, nodeWidth))
        peersByDepth.set(depth, (peersByDepth.get(depth) ?? 0) + 1)
      })
      const tierWidths = Array.from({ length: maxDepth + 1 }, (_, depth) => widthsByDepth.get(depth) ?? 0)
      const tallestTier = Math.max(1, ...peersByDepth.values())
      const compactTree = maxPeers <= 2
      const compactLayout = compact
        ? compactTree
          ? { direction: 'downward' as const, naturalWidth: maxPeers * (maxNodeWidth + 12) + 20, naturalHeight: (maxDepth + 1) * (maxNodeHeight + 10) + 20 }
          : { direction: 'rightward' as const, naturalWidth: tierWidths.reduce((total, tierWidth) => total + tierWidth, 0) + maxDepth * 28 + 20, naturalHeight: tallestTier * (maxNodeHeight + 12) + 20 }
        : { direction: 'downward' as const, naturalWidth: maxPeers * (maxNodeWidth + 20) + 28, naturalHeight: (maxDepth + 1) * (maxNodeHeight + 36) + 20 }
      const layoutWidth = Math.min(Math.max(1, width - 16), compactLayout.naturalWidth)
      const layoutHeight = Math.min(Math.max(1, height - 58), compactLayout.naturalHeight)
      cy.elements()
        .filter(element => element.isNode() || element.data('kind') === 'contains')
        .layout({
          name: 'breadthfirst', directed: true, roots: [definition.rootNodeId],
          direction: compactLayout.direction,
          padding: 8,
          spacingFactor: 1,
          nodeDimensionsIncludeLabels: true,
          boundingBox: { x1: Math.max(0, (width - layoutWidth) / 2), y1: 38, w: layoutWidth, h: layoutHeight },
          animate: false, fit: false,
        })
        .run()
      cy.fit(undefined, compact ? 8 : 12)
    }
    applyLayout()
    cy.on('tap', event => {
      const target = event.target
      if (typeof target.isNode !== 'function' || !target.isNode()) return
      if (target.data('kind') === 'objective') {
        const objectiveRef = target.data('objectiveRef') as string | undefined
        if (objectiveRef) onSelectRef.current(objectiveRef)
        return
      }
      const nodeId = target.id()
      setCollapsedNodeIds(current => {
        const next = new Set(current)
        if (next.has(nodeId)) next.delete(nodeId)
        else next.add(nodeId)
        return next
      })
    })
    graph.current = cy
    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        cy.resize()
        applyLayout()
      })
    })
    observer.observe(container.current)
    return () => { observer.disconnect(); if (resizeFrame) cancelAnimationFrame(resizeFrame); cy.destroy(); graph.current = null }
  }, [definition])
  useEffect(() => {
    const cy = graph.current
    if (!cy) return
    const visibleNodeIds = new Set(projection.nodes.map(node => node.id))
    const visibleRelationIds = new Set(projection.relations.map(relation => relation.id))
    const projectedNodeById = new Map(projection.nodes.map(node => [node.id, node]))
    cy.batch(() => {
      cy.nodes().forEach(node => {
        const projected = projectedNodeById.get(node.id())
        if (!projected) { node.style('display', 'none'); return }
        node.style('display', 'element')
        node.removeClass('evidence-unknown evidence-partial evidence-consolidate evidence-verified current')
        if (projected.kind === 'objective') node.addClass(`evidence-${projected.state ?? 'unknown'}`)
        if (projected.objectiveRef === selected) node.addClass('current')
        const label = projected.kind === 'objective'
          ? `${projected.title}\n\n${stateLabels[projected.state ?? 'unknown']}`
          : `${projected.title}\n\n有达标证据 ${projected.summary.verified}/${projected.summary.total}`
        node.data('label', label)
      })
      cy.edges().forEach(edge => {
        if (visibleRelationIds.has(edge.id()) && visibleNodeIds.has(edge.data('source')) && visibleNodeIds.has(edge.data('target'))) edge.style('display', 'element')
        else edge.style('display', 'none')
      })
    })
  }, [projection, selected])
  const expandableNodes = showCollapseControls ? projection.nodes.filter(node => node.kind !== 'objective' && node.objectiveIds.length > 0) : []
  const hasPrerequisite = definition.relations.some(relation => relation.kind === 'mandatory_prerequisite')
  const mapSummary = projection.summary
  const stateText = `课程知识图谱，${mapSummary.total} 个唯一目标，其中 ${mapSummary.verified} 项有达标证据，${mapSummary.partial} 项部分满足，${mapSummary.consolidate} 项需巩固，${mapSummary.unknown} 项尚未评估。`
  return <>
    <div className="graph-frame">
      <div className="graph-coordinate">{coordinateLabel ?? `${definition.courseId.toUpperCase()} / ${definition.version}`}</div>
      <div ref={container} className="graph-canvas" role="img" aria-label={`${stateText}下方提供可键盘操作的文字导航。`} />
    </div>
    <div className="graph-controls">
      <button onClick={() => graph.current?.fit(undefined, 42)}>适应画布</button>
      {expandableNodes.map(node => <button key={node.id} aria-expanded={!collapsedNodeIds.has(node.id)} onClick={() => setCollapsedNodeIds(current => {
        const next = new Set(current)
        if (next.has(node.id)) next.delete(node.id)
        else next.add(node.id)
        return next
      })}>{collapsedNodeIds.has(node.id) ? '展开' : '折叠'}「{node.title}」</button>)}
      {hasPrerequisite && <button aria-pressed={showPrerequisites} onClick={() => setShowPrerequisites(value => !value)}>{showPrerequisites ? '隐藏' : '显示'}先修关系</button>}
      <button onClick={() => graph.current?.zoom({ level: (graph.current?.zoom() ?? 1) * 1.2, renderedPosition: { x: 250, y: 150 } })} aria-label="放大图谱">＋</button>
      <button onClick={() => graph.current?.zoom({ level: (graph.current?.zoom() ?? 1) / 1.2, renderedPosition: { x: 250, y: 150 } })} aria-label="缩小图谱">−</button>
    </div>
    <details className="graph-text-navigation">
      <summary>用文字浏览 {navigation.length} 个目标</summary>
      <ol>{navigation.map(entry => <li key={entry.nodeId}>
        <button type="button" className="graph-outline-select" aria-pressed={entry.objectiveRef === selected} disabled={!entry.objectiveRef} onClick={() => entry.objectiveRef && onSelectRef.current(entry.objectiveRef)}>
          {entry.path.length > 0 && <span className="graph-outline-path">{entry.path.join(' / ')}</span>}
          <span className="graph-outline-row"><strong>{entry.title}</strong><span className={`evidence-pill ${entry.state}`}>{stateLabels[entry.state]}</span></span>
        </button>
      </li>)}</ol>
    </details>
  </>
}

export function GraphRelationLegend({ kinds }: { kinds: Iterable<CourseRelationKind> }) {
  const uniqueKinds = [...new Set(kinds)]
  if (!uniqueKinds.length) return null
  return <div className="graph-relations" role="group" aria-label="关系类型图例">
    {uniqueKinds.map(kind => <span className={`graph-relation-key ${kind}`} key={kind}><i aria-hidden="true"/><span>{courseRelationLabels[kind]}</span></span>)}
  </div>
}
