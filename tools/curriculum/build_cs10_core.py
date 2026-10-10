"""Original submission-service scenarios, with real tests and explicit design models."""

from pathlib import Path

from code_authoring import CodeBook

ROOT = Path(__file__).resolve().parents[2]
book = CodeBook(
    ROOT,
    "CS10-core-scope-0.1.0",
    "CS10-core-practice-0.1.0",
    "提交服务的局部实际程序、测试与Git工件；完整需求/架构评审及两轮综合交付待建设。",
    course="CS10",
    standard="code-fixed-condition-v1",
)
SOURCES = [
    (
        "se-spec",
        "MIT6.005 Specifications",
        "https://web.mit.edu/6.005/www/fa16/classes/06-specifications/",
        "preconditions and postconditions; original service scenario",
    ),
    (
        "se-design",
        "MIT6.005 Designing Specifications",
        "https://web.mit.edu/6.005/www/fa16/classes/07-designing-specs/",
        "operational and declarative specifications; original tradeoffs",
    ),
    (
        "se-test",
        "MIT6.005 Testing",
        "https://web.mit.edu/6.005/www/fa16/classes/03-testing/",
        "partitioning, boundaries, regression and test-first",
    ),
    (
        "se-git",
        "Git Branching and Merging",
        "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging",
        "real private branches, merge conflicts and resolution",
    ),
    (
        "se-release",
        "GoogleSRE Release Engineering",
        "https://sre.google/sre-book/release-engineering/",
        "repeatable releases and build/release mechanisms",
    ),
    (
        "se-monitor",
        "GoogleSRE Monitoring",
        "https://sre.google/sre-book/monitoring-distributed-systems/",
        "symptoms versus causes and monitoring; original fixed metrics",
    ),
    (
        "se-unittest",
        "Python3.13 unittest",
        "https://docs.python.org/3.13/library/unittest.html",
        "actual TestCase, TestSuite and result failures",
    ),
    (
        "se-http",
        "Python3.13 http.server",
        "https://docs.python.org/3.13/library/http.server.html",
        "HTTPServer in local experiments, not production server",
    ),
]
book.package["sources"] = [
    {
        "id": key,
        "title": title,
        "url": url,
        "locator": locator,
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
    for key, title, url, locator in SOURCES
]
book.package["activities"] = []


def add(
    module,
    objective,
    title,
    theory,
    source,
    code,
    wrong,
    right,
    before,
    after,
    changed_before,
    changed_after,
    variant,
):
    goal = f"CS10-M{module:02d}-O{objective:02d}"
    initial = "n = int(input())\n" + code.strip() + "\n"
    assert wrong in initial, goal
    repaired = initial.replace(wrong, right)
    cases = []
    for task, label, stdin, first, second in [
        ("base", title, "1\n", before, after),
        ("changed-condition", variant, "2\n", changed_before, changed_after),
    ]:
        request = {
            "language": "python313",
            "entry": "main.py",
            "files": {"main.py": initial},
            "stdin": stdin,
        }
        answer = {**request, "files": {"main.py": repaired}}
        cases.append(
            (
                task,
                label,
                "先写输入约束及预测，运行并保存反例，修改后解释哪些结论尚未证明。",
                request,
                answer,
                first,
                second,
            )
        )
    book.add(
        goal,
        title,
        "标注契约与证据，再用实际运行定位违反条件的步骤。",
        [
            theory,
            "本例的固定运行只支持列出的观察；证明、一般界和独立迁移不由输出代替。",
        ],
        [
            "先区分输出错误、输入前提变化和论证缺口。",
            "检查最小反例与边界，并解释修改依据。",
        ],
        [source],
        cases,
    )


add(
    1,
    1,
    "生命周期工件需包含验证依据",
    "原创提交服务迭代记录：实现文件存在不代表需求、验证和运行观察齐备；仅核对给定工件映射，不自动评价过程设计。",
    "se-spec",
    "records={'requirements':True,'implementation':True,'validation':False if n==1 else True}\nprint(records['implementation'])",
    "records['implementation']",
    "all(records.values())",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "补充验证工件",
)
add(
    1,
    2,
    "一次增量需形成可用的端到端动作",
    "原创最小提交增量要求输入、保存、恢复三个行为；只完成输入页面不能验收该增量。列出的行为仍需实际测试。",
    "se-design",
    "completed={'input','save'} if n==1 else {'input','save','restore'}\nrequired={'input','save','restore'}\nprint(bool(completed))",
    "bool(completed)",
    "required<=completed",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "恢复行为也有工件",
)
add(
    1,
    3,
    "预算下的风险选择须保留约束",
    "原创两个候选验证任务成本2和5、预算3，不能先选超预算高影响任务；此有限排序不是通用项目管理算法。",
    "se-design",
    "tasks=[('restore',2,8),('scale',5,9)]\nbudget=3 if n==1 else 5\nprint(max(tasks,key=lambda t:t[2])[0])",
    "max(tasks,key=lambda t:t[2])",
    "max((t for t in tasks if t[1]<=budget),key=lambda t:t[2])",
    "scale\n",
    "restore\n",
    "scale\n",
    "scale\n",
    "预算允许扩展验证",
)
add(
    2,
    1,
    "用户目标须与实现手段分开",
    "原创访谈的用户需要是找回已提交作品，安装数据库只是候选实现手段。字段已由作者结构化，程序不是自动需求理解器。",
    "se-spec",
    "story={'outcome':'recover_work','tool':'install_database' if n==1 else 'recover_work'}\nprint(story['tool'])",
    "story['tool']",
    "story['outcome']",
    "install_database\n",
    "recover_work\n",
    "recover_work\n",
    "recover_work\n",
    "表述已经是用户结果",
)
add(
    2,
    2,
    "每次请求时限不能用平均值替代",
    "原创验收明确每次样例不超过5个时间单位；平均值通过会漏掉长尾样例。有限数据不证明未来全部请求满足。",
    "se-test",
    "times=[1,9] if n==1 else [1,3]\nprint(sum(times)/len(times)<=5)",
    "sum(times)/len(times)",
    "max(times)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "全部样例满足时限",
)
add(
    2,
    3,
    "需求变更要追踪间接影响",
    "原创 role 影响 authorization，后者影响 tests；给定追踪图需遍历传递影响，结果仍需人工复查完整性。",
    "se-design",
    "links={'role':['authorization'],'authorization':['tests'],'tests':[]}\nstart='role' if n==1 else 'authorization'\nchanged=set(links[start])\nprint(' '.join(sorted(changed)))",
    "changed=set(links[start])",
    "changed=set();todo=list(links[start])\nwhile todo:\n item=todo.pop()\n if item not in changed:changed.add(item);todo.extend(links[item])",
    "authorization\n",
    "authorization tests\n",
    "tests\n",
    "tests\n",
    "直接变更授权",
)
add(
    3,
    1,
    "作品模型应隔离外部可变别名",
    "真实 Python 字典：提交后外部修改原输入不应改写已冻结作品。这里只验证复制，不是完整领域模型审阅。",
    "se-spec",
    "source={'owner':'student','text':'first'}\nartifact=source\nsource['text']='second' if n==1 else 'first'\nprint(artifact['text'])",
    "artifact=source",
    "artifact=dict(source)",
    "second\n",
    "first\n",
    "first\n",
    "first\n",
    "原输入未改动",
)
add(
    3,
    2,
    "取消状态不能接受迟到完成",
    "原创请求状态机：cancelled 为终态，迟到 completed 不应覆盖；未实现全部交互时序和并发事件。",
    "se-design",
    "state='cancelled' if n==1 else 'running'\nresponse='completed'\nstate=response\nprint(state)",
    "state=response",
    "if state=='running':state=response",
    "completed\n",
    "cancelled\n",
    "completed\n",
    "completed\n",
    "正常进行中的响应",
)
add(
    3,
    3,
    "需求追踪需核对缺失测试",
    "原创需求到测试记录中 save 缺少测试，不能凭表有条目就通过；引用存在也不证明测试有效。",
    "se-test",
    "mapping={'save':[] if n==1 else ['T-save'],'restore':['T-restore']}\nprint(bool(mapping))",
    "bool(mapping)",
    "all(mapping.values())",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "补上保存测试引用",
)
add(
    4,
    1,
    "业务职责必须调用存储接口",
    "实际运行原创 Repo 与 Service，submit 返回成功前需调用 save；行为观察与模块职责评审分开。",
    "se-spec",
    "class Repo:\n def __init__(self):self.rows=[]\n def save(self,value):self.rows.append(value)\nrepo=Repo()\ndef submit(value):\n return 'accepted'\nsubmit(7 if n==1 else 8)\nprint(len(repo.rows))",
    " return 'accepted'",
    " repo.save(value)\n return 'accepted'",
    "0\n",
    "1\n",
    "0\n",
    "1\n",
    "不同作品输入",
)
add(
    4,
    2,
    "恢复质量不能只看响应快",
    "原创质量场景明确持久恢复必需；候选快方案没有持久性证据，不满足此条件。给定布尔证据不是实测结果。",
    "se-design",
    "fast={'latency':1,'durable':False if n==1 else True}\nprint(fast['latency']<=2)",
    "fast['latency']<=2",
    "fast['latency']<=2 and fast['durable']",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "同时满足恢复条件",
)
add(
    4,
    3,
    "架构决策需记录依据和失效条件",
    "原创决策记录结构检查：缺少撤销条件时不能支持后续复审；字段齐全不证明取舍质量。",
    "se-design",
    "decision={'choice':'local_store','evidence':'restore_test'}\nif n==2:decision['reconsider']='multi_writer'\nprint('choice' in decision)",
    "'choice' in decision",
    "all(key in decision for key in ['choice','evidence','reconsider'])",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "增加复审触发条件",
)

HTTP_HEAD = "import http.server,http.client,threading,json\nclass Handler(http.server.BaseHTTPRequestHandler):\n def log_message(self,*args):pass\n def do_GET(self):\n"
HTTP_TAIL = "server=http.server.HTTPServer(('127.0.0.1',0),Handler)\nthread=threading.Thread(target=server.serve_forever,kwargs={'poll_interval':0.01});thread.start()\ntry:\n client=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=2);client.request('GET','/submit');response=client.getresponse();body=response.read();status=response.status;client.close()\nfinally:server.shutdown();thread.join();server.server_close()\n"
add(
    5,
    1,
    "真实接口拒绝须返回对应状态",
    "仅本沙箱HTTP请求：本原创契约未授权返回403，授权返回200。不是平台生产鉴权实现或完整HTTP错误分类。",
    "se-http",
    "authorized=n==2\n"
    + HTTP_HEAD
    + "  self.send_response(200);self.end_headers();self.wfile.write(b'ok')\n"
    + HTTP_TAIL
    + "print(status)",
    "self.send_response(200)",
    "self.send_response(200 if authorized else 403)",
    "200\n",
    "403\n",
    "200\n",
    "200\n",
    "授权请求",
)
add(
    5,
    2,
    "真实接口响应需遵守JSON契约",
    "本沙箱HTTP响应按原创契约提供JSON对象id；客户端实际解析，200不能代替响应结构正确。",
    "se-http",
    "value=7 if n==1 else 8\n"
    + HTTP_HEAD
    + "  self.send_response(200);self.end_headers();self.wfile.write(('id:'+str(value)).encode())\n"
    + HTTP_TAIL
    + "try:print(json.loads(body)['id'])\nexcept json.JSONDecodeError:print('invalid')",
    "('id:'+str(value)).encode()",
    "json.dumps({'id':value}).encode()",
    "invalid\n",
    "7\n",
    "invalid\n",
    "8\n",
    "改变返回id",
)
add(
    5,
    3,
    "存储依赖失败不能伪装成功",
    "真实注入Repo.save异常，服务层按明示契约返回unavailable；正常返回accepted。只有列出的依赖失败类型。",
    "se-spec",
    "class Repo:\n def save(self):\n  if n==1:raise OSError('storage unavailable')\ndef submit(repo):\n try:repo.save();return 'accepted'\n except OSError:return 'accepted'\nprint(submit(Repo()))",
    "except OSError:return 'accepted'",
    "except OSError:return 'unavailable'",
    "accepted\n",
    "unavailable\n",
    "accepted\n",
    "accepted\n",
    "依赖正常",
)
add(
    6,
    1,
    "集成测试需观察保存而非只看返回值",
    "实际unittest注入未存储的服务缺陷，断言repo状态能检出；这里只证明该缺陷被检出，测试数量不当质量分数。",
    "se-unittest",
    "import unittest\nrepo=[]\ndef submit(x):\n if n==2:repo.append(x)\n return True\nclass Check(unittest.TestCase):\n def test_save(self):\n  self.assertTrue(submit(7))\nresult=unittest.TestResult();unittest.defaultTestLoader.loadTestsFromTestCase(Check).run(result)\nprint(len(result.failures))",
    "self.assertTrue(submit(7))",
    "submit(7);self.assertEqual(repo,[7])",
    "0\n",
    "1\n",
    "0\n",
    "0\n",
    "正确保存实现",
)
add(
    6,
    2,
    "边界用例应检出阈值相等缺陷",
    "实际unittest：原创允许value>=0，缺陷使用>0，正值测试漏掉零边界。新增边界测试失败是检出证据而非工具运行失败。",
    "se-test",
    "import unittest\ndef valid(x):return x>0 if n==1 else x>=0\nclass Check(unittest.TestCase):\n def test_boundary(self):self.assertTrue(valid(1))\nresult=unittest.TestResult();unittest.defaultTestLoader.loadTestsFromTestCase(Check).run(result)\nprint(len(result.failures))",
    "valid(1)",
    "valid(0)",
    "0\n",
    "1\n",
    "0\n",
    "0\n",
    "修正后的实现",
)
add(
    6,
    3,
    "检出率应比较实际变异行为",
    "原创两变异函数>0和>=0，以明确零边界断言观察拒绝缺陷；不把代码覆盖率当缺陷检出率，有限变异不是完整可靠性。",
    "se-test",
    "mutants=[lambda x:x>0,lambda x:x>=0]\ncase=1\nexpected=True\nprint(sum(fn(case)!=expected for fn in mutants))",
    "case=1",
    "case=0 if n==1 else 2",
    "0\n",
    "1\n",
    "0\n",
    "0\n",
    "无区别的正值条件",
)

GIT = "import subprocess,pathlib,tempfile,os\nrepo=pathlib.Path(tempfile.mkdtemp())\nenv={**os.environ,'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null'}\ndef git(*args,check=True):\n return subprocess.run(['git','-c','user.name=Student','-c','user.email=student@example.invalid',*args],cwd=repo,env=env,check=check,capture_output=True,text=True)\ngit('init','-b','main');file=repo/'rule.txt';file.write_text('base');git('add','rule.txt');git('commit','-m','base')\n"
add(
    7,
    1,
    "实际提交需读取Git差异工件",
    "在本沙箱私有Git仓库修改未提交文件，读取working tree与HEAD差异；不连接远端或修改本项目仓库。评审意见另需记录。",
    "se-git",
    GIT
    + "file.write_text('changed' if n==1 else 'base')\nprint(bool(git('diff','--cached').stdout))",
    "git('diff','--cached')",
    "git('diff')",
    "False\n",
    "True\n",
    "False\n",
    "False\n",
    "工作文件未改动",
)
add(
    7,
    2,
    "实际合并冲突必须解决后再验收",
    "本沙箱私有分支修改同一文件产生真实冲突；检查Git未合并索引，手动写入完整决议并暂存才清除。暂存不证明语义正确。",
    "se-git",
    GIT
    + "git('checkout','-b','left');file.write_text('left');git('add','rule.txt');git('commit','-m','left')\ngit('checkout','main');file.write_text('right');git('add','rule.txt');git('commit','-m','right')\nmerge=git('merge','left',check=False)\nif n==2:file.write_text('resolved');git('add','rule.txt')\nprint(merge.returncode==0)",
    "print(merge.returncode==0)",
    "file.write_text('resolved');git('add','rule.txt')\nprint(not bool(git('ls-files','-u').stdout))",
    "False\n",
    "True\n",
    "False\n",
    "True\n",
    "已手动写入并暂存决议",
)
add(
    7,
    3,
    "构建清单需使用稳定输入顺序",
    "原创构建指纹对相同文件集保持稳定；只核对顺序规范化，不是完整依赖锁定或干净构建证明。",
    "se-release",
    "import json\na={'a.py':'A','b.py':'B'};b={'b.py':'B','a.py':'A'} if n==1 else a\nprint(json.dumps(a)==json.dumps(b))",
    "json.dumps(a)==json.dumps(b)",
    "json.dumps(a,sort_keys=True)==json.dumps(b,sort_keys=True)",
    "False\n",
    "True\n",
    "True\n",
    "True\n",
    "输入顺序相同",
)
add(
    8,
    1,
    "回滚需恢复实际版本文件",
    "本沙箱真实版本文件写入v2后明示健康检查失败，应恢复v1并读取文件取证；不代表生产服务部署或数据兼容验收。",
    "se-release",
    "from pathlib import Path\nversion=Path('version.txt');version.write_text('v1');previous=version.read_text();version.write_text('v2')\nhealthy=n==2\nif not healthy:pass\nprint(version.read_text())",
    "if not healthy:pass",
    "if not healthy:version.write_text(previous)",
    "v2\n",
    "v1\n",
    "v2\n",
    "v2\n",
    "新版本健康",
)
add(
    8,
    2,
    "错误率分母须包含失败请求",
    "原创有限实际请求记录200和500，错误率为失败数除总请求数；这里只核算给定记录，不称完整线上指标采集。",
    "se-monitor",
    "from fractions import Fraction\nstatuses=[200,500] if n==1 else [200,200]\nerrors=sum(code>=500 for code in statuses);successes=sum(code<500 for code in statuses)\nprint(Fraction(errors,successes))",
    "Fraction(errors,successes)",
    "Fraction(errors,len(statuses))",
    "1\n",
    "1/2\n",
    "0\n",
    "0\n",
    "全部成功的记录",
)
add(
    8,
    3,
    "200响应也要检查业务内容",
    "本沙箱真实HTTP响应200但正文broken；按本原创接口约定ok才满足行为。状态码不能独自证明服务健康。",
    "se-http",
    "value=b'broken' if n==1 else b'ok'\n"
    + HTTP_HEAD
    + "  self.send_response(200);self.end_headers();self.wfile.write(value)\n"
    + HTTP_TAIL
    + "print(status==200)",
    "status==200",
    "status==200 and body==b'ok'",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "状态与正文均满足",
)
add(
    9,
    1,
    "维护影响包含间接调用方",
    "原创给定模块依赖：api依赖service，service依赖schema，schema改变需追踪两者。有限关系图不保证真实工程映射完备。",
    "se-design",
    "depends={'api':{'service'},'service':{'schema'},'schema':set()}\nchanged={'schema' if n==1 else 'service'}\naffected={name for name,items in depends.items() if items&changed}\nprint(' '.join(sorted(affected)))",
    "affected={name for name,items in depends.items() if items&changed}",
    "affected=set();todo=set(changed)\nwhile True:\n found={name for name,items in depends.items() if items&todo}-affected\n if not found:break\n affected|=found;todo|=found",
    "service\n",
    "api service\n",
    "api\n",
    "api\n",
    "直接修改service",
)
add(
    9,
    2,
    "重构需保持阈值边界行为",
    "实际有限差分：旧契约>=0，重构后>0改变零边界；观察原/新函数差异，不把样例一致当一般证明。",
    "se-test",
    "values=[0,1] if n==1 else [1,2]\ndef old(x):return x>=0\ndef new(x):return x>0\nprint(sum(old(x)!=new(x) for x in values))",
    "def new(x):return x>0",
    "def new(x):return x>=0",
    "1\n",
    "0\n",
    "0\n",
    "0\n",
    "未触及零的样例",
)
add(
    9,
    3,
    "复盘不能由测试绿灯忽略未决风险",
    "原创交付条件包含已知严重缺陷为零；测试已通过但严重问题尚未关闭，不能将任务计数代替复核。规则是本情境声明的政策。",
    "se-test",
    "tests_green=True;critical_open=1 if n==1 else 0\nprint(tests_green)",
    "print(tests_green)",
    "print(tests_green and critical_open==0)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "严重缺陷已经关闭",
)

if __name__ == "__main__":
    book.package["relations"] = []
    links = [
        (1, 1, 2, "se-spec", "增量交付仍需保留需求到验证的工件"),
        (1, 2, 3, "se-design", "端到端动作需要在预算风险下选择"),
        (2, 1, 2, "se-spec", "用户结果须转为可检验行为约束"),
        (2, 2, 3, "se-design", "验收条件变化会影响后续测试"),
        (3, 1, 2, "se-spec", "作品冻结与状态终止共同限制迟到改写"),
        (3, 2, 3, "se-test", "状态转换需可追踪到验证案例"),
        (4, 1, 2, "se-design", "职责分配需支持质量场景"),
        (4, 2, 3, "se-design", "质量证据需进入可复审决策"),
        (5, 1, 2, "se-http", "状态与响应结构共同构成接口行为"),
        (5, 2, 3, "se-spec", "依赖失败仍需遵守错误契约"),
        (6, 1, 2, "se-test", "集成观察与边界选择检查不同缺陷"),
        (6, 2, 3, "se-test", "边界测试需要用实际缺陷检出验证"),
        (7, 1, 2, "se-git", "合并冲突解决需检查实际变更"),
        (7, 2, 3, "se-release", "合并结果需要稳定的构建输入"),
        (8, 1, 3, "se-release", "回滚后的健康检查应包含业务结果"),
        (8, 2, 3, "se-monitor", "监测错误不能只靠响应状态"),
        (9, 1, 2, "se-design", "影响图确定重构回归范围"),
        (9, 2, 3, "se-test", "回归通过仍需处理未决风险"),
    ]
    for module, left, right, source, reason in links:
        book.package["relations"].append(
            {
                "from": f"CS10-M{module:02d}-O{left:02d}",
                "to": f"CS10-M{module:02d}-O{right:02d}",
                "kind": "conceptual_association",
                "reason": reason,
                "source_locator": source,
                "course_version_id": book.version,
                "review_state": "authority_checked",
                "source": "原创工件关系："
                + reason
                + "；机制参见 "
                + source
                + "；专业审校不可用。",
            }
        )
    book.save("CS10-core")
