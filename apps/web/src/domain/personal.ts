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

// A personal attempt is a learner's own account of what happened. It is never
// checker evidence or a claim that an objective has been mastered.
export type PersonalAttempt = {
  id: string
  spaceId: string
  courseId: string
  topicId: string
  learningQuestion: string
  theoryNote: string
  action: string
  observation: string
  reflection: string
  nextStep: string
  createdAt: string
}
