import { Link } from 'react-router-dom'
import { courses, TRACE_OBJECTIVE, objectiveSummary } from '../domain/learning'
import { useLocal } from '../local/LocalProvider'

function Observatory() {
  return <div className="observatory" aria-hidden="true">
    <div className="orbital orbit-one"/><div className="orbital orbit-two"/><div className="orbital orbit-three"/>
    <svg viewBox="0 0 520 450" className="star-lines"><path d="M95 245 L220 100 L350 190 L415 345 M220 100 L280 295 L95 245 M350 190 L280 295 L415 345"/><path d="M220 100 L455 94 M95 245 L62 350" strokeDasharray="3 6"/></svg>
    <div className="star-node star-a"><i/><span>理论理解</span></div><div className="star-node star-b"><i/><span>动手实践</span></div><div className="star-node star-c"><i/><span>真实核验</span></div><div className="star-node star-d"><i/><span>持续学习</span></div>
    <div className="atlas-coordinate coordinate-a">LEARNING / ATLAS</div><div className="atlas-coordinate coordinate-b">每一个连接，都有依据。</div><div className="orbit-center">学会的过程<br/><strong>可以被看见</strong></div>
  </div>
}

export function Landing() {
  const { evidence, lastObjective } = useLocal()
  const summary = objectiveSummary(evidence)
  return <div className="landing page">
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="line"/>计算机专业 · 持续学习空间</div><h1>把知识学进<br/>你的<span className="serif-accent">能力</span>里<span className="title-period">。</span></h1><p className="hero-description">带着问题理解原理，亲手尝试，再用真实结果检验。<br className="desktop-break"/>你留下的作品，连成一张不断生长的学习图谱。</p><div className="hero-actions"><Link className="button primary" to={`/learn/${lastObjective ?? TRACE_OBJECTIVE}`}>{lastObjective ? '继续本地学习' : '开始一次真实实践'}<span aria-hidden="true">↗</span></Link><Link className="text-link" to="/atlas">先看看知识图谱 <span aria-hidden="true">→</span></Link></div><div className="hero-footnote"><span className="status-dot"/>无需登录 · 作品保存在本设备</div></div>
      <Observatory />
    </section>
    <section className="learning-entry" aria-labelledby="sample-title"><div className="entry-index">01 <span>/ OPEN STUDIO</span></div><div className="entry-content"><div className="eyebrow">开放的工程学习样例</div><h2 id="sample-title">从栈开始，观察思考如何变成证据。</h2><p>七步状态推演 → 解释后进先出 → 核验实际结果 → 尝试括号匹配。<br/>这是数据结构的局部样例，课程内容与教学标准仍待审校。</p></div><div className="entry-state"><strong>{summary.verified}<span> / {summary.total}</span></strong><span>样例目标有达标证据</span><Link className="circle-link" to="/atlas" aria-label="打开栈单元图谱">↗</Link></div></section>
    <section className="catalog-section" aria-labelledby="catalog-title"><div className="section-heading"><div><div className="eyebrow">THE KNOWLEDGE LANDSCAPE</div><h2 id="catalog-title">在专业知识中，找到下一步。</h2></div><p>13 门默认课程正在建设。<br/>目前仅开放栈单元工程样例。</p></div><div className="course-list">{courses.map((course, index) => <Link className={`course-row ${course.code === 'CS03' ? 'available' : ''}`} key={course.code} to={`/atlas?course=${course.code}`}><span className="course-number">{String(index + 1).padStart(2, '0')}</span><div className="course-title"><h3>{course.title}</h3><span>{course.description}</span></div><span className="course-group">{course.group}</span><span className="course-availability">{course.code === 'CS03' ? '局部样例可试' : '内容建设中'}</span><span className="row-arrow" aria-hidden="true">↗</span></Link>)}</div></section>
    <section className="manifesto"><span className="eyebrow">YOUR WORK, YOUR PATH.</span><h2>学习不止是看过。<br/><span>是你能解释，也能做到。</span></h2><p>查看思路、保留作品、承认未知。每一次核验，都让下一步更清楚。</p></section>
  </div>
}
