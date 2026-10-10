import type { components } from '../../../../packages/contracts/api.generated'
export type CodeRequest = components['schemas']['CodeRequest']
export type CodeResult = components['schemas']['CodeOperationResult']
/** Frozen work and tool facts, never a knowledge/mastery judgement. */
export type CodeAttempt = {
  id: string; artifactId: string; spaceId: string; activityKey: string
  request: CodeRequest; requestHash: string; result: CodeResult | null
  resultTrust: string | null; createdAt: string; updatedAt: string
}
