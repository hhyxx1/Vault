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
  creationMethod?: 'manual' | 'ai_assisted'
  contentReviewStatus?: 'unreviewed_ai_draft'
}

export type PersonalEvidenceKind = 'explanation' | 'hand_trace' | 'diagram' | 'code' | 'external_tool' | 'other'
export const PERSONAL_EVIDENCE_LABELS: Record<PersonalEvidenceKind, string> = {
  explanation: '概念解释',
  hand_trace: '手工推演 / 纸笔记录',
  diagram: '图示 / 图谱',
  code: '代码 / 程序运行',
  external_tool: '外部仿真器或实验工具',
  other: '观察 / 其他作品',
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
  evidenceKinds?: PersonalEvidenceKind[]
  createdAt: string
}

// Assistant advice is attached to a saved learner attempt and never changes
// mastery or the provenance of that attempt.
export type PersonalAssist = {
  id: string
  spaceId: string
  courseId: string
  scopeVersionId: string
  topicId: string
  attemptId: string
  intent: 'diagnose' | 'explain' | 'hint' | 'practice'
  question: string
  reply: string
  nextAction: string
  modelProfileId: string
  provider: string
  disclosureVersion: 'personal-learning-assist-v1'
  createdAt: string
}
