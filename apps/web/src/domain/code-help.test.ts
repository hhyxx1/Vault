import { describe, expect, it } from 'vitest'
import { buildCodeHelpEvent, helpEventsForCodeAttempt, type CodeAttempt } from './code'
import type { HelpEvent } from './learning'

const base = {
  id: 'help-1',
  spaceId: 'space-a',
  objective: 'CS01-M01-O1',
  courseVersion: 'course-version-id',
  activityVersionId: 'activity-version-id',
  activityVersion: 'CODE@0.1.0',
  now: '2026-10-10T10:00:00.000Z',
}

describe('buildCodeHelpEvent', () => {
  it('maps the reference answer disclosure to kind answer and freezes the activity version', () => {
    const event = buildCodeHelpEvent({ ...base, helpId: 'answer' })
    expect(event.kind).toBe('answer')
    expect(event.disclosureVersion).toBe('CODE@0.1.0')
    expect(event.activityVersion).toBe('activity-version-id')
    expect(event.courseVersion).toBe('course-version-id')
    expect(event.objectiveId).toBe('CS01-M01-O1')
    expect(event.createdAt).toBe(base.now)
  })

  it('maps numbered hints to kind hint', () => {
    expect(buildCodeHelpEvent({ ...base, helpId: 'hint-1' }).kind).toBe('hint')
    expect(buildCodeHelpEvent({ ...base, helpId: 'hint-3' }).kind).toBe('hint')
  })

  it('binds the current revision only when one exists (draft-stage disclosures omit it)', () => {
    const draft = buildCodeHelpEvent({ ...base, helpId: 'hint-1' })
    expect(draft.revisionId).toBeUndefined()
    expect(draft.artifactId).toBeUndefined()
    const onRevision = buildCodeHelpEvent({ ...base, helpId: 'answer', revisionId: 'rev-7', artifactId: 'art-2' })
    expect(onRevision.revisionId).toBe('rev-7')
    expect(onRevision.artifactId).toBe('art-2')
  })
})

function helpEvent(partial: Partial<HelpEvent> & Pick<HelpEvent, 'id' | 'objectiveId' | 'activityVersion' | 'createdAt'>): HelpEvent {
  return { spaceId: 'space-a', kind: 'hint', disclosureVersion: 'CODE@0.1.0', ...partial }
}

function attemptWith(updatedAt: string, objectiveCode: string, activityVersionId: string): Pick<CodeAttempt, 'updatedAt' | 'learning'> {
  return {
    updatedAt,
    learning: {
      context: {
        courseId: 'course-id', courseVersionId: 'course-version-id',
        activityVersionId, objectiveCode, taskCode: 'base', helpViewed: [],
      },
      prediction: '',
    },
  }
}

describe('helpEventsForCodeAttempt', () => {
  const events: HelpEvent[] = [
    helpEvent({ id: 'h1', objectiveId: 'CS01-M01-O1', activityVersion: 'av-1', createdAt: '2026-10-10T08:00:00.000Z' }),
    helpEvent({ id: 'h2', objectiveId: 'CS01-M01-O1', activityVersion: 'av-1', createdAt: '2026-10-10T09:00:00.000Z', kind: 'answer' }),
    helpEvent({ id: 'other-objective', objectiveId: 'CS01-M01-O2', activityVersion: 'av-1', createdAt: '2026-10-10T09:30:00.000Z' }),
    helpEvent({ id: 'other-version', objectiveId: 'CS01-M01-O1', activityVersion: 'av-2', createdAt: '2026-10-10T09:40:00.000Z' }),
    helpEvent({ id: 'after-run', objectiveId: 'CS01-M01-O1', activityVersion: 'av-1', createdAt: '2026-10-10T11:00:00.000Z' }),
  ]

  it('returns only same-objective, same-version help disclosed no later than the attempt, ascending', () => {
    const related = helpEventsForCodeAttempt(events, attemptWith('2026-10-10T10:00:00.000Z', 'CS01-M01-O1', 'av-1'))
    expect(related.map(event => event.id)).toEqual(['h1', 'h2'])
  })

  it('returns an empty list when the attempt carries no learning context', () => {
    expect(helpEventsForCodeAttempt(events, { updatedAt: '2026-10-10T10:00:00.000Z', learning: { context: null, prediction: '' } })).toEqual([])
  })
})
