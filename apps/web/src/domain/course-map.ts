import type { PersonalCourse } from './personal'

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

export type CourseMapObjectiveNavigationEntry = {
  nodeId: string
  objectiveRef?: string
  title: string
  path: string[]
  state: ObjectiveState
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
  outline?: CourseOutlineInput[]
}

type CourseOutlineInput = {
  // Inputs come from authored JSON packages, where literal kinds widen to string;
  // appendOutline validates that level 0 is a chapter and level 1 is a unit.
  kind: string
  id: string
  title: string
  objective_refs?: string[]
  children?: CourseOutlineInput[]
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
  const objectiveIds = new Set<string>()

  for (const objective of course.objectives) {
    const objectiveId = objective.id ?? objective.code
    const objectiveRef = objective.code ?? objectiveId
    if (!objectiveId || !objectiveRef || !objective.title) throw new Error('Each objective needs a stable ID, route reference, and title.')
    if (objectiveIds.has(objectiveId)) throw new Error(`Duplicate course objective ID: ${objectiveId}`)
    if (objectiveNodeByRef.has(objectiveRef)) throw new Error(`Duplicate objective reference: ${objectiveRef}`)
    if (objectiveNodeByRef.has(objectiveId)) throw new Error(`Duplicate course objective reference: ${objectiveId}`)
    const node: CourseMapNode = { id: `objective:${objectiveId}`, title: objective.title, kind: 'objective', objectiveId, objectiveRef }
    nodes.push(node)
    objectiveIds.add(objectiveId)
    objectiveNodeByRef.set(objectiveRef, node)
    objectiveNodeByRef.set(objectiveId, node)
  }

  const relations: CourseMapRelation[] = []
  if (course.outline === undefined) {
    relations.push(...nodes.filter(node => node.kind === 'objective').map(node => ({
      id: `contains:${rootNodeId}:${node.id}`, from: rootNodeId, to: node.id, kind: 'contains' as const,
    })))
  } else {
    const placedObjectives = new Set<string>()
    const outlineNodeIds = new Set<string>()
    const appendOutline = (entry: CourseOutlineInput, parentId: string, parentKind: CourseMapNodeKind, level: number) => {
      if (!entry.id?.trim() || !entry.title?.trim()) throw new Error('Course outline nodes require stable IDs and titles.')
      if (outlineNodeIds.has(entry.id)) throw new Error(`Course outline has a duplicate structure ID: ${entry.id}`)
      if ((level === 0 && entry.kind !== 'chapter') || (level === 1 && (parentKind !== 'chapter' || entry.kind !== 'unit')) || level > 1) {
        throw new Error('Course outline may contain chapters and units only, with units directly inside chapters.')
      }
      if ((entry.children?.length ?? 0) > 0 && entry.kind !== 'chapter') throw new Error('Course outline units cannot contain other structure nodes.')
      outlineNodeIds.add(entry.id)
      const nodeId = `${entry.kind}:${entry.id}`
      nodes.push({ id: nodeId, title: entry.title, kind: entry.kind as CourseMapNodeKind })
      relations.push({ id: `contains:${parentId}:${nodeId}`, from: parentId, to: nodeId, kind: 'contains' })

      const localObjectives = new Set<string>()
      for (const ref of entry.objective_refs ?? []) {
        const objective = objectiveNodeByRef.get(ref)
        if (!objective) throw new Error(`Course outline references an unknown objective: ${ref}`)
        if (localObjectives.has(objective.objectiveId!)) throw new Error(`Course outline repeats an objective in one placement: ${ref}`)
        localObjectives.add(objective.objectiveId!)
        placedObjectives.add(objective.objectiveId!)
        relations.push({ id: `contains:${nodeId}:${objective.id}`, from: nodeId, to: objective.id, kind: 'contains' })
      }

      for (const child of entry.children ?? []) appendOutline(child, nodeId, entry.kind as CourseMapNodeKind, level + 1)
      if (!(entry.objective_refs?.length) && !(entry.children?.length)) throw new Error(`Course outline contains an empty ${entry.kind}: ${entry.id}`)
    }

    for (const chapter of course.outline) appendOutline(chapter, rootNodeId, 'course', 0)
    const unplaced = [...objectiveNodeByRef.values()]
      .filter((node, index, all) => all.findIndex(candidate => candidate.id === node.id) === index)
      .filter(node => !placedObjectives.has(node.objectiveId!))
    if (unplaced.length) throw new Error(`Course outline must place every declared objective at least once; missing: ${unplaced.map(node => node.objectiveRef).join(', ')}`)
  }
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

  const prerequisiteChildren = new Map<string, string[]>()
  for (const relation of relations.filter(item => item.kind === 'mandatory_prerequisite')) {
    prerequisiteChildren.set(relation.from, [...(prerequisiteChildren.get(relation.from) ?? []), relation.to])
  }
  const complete = new Set<string>()
  const active = new Set<string>()
  const visit = (id: string) => {
    if (active.has(id)) throw new Error('Strict prerequisite relations must be acyclic.')
    if (complete.has(id)) return
    active.add(id)
    for (const child of prerequisiteChildren.get(id) ?? []) visit(child)
    active.delete(id)
    complete.add(id)
  }
  for (const id of prerequisiteChildren.keys()) visit(id)
  return { courseId, version: course.version, rootNodeId, nodes, relations }
}

/** Project only the learner-declared structure; self-reported attempts are not verification evidence. */
export function personalCourseMap(course: PersonalCourse): CourseMapDefinition {
  if (!course.id || !course.title.trim()) throw new Error('Personal course map requires a course ID and title.')
  const rootNodeId = `course:${course.id}:personal-draft`
  const nodes: CourseMapNode[] = [{ id: rootNodeId, title: course.title, kind: 'course' }]
  const relations: CourseMapRelation[] = []
  const topicIds = new Set<string>()

  for (const topic of course.topics) {
    if (!topic.id || !topic.title.trim()) throw new Error('Each personal learning point needs a stable ID and title.')
    if (topicIds.has(topic.id)) throw new Error(`Duplicate personal learning point ID: ${topic.id}`)
    topicIds.add(topic.id)
    const nodeId = `objective:${topic.id}`
    nodes.push({ id: nodeId, title: topic.title, kind: 'objective', objectiveId: topic.id, objectiveRef: topic.id })
    relations.push({ id: `contains:${rootNodeId}:${nodeId}`, from: rootNodeId, to: nodeId, kind: 'contains' })
  }

  return { courseId: course.id, version: 'personal-draft', rootNodeId, nodes, relations }
}

export function summarizeObjectiveStates(objectiveIds: Iterable<string>, states: ReadonlyMap<string, ObjectiveState>): ObjectiveSummary {
  const ids = [...new Set(objectiveIds)]
  const summary: ObjectiveSummary = { total: ids.length, verified: 0, partial: 0, consolidate: 0, unknown: 0 }
  for (const id of ids) summary[states.get(id) ?? 'unknown'] += 1
  return summary
}

/** Provide a keyboard-readable target list that preserves declared chapter/unit context. */
export function courseMapObjectiveNavigation(
  definition: CourseMapDefinition,
  states: ReadonlyMap<string, ObjectiveState>,
): CourseMapObjectiveNavigationEntry[] {
  const nodeById = new Map(definition.nodes.map(node => [node.id, node]))
  const children = new Map<string, string[]>()
  for (const relation of definition.relations) {
    if (relation.kind === 'contains' && nodeById.has(relation.from) && nodeById.has(relation.to)) {
      children.set(relation.from, [...(children.get(relation.from) ?? []), relation.to])
    }
  }

  const entries: CourseMapObjectiveNavigationEntry[] = []
  const visited = new Set<string>()
  const walk = (parentId: string, path: string[]) => {
    for (const childId of children.get(parentId) ?? []) {
      if (visited.has(childId)) continue
      visited.add(childId)
      const node = nodeById.get(childId)!
      if (node.kind === 'objective') {
        if (node.objectiveId) entries.push({
          nodeId: node.id,
          objectiveRef: node.objectiveRef,
          title: node.title,
          path,
          state: states.get(node.objectiveId) ?? 'unknown',
        })
      } else {
        walk(childId, [...path, node.title])
      }
    }
  }
  walk(definition.rootNodeId, [])
  for (const node of definition.nodes) {
    if (node.kind === 'objective' && node.objectiveId && !visited.has(node.id)) entries.push({
      nodeId: node.id,
      objectiveRef: node.objectiveRef,
      title: node.title,
      path: [],
      state: states.get(node.objectiveId) ?? 'unknown',
    })
  }
  return entries
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
