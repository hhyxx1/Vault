import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CognitiveEdge, CognitiveGraph, CognitiveLayer, CognitiveNode, ConstellationLayout } from '../../domain/cognitive-graph'
import { stateLabels as STATE_LABEL } from '../../domain/learning'
import './cognitive-atlas.css'

export type CosmicCanvasHandle = {
  focusNode: (nodeId: string) => void
  fitAll: () => void
}

type Camera = { x: number; y: number; w: number; h: number }

const NODE_RADIUS: Record<CognitiveLayer, number> = { course: 62, chapter: 34, unit: 15, objective: 22 }

/** Wrap a CJK label into at most two lines so long objective titles stay readable. */
function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const first = text.slice(0, maxChars)
  const rest = text.slice(maxChars)
  return rest.length <= maxChars ? [first, rest] : [first, `${rest.slice(0, maxChars - 1)}…`]
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export const CosmicCanvas = forwardRef<CosmicCanvasHandle, {
  graph: CognitiveGraph
  layout: ConstellationLayout
  selectedId: string | null
  hoveredId: string | null
  /** Objective codes that match the current search/filter; null means no filter is applied. */
  matchCodes: ReadonlySet<string> | null
  visibleEdgeKinds: ReadonlySet<CognitiveEdge['kind']>
  reducedMotion: boolean
  onSelect: (nodeId: string) => void
  onHover: (nodeId: string | null) => void
}>(function CosmicCanvas(
  { graph, layout, selectedId, hoveredId, matchCodes, visibleEdgeKinds, reducedMotion, onSelect, onHover },
  ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [camera, setCamera] = useState<Camera>(() => ({ x: layout.bounds.minX, y: layout.bounds.minY, w: layout.bounds.width, h: layout.bounds.height }))
  const [detailZoom, setDetailZoom] = useState(false)
  const tween = useRef<number | null>(null)
  const drag = useRef<{ x: number; y: number; camera: Camera } | null>(null)
  const filterActive = matchCodes !== null

  const nodeById = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph])
  const placementOf = useCallback((id: string) => layout.placements.get(id), [layout])

  const stopTween = useCallback(() => {
    if (tween.current) {
      cancelAnimationFrame(tween.current)
      tween.current = null
    }
  }, [])

  const animateTo = useCallback((target: Camera) => {
    stopTween()
    if (reducedMotion) { setCamera(target); return }
    const from = camera
    const start = performance.now()
    const duration = 460
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const e = easeInOut(t)
      setCamera({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      })
      tween.current = t < 1 ? requestAnimationFrame(step) : null
    }
    tween.current = requestAnimationFrame(step)
  }, [camera, reducedMotion, stopTween])

  const clampZoom = useCallback((w: number) => {
    const minW = layout.bounds.width / 7
    const maxW = layout.bounds.width / 1.6
    return Math.min(maxW, Math.max(minW, w))
  }, [layout])

  const fitAll = useCallback(() => {
    setDetailZoom(false)
    animateTo({ x: layout.bounds.minX, y: layout.bounds.minY, w: layout.bounds.width, h: layout.bounds.height })
  }, [animateTo, layout])

  const focusNode = useCallback((nodeId: string) => {
    const placement = placementOf(nodeId)
    const node = nodeById.get(nodeId)
    if (!placement || !node) return
    const aspect = layout.bounds.width / layout.bounds.height
    const targetWidth = node.layer === 'objective' ? 420 : node.layer === 'unit' ? 620 : node.layer === 'chapter' ? 1100 : layout.bounds.width
    const w = Math.min(layout.bounds.width, targetWidth)
    const h = w / aspect
    setDetailZoom(node.layer === 'objective' || node.layer === 'unit')
    animateTo({ x: placement.x - w / 2, y: placement.y - h / 2, w, h })
  }, [animateTo, layout, nodeById, placementOf])

  useImperativeHandle(ref, () => ({ focusNode, fitAll }), [fitAll, focusNode])

  useLayoutEffect(() => {
    stopTween()
    setCamera({ x: layout.bounds.minX, y: layout.bounds.minY, w: layout.bounds.width, h: layout.bounds.height })
    setDetailZoom(false)
  }, [layout, stopTween])

  useEffect(() => () => stopTween(), [stopTween])

  useEffect(() => {
    if (selectedId) focusNode(selectedId)
    // Only react to an explicit selection change, not to camera state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const px = camera.x + ((event.clientX - rect.left) / rect.width) * camera.w
    const py = camera.y + ((event.clientY - rect.top) / rect.height) * camera.h
    const factor = event.deltaY > 0 ? 1.14 : 1 / 1.14
    const w = clampZoom(camera.w * factor)
    const scale = w / camera.w
    const h = camera.h * scale
    setDetailZoom(w < layout.bounds.width / 2.6)
    setCamera({ x: px - (px - camera.x) * scale, y: py - (py - camera.y) * scale, w, h })
  }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, camera }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const state = drag.current
    if (!state || !svg.current) return
    const rect = svg.current.getBoundingClientRect()
    const dx = ((event.clientX - state.x) / rect.width) * state.camera.w
    const dy = ((event.clientY - state.y) / rect.height) * state.camera.h
    setCamera({ x: state.camera.x - dx, y: state.camera.y - dy, w: state.camera.w, h: state.camera.h })
  }
  const endDrag = () => { drag.current = null }

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const stepX = camera.w * 0.12
    const stepY = camera.h * 0.12
    if (event.key === 'ArrowLeft') setCamera({ ...camera, x: camera.x - stepX })
    else if (event.key === 'ArrowRight') setCamera({ ...camera, x: camera.x + stepX })
    else if (event.key === 'ArrowUp') setCamera({ ...camera, y: camera.y - stepY })
    else if (event.key === 'ArrowDown') setCamera({ ...camera, y: camera.y + stepY })
    else if (event.key === '+' || event.key === '=') setCamera({ ...camera, ...zoomAroundCenter(camera, 1 / 1.2, clampZoom) })
    else if (event.key === '-' || event.key === '_') setCamera({ ...camera, ...zoomAroundCenter(camera, 1.2, clampZoom) })
    else return
    event.preventDefault()
  }

  const neighbors = useMemo(() => {
    const map = new Map<string, CognitiveEdge[]>()
    for (const edge of graph.edges) {
      map.set(edge.from, [...(map.get(edge.from) ?? []), edge])
      map.set(edge.to, [...(map.get(edge.to) ?? []), edge])
    }
    return map
  }, [graph])

  const relatedIds = useMemo(() => {
    if (!selectedId) return null
    const ids = new Set<string>([selectedId])
    for (const edge of neighbors.get(selectedId) ?? []) { ids.add(edge.from); ids.add(edge.to) }
    return ids
  }, [neighbors, selectedId])

  const dim = (node: CognitiveNode) => {
    if (relatedIds && !relatedIds.has(node.id)) return true
    if (filterActive && node.layer === 'objective' && node.objectiveCode && !matchCodes?.has(node.objectiveCode)) return true
    return false
  }

  const renderedEdges = useMemo(() => graph.edges.filter(edge => {
    if (edge.kind === 'contains') return false
    return visibleEdgeKinds.has(edge.kind)
  }), [graph, visibleEdgeKinds])

  const edgePath = (edge: CognitiveEdge) => {
    const a = placementOf(edge.from)
    const b = placementOf(edge.to)
    if (!a || !b) return ''
    const dx = b.x - a.x
    const dy = b.y - a.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const bow = Math.min(120, distance * 0.22)
    const nx = -dy / distance
    const ny = dx / distance
    const mx = (a.x + b.x) / 2 + nx * bow
    const my = (a.y + b.y) / 2 + ny * bow
    return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
  }

  const info = [...layout.placements.values()]
  const showUnitLabels = detailZoom
  // At the full "cosmos" overview the outer objective labels would collide; show
  // them once the camera is zoomed in, or for the nodes that matter right now.
  const showObjectiveLabels = camera.w < layout.bounds.width * 0.72

  return <div className="cosmic-stage" ref={host}>
    <div className="cosmic-backdrop" aria-hidden="true" />
    <svg
      ref={svg}
      className={`cosmic-svg ${drag.current ? 'is-panning' : ''}`}
      viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`}
      role="application"
      aria-label={`认知图谱，${graph.nodes.filter(node => node.layer === 'objective').length} 个知识目标。可用方向键平移，加减号缩放，Tab 在节点间移动。`}
      tabIndex={0}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <defs>
        <radialGradient id="cosmic-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#bfe3ff" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#4b8dff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1b2a6b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cosmic-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5f7dff" stopOpacity="0.22" />
          <stop offset="70%" stopColor="#5f7dff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#5f7dff" stopOpacity="0" />
        </radialGradient>
        <filter id="cosmic-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {[...info].map(placement => {
        const node = nodeById.get(placement.id)
        if (!node || node.layer !== 'chapter') return null
        const radius = node.layer === 'chapter' ? NODE_RADIUS.chapter * 4.4 : 0
        return <circle key={`halo-${node.id}`} className="cosmic-cluster-halo" cx={placement.x} cy={placement.y} r={radius} fill="url(#cosmic-halo)" />
      })}

      <g className="cosmic-edges">
        {renderedEdges.map(edge => {
          const path = edgePath(edge)
          if (!path) return null
          const active = !!selectedId && (edge.from === selectedId || edge.to === selectedId)
          const muted = !!relatedIds && !active
          return <path
            key={edge.id}
            d={path}
            className={`cosmic-edge kind-${edge.kind} origin-${edge.origin} ${active ? 'is-active' : ''} ${muted ? 'is-muted' : ''}`}
            markerEnd={edge.kind === 'conceptual_association' || edge.kind === 'influence' ? undefined : 'url(#cosmic-arrow)'}
          />
        })}
        <defs>
          <marker id="cosmic-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M1 1L11 6L1 11Z" className="cosmic-arrow-head" />
          </marker>
        </defs>
      </g>

      <g className="cosmic-nodes">
        {graph.nodes.map(node => {
          const placement = placementOf(node.id)
          if (!placement) return null
          const radius = NODE_RADIUS[node.layer]
          const isSelected = node.id === selectedId
          const isHovered = node.id === hoveredId
          const state = node.state ?? 'unknown'
          const nodeDim = dim(node)
          const labelChars = node.layer === 'chapter' ? 9 : 6
          const labelled = node.layer !== 'objective'
            || showObjectiveLabels
            || isSelected || isHovered || node.recommended || node.flagCount > 0
          const lines = !labelled || (node.layer === 'unit' && !showUnitLabels) ? [] : wrapLabel(node.label, labelChars)
          const stateText = node.layer === 'objective' ? STATE_LABEL[state] : node.summary ? `有达标证据 ${node.summary.verified}/${node.summary.total}` : ''
          return <g
            key={node.id}
            className={[
              'cosmic-node', `layer-${node.layer}`,
              node.layer === 'objective' ? `state-${state}` : '',
              isSelected ? 'is-selected' : '',
              isHovered ? 'is-hovered' : '',
              nodeDim ? 'is-dim' : '',
              node.unverified ? 'is-unverified' : '',
              node.flagCount > 0 ? 'has-flag' : '',
              node.recommended ? 'is-recommended' : '',
              node.layer === 'objective' && node.objectiveCode && matchCodes?.has(node.objectiveCode) ? 'is-match' : '',
            ].filter(Boolean).join(' ')}
            transform={`translate(${placement.x} ${placement.y})`}
            tabIndex={0}
            role="button"
            aria-label={`${node.label}${stateText ? `，${stateText}` : ''}`}
            aria-pressed={isSelected}
            onPointerDown={event => event.stopPropagation()}
            onClick={() => onSelect(node.id)}
            onPointerEnter={() => onHover(node.id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(node.id)}
            onBlur={() => onHover(null)}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id) } }}
          >
            <title>{stateText ? `${node.label} · ${stateText}` : node.label}</title>
            {node.layer === 'course' && <circle className="cosmic-core-glow" r={radius * 1.5} fill="url(#cosmic-core)" />}
            {node.layer === 'course' && <circle className="cosmic-core-ring" r={radius * 1.14} />}
            <circle className="cosmic-plate" r={radius} />
            {node.layer === 'objective' && <>
              <circle className="cosmic-state-ring" r={radius * 0.82} />
              <circle className="cosmic-core-dot" r={radius * 0.34} filter="url(#cosmic-glow)" />
            </>}
            {node.layer === 'chapter' && <path className="cosmic-hex" d={hexPath(radius * 0.72)} />}
            {node.layer === 'unit' && <path className="cosmic-diamond" d={diamondPath(radius * 0.78)} />}
            {node.layer === 'course' && <circle className="cosmic-core-dot" r={radius * 0.2} />}
            {node.recommended && <path className="cosmic-beacon" d="M0 -6 L6 6 L-6 6 Z" transform={`translate(0 ${-radius - 16})`} />}
            {node.flagCount > 0 && <g className="cosmic-flag" transform={`translate(${radius * 0.72} ${-radius * 0.72})`}><circle r="9" /><text y="4">{node.flagCount}</text></g>}
            {lines.map((line, index) => <text
              key={line + index}
              className="cosmic-label"
              y={radius + 16 + index * 14}
              x={0}
            >{line}</text>)}
          </g>
        })}
      </g>
    </svg>
    <div className="cosmic-hint" aria-hidden="true">拖动平移 · 滚轮缩放 · 点击目标查看认知状态</div>
  </div>
})

function hexPath(radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3
    return `${index === 0 ? 'M' : 'L'} ${(Math.cos(angle) * radius).toFixed(2)} ${(Math.sin(angle) * radius).toFixed(2)}`
  }).join(' ') + ' Z'
}

function diamondPath(radius: number) {
  return `M 0 ${-radius} L ${radius} 0 L 0 ${radius} L ${-radius} 0 Z`
}

function zoomAroundCenter(camera: Camera, factor: number, clamp: (w: number) => number) {
  const w = clamp(camera.w * factor)
  const scale = w / camera.w
  const h = camera.h * scale
  const cx = camera.x + camera.w / 2
  const cy = camera.y + camera.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}
