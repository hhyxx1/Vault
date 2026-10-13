import type { AtlasPackage } from './course-packages'
import { summarizeObjectiveStates, type ObjectiveState, type ObjectiveSummary } from './course-map'
import type { ObjectiveCognition } from './learner-cognition'

/** The three structural layers the vision asks for: the objective discipline map, plus the learner layer on top. */
export type CognitiveLayer = 'course' | 'chapter' | 'unit' | 'objective'

export type CognitiveNode = {
  id: string
  label: string
  layer: CognitiveLayer
  parentId: string | null
  chapterId: string | null
  objectiveCode?: string
  /** Objective cognitive state. Only meaningful for objective nodes. */
  state?: ObjectiveState
  /** Full learner cognition for an objective node. */
  cognition?: ObjectiveCognition
  /** Declared-objective summary for container nodes (deduplicated). */
  summary?: ObjectiveSummary
  /** Number of evidence-derived problems / open items on this objective. */
  flagCount: number
  /** True when there is no trustworthy evidence and no attempt yet. */
  unverified: boolean
  recommended: boolean
}

/** Objective/structural relations stay declarative; learner edges are inferred from this student's records only. */
export type CognitiveEdgeKind =
  | 'contains'
  | 'mandatory_prerequisite'
  | 'conceptual_association'
  | 'application'
  | 'recommendation'
  | 'influence'

export type CognitiveEdgeOrigin = 'structure' | 'curriculum' | 'learner'

export type CognitiveEdge = {
  id: string
  from: string
  to: string
  kind: CognitiveEdgeKind
  origin: CognitiveEdgeOrigin
  source?: string
}

export type Recommendation = {
  code: string
  title: string
  reason: string
  basis: string
}

export type CognitiveGraph = {
  courseCode: string
  courseVersionId: string
  title: string
  version: string
  status: string
  scopeNote: string
  rootId: string
  nodes: CognitiveNode[]
  edges: CognitiveEdge[]
  objectiveCodes: string[]
  summary: ObjectiveSummary
  recommendation: Recommendation | null
}

const objectiveNodeId = (objectiveId: string) => `objective:${objectiveId}`

/**
 * Combine the objective discipline map with this learner's cognitive records into
 * one render-ready model. The discipline map (course / chapter / unit / objective)
 * is objective and stable; the cognitive state is layered onto objective nodes and
 * never lowers or raises a container's declared scope.
 */
export function buildCognitiveGraph(
  data: AtlasPackage,
  cognitionByCode: ReadonlyMap<string, ObjectiveCognition>,
  options: { lastObjective?: string | null } = {},
): CognitiveGraph {
  const nodes: CognitiveNode[] = []
  const edges: CognitiveEdge[] = []
  const goalByCode = new Map(data.objectives.map(goal => [goal.code, goal]))
  const objectiveIdByCode = new Map(data.objectives.map(goal => [goal.code, goal.id ?? goal.code]))
  const stateOf = (code: string): ObjectiveState => cognitionByCode.get(code)?.state ?? 'unknown'

  const rootId = `course:${data.course_id}:${data.course_version_id}`
  const objectiveIds = data.objectives.map(goal => goal.id ?? goal.code)
  const outline = data.outline ?? []

  const objectiveSummaryFor = (refs: Iterable<string>) =>
    summarizeObjectiveStates(
      [...new Set(refs)].map(code => objectiveIdByCode.get(code) ?? code),
      new Map([...cognitionByCode.values()].map(item => [item.objectiveId, item.state])),
    )

  const addObjectiveNode = (code: string, parentId: string, chapterId: string | null) => {
    const goal = goalByCode.get(code)
    if (!goal) return
    const cognition = cognitionByCode.get(code)
    nodes.push({
      id: objectiveNodeId(objectiveIdByCode.get(code) ?? code),
      label: goal.title,
      layer: 'objective',
      parentId,
      chapterId,
      objectiveCode: code,
      state: stateOf(code),
      cognition,
      flagCount: cognition?.flags.length ?? 0,
      unverified: stateOf(code) === 'unknown' && !cognition?.hasAttempt,
      recommended: options.lastObjective === code,
    })
  }

  nodes.push({
    id: rootId,
    label: data.title,
    layer: 'course',
    parentId: null,
    chapterId: null,
    summary: objectiveSummaryFor(data.objectives.map(goal => goal.code)),
    flagCount: 0,
    unverified: false,
    recommended: false,
  })

  if (outline.length) {
    for (const chapter of outline) {
      const chapterId = `chapter:${chapter.id}`
      const chapterRefs = chapter.children.flatMap(unit => unit.objective_refs)
      nodes.push({
        id: chapterId,
        label: chapter.title,
        layer: 'chapter',
        parentId: rootId,
        chapterId: chapter.id,
        summary: objectiveSummaryFor(chapterRefs),
        flagCount: 0,
        unverified: false,
        recommended: false,
      })
      edges.push({ id: `contains:${rootId}:${chapterId}`, from: rootId, to: chapterId, kind: 'contains', origin: 'structure' })
      for (const unit of chapter.children) {
        const unitId = `unit:${unit.id}`
        nodes.push({
          id: unitId,
          label: unit.title,
          layer: 'unit',
          parentId: chapterId,
          chapterId: chapter.id,
          summary: objectiveSummaryFor(unit.objective_refs),
          flagCount: 0,
          unverified: false,
          recommended: false,
        })
        edges.push({ id: `contains:${chapterId}:${unitId}`, from: chapterId, to: unitId, kind: 'contains', origin: 'structure' })
        for (const ref of unit.objective_refs) {
          addObjectiveNode(ref, unitId, chapter.id)
          edges.push({
            id: `contains:${unitId}:objective:${objectiveIdByCode.get(ref) ?? ref}`,
            from: unitId,
            to: objectiveNodeId(objectiveIdByCode.get(ref) ?? ref),
            kind: 'contains',
            origin: 'structure',
          })
        }
      }
    }
  } else {
    for (const goal of data.objectives) {
      addObjectiveNode(goal.code, rootId, null)
      edges.push({
        id: `contains:${rootId}:objective:${goal.id ?? goal.code}`,
        from: rootId,
        to: objectiveNodeId(goal.id ?? goal.code),
        kind: 'contains',
        origin: 'structure',
      })
    }
  }

  // Declared curriculum relations between objectives (never invented, never propagated).
  for (const relation of data.relations ?? []) {
    const from = objectiveIdByCode.get(relation.from)
    const to = objectiveIdByCode.get(relation.to)
    if (!from || !to) continue
    edges.push({
      id: `curriculum:${relation.kind}:${from}:${to}`,
      from: objectiveNodeId(from),
      to: objectiveNodeId(to),
      kind: relation.kind as CognitiveEdgeKind,
      origin: 'curriculum',
      source: relation.source,
    })
  }

  // Learner-only inference: a prerequisite that actually shows insufficient
  // performance is surfaced as a potential influence. Unknown prerequisites are
  // NOT treated as a gap, and a relation never transfers a state to its target.
  for (const relation of (data.relations ?? []).filter(item => item.kind === 'mandatory_prerequisite')) {
    if (stateOf(relation.from) !== 'consolidate') continue
    const from = objectiveIdByCode.get(relation.from)
    const to = objectiveIdByCode.get(relation.to)
    if (!from || !to) continue
    edges.push({
      id: `influence:${from}:${to}`,
      from: objectiveNodeId(from),
      to: objectiveNodeId(to),
      kind: 'influence',
      origin: 'learner',
    })
  }

  const objectiveCodes = data.objectives.map(goal => goal.code)
  const stateMap = new Map([...cognitionByCode.values()].map(item => [item.objectiveId, item.state]))
  const recommendation = recommendNext(data, cognitionByCode, options)
  const visibleNodes = nodes.map(node => {
    if (!recommendation || node.objectiveCode !== recommendation.code) return node
    return { ...node, recommended: true }
  })

  return {
    courseCode: data.course_code,
    courseVersionId: data.course_version_id,
    title: data.title,
    version: data.version,
    status: data.status,
    scopeNote: data.scope_note,
    rootId,
    nodes: visibleNodes,
    edges,
    objectiveCodes,
    summary: summarizeObjectiveStates(objectiveIds, stateMap),
    recommendation,
  }
}

/**
 * A single, explainable next step. Ordered by what the evidence supports:
 * resume an explicit last objective, consolidate a real gap, finish partial
 * evidence, or start something whose prerequisites are known. No scores.
 */
export function recommendNext(
  data: AtlasPackage,
  cognitionByCode: ReadonlyMap<string, ObjectiveCognition>,
  options: { lastObjective?: string | null } = {},
): Recommendation | null {
  const ordered = data.objectives
  const find = (predicate: (code: string, cognition: ObjectiveCognition | undefined) => boolean) =>
    ordered.find(goal => predicate(goal.code, cognitionByCode.get(goal.code)))

  const last = options.lastObjective ? ordered.find(goal => goal.code === options.lastObjective) : undefined
  if (last) {
    return {
      code: last.code,
      title: last.title,
      reason: '继续上次中断的目标，保留已保存的作品与待补条件。',
      basis: '来自本机记录的上次学习位置。',
    }
  }

  const gap = find((_code, cognition) => cognition?.state === 'consolidate')
  if (gap) {
    return {
      code: gap.code,
      title: gap.title,
      reason: '最近证据显示这个目标仍有条件未满足，先修正比继续前进更稳。',
      basis: `${cognitionByCode.get(gap.code)?.flags[0]?.label ?? '存在未满足条件'}；依据为已记录作品。`,
    }
  }

  const partial = find((_code, cognition) => cognition?.state === 'partial')
  if (partial) {
    return {
      code: partial.code,
      title: partial.title,
      reason: '已有部分条件满足，补上原理解释与独立迁移即可提升证据等级。',
      basis: '来自当前课程版本的部分证据。',
    }
  }

  const prerequisiteSatisfied = (code: string) =>
    (data.relations ?? [])
      .filter(relation => relation.kind === 'mandatory_prerequisite' && relation.to === code)
      .every(relation => (cognitionByCode.get(relation.from)?.state ?? 'unknown') !== 'unknown')
  const ready = find((code, cognition) => cognition?.state === 'unknown' && prerequisiteSatisfied(code))
  if (ready) {
    return {
      code: ready.code,
      title: ready.title,
      reason: '它的严格先修已有证据，可以安全开始，不会跳过基础。',
      basis: '先修目标在当前版本已有可信证据。',
    }
  }

  const first = ordered[0]
  if (first) {
    return {
      code: first.code,
      title: first.title,
      reason: '当前范围内最靠前的未评估目标；未评估不等于不会，可以从这里建立第一份证据。',
      basis: '课程声明范围，尚无该目标的学习记录。',
    }
  }
  return null
}

export type Placement = { id: string; x: number; y: number; ring: number }

export type LayoutBounds = { minX: number; minY: number; width: number; height: number }

export type ConstellationLayout = {
  placements: Map<string, Placement>
  bounds: LayoutBounds
}

/**
 * Deterministic constellation layout: the course sits at the core, chapters orbit
 * it, units sit on a slightly wider orbit, and each unit's objectives fan outward.
 * Pure function of the graph, so a re-render or new evidence never re-shuffles it.
 */
export function constellationLayout(
  graph: CognitiveGraph,
  size: { width: number; height: number },
): ConstellationLayout {
  const placements = new Map<string, Placement>()
  const cx = size.width / 2
  const cy = size.height / 2
  const base = Math.min(size.width, size.height) * 0.5
  const rootPlacement: Placement = { id: graph.rootId, x: cx, y: cy, ring: 0 }
  placements.set(graph.rootId, rootPlacement)

  const chapters = graph.nodes.filter(node => node.layer === 'chapter')
  const orphanObjectives = graph.nodes.filter(node => node.layer === 'objective' && node.parentId === graph.rootId)

  const radiusBase = base * 0.52
  const radiusUnit = base * 0.78
  const radiusObjective = base * 0.98

  if (chapters.length) {
    const n = chapters.length
    const fullTurn = Math.PI * 2
    const chapterStep = fullTurn / n
    const halfSpan = chapterStep * 0.4
    chapters.forEach((chapter, index) => {
      const angle = -Math.PI / 2 + index * chapterStep
      placements.set(chapter.id, {
        id: chapter.id,
        x: cx + Math.cos(angle) * radiusBase,
        y: cy + Math.sin(angle) * radiusBase,
        ring: 1,
      })
      const units = graph.nodes.filter(node => node.layer === 'unit' && node.parentId === chapter.id)
      const unitCount = Math.max(1, units.length)
      const unitStep = (halfSpan * 2) / unitCount
      units.forEach((unit, unitIndex) => {
        const unitAngle = angle + (unitIndex - (unitCount - 1) / 2) * unitStep
        placements.set(unit.id, {
          id: unit.id,
          x: cx + Math.cos(unitAngle) * radiusUnit,
          y: cy + Math.sin(unitAngle) * radiusUnit,
          ring: 2,
        })
        const objectives = graph.nodes.filter(node => node.layer === 'objective' && node.parentId === unit.id)
        const objectiveCount = Math.max(1, objectives.length)
        const objectiveStep = (unitStep * 0.72) / objectiveCount
        objectives.forEach((objective, objectiveIndex) => {
          const objectiveAngle = unitAngle + (objectiveIndex - (objectiveCount - 1) / 2) * objectiveStep
          placements.set(objective.id, {
            id: objective.id,
            x: cx + Math.cos(objectiveAngle) * radiusObjective,
            y: cy + Math.sin(objectiveAngle) * radiusObjective,
            ring: 3,
          })
        })
      })
    })
  }

  if (orphanObjectives.length) {
    const n = Math.max(1, orphanObjectives.length)
    const perRing = Math.max(4, Math.ceil(Math.sqrt(n) * 1.6))
    orphanObjectives.forEach((objective, index) => {
      const ringIndex = Math.floor(index / perRing)
      const withinRing = index % perRing
      const ringCount = Math.min(perRing, n - ringIndex * perRing)
      const angle = -Math.PI / 2 + (withinRing / ringCount) * Math.PI * 2
      const radius = radiusBase + ringIndex * radiusBase * 0.42
      placements.set(objective.id, {
        id: objective.id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        ring: 2 + ringIndex,
      })
    })
  }

  // Any node not covered yet (defensive: keeps layout total).
  for (const node of graph.nodes) {
    if (placements.has(node.id)) continue
    placements.set(node.id, { id: node.id, x: cx, y: cy, ring: 0 })
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const placement of placements.values()) {
    minX = Math.min(minX, placement.x)
    minY = Math.min(minY, placement.y)
    maxX = Math.max(maxX, placement.x)
    maxY = Math.max(maxY, placement.y)
  }
  const pad = 90
  const bounds: LayoutBounds = {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
  return { placements, bounds }
}
