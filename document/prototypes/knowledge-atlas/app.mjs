import { chapters, goals, relations, summary, goalIdsForChapter, simulateOutcome } from './model.mjs'

// Isolated design prototype: no API, account, learning database or storage writes.
const $ = id => document.getElementById(id)
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const states = { verified: { label: '有达标证据', icon: '✓', color: '#16826b' }, partial: { label: '部分满足', icon: '◐', color: '#a56a1a' }, consolidate: { label: '需要巩固', icon: '!', color: '#8852a7' }, unknown: { label: '尚未评估', icon: '○', color: '#7a8597' } }
const relationLabels = { prerequisite: '严格先修', association: '概念关联', application: '后续应用' }
let state = { chapter: '', goal: '', view: 'map', filter: 'all', kinds: ['prerequisite'], outcome: 'baseline', events: [], relation: '' }
let currentGoals = structuredClone(goals)
let smallScreen = matchMedia('(max-width:640px)').matches
let searchTerm = ''
let updated = false
const byId = id => currentGoals.find(goal => goal.id === id)
const owners = id => chapters.filter(chapter => chapter.units.some(unit => unit.goalIds.includes(id)))
const primaryChapter = id => owners(id)[0]
const currentChapter = () => chapters.find(chapter => chapter.id === state.chapter)
const matches = id => state.filter === 'all' || byId(id).state === state.filter
const pill = status => `<span class="state ${status}"><span aria-hidden="true">${states[status].icon}</span>${states[status].label}</span>`
const dots = ids => `<span class="dots" aria-hidden="true">${[...new Set(ids)].map(id => `<i class="${byId(id).state}"></i>`).join('')}</span>`
const distribution = stats => `<div class="distribution" role="img" aria-label="${Object.keys(states).map(key => `${states[key].label}${stats[key]}个`).join('，')}">${Object.keys(states).map(key => stats[key] ? `<i class="${key}" style="flex:${stats[key]}"></i>` : '').join('')}</div>`
const goalButton = (id, extra = '') => { const goal = byId(id); return `<button class="goal-pick" data-action="goal" data-id="${id}" aria-pressed="${id === state.goal}"><span>${esc(goal.title)}${extra}</span>${pill(goal.state)}</button>` }

function readUrl() {
  const query = new URLSearchParams(location.hash.slice(1))
  const chapter = query.get('chapter') ?? ''
  const goal = query.get('goal') ?? ''
  state.chapter = chapters.some(item => item.id === chapter) ? chapter : ''
  state.goal = goals.some(item => item.id === goal) ? goal : ''
  if (state.goal && !state.chapter) state.chapter = primaryChapter(state.goal).id
  if (state.goal && !goalIdsForChapter(state.chapter).includes(state.goal)) state.chapter=primaryChapter(state.goal).id
  if (state.chapter && !state.goal) state.goal=goalIdsForChapter(state.chapter)[0]
  state.view = query.get('view') === 'list' ? 'list' : 'map'
  state.filter = Object.hasOwn(states, query.get('filter')) ? query.get('filter') : 'all'
  state.kinds = (query.get('relations') ?? 'prerequisite').split(',').filter(kind => Object.hasOwn(relationLabels, kind))
  state.outcome = ['pass','conflict'].includes(query.get('outcome')) ? query.get('outcome') : 'baseline'
  state.events=(query.get('events')??'').split(',').filter(item=>['pass','conflict'].includes(item)).slice(0,16)
  if(state.outcome==='baseline')state.events=[]
  else if(state.events.at(-1)!==state.outcome)state.events=[state.outcome]
  state.relation = ''
  currentGoals = state.events.reduce((items,event)=>simulateOutcome(items,event),structuredClone(goals))
}

function saveUrl(replace = false) {
  const query = new URLSearchParams()
  if (state.chapter) query.set('chapter', state.chapter)
  if (state.goal) query.set('goal', state.goal)
  if (state.view !== 'map') query.set('view', state.view)
  if (state.filter !== 'all') query.set('filter', state.filter)
  if (state.kinds.join(',') !== 'prerequisite') query.set('relations', state.kinds.join(','))
  if (state.outcome !== 'baseline') query.set('outcome', state.outcome)
  if(state.events.length>1)query.set('events',state.events.join(','))
  history[replace ? 'replaceState' : 'pushState'](null, '', `${location.pathname}${query.size ? `#${query}` : ''}`)
}

function renderSummary() {
  const stats = summary(currentGoals.map(goal => goal.id), currentGoals)
  $('scope-summary').innerHTML = `<div class="summary-title"><strong>${stats.verified}<span style="font-size:16px;color:#7a8597"> / ${stats.total}</span></strong><span>目标有达标证据</span><small>示例范围，不代表整课掌握度</small></div>${distribution(stats)}<div class="summary-key">${Object.entries(states).map(([key, value]) => `<span><i style="background:${value.color}"></i>${value.label}<b>${stats[key]}</b></span>`).join('')}</div>`
}

function renderOutline() {
  $('course-outline').innerHTML = `<button class="outline-chapter" data-action="overview" ${!state.chapter ? 'aria-current="page"' : ''}><span class="chapter-index">◎</span><span>整课全景</span><small>32 目标</small></button>` + chapters.map((chapter,index) => `<button class="outline-chapter" data-action="chapter" data-id="${chapter.id}" ${state.chapter === chapter.id ? 'aria-current="page"' : ''}><span class="chapter-index">${String(index+1).padStart(2,'0')}</span><span>${chapter.title}</span><small>${summary(goalIdsForChapter(chapter.id),currentGoals).verified}/${goalIdsForChapter(chapter.id).length}</small></button>${state.chapter === chapter.id ? `<div class="outline-units">${chapter.units.map(unit => `<button class="outline-unit" data-action="unit" data-id="${unit.id}">${unit.title}</button>`).join('')}</div>` : ''}`).join('')
}

function renderSearch() {
  const results = $('search-results')
  results.hidden = !searchTerm
  $('course-outline').hidden = !!searchTerm
  if (!searchTerm) return
  const found = currentGoals.filter(goal => `${goal.title} ${goal.description} ${owners(goal.id).map(chapter => chapter.title).join(' ')}`.includes(searchTerm))
  results.innerHTML = found.length ? `<p>找到 ${found.length} 个目标</p>${found.map(goal => `<button data-action="search-goal" data-id="${goal.id}">${esc(goal.title)}<small>${owners(goal.id).map(chapter => chapter.title).join(' / ')} · ${states[goal.state].label}</small></button>`).join('')}` : `<p>没有找到“${esc(searchTerm)}”。可尝试搜索“栈”“边界”或“代价”。课程范围没有改变。</p>`
}

function overview() {
  return `<div class="overview-grid">${chapters.map((chapter,index) => {
    const ids = goalIdsForChapter(chapter.id)
    const visibleUnits = chapter.units.filter(unit => unit.goalIds.some(matches))
    return `<section class="chapter-region" aria-label="${chapter.title}"><button class="region-heading" data-action="chapter" data-id="${chapter.id}"><span class="region-mark">${String(index+1).padStart(2,'0')}</span><strong>${chapter.title}</strong><span>${summary(ids,currentGoals).verified} / ${ids.length}</span></button>${distribution(summary(ids,currentGoals))}<div class="unit-nodes">${visibleUnits.map(unit => `<button class="unit-node" data-action="unit" data-id="${unit.id}"><strong>${unit.title}</strong><small>${dots(unit.goalIds)}${unit.goalIds.filter(matches).length} 个${state.filter === 'all' ? '目标' : '匹配目标'}</small></button>`).join('') || '<span class="region-empty">此章没有匹配目标</span>'}</div></section>`
  }).join('')}</div>`
}

function listView() {
  const scope = currentChapter() ? [currentChapter()] : chapters
  return `<div class="context-list">${scope.map(chapter => `<section class="list-section"><h3>${chapter.title} <span> / ${goalIdsForChapter(chapter.id).length} 个唯一目标</span></h3>${chapter.units.map(unit => { const ids = unit.goalIds.filter(matches); return ids.length ? `<section class="list-section"><h3>${unit.title}</h3>${ids.map(id => goalButton(id, owners(id).length > 1 ? '<small class="shared-reference">跨章引用 · 全课只计一次</small>' : '')).join('')}</section>` : '' }).join('') || '<p class="empty-note">没有匹配目标</p>'}</section>`).join('')}</div>`
}

function visibleRelations() {
  return relations.filter(relation => state.kinds.includes(relation.kind) && (relation.from === state.goal || relation.to === state.goal))
}

function network() {
  const chapter = currentChapter()
  const chapterIds = goalIdsForChapter(chapter.id)
  const selected = byId(state.goal) ?? byId(chapterIds[0])
  const unit = chapter.units.find(item=>item.goalIds.includes(selected.id))
  const internalIds = unit.goalIds
  const links = visibleRelations()
  const externalIds = [...new Set(links.flatMap(relation => [relation.from,relation.to]))].filter(id => !internalIds.includes(id))
  const incoming = externalIds.filter(id => links.some(relation => relation.from === id && relation.to === selected.id && relation.kind !== 'association'))
  const outgoing = [...new Set([...internalIds.filter(id=>id!==selected.id),...externalIds.filter(id => !incoming.includes(id))])]
  const width = smallScreen ? $('map-surface').clientWidth : Math.max(640,$('map-surface').clientWidth)
  const nodeWidth = smallScreen ? width - 48 : Math.floor((width-100)/3)
  const stride = nodeWidth + 30
  const incomingTitle=links.filter(relation=>incoming.includes(relation.from)).every(relation=>relation.kind==='prerequisite')?'先修准备':'先修或应用来源'
  const columns = [{ title:incomingTitle, ids:incoming, x:20 },{ title:'当前学习目标', ids:[selected.id], x:20+stride },{ title:'同单元目标与相关应用', ids:outgoing, x:20+2*stride }]
  const positions = new Map()
  let planeHeight = 0
  if (smallScreen) {
    let cursor = 18
    for (const column of columns) {
      if (!column.ids.length) continue
      column.y = cursor
      cursor += 32
      column.ids.forEach(id => { positions.set(id,{x:24,y:cursor}); cursor += 142 })
    }
    planeHeight = cursor + 34
  } else {
    columns.forEach(column => column.ids.forEach((id,index) => positions.set(id,{x:column.x,y:100 + index*148})))
    planeHeight = Math.max(400, Math.max(...columns.map(column => column.ids.length))*148 + 140)
  }
  const edgePaths = links.map(relation => {
    const from = positions.get(relation.from), to = positions.get(relation.to)
    if (!from || !to) return ''
    let d
    if (smallScreen || from.x === to.x) {
      const right = from.x + nodeWidth
      const lane = smallScreen ? width - 8 : right + 30
      d = `M ${right} ${from.y+53} C ${lane} ${from.y+53} ${lane} ${to.y+53} ${to.x+nodeWidth} ${to.y+53}`
    } else {
      const forward = from.x < to.x
      const sx = from.x + (forward ? nodeWidth : 0), tx = to.x + (forward ? 0 : nodeWidth)
      d = `M ${sx} ${from.y+53} C ${(sx+tx)/2} ${from.y+53} ${(sx+tx)/2} ${to.y+53} ${tx} ${to.y+53}`
    }
    return `<path class="network-edge ${relation.kind}" d="${d}" ${relation.kind !== 'association' ? 'marker-end="url(#arrow)"' : ''} />`
  }).join('')
  const buttons = [...positions].map(([id,pos]) => { const goal = byId(id); const outside = !chapterIds.includes(id); return `<button class="network-node ${!matches(id) && id !== state.goal ? 'dimmed' : ''}" data-action="goal" data-id="${id}" style="left:${pos.x}px;top:${pos.y}px;width:${nodeWidth}px" aria-pressed="${id === state.goal}"><span class="node-path">${owners(id).map(item=>item.title).join(' / ')}${outside ? '<span class="outside">跨章关系</span>' : ''}</span><strong>${esc(goal.title)}</strong>${pill(goal.state)}</button>` }).join('')
  const activeRelation = relations.find(relation=>relation.id===state.relation)
  return `<div class="selection-note">聚焦「${unit.title}」 · ${internalIds.length} 个目标。${state.filter !== 'all' ? '淡化节点仅作关系上下文。' : '跨章节点是引用，不会新增统计目标。'}</div><div class="network-scroll" tabindex="0" role="region" aria-label="局部知识关系图，可横向滚动；节点可用键盘选择"><div class="network-plane" style="height:${planeHeight}px;width:${width}px"><svg width="${width}" height="${planeHeight}" aria-hidden="true"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#93a3bc"/></marker></defs>${edgePaths}</svg>${columns.filter(column=>column.ids.length).map(column=>`<div class="network-column" style="left:${column.x}px;${smallScreen ? `position:absolute;top:${column.y}px;padding:0` : ''}"><strong>${column.title}</strong></div>`).join('')}${buttons}<p class="network-help">${smallScreen ? '逐个点选目标，下方查看证据与行动。' : '目标可用 Tab 与 Enter 选择 · 关系来源见下方'}</p></div></div><div class="focus-relations" aria-label="可查看来源的知识关系">${links.map(relation=>`<button data-action="relation" data-id="${relation.id}" aria-pressed="${relation.id===state.relation}">${relationLabels[relation.kind]}：${esc(byId(relation.from).title)} ${relation.kind==='association'?'↔':'→'} ${esc(byId(relation.to).title)}</button>`).join('') || '<span class="empty-note">当前关系类型下没有已声明的邻接关系。</span>'}</div>${activeRelation ? `<div class="selection-note" role="status"><strong>${relationLabels[activeRelation.kind]}</strong> · ${esc(activeRelation.reason)}<br>来源：${esc(activeRelation.source)}</div>` : ''}<details class="other-goals"><summary>本章全部 ${chapterIds.length} 个目标</summary><div class="context-list">${chapterIds.filter(matches).map(id=>goalButton(id)).join('')||'<p class="empty-note">当前筛选没有匹配目标。</p>'}</div></details>`
}

function inspector() {
  const goal = byId(state.goal)
  if (!goal) {
    const stats = summary(currentGoals.map(item=>item.id),currentGoals)
    $('inspector').innerHTML = `<div class="inspector-label">全景阅读 <span>模拟数据</span></div><svg class="inspector-intro-icon" width="75" height="65" viewBox="0 0 75 65" aria-hidden="true"><path d="M14 48 35 17 63 43M14 48H63" fill="none" stroke="#b8c8ed" stroke-width="1.5"/><circle cx="35" cy="17" r="10" fill="#edf3ff" stroke="#315fe7"/><circle cx="14" cy="48" r="7" fill="#f4f7fd" stroke="#8ba1ce"/><circle cx="63" cy="43" r="8" fill="#eef7f4" stroke="#16826b"/></svg><h2>先看范围，<br>再找下一步。</h2><p class="description">选择章节查看局部关系，选择具体目标查看证据、缺口与可做的实践。</p><div class="scope-tally">${Object.entries(states).map(([key,value])=>`<div><strong>${stats[key]}</strong><span>${value.label}</span></div>`).join('')}</div><p class="subtle">同一个目标可能出现在不同章节，状态由同一份证据决定。这里的数值只对应 32 个示例目标。</p><section class="learn-next"><h3>从上次的尝试继续</h3><p>${byId('stack-trace').state === 'verified' ? '栈的当前示例条件已有达标证据；可以进入括号匹配，或换一组新约束检验迁移。' : byId('stack-trace').state === 'consolidate' ? '后续空栈反例暴露了边界缺口；保留旧记录，修正后再核验。' : '栈的普通输入已经完成；空栈边界曾用过提示，还需要换一组条件独立推演。'}</p><button class="primary" data-action="resume">定位待补充的目标</button></section><p class="subtle">本次建议依据为模拟记录，不是 AI 自动认定的掌握结论。</p>`
    return
  }
  const unit = currentChapter()?.units.find(item=>item.goalIds.includes(goal.id)) ?? primaryChapter(goal.id).units.find(item=>item.goalIds.includes(goal.id))
  const related = relations.filter(relation=>relation.from===goal.id || relation.to===goal.id)
  const available = goal.support !== 'unavailable'
  const supportText = goal.support === 'supported' ? '示例能力：确定性核验 + 解释待复核' : goal.support === 'review' ? '示例能力：作品提交与人工复核' : '示例能力：运行环境待适配'
  const isFiltered = !matches(goal.id)
  $('inspector').innerHTML = `<div class="inspector-label"><span>${esc(unit.title)} / 学习目标</span><span>模拟</span></div><h2>${esc(goal.title)}</h2>${pill(goal.state)}${isFiltered ? '<p class="subtle">当前选中目标不符合筛选条件，详情继续保留。</p>' : ''}${owners(goal.id).length>1?'<p class="shared-reference">跨章共用目标 · 全课统计只计一次</p>':''}<p class="description">${esc(goal.description.replace('模拟目标：',''))}</p>${updated && goal.id==='stack-trace'?`<div class="update-note" role="status">模拟变化：${state.outcome==='pass'?'独立新条件与解释通过，当前目标获得达标证据。':state.outcome==='conflict'?'后续空栈反例暴露缺口，转为需要巩固。':'恢复到提示后完成、独立核验待补的初始状态。'}相邻目标保持原状态。</div>`:''}<h3>要满足哪些条件</h3><ul class="criteria">${goal.criteria.map(criterion=>`<li class="${criterion.status}"><i aria-hidden="true">${criterion.status==='pass'?'✓':criterion.status==='gap'?'!':'○'}</i><span>${esc(criterion.label)}<small>${criterion.status==='pass'?'示例证据已覆盖':criterion.status==='gap'?'后续核验发现缺口':'尚无足够的独立证据'}</small></span></li>`).join('')}</ul><details><summary>已有证据与帮助 · ${goal.evidence.length} 条</summary>${goal.evidence.length ? goal.evidence.map(record=>`<div class="evidence"><strong>${esc(record.title)}</strong><p>${esc(record.detail.replace('设计模拟：',''))}</p></div>`).join('') : '<p class="subtle">尚无有效记录。这个状态表示证据不足，不表示你不会。</p>'}</details><details><summary>知识关系与来源 · ${related.length} 条</summary><ul class="relation-list">${related.map(relation=>{const other=byId(relation.from===goal.id?relation.to:relation.from);return `<li><strong>${relationLabels[relation.kind]}</strong><p>${esc(byId(relation.from).title)} ${relation.kind==='association'?'↔':'→'} ${esc(byId(relation.to).title)}</p><p>${esc(relation.reason)}</p><small>来源：${esc(relation.source)}</small><br><button data-action="related-goal" data-id="${other.id}">查看「${esc(other.title)}」</button></li>`}).join('') || '<li>没有已声明的关系。</li>'}</ul></details><section class="next-action"><h3>${available?'下一步可以做':'活动暂未就绪'}</h3><p>${esc(goal.action)}</p><button class="primary" data-action="practice" ${!available?'disabled':''}>${available?'预览学习入口':'运行环境待适配'}</button><small>${supportText}。${available?'这里预览流程，不提交真实学习。':'保留目标与分母，不将能力缺口算作学生不会。'}</small></section><p class="subtle">范围示例 v1 · 规则示例 r1<br>独立演示空间 · 与真实学习档案隔离</p>${smallScreen?'<button data-action="back-map">回到局部图谱</button>':''}`
}

function render({keepPosition = true} = {}) {
  const active=document.activeElement
  const focusSelector=active?.id ? `#${CSS.escape(active.id)}` : active?.dataset.id && active.matches('.network-node,.goal-pick') ? `.${active.matches('.network-node')?'network-node':'goal-pick'}[data-id="${CSS.escape(active.dataset.id)}"]` : null
  const disclosures=keepPosition?[...document.querySelectorAll('#inspector details,.other-goals')].map(node=>({title:node.querySelector('summary').textContent.split('·')[0].trim(),open:node.open})):[]
  const viewport = document.querySelector('.network-scroll')
  const scroll = keepPosition && viewport ? {x:viewport.scrollLeft,y:viewport.scrollTop} : null
  renderSummary(); renderOutline(); renderSearch()
  const chapter = currentChapter()
  $('canvas-title').textContent = chapter ? chapter.title : '课程全景'
  $('view-description').textContent = chapter ? '看懂先修与应用，再回到一个具体的学习目标。' : '8 章 · 16 单元 · 点击单元，进入目标与知识关系。'
  $('breadcrumbs').innerHTML = `<button data-action="overview">课程全景</button>${chapter?`<span aria-hidden="true">/</span><strong>${chapter.title}</strong>`:''}`
  $('map-view').setAttribute('aria-pressed', String(state.view==='map'))
  $('list-view').setAttribute('aria-pressed', String(state.view==='list'))
  $('state-filter').value = state.filter
  $('outcome').value = state.outcome
  $('clear-filter').hidden = state.filter==='all'
  const ids = chapter ? goalIdsForChapter(chapter.id) : goals.map(item=>item.id)
  $('visible-count').textContent = `范围 ${ids.length} · 匹配 ${ids.filter(matches).length}`
  $('map-surface').innerHTML = state.view==='list' ? listView() : chapter ? network() : overview()
  $('relation-controls').hidden = !chapter || state.view==='list'
  document.querySelectorAll('[name=relation]').forEach(input=>{input.checked=state.kinds.includes(input.value)})
  inspector()
  const nextAction=$('inspector').querySelector('.next-action')
  const firstEvidence=$('inspector').querySelector('details')
  if(nextAction && firstEvidence)firstEvidence.before(nextAction)
  for(const node of document.querySelectorAll('#inspector details,.other-goals')) {
    const previous=disclosures.find(item=>item.title===node.querySelector('summary').textContent.split('·')[0].trim())
    if(previous)node.open=previous.open
  }
  if(focusSelector && keepPosition && document.activeElement===document.body)document.querySelector(focusSelector)?.focus({preventScroll:true})
  if (scroll) document.querySelector('.network-scroll')?.scrollTo(scroll.x,scroll.y)
}

function chooseGoal(id, changeChapter = false) {
  if (!byId(id)) return
  if (!state.chapter || changeChapter || !goalIdsForChapter(state.chapter).includes(id)) state.chapter = primaryChapter(id).id
  state.goal = id
  state.relation = ''
}

function moveToChapter(id) {
  state.chapter = id
  const ids = goalIdsForChapter(id)
  state.goal = ids.includes(state.goal) ? state.goal : ids.find(matches) ?? ids[0] ?? ''
  state.relation = ''
}

document.addEventListener('click', event=>{
  const button = event.target.closest('[data-action]')
  if (!button) return
  const action = button.dataset.action, id = button.dataset.id
  if (action === 'practice') {
    $('practice-title').textContent = byId(state.goal).title
    $('practice-action').textContent = byId(state.goal).action
    $('practice-dialog').showModal()
    return
  }
  if (action === 'back-map') { $('canvas-title').scrollIntoView({block:'start',behavior:'instant'}); $('canvas-title').focus({preventScroll:true}); return }
  if (action === 'overview') { state.chapter='';state.goal='';state.relation='' }
  if (action === 'chapter') moveToChapter(id)
  if (action === 'unit') {
    const chapter=chapters.find(item=>item.units.some(unit=>unit.id===id))
    const unit=chapter.units.find(item=>item.id===id)
    state.chapter=chapter.id;state.goal=unit.goalIds.find(matches)??unit.goalIds[0];state.relation=''
  }
  if (action === 'goal') chooseGoal(id)
  if (action === 'related-goal' || action === 'search-goal') chooseGoal(id,true)
  if (action === 'search-goal') { searchTerm='';$('search').value='';$('outline-toggle').setAttribute('aria-expanded','false');document.querySelector('.outline-panel').classList.remove('is-open') }
  if (action === 'resume') {state.chapter='stacks-queues';state.goal='stack-trace';state.filter='all';state.relation=''}
  if (action === 'relation') state.relation=state.relation===id?'':id
  saveUrl();render({keepPosition:action==='relation'})
  const sameButton = [...document.querySelectorAll('[data-action]')].find(node=>node.dataset.action===action&&node.dataset.id===id)
  sameButton?.focus({preventScroll:true})
  if (smallScreen && ['goal','related-goal','search-goal'].includes(action)) {$('inspector').scrollIntoView({block:'start',behavior:'instant'});$('inspector').focus({preventScroll:true})}
  $('announcement').textContent = action==='relation'?'已展开关系含义与来源':`已定位${byId(state.goal)?.title??'课程全景'}，范围统计保持不变。`
})

$('resume').addEventListener('click',()=>{state.chapter='stacks-queues';state.goal='stack-trace';state.filter='all';saveUrl();render({keepPosition:false})})
$('search').addEventListener('input',event=>{searchTerm=event.target.value.trim();renderSearch()})
$('outline-toggle').addEventListener('click',()=>{const open=$('outline-toggle').getAttribute('aria-expanded')!=='true';$('outline-toggle').setAttribute('aria-expanded',String(open));$('outline-toggle').textContent=open?'收起目录':'展开目录';document.querySelector('.outline-panel').classList.toggle('is-open',open)})
for (const mode of ['map','list']) $(mode+'-view').addEventListener('click',()=>{state.view=mode;saveUrl();render()})
$('state-filter').addEventListener('change',event=>{state.filter=event.target.value;saveUrl();render();$('announcement').textContent='筛选已更新，整课目标总数不变。'})
$('clear-filter').addEventListener('click',()=>{state.filter='all';saveUrl();render()})
document.querySelectorAll('[name=relation]').forEach(input=>input.addEventListener('change',()=>{state.kinds=[...document.querySelectorAll('[name=relation]:checked')].map(item=>item.value);state.relation='';saveUrl();render()}))
$('reset-position').addEventListener('click',()=>{const scroll=document.querySelector('.network-scroll');const node=document.querySelector('.network-node[aria-pressed=true]');if(scroll&&node){scroll.scrollTo({left:Math.max(0,node.offsetLeft-80),top:0,behavior:'instant'});node.focus({preventScroll:true})}})
$('show-key').addEventListener('click',()=>{const open=$('state-key').hidden;$('state-key').hidden=!open;$('show-key').setAttribute('aria-expanded',String(open))})
$('outcome').addEventListener('change',event=>{
  state.outcome=event.target.value
  state.events=state.outcome==='baseline'?[]:[...state.events,state.outcome]
  currentGoals=simulateOutcome(currentGoals,state.outcome)
  updated=true
  saveUrl();render()
  $('announcement').textContent=`模拟核验更新：栈推演${states[byId('stack-trace').state].label}，其他目标未变；位置保留。`
})
$('reset-demo').addEventListener('click',()=>{state={chapter:'',goal:'',view:'map',filter:'all',kinds:['prerequisite'],outcome:'baseline',events:[],relation:''};currentGoals=structuredClone(goals);updated=false;searchTerm='';$('search').value='';saveUrl();render({keepPosition:false});$('announcement').textContent='模拟设计已重置。'})
window.addEventListener('popstate',()=>{readUrl();saveUrl(true);render({keepPosition:false})})
matchMedia('(max-width:640px)').addEventListener('change',event=>{smallScreen=event.matches;render({keepPosition:false})})
let resizeTimer
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>render(),120)})
$('map-surface').before($('relation-controls'))
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();$('canvas-title').focus();$('canvas-title').scrollIntoView({block:'start',behavior:'instant'})})
readUrl();saveUrl(true);render()
