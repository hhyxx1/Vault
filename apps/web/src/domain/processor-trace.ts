export type ProcessorStep = {
  cycle: number; phase: 'fetch' | 'decode' | 'execute' | 'commit'; pc: number
  registers: number[]; controls: Record<string, boolean>
}
export type ProcessorTrace = { steps: ProcessorStep[]; status: string }

const phases = ['fetch', 'decode', 'execute', 'commit'] as const
const integer = (value: unknown, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum

/** Presentation of bounded program output, never a trusted assessment. */
export function parseProcessorTrace(stdout: string): ProcessorTrace | null {
  if (stdout.length > 65536) return null
  try {
    const value: unknown = JSON.parse(stdout)
    if (!value || typeof value !== 'object') return null
    const report = value as Record<string, unknown>
    if (!['halted', 'rom_exhausted', 'budget_exhausted'].includes(String(report.status)) ||
        !integer(report.cycles, 4096) || !Array.isArray(report.trace) || report.trace.length === 0 ||
        report.cycles !== report.trace.length || report.trace.length % 4 !== 0 ||
        !Array.isArray(report.encoded_words) || report.encoded_words.length === 0 ||
        report.encoded_words.length > 256 || report.encoded_words.some(word => !integer(word, 65535))) return null
    const steps: ProcessorStep[] = []
    for (const [index, row] of report.trace.entries()) {
      if (!Array.isArray(row) || row.length !== 5) return null
      const [cycle, phase, pc, registers, controls] = row
      if (cycle !== index + 1 || phase !== phases[index % 4] || !integer(pc, 255) ||
          !Array.isArray(registers) || registers.length !== 4 || registers.some(value => !integer(value, 255)) ||
          !controls || typeof controls !== 'object' || Array.isArray(controls) ||
          Object.entries(controls).some(([key, value]) => !['reg_write', 'mem_write', 'branch'].includes(key) || typeof value !== 'boolean')) return null
      steps.push({ cycle, phase, pc, registers: [...registers], controls: { ...controls } })
    }
    return { steps, status: String(report.status) }
  } catch { return null }
}
