"""Real sandbox files and defect-sensitive regression exercises."""

from pathlib import Path

from code_authoring import CodeBook

book = CodeBook(
    Path(__file__).resolve().parents[2],
    "CS01-core-practice-0.7.0",
    "CS01-core-practice-0.8.0",
    "30 个目标均有受限实践和固定条件比较；跨作业文件持久恢复、组合任务、原理解释、独立迁移及整课验收尚未完成，不代表整课交付。",
)
SOURCE = ["wg14-n1570-files"]
HELPERS = """
struct Record {int id; int score;};
int write_text(const char *path,const char *text) {
    FILE *file=fopen(path,"w"); if(!file) return 0;
    int ok=fputs(text,file)>=0; if(fclose(file)!=0) ok=0; return ok;
}
int load_record(const char *path,struct Record *out) {
    FILE *file=fopen(path,"r"); if(!file) return 0;
    struct Record candidate={0,0}; int parsed=fscanf(file,"%d %d",&candidate.id,&candidate.score);
    int closed=fclose(file)==0;
    if(parsed!=2 || !closed || candidate.id<1 || candidate.score<0 || candidate.score>100) return 0;
    *out=candidate; return 1;
}
"""


def request(main, helpers=HELPERS):
    return {
        "language": "c17",
        "entry": "main.c",
        "files": {
            "main.c": "#include <stdio.h>\n"
            + helpers
            + "\nint main(void) {\n"
            + main
            + "\nreturn 0;\n}\n"
        },
        "stdin": "",
    }


def roundtrip(score=80, correct=False):
    written = score if correct else 0
    return request(
        f'if(!write_text("/box/tmp/record.txt","7 {written}\\n")) return 1;\nstruct Record loaded={{0,0}};\nif(!load_record("/box/tmp/record.txt",&loaded)) return 1;\nprintf("loaded=%d %d\\n",loaded.id,loaded.score);'
    )


book.add(
    "CS01-M09-O01",
    "关闭写入后重新读取记录",
    "将学号 7、分数 80 写入真实沙箱文本文件，关闭后重新打开并解析；初始作品错误保存为 0。文件仅在本次沙箱运行中存在，学习源文件与输出记录可恢复，文件本身不跨作业保留。",
    [
        "写入、关闭及再次打开都需检查返回值；重新读取磁盘内容比仅打印内存值更能揭示保存错误。"
    ],
    ["比较写入文本与期望记录。", "核对读取使用的是文件里的候选值而非原内存值。"],
    SOURCE,
    [
        (
            "base",
            "保存并重读",
            "7 80",
            roundtrip(),
            roundtrip(correct=True),
            "loaded=7 0\n",
            "loaded=7 80\n",
        ),
        (
            "zero-score",
            "零分也须正确保存",
            "分数 0 是合法记录。",
            roundtrip(0),
            roundtrip(0, True),
            "loaded=7 0\n",
            "loaded=7 0\n",
        ),
    ],
)


def parsing(kind="range", correct=False):
    content = {"range": "7 101", "broken": "broken", "valid": "7 90"}[kind]
    check = (
        "parsed==2 && candidate.id>0 && candidate.score>=0 && candidate.score<=100"
        if correct
        else "parsed==2"
    )
    return request(
        f'if(!write_text("/box/tmp/input.txt","{content}\\n")) return 1;\nstruct Record current={{7,80}},candidate={{0,0}};\nFILE *file=fopen("/box/tmp/input.txt","r");if(!file) return 1;\nint parsed=fscanf(file,"%d %d",&candidate.id,&candidate.score);if(fclose(file)!=0)return 1;\nif({check}) {{current=candidate;puts("accepted");}} else puts("rejected");\nprintf("current=%d %d\\n",current.id,current.score);'
    )


def missing():
    return request(
        'struct Record current={7,80};\nFILE *file=fopen("/box/tmp/not-created.txt","r");\nif(!file) puts("open-failed"); else {if(fclose(file)!=0)return 1;}\nprintf("current=%d %d\\n",current.id,current.score);'
    )


book.add(
    "CS01-M09-O02",
    "解析成功还需满足记录约束",
    "输入文件为 7 101，字段转换成功但分数越界，必须拒绝并保留原记录 7 80。另检查损坏行和真实打开失败。数字文本全部是任务自建的小整数，不声明可安全解析任意大数字或任意外部文件。",
    [
        "字段转换数与业务有效性分别判断；先验证候选记录，再替换原对象。不能把打开失败当成空记录成功。"
    ],
    ["解析两个字段不等于 score 合法。", "拒绝时不要把候选覆盖到 current。"],
    SOURCE,
    [
        (
            "base",
            "越界字段",
            "拒绝 101",
            parsing(),
            parsing(correct=True),
            "accepted\ncurrent=7 101\n",
            "rejected\ncurrent=7 80\n",
        ),
        (
            "broken-line",
            "损坏行",
            "broken 无法形成两个字段，保留旧记录。",
            parsing("broken"),
            parsing("broken", True),
            "rejected\ncurrent=7 80\n",
            "rejected\ncurrent=7 80\n",
        ),
        (
            "missing-file",
            "真实打开失败",
            "不存在的文件返回空指针，错误分支保留旧记录。",
            missing(),
            missing(),
            "open-failed\ncurrent=7 80\n",
            "open-failed\ncurrent=7 80\n",
        ),
    ],
)


def staged(kind="broken", correct=False):
    payload = "7 90" if kind == "valid" else "broken"
    target = (
        "/box/tmp/missing/stage.txt" if kind == "write-fail" else "/box/tmp/stage.txt"
    )
    if not correct and kind != "write-fail":
        target = "/box/tmp/record.txt"
    commit = (
        'if(rename("/box/tmp/stage.txt","/box/tmp/record.txt")!=0) return 1;'
        if correct
        else ""
    )
    body = f'if(!write_text("/box/tmp/record.txt","7 80\\n")) return 1;\nstruct Record candidate={{0,0}},loaded={{0,0}};\nif(!write_text("{target}","{payload}\\n")) puts("write-failed");\nelse if(!load_record("{target}",&candidate)) puts("rejected");\nelse {{{commit} puts("committed");}}\nif(load_record("/box/tmp/record.txt",&loaded)) printf("loaded=%d %d\\n",loaded.id,loaded.score); else puts("no-valid-record");'
    return request(body)


book.add(
    "CS01-M09-O03",
    "候选保存失败不能覆盖最后有效记录",
    "旧文件是 7 80。候选损坏行必须拒绝，重开旧文件仍读到 7 80；初始工件直接覆盖旧文件。修正为先写临时文件、关闭并验证，再提交。这里只验证当前 Linux 沙箱行为，不承诺断电持久性或跨平台原子替换。",
    [
        "有效旧版本和候选文件分开；候选验证或写入失败时不提交。成功提交后再从文件重读，不能只展示原内存值。"
    ],
    ["找出旧文件首次被以 w 打开的时刻。", "先写另一文件，验证后才提交。"],
    SOURCE,
    [
        (
            "base",
            "损坏候选被拒绝",
            "保留旧文件",
            staged(),
            staged(correct=True),
            "rejected\nno-valid-record\n",
            "rejected\nloaded=7 80\n",
        ),
        (
            "write-fail",
            "真实写入打开失败",
            "候选目录不存在，写入失败后保留旧文件。",
            staged("write-fail"),
            staged("write-fail", True),
            "write-failed\nloaded=7 80\n",
            "write-failed\nloaded=7 80\n",
        ),
        (
            "valid-commit",
            "有效候选提交",
            "候选 7 90，提交后重开读到 7 90。",
            staged("valid"),
            staged("valid", True),
            "committed\nloaded=7 90\n",
            "committed\nloaded=7 90\n",
        ),
    ],
)


def regression(complete=True, repair=False, baseline=80):
    setter = (
        "if(value<0||value>100)return 0;record->score=value;return 1;"
        if repair
        else "record->score=value;if(value<0||value>100)return 0;return 1;"
    )
    values = "-1,0,100,101" if complete else "80"
    count = 4 if complete else 1
    helpers = (
        "struct Record {int id;int score;};\nint set_score(struct Record *record,int value){"
        + setter
        + "}\n"
    )
    main = f'int inputs[{count}]={{{values}}};int failures=0;\nfor(int i=0;i<{count};i++) {{struct Record record={{7,{baseline}}};int accepted=set_score(&record,inputs[i]);int expected=inputs[i]>=0&&inputs[i]<=100;int score=expected?inputs[i]:{baseline};if(accepted!=expected||record.id!=7||record.score!=score) failures++;}}\nprintf("cases={count} failures=%d\\n",failures);'
    return request(main, helpers)


book.add(
    "CS01-M10-O01",
    "测试要检出拒绝后状态被改坏",
    "生产函数故意带先写后检查缺陷；任务是补测试而非先修函数。初始只测合法 80；新增 -1、0、100、101 并核对拒绝后的原值，期望检出两项失败。测试工具正常退出不代表所有测试通过。",
    [
        "边界测试应比较返回值和副作用；仅正常输入无法检出非法更新破坏原状态。这里的失败数是待修复缺陷证据。"
    ],
    ["先指定拒绝后的 score 应保持什么。", "覆盖上下界等值及其外侧。"],
    SOURCE,
    [
        (
            "base",
            "检出两个缺陷",
            "四个输入，失败数 2。",
            regression(False),
            regression(),
            "cases=1 failures=0\n",
            "cases=4 failures=2\n",
        ),
        (
            "different-baseline",
            "旧值改变仍可检出",
            "旧值 60，不能把 80 写死成唯一期望。",
            regression(False, baseline=60),
            regression(baseline=60),
            "cases=1 failures=0\n",
            "cases=4 failures=2\n",
        ),
    ],
)


def counterexample(first=80, second=80):
    return request(
        f'int first={first},second={second};int expected=first+second;int actual=first+first;\nprintf("expected=%d actual=%d mismatch=%d\\n",expected,actual,expected!=actual);',
        helpers="",
    )


book.add(
    "CS01-M10-O02",
    "最小反例暴露重复读取",
    "初始两条分数都为 80，重复第一条也碰巧得到正确总分。把样例缩小为 1 和 0，保留 expected、actual 与 mismatch，再用反向 0 和 1 验证不是偶然。",
    [
        "能通过的演示样例可能掩盖缺陷；最小反例应仍保留触发错误的差异。这里只定位重复读取，不证明全部记录器行为。"
    ],
    ["两个输入相等时为何无法区分正确和错误表达式？", "用不相等的小值重现。"],
    SOURCE,
    [
        (
            "base",
            "不相等的最小样例",
            "1、0：期望 1，实际 2。",
            counterexample(),
            counterexample(1, 0),
            "expected=160 actual=160 mismatch=0\n",
            "expected=1 actual=2 mismatch=1\n",
        ),
        (
            "reverse-records",
            "顺序反转",
            "0、1：期望 1，实际 0。",
            counterexample(0, 0),
            counterexample(0, 1),
            "expected=0 actual=0 mismatch=0\n",
            "expected=1 actual=0 mismatch=1\n",
        ),
    ],
)


book.add(
    "CS01-M10-O03",
    "修复之后复跑返回值与状态回归",
    "保留前一目标检出的四个测试，再修先写后检查缺陷，期望四例失败数为 0。旧值改成 60 的新条件核对未把恢复值写死；解释这组回归尚未覆盖文件或内存故障。",
    [
        "修复应使原失败测试转为通过，并保留合法边界；解释回归范围，不能因为四例通过宣称整门课程掌握。"
    ],
    ["把验证移到首次状态修改之前。", "保留测试，不删掉失败输入。"],
    SOURCE,
    [
        (
            "base",
            "缺陷修复回归",
            "四例通过",
            regression(),
            regression(repair=True),
            "cases=4 failures=2\n",
            "cases=4 failures=0\n",
        ),
        (
            "changed-record",
            "另一原记录",
            "旧值 60，同样四例通过。",
            regression(baseline=60),
            regression(repair=True, baseline=60),
            "cases=4 failures=2\n",
            "cases=4 failures=0\n",
        ),
    ],
)
book.package["sources"].append(
    {
        "id": "wg14-n1570-files",
        "title": "WG14 N1570：文件操作（C11 委员会草案）",
        "url": "https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf",
        "locator": "7.21.4.2；7.21.5.1；7.21.5.3；7.21.6.2；非 C17 正式标准",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
)
for first, second, kind, source, locator, reason in [
    (
        "CS01-M02-O01",
        "CS01-M03-O01",
        "application",
        "wg14-n1570-control",
        "6.8.4.1",
        "表达式求值用于本活动条件判断；应用关系不强制要求先完成某次温度练习。",
    ),
    (
        "CS01-M03-O02",
        "CS01-M03-O03",
        "application",
        "wg14-n1570-control",
        "6.8.4.1",
        "三段条件实现用于选择阈值反例和规则改变，不以同章次序推断严格先修。",
    ),
    (
        "CS01-M04-O01",
        "CS01-M06-O01",
        "application",
        "wg14-n1570-control",
        "6.8.5.3",
        "逐轮变量轨迹用于核对数组更新的下标与有效长度。",
    ),
    (
        "CS01-M05-O01",
        "CS01-M08-O02",
        "application",
        "wg14-n1570-functions",
        "6.5.2.2",
        "参数与返回值应用于跨文件构造器接口；不要求复制先前参考代码。",
    ),
    (
        "CS01-M07-O01",
        "CS01-M07-O03",
        "conceptual_association",
        "wg14-n1570-memory",
        "7.22.3.3",
        "两者比较别名所指对象与对象释放后的访问责任；关联不宣称已证明一般内存安全。",
    ),
    (
        "CS01-M08-O01",
        "CS01-M09-O01",
        "application",
        "wg14-n1570-files",
        "7.21.5.3",
        "结构记录的字段被保存并重新读取；文本格式是任务定义，不是内存布局的直接复制。",
    ),
    (
        "CS01-M08-O03",
        "CS01-M09-O02",
        "application",
        "wg14-n1570-files",
        "7.21.6.2",
        "候选记录约束用于解析后验证；字段转换成功不等于允许提交。",
    ),
    (
        "CS01-M09-O02",
        "CS01-M09-O03",
        "application",
        "wg14-n1570-files",
        "7.21.4.2",
        "损坏候选的拒绝用于临时保存流程，避免覆盖最后有效记录。",
    ),
    (
        "CS01-M08-O03",
        "CS01-M10-O01",
        "application",
        "wg14-n1570-records",
        "6.5.2.3",
        "对象字段约束用作回归断言，检查拒绝后的副作用而非只比较返回值。",
    ),
    (
        "CS01-M10-O01",
        "CS01-M10-O03",
        "application",
        "wg14-n1570-records",
        "6.5.2.3",
        "已检出失败的测试用于修复后回归；关系表示任务复用，不自动授予独立能力。",
    ),
]:
    book.package["relations"].append(
        {
            "from": first,
            "to": second,
            "kind": kind,
            "source": f"作者任务关系核对：{reason} 来源 {source} §{locator}；专业审校未完成。",
            "reason": reason,
            "source_locator": f"{source}:{locator}",
            "course_version_id": book.version,
            "review_state": "authority_checked",
        }
    )
book.save("CS01-files-testing")
