import type { WorkSnapshot } from '../api/reviews'

export default function ReviewWork({ snapshots }: { snapshots: WorkSnapshot[] }) {
  return <details className="review-evidence-details">
    <summary>冻结的作品与核验（{snapshots.length} 个版本）</summary>
    {snapshots.map((snapshot, index) => <div key={`${snapshot.artifact_revision_id}:${index}`} className="review-work-snapshot">
      <p className="field-note">版本 {index + 1} · 内容指纹 {snapshot.artifact_hash.slice(0, 12)}… {snapshot.note}</p>
      {Object.entries(snapshot.request?.files ?? {}).map(([name, source]) => <div key={name}><h6>{name}</h6><pre className="artifact-source">{source}</pre></div>)}
      {snapshot.content && <pre className="artifact-source">{JSON.stringify(snapshot.content, null, 2)}</pre>}
      {snapshot.server_verification ? <div className="review-authoritative">
        <p>服务端重新核验：{snapshot.server_verification.outcome === 'met' ? '固定条件通过' : snapshot.server_verification.outcome === 'not_met' ? '固定条件未通过' : '待复核'} · {snapshot.server_verification.standard_version}</p>
        <p className="field-note">这次运行不自动证明解释、独立迁移或长期掌握。</p>
        <details><summary>核验依据</summary><pre>{JSON.stringify(snapshot.server_verification.detail, null, 2)}</pre></details>
      </div> : <p className="field-note">尚无服务端自动核验结论，请依据作品进行人工审阅。</p>}
      {snapshot.client_reported_result && <p className="field-note">另有学生提供的历史运行记录，仅供参考，不作为服务端受信结果。</p>}
      <details><summary>学习上下文与帮助记录（{snapshot.help_records?.length ?? 0}）</summary>
        <pre>{JSON.stringify({ context: snapshot.learning_context, help: snapshot.help_records ?? [] }, null, 2)}</pre>
        <p className="field-note">帮助记录来自学生披露，未记录不代表完全没有获得帮助。</p>
      </details>
    </div>)}
  </details>
}
