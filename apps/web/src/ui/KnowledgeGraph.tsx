import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { IMPLEMENT_OBJECTIVE, TRACE_OBJECTIVE, stateLabels, type ObjectiveState } from '../domain/learning'

export default function KnowledgeGraph({ state, selected, onSelect }: { state: ObjectiveState; selected: string; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const graph = useRef<cytoscape.Core | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  useEffect(() => {
    if (!container.current) return
    const cy = cytoscape({ container: container.current, pixelRatio: 'auto', minZoom: 0.45, maxZoom: 2.5,
      elements: [
        { data: { id: 'chapter', label: '线性结构', kind: 'chapter' }, position: { x: 130, y: 180 } },
        { data: { id: 'unit', label: '栈及括号匹配', kind: 'unit' }, position: { x: 285, y: 180 } },
        { data: { id: TRACE_OBJECTIVE, label: '栈状态推演', kind: 'objective' }, position: { x: 460, y: 100 } },
        { data: { id: IMPLEMENT_OBJECTIVE, label: '括号匹配实现', kind: 'objective' }, position: { x: 460, y: 260 } },
        { data: { id: 'contains-a', source: 'chapter', target: 'unit', kind: 'contains' } },
        { data: { id: 'contains-b', source: 'unit', target: TRACE_OBJECTIVE, kind: 'contains' } },
        { data: { id: 'contains-c', source: 'unit', target: IMPLEMENT_OBJECTIVE, kind: 'contains' } },
        { data: { id: 'prerequisite', source: TRACE_OBJECTIVE, target: IMPLEMENT_OBJECTIVE, kind: 'prerequisite', label: '先修 · 待审' } },
      ], layout: { name: 'preset', padding: 42 },
      style: [
        { selector: 'node', style: { width: 54, height: 54, 'background-color': '#d7ddd5', 'border-width': 1, 'border-color': '#667773', label: 'data(label)', 'font-size': 14, color: '#163b38', 'text-valign': 'bottom', 'text-margin-y': 15, 'font-family': 'system-ui, sans-serif' } },
        { selector: 'node[kind="chapter"]', style: { shape: 'round-rectangle', width: 32, height: 32, 'background-color': '#294b45', 'border-color': '#294b45' } },
        { selector: 'node[kind="unit"]', style: { width: 40, height: 40, 'background-color': '#7b9d89' } },
        { selector: 'edge', style: { width: 1.3, 'line-color': '#6d8173', 'curve-style': 'bezier', 'target-arrow-shape': 'none' } },
        { selector: 'edge[kind="prerequisite"]', style: { 'line-style': 'dashed', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#a36735', 'line-color': '#a36735', label: 'data(label)', color: '#805732', 'font-size': 12, 'text-rotation': 'autorotate', 'text-background-color': '#f3f3eb', 'text-background-opacity': 1, 'text-background-padding': '5px' } },
        { selector: 'node.evidence-partial', style: { 'background-color': '#91b9a8', 'border-color': '#246a5b', 'border-width': 3 } },
        { selector: 'node.evidence-consolidate', style: { 'background-color': '#e5c0a3', 'border-color': '#955429', 'border-width': 3 } },
        { selector: 'node.evidence-verified', style: { 'background-color': '#286957', 'border-color': '#183b33', 'border-width': 3 } },
        { selector: 'node.current', style: { 'overlay-color': '#235b51', 'overlay-opacity': 0.09, 'overlay-padding': 9 } },
      ],
    })
    cy.on('tap', 'node[kind="objective"]', event => onSelectRef.current(event.target.id()))
    graph.current = cy
    let narrowMode: boolean | null = null
    const resizeGraph = () => {
      cy.resize()
      const narrow = (container.current?.clientWidth ?? 0) < 600
      if (narrowMode !== narrow) {
        narrowMode = narrow
        const positions = narrow ? { chapter: { x: 140, y: 40 }, unit: { x: 140, y: 140 }, [TRACE_OBJECTIVE]: { x: 70, y: 260 }, [IMPLEMENT_OBJECTIVE]: { x: 210, y: 260 } } : { chapter: { x: 130, y: 180 }, unit: { x: 285, y: 180 }, [TRACE_OBJECTIVE]: { x: 460, y: 100 }, [IMPLEMENT_OBJECTIVE]: { x: 460, y: 260 } }
        cy.batch(() => { Object.entries(positions).forEach(([id, position]) => cy.getElementById(id).position(position)) })
      }
      cy.fit(undefined, narrow ? 20 : 48)
    }
    const observer = new ResizeObserver(resizeGraph)
    observer.observe(container.current)
    resizeGraph()
    return () => { observer.disconnect(); cy.destroy(); graph.current = null }
  }, [])
  useEffect(() => {
    const cy = graph.current
    if (!cy) return
    cy.nodes().removeClass('current')
    const node = cy.getElementById(TRACE_OBJECTIVE)
    node.removeClass('evidence-partial evidence-consolidate evidence-verified').addClass(`evidence-${state}`)
    cy.getElementById(selected).addClass('current')
  }, [state, selected])
  return <><div className="graph-frame"><div className="graph-coordinate">DATA STRUCTURES / STACK</div><div ref={container} className="graph-canvas" role="img" aria-label={`栈单元知识图谱：两个目标。栈状态推演${stateLabels[state]}，括号匹配尚未有效评估。下方列表提供相同入口。`}/></div><div className="graph-controls"><button onClick={() => graph.current?.fit(undefined, 48)}>适应画布</button><button onClick={() => graph.current?.zoom({ level: (graph.current?.zoom() ?? 1) * 1.2, renderedPosition: { x: 250, y: 150 } })} aria-label="放大图谱">＋</button><button onClick={() => graph.current?.zoom({ level: (graph.current?.zoom() ?? 1) / 1.2, renderedPosition: { x: 250, y: 150 } })} aria-label="缩小图谱">−</button></div></>
}
