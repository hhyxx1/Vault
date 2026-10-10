import { useMemo, useState } from 'react'
import { parseProcessorTrace } from '../domain/processor-trace'

const names = { fetch: '取指', decode: '译码', execute: '执行', commit: '提交' }

export default function ProcessorTrace({ stdout }: { stdout: string }) {
  const report = useMemo(() => parseProcessorTrace(stdout), [stdout])
  const [index, setIndex] = useState(0)
  if (!report) return <p className="muted">输出不是完整的教学处理器轨迹；保留原始输出，不补造周期。</p>
  const position = Math.min(index, report.steps.length - 1)
  const step = report.steps[position]
  return <section aria-label="处理器逐周期观察" className="processor-trace">
    <h3>逐周期观察</h3>
    <p>第 {step.cycle} / {report.steps.length} 周期 · {names[step.phase]} · PC {step.pc}</p>
    <div className="processor-phases" aria-label="当前阶段">
      {Object.entries(names).map(([phase, label]) => <span key={phase} aria-current={step.phase === phase ? 'step' : undefined}>{label}</span>)}
    </div>
    <dl className="processor-registers">{step.registers.map((value, register) => <div key={register}><dt>R{register}</dt><dd>{value}</dd></div>)}</dl>
    <p>{Object.keys(step.controls).length ? `寄存器写入：${step.controls.reg_write ? '开启' : '关闭'}；内存写入：${step.controls.mem_write ? '开启' : '关闭'}；分支：${step.controls.branch ? '开启' : '关闭'}` : '取指阶段，尚未生成控制信号。'}</p>
    <label>观察周期<input aria-label="观察周期" type="range" min="1" max={report.steps.length} value={position + 1} onChange={event => setIndex(Number(event.target.value) - 1)} /></label>
    <div className="code-run-actions"><button className="button secondary" disabled={position === 0} onClick={() => setIndex(position - 1)}>上一周期</button><button className="button secondary" disabled={position === report.steps.length - 1} onClick={() => setIndex(position + 1)}>下一周期</button></div>
    <p className="muted">学生程序实际输出的教学模型快照，可能包含程序错误；不是实物时序或额外的可信核验。修改程序后重新运行才能获得新轨迹。</p>
  </section>
}
