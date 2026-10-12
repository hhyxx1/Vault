import type { components } from '../../../../packages/contracts/api.generated'
import { helpEventsForContext, type HelpEvent } from './learning'
export type CodeRequest = components['schemas']['CodeRequest']
export type CodeResult = components['schemas']['CodeOperationResult']
export type CodeTaskRef = components['schemas']['CodeTaskRef']
export type CodeSuiteRef = components['schemas']['CodeSuiteRef']
export type CodeSuiteAssessment = components['schemas']['CodeSuiteAssessment']
export type CodeSuiteCase = components['schemas']['CodeSuiteCase']
/** Learning-context taskCode marker for a semantic suite attempt (the suite ref itself carries no task_code). */
export const SUITE_CONTEXT_TASK_CODE = 'semantic-suite'
export type CodeLearningContext = {
  courseId: string; courseVersionId: string; activityVersionId: string
  objectiveCode: string; taskCode: string; helpViewed: string[]
}
export type CodeDraft = {
  id: string; spaceId: string; activityKey: string; request: CodeRequest
  prediction: string; reflection: string; learningContext: CodeLearningContext | null
  createdAt: string; updatedAt: string
  viewedRevisionId?: string | null
  reflectionRevisionId?: string | null
  reflections?: Record<string, string>
}

export function validateCodeRequest(request: CodeRequest) {
  const extensions = { c17: ['c', 'h'], cpp17: ['cpp', 'h', 'hpp'], java21: ['java'], python313: ['py'], python313ml: ['py'], node24: ['js'], postgres18: ['sql'] }
  const entries = { c17: 'c', cpp17: 'cpp', java21: 'java', python313: 'py', python313ml: 'py', node24: 'js', postgres18: 'sql' }
  const allowed = extensions[request.language]
  if (!allowed || Object.keys(request.files).length < 1 || Object.keys(request.files).length > 8 || !(request.entry in request.files) || !request.entry.endsWith(`.${entries[request.language]}`)) throw new Error('执行入口与所选语言不一致。')
  for (const name of Object.keys(request.files)) if (!/^[A-Za-z_][A-Za-z0-9_]{0,50}\.(c|cpp|h|hpp|java|py|js|sql)$/.test(name) || !allowed.includes(name.split('.').at(-1)!)) throw new Error('源文件名称或扩展名不符合所选语言。')
  if (request.language === 'postgres18' && (Object.keys(request.files).length !== 1 || request.stdin || request.files[request.entry].includes('\\'))) throw new Error('SQL 使用一个脚本，不接受标准输入或 psql 客户端命令。')
  const bytes = (text: string) => new TextEncoder().encode(text).byteLength
  if (Object.values(request.files).reduce((sum, value) => sum + bytes(value), 0) > 65536 || bytes(request.stdin ?? '') > 16384) throw new Error('代码或输入超过运行大小限制。')
}
/** Frozen work and tool facts, never a knowledge/mastery judgement. */
export type CodeAttempt = {
  id: string; artifactId: string; spaceId: string; activityKey: string
  request: CodeRequest; requestHash: string; result: CodeResult | null
  resultTrust: string | null; createdAt: string; updatedAt: string
  /**
   * For a semantic-suite attempt this is the id of the fixed-task revision it
   * ran against, so a suite verdict can never be shown beside a different code
   * version. Absent on plain fixed-task attempts and on pre-binding records.
   */
  sourceRevisionId?: string
  learning?: { context: CodeLearningContext | null; prediction: string }
}

/**
 * Build a versioned help-disclosure snapshot for a data-driven code activity.
 * Help content (hints / reference answer) is immutable within an activity
 * version, so the snapshot binds the disclosure to that activity version and
 * course version. Mirrors the trace/algebra/logic workspaces that already call
 * recordHelp; the event is synced/exported/restored through the help table and
 * never grants mastery by itself.
 */
export function buildCodeHelpEvent(input: {
  id: string; spaceId: string; objective: string
  courseVersion: string; activityVersionId: string; activityVersion: string
  helpId: string; now: string
  revisionId?: string; artifactId?: string
}): HelpEvent {
  const event: HelpEvent = {
    id: input.id,
    spaceId: input.spaceId,
    objectiveId: input.objective,
    kind: input.helpId === 'answer' ? 'answer' : 'hint',
    disclosureVersion: input.activityVersion,
    createdAt: input.now,
    courseVersion: input.courseVersion,
    activityVersion: input.activityVersionId,
  }
  if (input.revisionId) event.revisionId = input.revisionId
  if (input.artifactId) event.artifactId = input.artifactId
  return event
}

/**
 * Help disclosures that belong with a specific code attempt: same objective and
 * immutable activity version, disclosed no later than when the attempt was last
 * updated (so help opened after the run is not retroactively attached). Help
 * from another objective/activity version is excluded even within one space.
 */
export function helpEventsForCodeAttempt(
  events: HelpEvent[],
  attempt: Pick<CodeAttempt, 'updatedAt' | 'learning'>,
): HelpEvent[] {
  const ctx = attempt.learning?.context
  if (!ctx) return []
  return helpEventsForContext(events, {
    objectiveId: ctx.objectiveCode,
    activityVersion: ctx.activityVersionId,
    before: attempt.updatedAt,
  })
}
