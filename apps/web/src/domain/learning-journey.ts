export type CourseLearningStage = 'orientation' | 'practice'

/** A graph node is an invitation to learn, not a shortcut to an editor. */
export function courseLearningStage(params: URLSearchParams): CourseLearningStage {
  return params.get('stage') === 'practice' ? 'practice' : 'orientation'
}

export function practiceHref(objective: string, courseVersionId: string, taskCode?: string): string {
  const params = new URLSearchParams({ courseVersion: courseVersionId, stage: 'practice' })
  if (taskCode && taskCode !== 'base') params.set('task', taskCode)
  return `/learn/${encodeURIComponent(objective)}?${params.toString()}`
}
