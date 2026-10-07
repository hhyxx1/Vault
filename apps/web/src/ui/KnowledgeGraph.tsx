import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import { stateLabels } from '../domain/learning'
import { courseRelationLabels, projectCourseMap, type CourseMapDefinition, type CourseRelationKind, type ObjectiveState } from '../domain/course-map'

export default function KnowledgeGraph({ definition, states, selected, onSelect }: { definition: CourseMapDefinition; states: ReadonlyMap<string, ObjectiveState>; selected: string; onSelect: (id: string) => void }) {
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
          label: courseRelationLabels[relation.kind],
        } })),
      },
      layout: { name: 'breadthfirst', directed: true, roots: [`node[id = "${definition.rootNodeId}"]`], padding: 42, spacingFactor: 1.2, animate: false },
      style: [
        { selector: 'node', style: { width: 132, height: 54, 'background-color': '#d7ddd5', 'border-width': 1, 'border-color': '#667773', label: 'data(label)', 'text-wrap': 'wrap', 'text-max-width': '118px', 'font-size': '12px', color: '#163b38', 'text-valign': 'center', 'text-halign': 'center', 'font-family': 'system-ui, sans-serif' } },
        { selector: 'node[kind="course"]', style: { shape: 'round-rectangle', width: 150, height: 62, 'background-color': '#294b45', color: '#ffffff', 'border-color': '#294b45' } },
        { selector: 'node[kind="chapter"]', style: { shape: 'round-rectangle', width: 142, height: 56, 'background-color': '#7b9d89' } },
        { selector: 'node[kind="unit"]', style: { width: 136, height: 54, 'background-color': '#aebda9' } },
        { selector: 'edge', style: { width: 1.3, 'line-color': '#6d8173', 'curve-style': 'bezier', 'target-arrow-shape': 'none', label: 'data(label)', color: '#546050', 'font-size': 10, 'text-rotation': 'autorotate', 'text-background-color': '#f3f3eb', 'text-background-opacity': 1, 'text-background-padding': '3px' } },
        { selector: 'edge[kind="mandatory_prerequisite"]', style: { 'line-style': 'dashed', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#a36735', 'line-color': '#a36735', color: '#805732' } },
        { selector: 'edge[kind="conceptual_association"]', style: { 'line-style': 'dotted', 'line-color': '#687c99', 'target-arrow-shape': 'none', color: '#526884' } },
        { selector: 'edge[kind="application"]', style: { 'target-arrow-shape': 'triangle', 'target-arrow-color': '#246a5b', 'line-color': '#246a5b', color: '#246a5b' } },
        { selector: 'edge[kind="evidence_support"]', style: { 'line-style': 'dashed', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#526884', 'line-color': '#526884', color: '#526884' } },
        { selector: 'node.evidence-partial', style: { 'background-color': '#91b9a8', 'border-color': '#246a5b', 'border-width': 3 } },
        { selector: 'node.evidence-consolidate', style: { 'background-color': '#e5c0a3', 'border-color': '#955429', 'border-width': 3 } },
        { selector: 'node.evidence-verified', style: { 'background-color': '#286957', 'border-color': '#183b33', 'border-width': 3 } },
        { selector: 'node.current', style: { 'overlay-color': '#235b51', 'overlay-opacity': 0.09, 'overlay-padding': 9 } },
      ],
    })
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
    const observer = new ResizeObserver(() => cy.resize())
    observer.observe(container.current)
    cy.fit(undefined, 42)
    return () => { observer.disconnect(); cy.destroy(); graph.current = null }
  }, [definition])
  useEffect(() => {
    const cy = graph.current
    if (!cy) return
    const visibleNodeIds = new Set(projection.nodes.map(node => node.id))
    const visibleRelationIds = new Set(projection.relations.map(relation => relation.id))
    cy.batch(() => {
      cy.nodes().forEach(node => {
        const projected = projection.nodes.find(item => item.id === node.id())
        if (!projected) { node.style('display', 'none'); return }
        node.style('display', 'element')
        node.removeClass('evidence-unknown evidence-partial evidence-consolidate evidence-verified current')
        if (projected.kind === 'objective') node.addClass(`evidence-${projected.state ?? 'unknown'}`)
        if (projected.objectiveRef === selected) node.addClass('current')
        const label = projected.kind === 'objective'
          ? `${projected.title}\n${stateLabels[projected.state ?? 'unknown']}`
          : `${projected.title}\n${projected.summary.verified}/${projected.summary.total} 项有达标证据`
        node.data('label', label)
      })
      cy.edges().forEach(edge => {
        if (visibleRelationIds.has(edge.id()) && visibleNodeIds.has(edge.data('source')) && visibleNodeIds.has(edge.data('target'))) edge.style('display', 'element')
        else edge.style('display', 'none')
      })
    })
  }, [projection, selected])
  const expandableNodes = projection.nodes.filter(node => node.kind !== 'objective' && node.objectiveIds.length > 0)
  const hasPrerequisite = definition.relations.some(relation => relation.kind === 'mandatory_prerequisite')
  const mapSummary = projection.summary
  const stateText = `课程知识图谱，${mapSummary.total} 个唯一目标，其中 ${mapSummary.verified} 项有达标证据，${mapSummary.partial} 项部分满足，${mapSummary.consolidate} 项需巩固，${mapSummary.unknown} 项尚未评估。`
  return <><div className="graph-frame"><div className="graph-coordinate">{definition.courseId.toUpperCase()} / {definition.version}</div><div ref={container} className="graph-canvas" role="img" aria-label={`${stateText}下方文字视图提供相同目标入口。`}/></div><div className="graph-controls"><button onClick={() => graph.current?.fit(undefined, 42)}>适应画布</button>{expandableNodes.map(node => <button key={node.id} aria-expanded={!collapsedNodeIds.has(node.id)} onClick={() => setCollapsedNodeIds(current => { const next = new Set(current); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next })}>{collapsedNodeIds.has(node.id) ? '展开' : '折叠'}「{node.title}」</button>)}{hasPrerequisite && <button aria-pressed={showPrerequisites} onClick={() => setShowPrerequisites(value => !value)}>{showPrerequisites ? '隐藏' : '显示'}先修关系</button>}<button onClick={() => graph.current?.zoom({ level: (graph.current?.zoom() ?? 1) * 1.2, renderedPosition: { x: 250, y: 150 } })} aria-label="放大图谱">＋</button><button onClick={() => graph.current?.zoom({ level: (graph.current?.zoom() ?? 1) / 1.2, renderedPosition: { x: 250, y: 150 } })} aria-label="缩小图谱">−</button></div></>
}
