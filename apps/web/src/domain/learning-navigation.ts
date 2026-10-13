export function learningNeighbors<T extends { code: string; title: string }>(goals: readonly T[], current: string) {
  const index = goals.findIndex(goal => goal.code === current)
  return index < 0 ? null : {
    previous: goals[index - 1] ?? null,
    next: goals[index + 1] ?? null,
    position: index + 1,
    total: goals.length,
  }
}
