export type ObjectiveState = 'unknown' | 'partial' | 'consolidate' | 'verified'
export type CourseMapNodeKind = 'course' | 'chapter' | 'unit' | 'objective'
export type CourseRelationKind = 'contains' | 'mandatory_prerequisite' | 'conceptual_association' | 'application' | 'evidence_support'

export type CourseMapNode = {
  id: string
  title: string
  kind: CourseMapNodeKind
  /** Stable learning objective ID. Multiple map nodes may refer to one objective. */
  objectiveId?: string
  /** Human-facing reference used by existing activity routes. */
  objectiveRef?: string
}

export type CourseMapRelation = {
  id: string
  from: string
  to: string
  kind: CourseRelationKind
  source?: string
}

export type CourseMapDefinition = {
  courseId: string
  version: string
  rootNodeId: string
  nodes: CourseMapNode[]
  relations: CourseMapRelation[]
}

export type ObjectiveSummary = {
  total: number
  verified: number
  partial: number
  consolidate: number
  unknown: number
}

export type ProjectedCourseMapNode = CourseMapNode & {
  /** Present only for objective nodes; container states are represented by counts. */
  state?: ObjectiveState
  objectiveIds: string[]
  summary: ObjectiveSummary
}

export type CourseMapProjection = {
  courseId: string
  version: string
  rootNodeId: string
  nodes: ProjectedCourseMapNode[]
  relations: CourseMapRelation[]
  /** Full declared objective denominator, independent of map visibility and filters. */
  objectiveIds: string[]
  summary: ObjectiveSummary
}

export const courseRelationLabels: Record<CourseRelationKind, string> = {
  contains: '包含',
  mandatory_prerequisite: '严格先修',
  conceptual_association: '概念关联',
  application: '后续应用',
  evidence_support: '证据支持',
}

type CoursePackageLike = {
  course_id?: string
  course_code?: string
  course_version_id?: string
  version: string
  title: string
  objectives: Array<{ id?: string; code?: string; title: string }>
  relations?: Array<{ from: string; to: string; kind: string; source?: string }>
}

const relationKinds = new Set<CourseRelationKind>([
  'contains', 'mandatory_prerequisite', 'conceptual_association', 'application', 'evidence_support',
])

function parseRelationKind(kind: string): CourseRelationKind {
  if (!relationKinds.has(kind as CourseRelationKind)) throw new Error(`Unsupported course relation: ${kind}`)
  return kind as CourseRelationKind
}

/** Convert an authored course package into the graph contract without inventing chapters or units. */
export function courseMapFromPackage(course: CoursePackageLike): CourseMapDefinition {
  const courseId = course.course_id ?? course.course_code
  if (!courseId || !course.version || !course.title) throw new Error('Course map requires a course ID, version, and title.')
  const rootNodeId = `course:${courseId}:${course.version}`
  const nodes: CourseMapNode[] = [{ id: rootNodeId, title: course.title, kind: 'course' }]
  const objectiveNodeByRef = new Map<string, CourseMapNode>()

  for (const objective of course.objectives) {
    const objectiveId = objective.id ?? objective.code
    const objectiveRef = objective.code ?? objectiveId
    if (!objectiveId || !objectiveRef || !objective.title) throw new Error('Each objective needs a stable ID, route reference, and title.')
    if (objectiveNodeByRef.has(objectiveRef)) throw new Error(`Duplicate objective reference: ${objectiveRef}`)
    const node: CourseMapNode = { id: `objective:${objectiveId}`, title: objective.title, kind: 'objective', objectiveId, objectiveRef }
    nodes.push(node)
    objectiveNodeByRef.set(objectiveRef, node)
    objectiveNodeByRef.set(objectiveId, node)
  }

  const relations: CourseMapRelation[] = nodes.filter(node => node.kind === 'objective').map(node => ({
    id: `contains:${rootNodeId}:${node.id}`, from: rootNodeId, to: node.id, kind: 'contains',
  }))
  for (const relation of course.relations ?? []) {
    const from = objectiveNodeByRef.get(relation.from)
    const to = objectiveNodeByRef.get(relation.to)
    if (!from || !to) throw new Error(`Course relation points to an unknown objective: ${relation.from} -> ${relation.to}`)
    relations.push({
      id: `${relation.kind}:${from.id}:${to.id}`,
      from: from.id,
      to: to.id,
      kind: parseRelationKind(relation.kind),
      source: relation.source,
    })
  }

  return { courseId, version: course.version, rootNodeId, nodes, relations }
}

export function summarizeObjectiveStates(objectiveIds: Iterable<string>, states: ReadonlyMap<string, ObjectiveState>): ObjectiveSummary {
  const ids = [...new Set(objectiveIds)]
  const summary: ObjectiveSummary = { total: ids.length, verified: 0, partial: 0, consolidate: 0, unknown: 0 }
  for (const id of ids) summary[states.get(id) ?? 'unknown'] += 1
  return summary
}

export function projectCourseMap(
  definition: CourseMapDefinition,
  states: ReadonlyMap<string, ObjectiveState>,
  options: { collapsedNodeIds?: ReadonlySet<string>; visibleRelationKinds?: ReadonlySet<CourseRelationKind> } = {},
): CourseMapProjection {
  const nodeById = new Map(definition.nodes.map(node => [node.id, node]))
  if (nodeById.size !== definition.nodes.length) throw new Error('Course map node IDs must be unique.')
  if (nodeById.get(definition.rootNodeId)?.kind !== 'course') throw new Error('Course map root must be a course node.')

  const relationIds = new Set<string>()
  const children = new Map<string, string[]>()
  for (const relation of definition.relations) {
    if (relationIds.has(relation.id)) throw new Error(`Duplicate course relation ID: ${relation.id}`)
    relationIds.add(relation.id)
    if (!nodeById.has(relation.from) || !nodeById.has(relation.to)) throw new Error(`Course relation has an unknown endpoint: ${relation.id}`)
    if (relation.kind === 'contains') children.set(relation.from, [...(children.get(relation.from) ?? []), relation.to])
  }

  const allObjectiveIds = [...new Set(definition.nodes.flatMap(node => node.kind === 'objective' && node.objectiveId ? [node.objectiveId] : []))]
  const childObjectives = new Map<string, string[]>()
  const descendants = (nodeId: string, active: Set<string>): string[] => {
    if (active.has(nodeId)) throw new Error('Course containment relations must be acyclic.')
    const node = nodeById.get(nodeId)
    if (!node) return []
    if (node.kind === 'objective') return node.objectiveId ? [node.objectiveId] : []
    const nextActive = new Set(active).add(nodeId)
    return [...new Set((children.get(nodeId) ?? []).flatMap(childId => descendants(childId, nextActive)))]
  }
  for (const node of definition.nodes) childObjectives.set(node.id, descendants(node.id, new Set()))

  const allNodeDescendants = (nodeId: string, active = new Set<string>()): string[] => {
    if (active.has(nodeId)) throw new Error('Course containment relations must be acyclic.')
    const nextActive = new Set(active).add(nodeId)
    const directChildren = children.get(nodeId) ?? []
    return [...new Set(directChildren.flatMap(childId => [childId, ...allNodeDescendants(childId, nextActive)]))]
  }
  const hiddenNodeIds = new Set<string>()
  for (const collapsedId of options.collapsedNodeIds ?? []) {
    if (nodeById.get(collapsedId)?.kind !== 'objective') allNodeDescendants(collapsedId).forEach(id => hiddenNodeIds.add(id))
  }

  const summary = summarizeObjectiveStates(allObjectiveIds, states)
  const projectedNodes = definition.nodes.filter(node => !hiddenNodeIds.has(node.id)).map(node => {
    const objectiveIds = childObjectives.get(node.id) ?? []
    const state = node.kind === 'objective' && node.objectiveId ? states.get(node.objectiveId) ?? 'unknown' : undefined
    return { ...node, state, objectiveIds, summary: summarizeObjectiveStates(objectiveIds, states) }
  })
  const visibleNodeIds = new Set(projectedNodes.map(node => node.id))
  const projectedRelations = definition.relations.filter(relation =>
    visibleNodeIds.has(relation.from) && visibleNodeIds.has(relation.to) &&
    (!options.visibleRelationKinds || options.visibleRelationKinds.has(relation.kind)),
  )

  return {
    courseId: definition.courseId,
    version: definition.version,
    rootNodeId: definition.rootNodeId,
    nodes: projectedNodes,
    relations: projectedRelations,
    objectiveIds: allObjectiveIds,
    summary,
  }
}
