import { Link } from 'react-router-dom'
import { courses, TRACE_OBJECTIVE, objectiveSummary } from '../domain/learning'
import { useLocal } from '../local/LocalProvider'

function Observatory() {
  return <div className="learning-flow" aria-label="理解、实践、核验与改进的学习过程">
    <article><small>提出问题 · 建立解释</small><h2>理论理解</h2><p>用原理预测将会发生什么。</p></article>
    <article><small>亲手尝试 · 保留作品</small><h2>动手实践</h2><p>把预测变成一次可观察的尝试。</p></article>
    <article><small>检查结果 · 解释偏差</small><h2>真实核验</h2><p>依据结果发现仍需补充的部分。</p></article>
    <article><small>修改作品 · 换条件再试</small><h2>持续学习</h2><p>用新尝试检验修正后的理解。</p></article>
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
    <section className="personal-entry" aria-labelledby="personal-entry-title"><div><div className="eyebrow">YOUR OWN COURSE / 任意计算机课程</div><h2 id="personal-entry-title">要学的课，不在默认列表里？</h2><p>建立自己的课程目标和学习点；写下依据的原理，亲手尝试，记录结果，再决定下一步。个人课程内容与尝试先按自建、未核验标示。</p></div><Link className="button primary" to="/my-courses">开始个人课程 <span aria-hidden="true">↗</span></Link></section>
    <section className="learning-entry" aria-labelledby="sample-title"><div className="entry-index">01 <span>/ OPEN STUDIO</span></div><div className="entry-content"><div className="eyebrow">开放的工程学习样例</div><h2 id="sample-title">从栈开始，观察思考如何变成证据。</h2><p>七步状态推演 → 解释后进先出 → 核验实际结果 → 尝试括号匹配。<br/>这是数据结构的局部样例，课程内容与教学标准仍待审校。</p></div><div className="entry-state"><strong>{summary.verified}<span> / {summary.total}</span></strong><span>样例目标有达标证据</span><Link className="circle-link" to="/atlas" aria-label="打开栈单元图谱">↗</Link></div></section>
    <section className="catalog-section" aria-labelledby="catalog-title"><div className="section-heading"><div><div className="eyebrow">CURATED / DEFAULT COURSES</div><h2 id="catalog-title">13 门默认课程，逐门建设。</h2></div><p>完整建成 0 / 13 门。<br/>它们是默认内容范围，不是学习上限。<br/>目前仅开放 CS03 栈单元工程样例。</p></div><div className="course-list">{courses.map((course, index) => <Link className={`course-row ${course.code === 'CS03' ? 'available' : ''}`} key={course.code} to={`/atlas?course=${course.code}`}><span className="course-number">{String(index + 1).padStart(2, '0')}</span><div className="course-title"><h3>{course.title}</h3><span>{course.description}</span></div><span className="course-group">{course.group}</span><span className="course-availability">{course.code === 'CS03' ? '局部样例可试' : '内容建设中'}</span><span className="row-arrow" aria-hidden="true">↗</span></Link>)}</div></section>
    <section className="manifesto"><span className="eyebrow">YOUR WORK, YOUR PATH.</span><h2>学习不止是看过。<br/><span>是你能解释，也能做到。</span></h2><p>查看思路、保留作品、承认未知。每一次核验，都让下一步更清楚。</p></section>
  </div>
}
