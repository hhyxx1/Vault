import { STANDARD_VERSION, TRACE_ACTIVITY, type ArtifactRevision, type TracePrediction } from './learning'

export function traceSubmission(revision: ArtifactRevision, trace: TracePrediction[]) {
  return { kind: 'verify_trace' as const, course_code: 'CS03' as const, activity_version: TRACE_ACTIVITY, standard_version: STANDARD_VERSION, client_artifact_id: revision.artifactId, client_revision_id: revision.revisionId, trace, explanation: revision.explanation }
}

export function artifactContent(revision: Pick<ArtifactRevision, 'explanation'>, trace: TracePrediction[]) {
  return { kind: 'stack_trace_with_explanation', trace, explanation: revision.explanation }
}

// Contract keys are ASCII and values are integers/booleans/null/Unicode strings.
// This matches Python json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False).
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
}

export async function canonicalHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
