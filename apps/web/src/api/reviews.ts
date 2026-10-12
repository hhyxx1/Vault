import { accountRequest, authenticatedRequest } from './accounts'

export type ReviewAudience = 'platform_teachers' | 'specific_teacher'
export type ReviewStatus =
  | 'awaiting_review'
  | 'claimed'
  | 'changes_requested'
  | 'resubmitted'
  | 'in_appeal'
  | 'approved'
export type RubricKind = 'objective' | 'explanation' | 'independent_transfer'
export type RubricCriterionStatus = 'met' | 'not_met' | 'needs_review'
export type StudentEvidenceKind = 'server_tool' | 'model_suggestion' | 'student_self'
export type EvidenceProvenance =
  | StudentEvidenceKind
  | 'teacher_review'
  | 'professional_review'

export type RubricCriterion = { id: string; title: string; kind: RubricKind }
export type EvidenceItem = { kind: StudentEvidenceKind; summary: string }
export type RubricResult = { id: string; status: RubricCriterionStatus; note: string }
export type EvidenceRef = { artifact_revision_id: string; artifact_hash: string; note: string }
export type TeacherSignature = {
  teacher_account_id: string
  display_name: string
  verification_state: string
  signed_at: string
}
export type ReviewEvent = {
  id: string
  sequence: number
  type: 'submitted' | 'resubmitted' | 'claimed' | 'decision' | 'appeal' | 'withdrawn'
  actor_account_id: string
  actor_role: 'student' | 'teacher'
  decision?: 'approved' | 'changes_requested' | null
  rubric_results?: RubricResult[] | null
  comment?: string | null
  evidence_refs?: EvidenceRef[] | null
  teacher_signature?: TeacherSignature | null
  created_at: string
}
/** Frozen real work a review references (source + result), never a client summary. */
export type WorkSnapshot = {
  kind: string
  artifact_id: string
  artifact_revision_id: string
  artifact_hash: string
  note?: string
  request: { language: string; entry: string; files: Record<string, string>; stdin: string }
  result: Record<string, unknown> | null
}
export type ReviewAssignment = {
  id: string
  space_id: string
  owner_account_id: string
  audience: ReviewAudience
  teacher_account_id?: string | null
  course_code: string
  course_version_id?: string | null
  objective_code: string
  activity_version: string
  artifact_id: string
  artifact_revision_id: string
  artifact_hash: string
  rubric: RubricCriterion[]
  evidence_snapshot: EvidenceItem[]
  work_snapshot: WorkSnapshot[]
  status: ReviewStatus
  claimed_by_account_id?: string | null
  review_service_available: boolean
  appeal_count: number
  created_at: string
  updated_at: string
  events: ReviewEvent[]
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  awaiting_review: '等待教师接单',
  claimed: '教师已接单',
  changes_requested: '退回补充材料',
  resubmitted: '已补充，等待复核',
  in_appeal: '异议复核中',
  approved: '审阅通过',
}

export const PROVENANCE_LABEL: Record<EvidenceProvenance, string> = {
  server_tool: '规则核验结果',
  model_suggestion: '模型建议（仅供参考）',
  student_self: '本人自述',
  teacher_review: '授权教师意见',
  professional_review: '专业审校',
}

export const PROVENANCE_DESCRIPTION: Record<EvidenceProvenance, string> = {
  server_tool: '由服务端检查器对当前作品版本与独立输入计算得出。',
  model_suggestion: '学习助手生成的建议，不能单独作为达标依据。',
  student_self: '学生对设计与思路的自述，需教师判断。',
  teacher_review: '由已认证教师在审阅工单中签署的意见。',
  professional_review: '外部专业审校，当前尚未开通，不会自动生成。',
}

// The standard human-review rubric. The objective dimension is informed by the
// rule checker but never decided by word count or keyword matching.
export const STANDARD_RUBRIC: RubricCriterion[] = [
  { id: 'objective', title: '客观结果与不变量', kind: 'objective' },
  { id: 'explanation', title: '解释与设计', kind: 'explanation' },
  { id: 'independent', title: '独立迁移表现', kind: 'independent_transfer' },
]

export type ReviewCreateBody = {
  assignment_id: string
  expected_account_id: string
  space_id: string
  audience: ReviewAudience
  teacher_account_id?: string | null
  course_code: string
  course_version_id?: string | null
  objective_code: string
  activity_version: string
  artifact_id: string
  artifact_revision_id: string
  artifact_hash: string
  rubric: RubricCriterion[]
  evidence_snapshot: EvidenceItem[]
  student_note?: string | null
}

export async function createReviewAssignment(body: ReviewCreateBody): Promise<ReviewAssignment> {
  return authenticatedRequest<ReviewAssignment>(
    'reviews/assignments',
    body,
    undefined,
    body.assignment_id,
  )
}
export async function listMyReviews(): Promise<ReviewAssignment[]> {
  return (await accountRequest<{ assignments: ReviewAssignment[] }>('reviews/assignments/mine'))
    .assignments
}
export async function listTeacherQueue(): Promise<ReviewAssignment[]> {
  return (await accountRequest<{ assignments: ReviewAssignment[] }>('reviews/teacher/queue'))
    .assignments
}
export async function claimReview(id: string): Promise<ReviewAssignment> {
  return authenticatedRequest<ReviewAssignment>(`reviews/assignments/${id}/claim`, {})
}
export async function decideReview(
  id: string,
  decision: 'approved' | 'changes_requested',
  rubric_results: RubricResult[],
  comment: string,
): Promise<ReviewAssignment> {
  return authenticatedRequest<ReviewAssignment>(
    `reviews/assignments/${id}/decisions`,
    { decision, rubric_results, comment },
  )
}
export async function resubmitReview(
  id: string,
  comment: string,
  evidence_refs: EvidenceRef[],
): Promise<ReviewAssignment> {
  return authenticatedRequest<ReviewAssignment>(
    `reviews/assignments/${id}/resubmit`,
    { comment, evidence_refs },
  )
}
export async function appealReview(id: string, comment: string): Promise<ReviewAssignment> {
  return authenticatedRequest<ReviewAssignment>(
    `reviews/assignments/${id}/appeal`,
    { comment },
  )
}

// Build the student-submittable evidence snapshot from a local verified record.
// Only the three student-allowed provenance kinds are ever produced here.
export function buildEvidenceSnapshot(input: {
  serverSummary?: string | null
  modelSummary?: string | null
  studentSummary?: string | null
}): EvidenceItem[] {
  const items: EvidenceItem[] = []
  if (input.serverSummary?.trim()) {
    items.push({ kind: 'server_tool', summary: input.serverSummary.trim() })
  }
  if (input.modelSummary?.trim()) {
    items.push({ kind: 'model_suggestion', summary: input.modelSummary.trim() })
  }
  if (input.studentSummary?.trim()) {
    items.push({ kind: 'student_self', summary: input.studentSummary.trim() })
  }
  return items
}
