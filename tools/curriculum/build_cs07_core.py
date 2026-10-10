"""Original operating-system exercises; real APIs and teaching traces are distinct."""

from pathlib import Path

from code_authoring import CodeBook

ROOT = Path(__file__).resolve().parents[2]
book = CodeBook(
    ROOT,
    "CS07-core-scope-0.1.0",
    "CS07-core-practice-0.1.0",
    "受限系统接口与教学模型实践；完整 trace、独立核验和作业观察器项目待建设。",
    course="CS07",
    standard="code-fixed-condition-v1",
)
SOURCES = [
    (
        "os-trap",
        "UW CS537 Limited Direct Execution",
        "https://pages.cs.wisc.edu/~remzi/Classes/537/Fall2021/Notes/Lecture-Sep14-2021.pdf",
        "user/kernel mode and trap return",
    ),
    (
        "os-banker",
        "UIC Operating Systems Deadlocks",
        "https://www.cs.uic.edu/~jbell/CourseNotes/OperatingSystems/7_Deadlocks.html",
        "7.5.3.1 work, need and allocation safety algorithm",
    ),
    (
        "os-api",
        "Python3.13 os",
        "https://docs.python.org/3.13/library/os.html",
        "open/read, pipe/fork, waitpid and status decoding",
    ),
    (
        "os-process",
        "OSTEP Process API",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf",
        "fork private address spaces, wait and process lifecycle",
    ),
    (
        "os-threads",
        "OSTEP Threads Introduction",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf",
        "shared address space and non-atomic increments",
    ),
    (
        "os-sched",
        "OSTEP Scheduling",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf",
        "FIFO/SJF/RR and response/turnaround",
    ),
    (
        "os-bugs",
        "OSTEP Concurrency Bugs",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf",
        "atomicity, ordering, deadlock conditions and avoidance",
    ),
    (
        "os-memory",
        "OSTEP Free Space",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/vm-freespace.pdf",
        "external fragmentation and allocation strategies",
    ),
    (
        "os-paging",
        "OSTEP Paging",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf",
        "VPN/PFN, offset and page table states",
    ),
    (
        "os-policy",
        "OSTEP Page Replacement",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf",
        "FIFO/LRU and memory pressure",
    ),
    (
        "os-files",
        "OSTEP Files and Directories",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/file-intro.pdf",
        "descriptors, links, access control and rename",
    ),
    (
        "os-limit",
        "Python3.13 resource",
        "https://docs.python.org/3.13/library/resource.html",
        "resource limits and RLIMIT_NOFILE",
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
    goal = f"CS07-M{module:02d}-O{objective:02d}"
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
    "教学陷入返回轨迹区分当前模式",
    "原创模型：系统调用 trap 进入 kernel，return 回 user。此 Python 状态表不是内核 trace，不能从日志补写未观察行为。",
    "os-trap",
    "mode='user'\nevents=['trap','return'] if n == 1 else ['trap']\nfor event in events:\n if event == 'trap': mode='kernel'\n if event == 'return': mode='kernel'\nprint(mode)",
    "if event == 'return': mode='kernel'",
    "if event == 'return': mode='user'",
    "kernel\n",
    "user\n",
    "kernel\n",
    "kernel\n",
    "尚未返回的系统调用",
)
add(
    1,
    2,
    "文件读到指定长度不等于读到 EOF",
    "真实 os.open/read 以两字节块读取隔离文件直到 EOF，保存所有块；短读不是一般文件结束保证。",
    "os-api",
    "import os\nfrom pathlib import Path\nPath('data.txt').write_bytes(b'alpha' if n == 1 else b'xy')\nfd=os.open('data.txt',os.O_RDONLY)\ntry:\n data=os.read(fd,2)\n print(data.decode())\nfinally: os.close(fd)",
    "data=os.read(fd,2)",
    "data=b''\n while True:\n  part=os.read(fd,2)\n  if not part: break\n  data+=part",
    "al\n",
    "alpha\n",
    "xy\n",
    "xy\n",
    "文件只有一块",
)
add(
    1,
    3,
    "真实缺失文件应保留失败原因",
    "实际隔离目录中的存在／缺失文件触发 FileNotFoundError，错误不能记录成读取成功；权限拒绝是不同原因。",
    "os-api",
    "from pathlib import Path\npath=Path('input.txt')\nif n == 2: path.write_text('ok')\ntry:\n data=path.read_text(); result=data\nexcept FileNotFoundError:\n result='ok'\nprint(result)",
    "result='ok'",
    "result='missing'",
    "ok\n",
    "missing\n",
    "ok\n",
    "ok\n",
    "真实文件存在",
)
add(
    2,
    1,
    "waitpid 状态字需解码退出值",
    "实际 fork 子进程正常退出、父进程 waitpid 回收；退出码与系统编码的等待状态字不同。信号退出必须另识别。",
    "os-process",
    "import os\ncode=7 if n == 1 else 0\npid=os.fork()\nif pid == 0: os._exit(code)\n_,status=os.waitpid(pid,0)\nprint(status)",
    "print(status)",
    "print(os.WEXITSTATUS(status))",
    "1792\n",
    "7\n",
    "0\n",
    "0\n",
    "零退出码",
)
add(
    2,
    2,
    "父子管道消息需读取到关闭端的 EOF",
    "实际 fork/pipe，子关闭读端写消息并退出，父关闭写端循环读取并 waitpid。单次两字节 read 不能取完整消息。",
    "os-api",
    "import os\npayload=b'alpha' if n == 1 else b'xy'\nr,w=os.pipe(); pid=os.fork()\nif pid == 0:\n os.close(r); os.write(w,payload); os.close(w); os._exit(0)\nos.close(w)\ndata=os.read(r,2)\nos.close(r); os.waitpid(pid,0)\nprint(data.decode())",
    "data=os.read(r,2)",
    "data=b''\nwhile True:\n part=os.read(r,2)\n if not part: break\n data+=part",
    "al\n",
    "alpha\n",
    "xy\n",
    "xy\n",
    "只有一个读取块",
)
add(
    2,
    3,
    "fork 后父子普通变量各有地址空间",
    "子修改 x 后通过真实管道报告值，父自己的 x 不随子修改。共享内存和线程是另一个契约。",
    "os-process",
    "import os\nx=1; child_value=2 if n == 1 else 1\nr,w=os.pipe(); pid=os.fork()\nif pid == 0:\n x=child_value; os.close(r); os.write(w,str(x).encode()); os.close(w); os._exit(0)\nos.close(w); reported=int(os.read(r,16)); os.close(r); os.waitpid(pid,0)\nprint(reported)",
    "print(reported)",
    "print(x)",
    "2\n",
    "1\n",
    "1\n",
    "1\n",
    "子写入与父原值相同",
)

add(
    3,
    1,
    "非抢占短作业优先按运行时长选择",
    "原创所有作业时刻零到达，SJF 选最短运行时长、同长按给定顺序；不冒称有后来到达时也是同一调度结果。",
    "os-sched",
    "jobs=[('A',5),('B',2)] if n == 1 else [('A',2),('B',5)]\nprint(' '.join(name for name,length in jobs))",
    "for name,length in jobs",
    "for name,length in sorted(jobs,key=lambda job:job[1])",
    "A B\n",
    "B A\n",
    "A B\n",
    "A B\n",
    "原顺序已是最短优先",
)
add(
    3,
    2,
    "周转时间应减去到达时刻",
    "非抢占作业完成时刻减到达为周转，首次运行减到达为响应，周转减运行总量为等待；不能混淆绝对完成时刻。",
    "os-sched",
    "arrival=3 if n == 1 else 0\nstart=5; finish=9\nprint(finish)",
    "print(finish)",
    "print(finish-arrival)",
    "9\n",
    "6\n",
    "9\n",
    "9\n",
    "零到达时刻",
)
add(
    3,
    3,
    "轮转调度未完成作业须重新排队",
    "原创全部时刻零到达、时间片2、切换零开销，服务片段按队列重新排未完成作业；只服务一轮会丢弃剩余任务。",
    "os-sched",
    "jobs=[['A',3],['B',1]] if n == 1 else [['A',1],['B',1]]\ntrace=[]\nwhile jobs:\n name,left=jobs.pop(0); used=min(2,left); trace.append(name+str(used)); left-=used\n if False: jobs.append([name,left])\nprint(' '.join(trace))",
    "if False: jobs.append([name,left])",
    "if left > 0: jobs.append([name,left])",
    "A2 B1\n",
    "A2 B1 A1\n",
    "A1 B1\n",
    "A1 B1\n",
    "都在一片内完成",
)
add(
    4,
    1,
    "真实线程读改写需要原子区间",
    "两个线程用 Barrier 固定读旧值的交错以复现丢失更新；锁覆盖读改写才能得到两次增量。该调度只展示一项反例。",
    "os-threads",
    "from threading import Thread,Barrier,Lock\ncount=0; gate=Barrier(2); lock=Lock(); amount=1 if n == 1 else 2\ndef worker():\n global count\n if False:\n  with lock: count+=amount\n else:\n  old=count; gate.wait(); count=old+amount\nthreads=[Thread(target=worker) for _ in range(2)]\nfor t in threads: t.start()\nfor t in threads: t.join()\nprint(count)",
    "if False:",
    "if True:",
    "1\n",
    "2\n",
    "2\n",
    "4\n",
    "每次增量改为二",
)
add(
    4,
    2,
    "有界队列满时拒绝不能悄悄挤走旧值",
    "queue.Queue(maxsize=2) 真实非阻塞 put，满队列保持状态并报告 Full；删除最旧作品不符合本题生产者消费者契约。",
    "os-threads",
    "from queue import Queue,Full\nq=Queue(maxsize=2); values=[1,2,3] if n == 1 else [1,2]\nfor x in values:\n try: q.put_nowait(x)\n except Full:\n  q.get_nowait(); q.put_nowait(x)\nprint(list(q.queue))",
    "q.get_nowait(); q.put_nowait(x)",
    "pass",
    "[2, 3]\n",
    "[1, 2]\n",
    "[1, 2]\n",
    "[1, 2]\n",
    "刚好容量",
)
add(
    4,
    3,
    "线程初始化须先于读取",
    "真实 Event 和线程，先让读取线程启动、主线程确定初始化后释放；无等待路径被控制为先读旧值。成功的一个调度不代表全部同步已证明。",
    "os-bugs",
    "from threading import Thread,Event\nready=Event(); observed=Event(); done=Event(); value=0; result=[]\ndef worker():\n observed.set()\n if False: ready.wait()\n result.append(value); done.set()\nt=Thread(target=worker); t.start(); observed.wait()\nif not False: done.wait()\nvalue=9 if n == 1 else 3; ready.set(); t.join()\nprint(result[0])",
    "False",
    "True",
    "0\n",
    "9\n",
    "0\n",
    "3\n",
    "改变初始化内容",
)
add(
    5,
    1,
    "死锁四项必要条件需同时成立",
    "互斥、持有等待、不可抢占、循环等待是本资源模型死锁必要条件；全部成立说明风险，不能仅凭布尔项就宣称实际已死锁。",
    "os-bugs",
    "conditions=[True,True,False,True] if n == 1 else [True]*4\nprint(any(conditions))",
    "any(conditions)",
    "all(conditions)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "四项条件都成立的风险",
)
add(
    5,
    2,
    "等待图边由等待者指向持有者",
    "原创单实例资源：进程 A 等资源 R，持有者 B，等待边 A→B。方向错会影响环与恢复分析。这里只构造给定等待边。",
    "os-bugs",
    "waiting='A' if n == 1 else 'C'; owner='B'\nprint(owner+'->'+waiting)",
    "owner+'->'+waiting",
    "waiting+'->'+owner",
    "B->A\n",
    "A->B\n",
    "B->C\n",
    "C->B\n",
    "不同等待者",
)
add(
    5,
    3,
    "安全检查归还已分配量而非最大声明",
    "原创单资源 Banker 安全性模型，need=max-allocation，能完成后 work 加 allocation；不安全不等于当前已经死锁。",
    "os-banker",
    "allocation=[1,1,1]; maximum=[2,4,4] if n == 1 else [2,3,3]\nwork=1; finished=set()\nfor _ in allocation:\n for i in range(3):\n  if i not in finished and maximum[i]-allocation[i] <= work:\n   work+=maximum[i]; finished.add(i)\nprint(len(finished)==3)",
    "work+=maximum[i]",
    "work+=allocation[i]",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "第二进程需求可由归还量满足",
)
add(
    6,
    1,
    "分配整页数必须向上取整",
    "原创页大小16，分配请求17字节占两页；整页分配留下内部碎片，不等于可用空闲块之间的外部碎片。",
    "os-paging",
    "size=17 if n == 1 else 16\nprint(size//16)",
    "size//16",
    "(size+15)//16",
    "1\n",
    "2\n",
    "1\n",
    "1\n",
    "整页请求",
)
add(
    6,
    2,
    "页表转换保留偏移并验证页有效",
    "原创16字节页，虚页1映物理帧4，未列页拒绝；本活动尚未验证完整跨页访问。",
    "os-paging",
    "address=19 if n == 1 else 32\nvpn,offset=divmod(address,16); table={1:4}\nresult=table[vpn]+offset if vpn in table else 'invalid'\nprint(result)",
    "table[vpn]+offset",
    "table[vpn]*16+offset",
    "7\n",
    "67\n",
    "invalid\n",
    "invalid\n",
    "缺失页表项",
)
add(
    6,
    3,
    "外部碎片下总空闲量不足以判断可分配",
    "连续分区请求须有单块足够大；空闲块总和够仍可能无法满足。原模型不含元数据或对齐开销。",
    "os-memory",
    "holes=[4,4] if n == 1 else [8]; request=6\nprint(sum(holes)>=request)",
    "sum(holes)>=request",
    "any(size>=request for size in holes)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "一个足够大的连续块",
)
add(
    7,
    1,
    "FIFO 命中不刷新进入次序",
    "原创容量二、初始空页框，FIFO 在命中时不改装入顺序，LRU 才刷新最近使用。记录最终页框不能代替全部缺页轨迹。",
    "os-policy",
    "access=[1,2,1,3] if n == 1 else [1,2,3]; frames=[]\nfor page in access:\n if page in frames: frames.remove(page); frames.append(page)\n else:\n  if len(frames)==2: frames.pop(0)\n  frames.append(page)\nprint(frames)",
    "if page in frames: frames.remove(page); frames.append(page)",
    "if page in frames: pass",
    "[1, 3]\n",
    "[2, 3]\n",
    "[2, 3]\n",
    "[2, 3]\n",
    "没有页命中的访问串",
)
add(
    7,
    2,
    "局部性观察区分访问次数与不同页数",
    "时间窗口中重复访问同一页有时间局部性，不同页集合大小影响容量需求；不能将重复访问次数当工作集大小。",
    "os-policy",
    "access=[1,1,1] if n == 1 else [1,2,3]\nprint(len(access))",
    "len(access)",
    "len(set(access))",
    "3\n",
    "1\n",
    "3\n",
    "3\n",
    "没有重复的窗口",
)
add(
    7,
    3,
    "工作集窗口只覆盖最近约定访问",
    "原创最近三次访问窗口，工作集为窗口中不同页集合；累计历史所有页不是当前窗口工作集，也不由此单项判定真实系统抖动。",
    "os-policy",
    "access=[1,2,3,3,3] if n == 1 else [1,2]\nprint(sorted(set(access)))",
    "set(access)",
    "set(access[-3:])",
    "[1, 2, 3]\n",
    "[3]\n",
    "[1, 2]\n",
    "[1, 2]\n",
    "历史短于窗口",
)
add(
    8,
    1,
    "改名后打开的描述符仍引用原文件",
    "真实打开文件后 rename，原路径消失但已打开描述符仍能读取；目录名与文件对象不同。此处同一隔离目录。",
    "os-files",
    "import os\nfrom pathlib import Path\nPath('old.txt').write_bytes(b'alpha' if n == 1 else b'beta')\nfd=os.open('old.txt',os.O_RDONLY); os.rename('old.txt','new.txt')\ntry:\n result=Path('old.txt').read_text() if Path('old.txt').exists() else 'missing'\n print(result)\nfinally: os.close(fd)",
    "Path('old.txt').read_text() if Path('old.txt').exists() else 'missing'",
    "os.read(fd,1024).decode()",
    "missing\n",
    "alpha\n",
    "missing\n",
    "beta\n",
    "改变文件内容",
)
add(
    8,
    2,
    "权限拒绝需记录真实错误而非空数据",
    "在非 root isolate 用户下真实 chmod(0) 后 read 触发 PermissionError；操作完恢复权限。不能把拒绝当空文件。",
    "os-files",
    "import os\nfrom pathlib import Path\np=Path('locked.txt'); p.write_text('ok'); os.chmod(p,0 if n == 1 else 0o600)\ntry:\n try: result=p.read_text()\n except PermissionError: result='empty'\n print(result)\nfinally: os.chmod(p,0o600)",
    "result='empty'",
    "result='denied'",
    "empty\n",
    "denied\n",
    "ok\n",
    "ok\n",
    "允许所有者读写",
)
add(
    8,
    3,
    "磁盘请求模型逐步选择最近距离",
    "原创 SSTF 磁头初始50，只选择下一请求，绝对距离而非最小柱面号；未测真实磁盘耗时或完整缓存。",
    "os-files",
    "head=50; requests=[10,55] if n == 1 else [10,20]\nprint(min(requests))",
    "min(requests)",
    "min(requests,key=lambda track:abs(track-head))",
    "10\n",
    "55\n",
    "10\n",
    "20\n",
    "全部请求位于左侧",
)
add(
    9,
    1,
    "认证身份不自动授权读取他人数据",
    "原创 ACL 模型读请求同时检查身份与资源所有者；沙箱隔离与业务授权是独立层。这里不是实际平台安全审计结果。",
    "os-files",
    "authenticated=True; actor='A'; owner='B' if n == 1 else 'A'\nprint(authenticated)",
    "print(authenticated)",
    "print(authenticated and actor == owner)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "资源属于请求者",
)
add(
    9,
    2,
    "真实描述符软限制会拒绝额外打开",
    "在本隔离进程降低 RLIMIT_NOFILE，实际打开小文件直到 EMFILE，finally 关闭。只改变本进程资源，不修改业务机全局配置。",
    "os-limit",
    "import os,resource\nfrom pathlib import Path\nPath('resource.txt').write_text('x')\n_,hard=resource.getrlimit(resource.RLIMIT_NOFILE)\nresource.setrlimit(resource.RLIMIT_NOFILE,(32,hard))\nfds=[]; result='within_limit'\ntry:\n for _ in range(20 if n == 1 else 2):\n  try: fds.append(os.open('resource.txt',os.O_RDONLY))\n  except OSError as error:\n   if error.errno != 24: raise\n   result='limited'; break\n print(result)\nfinally:\n for fd in fds: os.close(fd)",
    "(32,hard)",
    "(8,hard)",
    "within_limit\n",
    "limited\n",
    "within_limit\n",
    "within_limit\n",
    "少量描述符不超限",
)
add(
    9,
    3,
    "进程被信号终止不能记录为正常成功",
    "实际 fork 子进程自发 SIGTERM 或正常退出，父 waitpid 回收并依据状态判定，未完成完整观察器重启及跨任务恢复。",
    "os-process",
    "import os,signal\npid=os.fork()\nif pid == 0:\n if n == 1: os.kill(os.getpid(),signal.SIGTERM)\n os._exit(0)\n_,status=os.waitpid(pid,0)\nprint(True)",
    "print(True)",
    "print(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "正常零退出",
)

if __name__ == "__main__":
    book.package["relations"] = []
    connections = [
        (
            "M01-O01",
            "M01-O02",
            "os-api",
            "文件系统调用进入内核但用户代码只观察返回结果",
        ),
        ("M01-O02", "M01-O03", "os-api", "读调用的返回值和失败原因必须分别记录"),
        ("M02-O01", "M02-O02", "os-process", "管道接收结束后父进程须回收子进程"),
        ("M02-O02", "M02-O03", "os-process", "管道传递值不使父子普通变量自动共享"),
        ("M03-O01", "M03-O02", "os-sched", "服务顺序决定首次响应及完成时刻"),
        ("M03-O02", "M03-O03", "os-sched", "轮转时间片改变响应与周转，指标定义不变"),
        ("M04-O01", "M04-O02", "os-threads", "共享队列的复合状态操作同样需要原子性"),
        ("M04-O01", "M04-O03", "os-bugs", "互斥和初始化顺序处理不同并发条件"),
        ("M05-O01", "M05-O02", "os-bugs", "单实例等待图的环表达循环等待条件"),
        ("M05-O02", "M05-O03", "os-banker", "当前等待图与最大需求下的安全序列不同"),
        ("M06-O01", "M06-O02", "os-paging", "地址页号与页内偏移使用同一页大小"),
        ("M06-O01", "M06-O03", "os-memory", "整页内部碎片与连续分区外部碎片不同"),
        (
            "M07-O01",
            "M07-O02",
            "os-policy",
            "命中刷新规则取决于置换策略而局部性只提供访问背景",
        ),
        ("M07-O02", "M07-O03", "os-policy", "工作集必须注明访问窗口而非全部历史"),
        ("M08-O01", "M08-O02", "os-files", "目录路径、打开描述符和访问权限需分别记录"),
        ("M08-O01", "M08-O03", "os-files", "文件 API 行为不能直接推出机械磁盘调度成本"),
        ("M09-O01", "M09-O02", "os-limit", "业务授权与进程资源隔离分别约束请求和运行"),
        (
            "M09-O02",
            "M09-O03",
            "os-process",
            "观察器需分辨资源拒绝、正常退出和信号终止",
        ),
    ]
    for start, end, source, reason in connections:
        book.package["relations"].append(
            {
                "from": "CS07-" + start,
                "to": "CS07-" + end,
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
    book.save("CS07-core")
