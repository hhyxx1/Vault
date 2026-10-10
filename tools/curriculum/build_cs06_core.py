"""Original bounded architecture models with explicit contracts."""

from pathlib import Path

from code_authoring import CodeBook

ROOT = Path(__file__).resolve().parents[2]
book = CodeBook(
    ROOT,
    "CS06-core-scope-0.1.0",
    "CS06-core-practice-0.1.0",
    "27 目标的受限教学模型；完整 HDL、逐周期处理器及综合项目待建设。",
    course="CS06",
    standard="code-fixed-condition-v1",
)
SOURCES = [
    (
        "cornell-numbers",
        "Cornell CS3410 Numbers",
        "https://www.cs.cornell.edu/courses/cs3410/2025fa/notes/numbers.html",
        "two's complement and fixed-width interpretation",
    ),
    (
        "nand-logic",
        "Nand2Tetris Project 1",
        "https://www.nand2tetris.org/project01",
        "combinational logic chip contracts; our truth-table implementations",
    ),
    (
        "nand-state",
        "Nand2Tetris Project 3",
        "https://www.nand2tetris.org/project03",
        "registers and state; our reset/enable priority is explicitly local",
    ),
    (
        "nand-cpu",
        "Nand2Tetris Project 5",
        "https://www.nand2tetris.org/project05",
        "CPU/data path project scope; our ISA is distinct from Hack",
    ),
    (
        "python-round",
        "Python3.13 round",
        "https://docs.python.org/3.13/library/functions.html#round",
        "nearest with even tie; exact integer/Fraction teaching model",
    ),
    (
        "cornell-cache",
        "Cornell CS3410 Caches",
        "https://www.cs.cornell.edu/courses/cs3410/2026sp/notes/caches.html",
        "direct mapping, valid bit, larger blocks and write policies",
    ),
    (
        "usf-pipeline",
        "USF CS315 Pipeline Hazards",
        "https://cs315-f25.cs.usfca.edu/lectures/15-cs315-2025-11-25-processor-pipeline-hazards/",
        "RAW forwarding, load stalling, control flush",
    ),
    (
        "ostep-paging",
        "OSTEP Paging",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf",
        "VPN to PFN with unchanged offset",
    ),
    (
        "ostep-io",
        "OSTEP I/O Devices",
        "https://pages.cs.wisc.edu/~remzi/OSTEP/file-devices.pdf",
        "DMA completion and CPU overlap",
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
    goal = f"CS06-M{module:02d}-O{objective:02d}"
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
    "负整数编码须按八位取模",
    "八位补码保存 x 模 256 的位模式；本题不表示负数的符号绝对值编码。",
    "cornell-numbers",
    "x=-1 if n == 1 else -128\nprint(abs(x))",
    "abs(x)",
    "x & 255",
    "1\n",
    "255\n",
    "128\n",
    "128\n",
    "最小八位有符号整数",
)
add(
    1,
    2,
    "同一字节的有符号解释不同",
    "八位模式 u≥128 时按补码解释为 u-256，零扩展保留无符号意义。",
    "cornell-numbers",
    "u=255 if n == 1 else 127\nprint(u)",
    "print(u)",
    "print(u-256 if u >= 128 else u)",
    "255\n",
    "-1\n",
    "127\n",
    "127\n",
    "最高位为零",
)
add(
    1,
    3,
    "八位有符号上界是 127",
    "八位补码范围 -128 至 127；截断为位模式不表示原数仍可表示。",
    "cornell-numbers",
    "x=128 if n == 1 else 127\nprint(-128 <= x <= 128)",
    "x <= 128",
    "x <= 127",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "合法最大值",
)
add(
    2,
    1,
    "八位 ALU 加法保存低八位",
    "本模型无符号八位加法输出低八位，数学和与机器结果分开；有符号溢出旗标另待建设。",
    "cornell-numbers",
    "a,b=(250,10) if n == 1 else (1,2)\nprint(a+b)",
    "print(a+b)",
    "print((a+b) & 255)",
    "260\n",
    "4\n",
    "3\n",
    "3\n",
    "无进位条件",
)
add(
    2,
    2,
    "最近舍入中点选择偶数",
    "使用 Fraction 精确中点，本教学舍入为最近且中点取偶，不是直接加半再截断。尚未实现 IEEE 全部编码与特殊值。",
    "python-round",
    "from fractions import Fraction\nx=Fraction(5,2) if n == 1 else Fraction(7,2)\nprint(int(x+Fraction(1,2)))",
    "int(x+Fraction(1,2))",
    "round(x)",
    "3\n",
    "2\n",
    "4\n",
    "4\n",
    "中点上方整数为偶数",
)
add(
    2,
    3,
    "精度间距随指数变化",
    "原创规格：规格化二进制精度 p=3 含隐含首位，指数 e 区间的相邻间距为 2^(e-(p-1))，不是所有区间固定间距。",
    "python-round",
    "from fractions import Fraction\ne=0 if n == 1 else 2\np=3\nprint(Fraction(1,8))",
    "Fraction(1,8)",
    "Fraction(2)**(e-(p-1))",
    "1/8\n",
    "1/4\n",
    "1/8\n",
    "1\n",
    "较大指数区间",
)
add(
    3,
    1,
    "半加器和位需要异或",
    "输入为零一位，sum=a XOR b，carry=a AND b；或门在双一时给错和位。",
    "nand-logic",
    "a,b=(1,1) if n == 1 else (1,0)\nprint(a | b,a & b)",
    "a | b",
    "a ^ b",
    "1 1\n",
    "0 1\n",
    "1 0\n",
    "1 0\n",
    "仅一个输入为一",
)
add(
    3,
    2,
    "全加器进位包含输入进位",
    "全加器 carry=(a∧b)∨(cin∧(a XOR b))，不能只看两输入均一。",
    "nand-logic",
    "a,b,c=(1,0,1) if n == 1 else (1,1,0)\ns=a^b^c; carry=a & b\nprint(s,carry)",
    "carry=a & b",
    "carry=(a & b) | (c & (a ^ b))",
    "0 0\n",
    "0 1\n",
    "0 1\n",
    "0 1\n",
    "双一且无输入进位",
)
add(
    3,
    3,
    "门网络等价核对全部输入",
    "两输入组合逻辑可穷举全部四种组合，¬(a∧b)=¬a∨¬b。不同门网络可实现同一真值函数。",
    "nand-logic",
    "from itertools import product\nrows=list(product([False,True],repeat=2)) if n == 1 else [(True,False)]\nprint(all((not (a and b)) == ((not a) and (not b)) for a,b in rows))",
    "((not a) and (not b))",
    "((not a) or (not b))",
    "False\n",
    "True\n",
    "False\n",
    "True\n",
    "最小区分输入",
)
add(
    4,
    1,
    "同一时钟沿寄存器读旧状态",
    "本模型两个寄存器同沿交换，右侧使用沿前状态，不能顺序赋值让后一寄存器读到已改值。",
    "nand-state",
    "a,b=(1,2) if n == 1 else (3,3)\na=b\nb=a\nprint(a,b)",
    "a=b\nb=a",
    "a,b=b,a",
    "2 2\n",
    "2 1\n",
    "3 3\n",
    "3 3\n",
    "沿前两值相同",
)
add(
    4,
    2,
    "复位和使能冲突按已声明优先级",
    "原创模型为上升沿同步复位且复位优先于使能，八位计数回绕。该优先级不是全部硬件的默认规则。",
    "nand-state",
    "q=7; reset=n == 1; enable=n == 1\nif enable: q=(q+1)&255\nelif reset: q=0\nprint(q)",
    "if enable: q=(q+1)&255\nelif reset: q=0",
    "if reset: q=0\nelif enable: q=(q+1)&255",
    "8\n",
    "0\n",
    "7\n",
    "7\n",
    "无复位且保持状态",
)
add(
    4,
    3,
    "时钟周期须覆盖最长组合路径",
    "本模型只核对建立时间约束 T≥tcq+tcomb+tsetup，忽略偏斜；保持时间和电气行为另待建设。任一路满足不足以接受。",
    "nand-state",
    "paths=[(1,6,1),(1,2,1)] if n == 1 else [(1,2,1)]\nperiod=5\nprint(any(period >= sum(path) for path in paths))",
    "any(period >= sum(path)",
    "all(period >= sum(path)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "只有较短路径",
)
add(
    5,
    1,
    "教学指令高四位才是 opcode",
    "原创 ISA：16 位指令，位 15..12 是 opcode，位 11..0 为无符号 immediate；不兼容 Hack 或 RISC-V。",
    "nand-cpu",
    "word=0x1234 if n == 1 else 0x2000\nprint(word >> 8)",
    "word >> 8",
    "word >> 12",
    "18\n",
    "1\n",
    "32\n",
    "2\n",
    "不同 opcode 且零立即数",
)
add(
    5,
    2,
    "基址偏移寻址需先求有效地址",
    "原创字寻址模型 EA=base+offset，load 返回 memory[EA]；不是立即数模式，也未模拟越界或对齐异常。",
    "nand-cpu",
    "memory={4:111,5:222}; base=4; offset=1 if n == 1 else 0\nprint(memory[base])",
    "memory[base]",
    "memory[base+offset]",
    "111\n",
    "222\n",
    "111\n",
    "111\n",
    "零偏移",
)
add(
    5,
    3,
    "减法指令操作数顺序有意义",
    "原创模型 LOAD a，SUB b 输出 a-b；数学表达式映射须保留减法次序及八位结果契约。",
    "nand-cpu",
    "a,b=(9,2) if n == 1 else (3,3)\nacc=a\nacc=b-acc\nprint(acc & 255)",
    "acc=b-acc",
    "acc=acc-b",
    "249\n",
    "7\n",
    "0\n",
    "0\n",
    "相等操作数",
)
add(
    6,
    1,
    "取指先读取当前 PC 再推进",
    "原创分离指令存储器模型 PC 以字为单位，顺序指令取 memory[PC] 后 PC+1；不包含真实总线延迟。",
    "nand-cpu",
    "program=[10,20,30]; pc=0 if n == 1 else 1\npc+=1\ninstruction=program[pc]\nprint(instruction,pc)",
    "pc+=1\ninstruction=program[pc]",
    "instruction=program[pc]\npc+=1",
    "20 1\n",
    "10 1\n",
    "30 2\n",
    "20 2\n",
    "非零起始 PC",
)
add(
    6,
    2,
    "无目的寄存器的指令不能写寄存器",
    "原创控制表：STORE 仅写存储器，ADD 写累加器；不能所有 opcode 均打开寄存器写使能。",
    "nand-cpu",
    "opcode='STORE' if n == 1 else 'ADD'\nreg=3; alu=9\nwrite_enable=True\nif write_enable: reg=alu\nprint(reg)",
    "write_enable=True",
    "write_enable=opcode == 'ADD'",
    "9\n",
    "3\n",
    "9\n",
    "9\n",
    "有寄存器目的的加法",
)
add(
    6,
    3,
    "单端口互斥读写信号不能同时开",
    "本模型同一存储端口读写互斥；双端口及读写同周期语义必须另给规格。这里检测冲突而非模拟完整控制器。",
    "nand-cpu",
    "read,write=(True,True) if n == 1 else (True,False)\nprint(read or write)",
    "read or write",
    "not (read and write)",
    "True\n",
    "False\n",
    "True\n",
    "True\n",
    "只有读使能",
)
add(
    7,
    1,
    "load-use 检测比较目的与后继源",
    "原创五级顺序流水模型：加载结果在 MEM 末可用，紧随后继 EX 需要该结果时有 RAW 冒险；不能比较前指令自己的源。",
    "usf-pipeline",
    "prev={'load':True,'dst':2,'src':1}; next_src=2 if n == 1 else 3\nprint(prev['load'] and prev['src'] == next_src)",
    "prev['src'] == next_src",
    "prev['dst'] == next_src",
    "False\n",
    "True\n",
    "False\n",
    "False\n",
    "后继无依赖",
)
add(
    7,
    2,
    "多条转发来源优先最近生产者",
    "两个更早指令都写同一源寄存器时，选择时间上最近的已就绪结果；本工件仅观察值选择，完整周期表另待建设。",
    "usf-pipeline",
    "older=9; newer=7 if n == 1 else None\nvalue=older\nprint(value)",
    "value=older",
    "value=newer if newer is not None else older",
    "9\n",
    "7\n",
    "9\n",
    "9\n",
    "只有较早来源",
)
add(
    7,
    3,
    "理想流水有限程序包括填充排空",
    "原创五级等周期、无停顿模型 N 条指令完成需 N+4 个周期；稳态吞吐不等于单条延迟。真实任务还需核对终态和周期表。",
    "usf-pipeline",
    "count=4 if n == 1 else 1\nprint(count)",
    "print(count)",
    "print(count+4)",
    "4\n",
    "8\n",
    "1\n",
    "5\n",
    "只有一条指令",
)
add(
    8,
    1,
    "缓存组下标来自块号而非字节号",
    "字节地址、四字节块、四组直接映射：block=addr//4，index=block%4，tag=block//4，offset=addr%4。",
    "cornell-cache",
    "addr=27 if n == 1 else 0\nprint(addr%4,addr//4,addr%4)",
    "addr%4,addr//4,addr%4",
    "(addr//4)%4,(addr//4)//4,addr%4",
    "3 6 3\n",
    "2 1 3\n",
    "0 0 0\n",
    "0 0 0\n",
    "零地址边界",
)
add(
    8,
    2,
    "写回缓存淘汰脏块先回写",
    "原创单槽写回模型，缓存脏值与内存可暂不同步；脏块被替换前必须回写。清洁块不产生写回。",
    "cornell-cache",
    "memory={0:1}; cache={'address':0,'data':9 if n == 1 else 1,'dirty':n == 1}\ncache=None\nprint(memory[0])",
    "cache=None",
    "if cache['dirty']: memory[cache['address']]=cache['data']\ncache=None",
    "1\n",
    "9\n",
    "1\n",
    "1\n",
    "清洁块淘汰",
)
add(
    8,
    3,
    "地址转换保留页内偏移",
    "原创页表：页大小16字节，虚拟页2映到物理帧7；物理地址为帧号乘页大小加偏移。缓存映射和虚实转换是不同层。",
    "ostep-paging",
    "address=35 if n == 1 else 32\npage,offset=divmod(address,16); table={2:7}\nprint(table[page]+offset)",
    "table[page]+offset",
    "table[page]*16+offset",
    "10\n",
    "115\n",
    "7\n",
    "112\n",
    "页首零偏移",
)
add(
    9,
    1,
    "DMA 启动不等于传输完成",
    "设备状态先提交传输，完成中断才表示完成；CPU 可执行其他工作。这里只记录状态条件，不冒称真实设备调试。",
    "ostep-io",
    "done=n == 2\nstatus='complete'\nprint(status)",
    "status='complete'",
    "status='complete' if done else 'pending'",
    "complete\n",
    "pending\n",
    "complete\n",
    "complete\n",
    "收到完成事件",
)
add(
    9,
    2,
    "末尾不足一个总线单位仍需传输拍",
    "原创每拍传最多4字节、无额外握手开销的模型，5字节需2拍而不是1拍；不能直接当现实总线性能。",
    "ostep-io",
    "size=5 if n == 1 else 8\nprint(size//4)",
    "size//4",
    "(size+3)//4",
    "1\n",
    "2\n",
    "2\n",
    "2\n",
    "整拍字节数",
)
add(
    9,
    3,
    "重叠执行取瓶颈而非相加",
    "原创模型 CPU 计算与 DMA 传输独立且全程可重叠、无启动开销，总耗时 max(cpu,io)。串行模型才相加，假设须写在证据中。",
    "ostep-io",
    "cpu,io=(3,5) if n == 1 else (7,2)\nprint(cpu+io)",
    "cpu+io",
    "max(cpu,io)",
    "8\n",
    "5\n",
    "9\n",
    "7\n",
    "改变瓶颈为 CPU",
)

if __name__ == "__main__":
    book.package["relations"] = []
    connections = [
        ("M01-O01", "M01-O02", "cornell-numbers", "八位编码结果的值取决于有符号解释"),
        ("M01-O02", "M01-O03", "cornell-numbers", "解释方式决定合法范围边界"),
        (
            "M02-O01",
            "M02-O02",
            "python-round",
            "固定宽度截断与最近偶数舍入使用不同契约",
        ),
        ("M02-O02", "M02-O03", "python-round", "舍入的量化网格随有效位精度和指数变化"),
        ("M03-O01", "M03-O02", "nand-logic", "全加器同时接受进位输入而半加器不接受"),
        ("M03-O02", "M03-O03", "nand-logic", "替代门网络须保持全部输入的和与进位真值"),
        (
            "M04-O01",
            "M04-O02",
            "nand-state",
            "同沿状态更新需先依据复位使能优先级选下一状态",
        ),
        (
            "M04-O01",
            "M04-O03",
            "nand-state",
            "沿间组合计算必须在下一捕获沿前满足建立约束",
        ),
        ("M05-O01", "M05-O02", "nand-cpu", "解码出的操作数语义决定有效地址求法"),
        ("M05-O01", "M05-O03", "nand-cpu", "表达式指令序列须按 ISA 保持编码和运算顺序"),
        ("M06-O01", "M06-O02", "nand-cpu", "取到的指令决定该拍的目的写使能"),
        (
            "M06-O02",
            "M06-O03",
            "nand-cpu",
            "控制表写入与同端口互斥规则共同约束合法信号",
        ),
        ("M07-O01", "M07-O02", "usf-pipeline", "依赖生产者决定转发来源和就绪条件"),
        ("M07-O01", "M07-O03", "usf-pipeline", "冒险停顿改变理想有限程序周期数"),
        (
            "M08-O01",
            "M08-O02",
            "cornell-cache",
            "同组不同标签替换时须检查被逐出行的脏位",
        ),
        (
            "M08-O01",
            "M08-O03",
            "ostep-paging",
            "缓存块偏移与页内偏移属于两个不同分解层",
        ),
        ("M09-O01", "M09-O02", "ostep-io", "DMA 完成事件发生在全部约定传输拍结束后"),
        (
            "M09-O01",
            "M09-O03",
            "ostep-io",
            "DMA 释放 CPU 才能在明确假设下分析计算传输重叠",
        ),
    ]
    for start, end, source, reason in connections:
        book.package["relations"].append(
            {
                "from": "CS06-" + start,
                "to": "CS06-" + end,
                "kind": "conceptual_association",
                "reason": reason,
                "source_locator": source,
                "course_version_id": book.version,
                "review_state": "authority_checked",
                "source": "原创教学模型关系："
                + reason
                + "；机制参见 "
                + source
                + "；专业审校不可用。",
            }
        )
    book.save("CS06-core")
