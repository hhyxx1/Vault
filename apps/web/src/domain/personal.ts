export type PersonalTopic = {
  id: string
  title: string
  expectedPerformance: string
}

export type PersonalCourse = {
  id: string
  spaceId: string
  title: string
  goal: string
  topics: PersonalTopic[]
  createdAt: string
  updatedAt: string
}

// A confirmed scope is an immutable snapshot. It defines only the range the
// learner chose; it does not claim the range is a complete curriculum.
export type PersonalCourseVersion = {
  id: string
  spaceId: string
  courseId: string
  version: number
  title: string
  goal: string
  topics: PersonalTopic[]
  scopeStatus: 'exploration' | 'defined'
  gaps: ('goal' | 'learning_points')[]
  confirmedAt: string
}

// A personal attempt is a learner's own account of what happened. It is never
// checker evidence or a claim that an objective has been mastered.
export type PersonalAttempt = {
  id: string
  spaceId: string
  courseId: string
  topicId: string
  scopeVersionId?: string
  learningQuestion: string
  theoryNote: string
  action: string
  observation: string
  reflection: string
  nextStep: string
  createdAt: string
}
