/**
 * Synthetic design fixture only. All course structure, support flags, relationships,
 * attempts and evidence below are simulated; they are not an approved syllabus or
 * records of real learning. Production progress must never import this fixture.
 */
export const chapters = [
  { id: 'foundations', title: '基础', units: [
    { id: 'models', title: '结构与约束', goalIds: ['structure-model', 'invariant'] },
    { id: 'analysis', title: '分析与推演', goalIds: ['cost-analysis', 'recursion-trace'] },
  ] },
  { id: 'linear', title: '线性表', units: [
    { id: 'sequences', title: '顺序存储', goalIds: ['sequence-access', 'sequence-insert'] },
    { id: 'links', title: '链式存储', goalIds: ['list-link', 'list-remove'] },
  ] },
  { id: 'stacks-queues', title: '栈与队列', units: [
    { id: 'stacks', title: '栈与应用', goalIds: ['stack-trace', 'stack-brackets'] },
    { id: 'queues', title: '队列与调度', goalIds: ['queue-ring', 'queue-schedule'] },
  ] },
  { id: 'strings', title: '串', units: [
    { id: 'matching', title: '模式匹配', goalIds: ['string-match', 'kmp-prefix'] },
    { id: 'string-data', title: '表示与边界', goalIds: ['string-encoding', 'string-boundary'] },
  ] },
  { id: 'trees', title: '树', units: [
    { id: 'tree-walking', title: '树的遍历', goalIds: ['tree-traversal', 'tree-recursion'] },
    { id: 'tree-structures', title: '搜索树与堆', goalIds: ['bst-search', 'heap-adjust'] },
  ] },
  { id: 'graphs', title: '图', units: [
    { id: 'graph-models', title: '图的表示', goalIds: ['graph-representation', 'graph-construction'] },
    { id: 'graph-walking', title: '图的遍历', goalIds: ['graph-bfs', 'graph-dfs'] },
  ] },
  { id: 'searching', title: '查找', units: [
    { id: 'ordered-search', title: '线性与折半查找', goalIds: ['linear-search', 'binary-search'] },
    { id: 'hashing', title: '散列查找', goalIds: ['hash-probe', 'hash-load'] },
  ] },
  { id: 'sorting', title: '排序', units: [
    { id: 'sorting-methods', title: '排序方法', goalIds: ['insertion-sort', 'merge-sort', 'cost-analysis'] },
    { id: 'sorting-decisions', title: '代价与选择', goalIds: ['sort-cost', 'sort-choice'] },
  ] },
]

function goal(id, title, description, action, criteria, state = 'unknown', support = 'review') {
  const statuses = criteria.map((_, index) => state === 'verified' ? 'pass'
    : state === 'consolidate' && index === criteria.length - 1 ? 'gap'
      : state !== 'unknown' && index === 0 ? 'pass' : 'pending')
  const evidence = state === 'unknown' ? [] : [{
    title: state === 'verified' ? '模拟记录 · 独立核验' : state === 'consolidate' ? '模拟记录 · 发现缺口' : '模拟记录 · 部分条件满足',
    detail: state === 'verified'
      ? `设计模拟：在独立的新条件任务中展示“${criteria.join('；')}”，均满足示例标准。不是实际学习记录。`
      : state === 'consolidate'
        ? `设计模拟：已展示“${criteria[0]}”，后续核验发现“${criteria.at(-1)}”仍有错误。旧成功记录保留。`
        : `设计模拟：已展示“${criteria[0]}”，其余条件尚未独立核验。不能据此认定目标全部达标。`,
  }]
  return {
    id, title, description: `模拟目标：${description}`, action, state,
    criteria: criteria.map((label, index) => ({ label, status: statuses[index] })),
    evidence, support, simulation: true,
  }
}

export const goals = [
  goal('structure-model', '区分逻辑与存储结构', '把同一组数据分别画为逻辑关系和存储表示，说明二者不等同。', '重画一种存储表示', ['区分逻辑关系与存储位置', '用新例子解释表示的取舍'], 'verified', 'supported'),
  goal('invariant', '解释操作不变式', '用具体操作前后状态说明结构必须保持的约束。', '检查一次操作前后约束', ['写出可检查的不变式', '用反例发现被破坏的约束'], 'verified', 'supported'),
  goal('cost-analysis', '分析操作代价', '在明确输入规模与基本操作后比较代价，区分最好、最坏情形。', '数清一次操作的代价', ['说明输入规模与计数对象', '解释不同输入下的增长趋势'], 'partial', 'supported'),
  goal('recursion-trace', '推演递归调用', '记录一次递归的进入、终止和返回，说明返回值如何组合。', '跟踪一条递归调用链', ['找出终止条件', '独立推演新的返回过程'], 'partial', 'supported'),
  goal('sequence-access', '定位顺序表元素', '把下标映射为存储位置，并解释越界访问为什么无效。', '核对访问位置与边界', ['计算有效下标对应的位置', '拒绝越界访问并解释原因'], 'verified', 'supported'),
  goal('sequence-insert', '完成顺序表插入', '推演移动方向、插入位置和容量变化，检查头尾边界。', '修正插入时的移动顺序', ['保持原有元素的相对顺序', '处理表满与尾部插入'], 'consolidate', 'supported'),
  goal('list-link', '连接链表节点', '画出指针修改顺序，保证新节点接入后原链不断开。', '重排两次指针修改', ['保留后继节点的引用', '用新位置检验连接过程'], 'partial', 'supported'),
  goal('list-remove', '删除链表节点', '在空表、首节点和末节点情形下修改链接并检查可达性。', '补做首尾删除情形', ['明确前驱与待删节点', '检查首尾与空表的删除边界'], 'consolidate', 'supported'),
  goal('stack-trace', '推演栈的状态变化', '逐步执行入栈与出栈，解释栈顶变化并处理空栈操作。', '继续核验空栈边界', ['正确记录普通输入的栈状态', '独立处理空栈出栈并解释原因', '在改变操作顺序后独立完成推演'], 'partial', 'supported'),
  goal('stack-brackets', '处理括号匹配', '用栈解释匹配关系，覆盖多余右括号和未闭合左括号。', '实现并解释括号匹配', ['正确区分匹配与不匹配输入', '覆盖两类不平衡边界并解释'], 'unknown', 'supported'),
  goal('queue-ring', '辨认循环队列边界', '选择一种空满判定约定，并保持入队、出队和取模计算一致。', '检查队列绕回与满队列', ['说明所选空满判定约定', '独立处理绕回和队满情形'], 'partial', 'supported'),
  goal('queue-schedule', '解释先进先出调度', '用队列模拟任务到达与处理，说明到达顺序对等待的影响。', '模拟一组任务的等待过程', ['记录入队与出队顺序', '解释新到达任务的等待变化'], 'unknown', 'review'),
  goal('string-match', '推演朴素串匹配', '跟踪主串和模式串的比较位置，覆盖空模式与最后一个起点。', '推演匹配失败后的移动', ['跟踪每次字符比较的位置', '解释失败后的移动与终止'], 'verified', 'supported'),
  goal('kmp-prefix', '解释前缀复用', '在明确前缀表定义的前提下计算表项，说明失配时复用的部分。', '手算前缀表并解释失配', ['说明使用的前缀表约定', '用新模式检验失配后的复用'], 'partial', 'review'),
  goal('string-encoding', '区分字符与字节', '比较字符、编码单元和字节长度，说明直接按字节截断的风险。', '比较两种字符串长度', ['辨认长度的计量单位', '解释多字节文本的截断现象'], 'unknown', 'review'),
  goal('string-boundary', '设计串操作边界', '为查找、切片或拼接列出前置条件与边界输入。', '设计一组串操作边界用例', ['写清操作前置条件', '用边界输入验证预期行为'], 'unknown', 'unavailable'),
  goal('tree-traversal', '推演树的遍历', '在给定二叉树上分别记录前序、中序、后序，并解释访问时机。', '对同一棵树比较访问顺序', ['解释根节点的访问时机', '独立推演一棵新的二叉树'], 'partial', 'supported'),
  goal('tree-recursion', '解释子树递归', '把树的问题分解到左右子树，并说明空树返回值的意义。', '补全空子树的递归条件', ['说明子树问题与组合方式', '验证空树和单节点树'], 'unknown', 'review'),
  goal('bst-search', '沿搜索树定位', '根据键值关系缩小查找范围，说明树形变化对路径长度的影响。', '比较两棵搜索树的查找路径', ['每步选择正确的子树', '解释退化树中的查找代价'], 'unknown', 'supported'),
  goal('heap-adjust', '维护堆的约束', '在插入或删除后选择上浮或下沉，并检查父子次序。', '修复一次堆删除后的状态', ['明确所选堆的父子约束', '保持调整后的全部父子约束'], 'consolidate', 'review'),
  goal('graph-representation', '选择图的表示', '比较邻接矩阵与邻接表，并明确有向、无向和权值约定。', '为一张小图选择表示', ['准确解释表示约定', '比较稀疏与稠密情形的代价'], 'unknown', 'supported'),
  goal('graph-construction', '构造图的存储', '把给定顶点和边转换为表示，检查方向、重复边和孤立点。', '构造并核对一张小图', ['保留全部顶点与边信息', '按约定处理孤立点和方向'], 'unknown', 'review'),
  goal('graph-bfs', '解释广度优先遍历', '记录队列、发现标记和访问序列，说明为何按层扩展。', '推演队列中的待访问顶点', ['解释发现标记与入队时机', '对新图解释分层访问顺序'], 'unknown', 'supported'),
  goal('graph-dfs', '解释深度优先遍历', '使用递归或显式栈跟踪探索与回退，并处理环和非连通图。', '跟踪探索与回退过程', ['记录探索与回退状态', '处理环和非连通分量'], 'unknown', 'review'),
  goal('linear-search', '核对顺序查找', '逐项检查并说明找到、未找到及重复键的返回约定。', '检查重复键与未找到输入', ['说明查找结果的返回约定', '验证未找到和重复键情形'], 'verified', 'supported'),
  goal('binary-search', '维护折半查找区间', '明确区间开闭约定，证明每次更新缩小范围且不漏掉目标。', '修正区间更新的边界', ['明确区间约定和不变式', '正确处理空区间与端点更新'], 'consolidate', 'supported'),
  goal('hash-probe', '处理散列冲突', '固定散列和探查约定，推演插入、查找与删除标记的影响。', '推演一组发生冲突的键', ['遵循同一探查约定', '解释删除标记对后续查找的影响'], 'unknown', 'review'),
  goal('hash-load', '比较装载因子', '在相同冲突策略下观察装载程度与探查次数，避免把样本当保证。', '记录不同装载程度的探查次数', ['说明装载因子的分母', '区分观察结果与复杂度保证'], 'unknown', 'unavailable'),
  goal('insertion-sort', '推演插入排序', '维护已排序前缀，记录元素移动，并比较不同初始顺序。', '跟踪已排序前缀的变化', ['保持已排序前缀不变式', '比较新输入下的移动次数'], 'partial', 'supported'),
  goal('merge-sort', '解释归并过程', '将两个有序段合并并处理剩余元素，说明递归划分与合并的联系。', '合并两个不同长度的有序段', ['有序合并两个子序列', '验证重复键与剩余元素'], 'unknown', 'review'),
  goal('sort-cost', '比较排序代价', '在相同输入约定下统计比较、移动与辅助空间，避免只看一次耗时。', '比较两种排序的操作计数', ['明确同一输入与计数口径', '解释代价随输入变化的原因'], 'unknown', 'review'),
  goal('sort-choice', '依据约束选择排序', '结合稳定性、空间、数据规模与已有顺序给出选择并用实验检验。', '为一种真实约束选择方法', ['说明任务约束与选择理由', '用反例或新数据检验选择'], 'unknown', 'unavailable'),
]

const baselineStack = goals.find(item => item.id === 'stack-trace')
baselineStack.evidence = [
  { title: '模拟记录 · 普通序列推演', detail: '设计模拟：普通入栈与出栈序列记录正确；该记录只覆盖普通输入。' },
  { title: '模拟记录 · 使用过提示', detail: '设计模拟：在空栈出栈处使用了提示；尚不能证明该条件下可以独立完成。' },
  { title: '模拟记录 · 新条件待验证', detail: '设计模拟：改变操作顺序后的独立推演尚未提交，保持部分满足。' },
]

function relation(from, to, kind, reason) {
  return { id: `${kind}:${from}:${to}`, from, to, kind, reason, source: '模拟设计关系；仅用于交互检验，不是权威教学大纲或经审校先修要求。' }
}

export const relations = [
  relation('structure-model', 'sequence-access', 'prerequisite', '本示例把顺序存储的表示约定作为推算访问位置的准备。'),
  relation('invariant', 'sequence-insert', 'application', '插入时可用“元素相对顺序保持”检查移动过程。'),
  relation('sequence-access', 'sequence-insert', 'prerequisite', '需要能解释下标与位置，才能核对顺序表插入的移动。'),
  relation('list-link', 'list-remove', 'prerequisite', '删除同样需要理解前驱、后继和引用更新。'),
  relation('structure-model', 'stack-trace', 'prerequisite', '推演前先明确栈表示及操作约定；此边为本设计样例的教学顺序。'),
  relation('stack-trace', 'stack-brackets', 'application', '括号匹配使用入栈、查看栈顶和出栈来保存待匹配符号。'),
  relation('stack-trace', 'recursion-trace', 'association', '可以比较显式栈状态与递归调用帧，但两者并非同一个概念。'),
  relation('stack-trace', 'queue-ring', 'association', '对照后进先出与先进先出，有助于辨认两种操作约束。'),
  relation('queue-ring', 'queue-schedule', 'application', '队列的顺序约束可以应用于简单先进先出的任务调度。'),
  relation('string-match', 'kmp-prefix', 'prerequisite', '先辨认失配位置，才能解释前缀复用省略了哪些比较。'),
  relation('string-encoding', 'string-boundary', 'application', '字符与字节的区分可用于设计截断边界测试。'),
  relation('recursion-trace', 'tree-recursion', 'prerequisite', '树的递归计算依赖终止条件和返回过程的解释。'),
  relation('tree-recursion', 'tree-traversal', 'association', '递归遍历把访问时机嵌入子树调用过程；也存在非递归实现。'),
  relation('invariant', 'heap-adjust', 'application', '堆调整可以通过每一对父子节点的约束进行核对。'),
  relation('graph-representation', 'graph-construction', 'prerequisite', '需要先选择并说明存储约定，再构造具体图。'),
  relation('graph-representation', 'graph-bfs', 'prerequisite', '读取相邻顶点需要理解所用图表示。'),
  relation('queue-ring', 'graph-bfs', 'application', 'BFS 使用队列语义维护待扩展顶点；并不要求使用循环数组实现。'),
  relation('graph-bfs', 'graph-dfs', 'association', '比较探索顺序、发现标记与回退行为，有助于区分两种遍历。'),
  relation('stack-trace', 'graph-dfs', 'application', '显式栈版本的 DFS 使用栈保存尚待完成的探索状态。'),
  relation('invariant', 'binary-search', 'application', '折半查找通过区间不变式说明更新为何没有遗漏目标。'),
  relation('binary-search', 'bst-search', 'association', '二者都依据次序缩小范围，但数据表示与代价条件不同。'),
  relation('hash-probe', 'hash-load', 'prerequisite', '需要先固定探查规则，才能比较装载程度对探查的影响。'),
  relation('cost-analysis', 'insertion-sort', 'application', '操作计数可用于解释插入排序在不同初始顺序下的代价。'),
  relation('recursion-trace', 'merge-sort', 'application', '递归推演可解释归并排序的划分、返回与合并。'),
  relation('cost-analysis', 'sort-cost', 'prerequisite', '比较排序前需要明确输入规模和操作计数口径。'),
  relation('sort-cost', 'sort-choice', 'application', '代价分析为方法选择提供依据，同时仍需考虑稳定性等约束。'),
]

/** Counts are based on unique stable IDs, never on the number of visual copies. */
export function summary(ids, goalList = goals) {
  const byId = new Map(goalList.map(item => [item.id, item]))
  const result = { total: 0, verified: 0, partial: 0, consolidate: 0, unknown: 0 }
  for (const id of new Set(ids)) {
    const item = byId.get(id)
    if (!item) throw new RangeError(`Unknown goal: ${id}`)
    if (!['verified', 'partial', 'consolidate', 'unknown'].includes(item.state)) throw new RangeError(`Unknown goal state: ${item.state}`)
    result.total += 1
    result[item.state] += 1
  }
  return result
}

export function goalIdsForChapter(id) {
  const chapter = chapters.find(item => item.id === id)
  return [...new Set(chapter?.units.flatMap(unit => unit.goalIds) ?? [])]
}

/** A design demonstration only; no account, activity, or learning record is written. */
export function simulateOutcome(goalList, outcome) {
  if (!['baseline', 'pass', 'conflict'].includes(outcome)) throw new RangeError(`Unknown outcome: ${outcome}`)
  const result = structuredClone(goalList)
  const index = result.findIndex(item => item.id === 'stack-trace')
  if (index < 0) return result
  if (outcome === 'baseline') {
    result[index] = structuredClone(baselineStack)
    return result
  }
  const stack = result[index]
  if (outcome === 'pass') {
    stack.state = 'verified'
    stack.criteria = stack.criteria.map(item => ({ ...item, status: 'pass' }))
    stack.action = '换一组条件继续检验'
    const title = '模拟记录 · 独立新条件核验通过'
    if (!stack.evidence.some(item => item.title === title)) stack.evidence.push({ title, detail: '设计模拟：在包含空栈出栈、改变操作顺序的新条件中，未使用提示，独立完成推演并解释边界；当前全部示例条件通过。不是实际成绩。' })
  } else {
    stack.state = 'consolidate'
    stack.criteria = stack.criteria.map((item, position) => ({ ...item, status: position === 1 ? 'gap' : item.status }))
    stack.action = '修正空栈处理后重新核验'
    const title = '模拟记录 · 后续核验出现反例'
    if (!stack.evidence.some(item => item.title === title)) stack.evidence.push({ title, detail: '设计模拟：在连续两次空栈出栈的新反例中，第二步错误地改变了状态；保留旧成功记录，当前目标转为需巩固。' })
  }
  return result
}
