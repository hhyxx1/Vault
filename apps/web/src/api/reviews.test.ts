import { describe, expect, it } from 'vitest'
import {
  PROVENANCE_DESCRIPTION,
  PROVENANCE_LABEL,
  STANDARD_RUBRIC,
  buildEvidenceSnapshot,
} from './reviews'

describe('buildEvidenceSnapshot', () => {
  it('emits only the three student-allowed provenance kinds, in a stable order', () => {
    const items = buildEvidenceSnapshot({
      serverSummary: 'server result',
      modelSummary: 'model hint',
      studentSummary: 'my design',
    })
    expect(items.map(item => item.kind)).toEqual([
      'server_tool',
      'model_suggestion',
      'student_self',
    ])
  })

  it('trims summaries and drops blank ones', () => {
    const items = buildEvidenceSnapshot({
      serverSummary: '  kept  ',
      modelSummary: '   ',
      studentSummary: '',
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({ kind: 'server_tool', summary: 'kept' })
  })

  it('never fabricates teacher or professional review evidence', () => {
    const items = buildEvidenceSnapshot({
      serverSummary: 'a',
      modelSummary: 'b',
      studentSummary: 'c',
    })
    expect(items.some(item => item.kind === 'teacher_review')).toBe(false)
    expect(items.some(item => item.kind === 'professional_review')).toBe(false)
  })

  it('returns an empty snapshot when there is no evidence', () => {
    expect(buildEvidenceSnapshot({})).toEqual([])
  })
})

describe('review constants', () => {
  it('ships the three-dimension human rubric with distinct ids', () => {
    expect(STANDARD_RUBRIC.map(item => item.id)).toEqual([
      'objective',
      'explanation',
      'independent',
    ])
    expect(new Set(STANDARD_RUBRIC.map(item => item.kind)).size).toBe(3)
  })

  it('labels all five provenance kinds and marks professional review as unavailable', () => {
    const kinds = Object.keys(PROVENANCE_LABEL)
    expect(kinds).toEqual(
      expect.arrayContaining([
        'server_tool',
        'model_suggestion',
        'student_self',
        'teacher_review',
        'professional_review',
      ]),
    )
    expect(PROVENANCE_DESCRIPTION.professional_review).toContain('尚未开通')
  })
})
