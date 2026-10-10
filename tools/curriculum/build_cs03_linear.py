"""Original bounded C++17 linear-structure exercises, independently specified outputs."""

from pathlib import Path

from code_authoring import CodeBook

ROOT = Path(__file__).resolve().parents[2]
book = CodeBook(
    ROOT,
    "CS03-core-scope-0.1.0",
    "CS03-core-practice-0.1.0",
    "前 3 模块 9 个目标具备受限 C++17 实践；其余模块、完整边界、解释和独立迁移仍待建设及复核。",
    course="CS03",
    standard="code-fixed-condition-v1",
)
SOURCE = "mit6006-sequences"
book.package["sources"] = [
    {
        "id": SOURCE,
        "title": "MIT 6.006 Spring 2020 Lecture 2: Data Structures",
        "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/79a07dc1cb47d76dae2ffedc701e3d2b_MIT6_006S20_lec2.pdf",
        "locator": "pp.1–4: sequence/set interfaces, arrays, linked lists, amortized cost",
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
]


def add(
    module,
    objective,
    title,
    theory,
    declarations,
    body,
    wrong,
    right,
    before,
    after,
    variant_before,
    variant_after,
    variant,
    source=SOURCE,
):
    goal = f"CS03-M{module:02d}-O{objective:02d}"
    initial = (
        "#include <iostream>\n#include <vector>\n#include <array>\n#include <algorithm>\n"
        "#include <string>\n#include <stack>\nusing namespace std;\n"
        + declarations
        + "\nint main(){ int n; cin>>n;\n"
        + body
        + "\n}\n"
    )
    assert wrong in initial, goal
    repaired = initial.replace(wrong, right)
    cases = []
    for task, label, stdin, first, second in [
        ("base", title, "1\n", before, after),
        ("changed-condition", variant, "2\n", variant_before, variant_after),
    ]:
        request = {
            "language": "cpp17",
            "entry": "main.cpp",
            "files": {"main.cpp": initial},
            "stdin": stdin,
        }
        answer = {**request, "files": {"main.cpp": repaired}}
        cases.append(
            (
                task,
                label,
                "预测每一步状态与输出；运行、修改并解释边界。",
                request,
                answer,
                first,
                second,
            )
        )
    book.add(
        goal,
        title,
        "先画状态，再定位代码违背契约的位置并修复。",
        [theory],
        [
            "逐个列出操作前后的元素与链接。",
            "检查空结构与下标边界；不要把一次通过当成一般正确性。",
        ],
        [source],
        cases,
    )


add(
    1,
    1,
    "集合插入不能悄悄产生重复键",
    "抽象数据类型先约定操作行为，再选择表示。这里约定整数集合的插入幂等：已有键再次插入不改变成员数。顺序容器允许重复并不意味着集合接口可以违反契约。",
    "struct IntSet{ vector<int> values; void insert(int x){ values.push_back(x); } };",
    "IntSet s; s.insert(4); s.insert(n==1?4:7); cout<<s.values.size()<<'\\n';",
    "values.push_back(x);",
    "if(find(values.begin(),values.end(),x)==values.end()) values.push_back(x);",
    "2\n",
    "1\n",
    "2\n",
    "2\n",
    "改为两个不同键，检查正向路径",
)

add(
    1,
    2,
    "逻辑顺序不能由存储地址猜测",
    "同一逻辑序列可以用数组或链接表示。遍历链接必须沿 next，而非按节点声明顺序。节点在栈上创建只为演示链接，地址大小不表达元素先后。",
    "struct Node{int value; Node* next;};",
    "Node c{30,nullptr}; Node b{20,&c}; Node a{10,&b}; Node* p=n==1?&a:&c; while(p){cout<<p->value<<' '; p=nullptr;} cout<<'\\n';",
    "p=nullptr;",
    "p=p->next;",
    "10 \n",
    "10 20 30 \n",
    "30 \n",
    "30 \n",
    "从尾节点开始，检验终止条件",
)

add(
    1,
    3,
    "用真实比较次数区分最好与未命中路径",
    "渐近复杂度讨论随输入规模的增长。这里固定三个元素，仅计相等比较次数，不能把单次时间测量当复杂度证明；首位命中与完全未命中访问数量不同。",
    "",
    "vector<int> a{8,9,10}; int key=n==1?8:99; int count=0; for(int x:a){count=3; if(x==key)break;} cout<<count<<'\\n';",
    "count=3;",
    "++count;",
    "3\n",
    "1\n",
    "3\n",
    "3\n",
    "改为未命中，必须检查全部元素",
)

add(
    2,
    1,
    "顺序表插入要避免覆盖尚未搬移的元素",
    "连续存储中向中间插入时，从末尾向右搬移才能保留旧值。有效长度与容量分别管理；示例先检查容量，才允许写入新增位置。",
    "",
    "array<int,4> a{10,20,30,0}; int size=3; int pos=n==1?0:3; if(size==int(a.size()))return 0; for(int i=pos;i<size;++i)a[i+1]=a[i]; a[pos]=7; ++size; for(int i=0;i<size;++i)cout<<a[i]<<' '; cout<<'\\n';",
    "for(int i=pos;i<size;++i)a[i+1]=a[i];",
    "for(int i=size;i>pos;--i)a[i]=a[i-1];",
    "7 10 10 10 \n",
    "7 10 20 30 \n",
    "10 20 30 7 \n",
    "10 20 30 7 \n",
    "改为尾部插入，比较搬移次数",
)

add(
    2,
    2,
    "单链表头插保留原后继",
    "头插的新节点先指向旧头，再修改头指针。若只改头而丢弃旧链，本例不会出现非法内存访问，但逻辑序列已经被截断。空链表的旧头为 nullptr。",
    "struct Node{int value; Node* next;};",
    "Node b{20,nullptr}; Node a{10,&b}; Node* head=n==1?&a:nullptr; Node fresh{7,nullptr}; fresh.next=nullptr; head=&fresh; for(Node* p=head;p;p=p->next)cout<<p->value<<' '; cout<<'\\n';",
    "fresh.next=nullptr;",
    "fresh.next=head;",
    "7 \n",
    "7 10 20 \n",
    "7 \n",
    "7 \n",
    "对空链表插入，避免解引用空指针",
)

add(
    2,
    3,
    "双向链表两条方向的链接必须一致",
    "在 a 与 b 间插入节点 x 时，a.next、x.prev、x.next、b.prev 都须更新。正向遍历正确不等于反向遍历正确。这里不含循环链表，循环终止条件另需验证。",
    "struct Node{int value; Node* prev; Node* next;};",
    "Node a{10,nullptr,nullptr}; Node b{20,&a,nullptr}; a.next=&b; Node x{7,&a,&b}; a.next=&x; if(n==2)b.prev=&x; for(Node* p=&a;p;p=p->next)cout<<p->value<<' '; cout<<\"| \"; for(Node* p=&b;p;p=p->prev)cout<<p->value<<' '; cout<<'\\n';",
    "if(n==2)b.prev=&x;",
    "b.prev=&x;",
    "10 7 20 | 20 10 \n",
    "10 7 20 | 20 7 10 \n",
    "10 7 20 | 20 7 10 \n",
    "10 7 20 | 20 7 10 \n",
    "原程序已更新反向链接时，检验正向保持一致",
)

add(
    3,
    1,
    "栈的出栈顺序与空栈边界",
    "栈在同一端插入和删除，后进先出。pop 在本例先检查空栈，空栈返回 false 而不读取元素；删除第一项会使它变成先进先出的行为。",
    "struct Stack{vector<int> a; bool pop(int& x){if(a.empty())return false; x=a.front(); a.erase(a.begin()); return true;}};",
    "Stack s; if(n==1)s.a={10,20}; int x; while(s.pop(x))cout<<x<<' '; cout<<\"empty=\"<<s.a.empty()<<'\\n';",
    "x=a.front(); a.erase(a.begin());",
    "x=a.back(); a.pop_back();",
    "10 20 empty=1\n",
    "20 10 empty=1\n",
    "empty=1\n",
    "empty=1\n",
    "初始空栈，必须拒绝读取",
)

add(
    3,
    2,
    "循环队列在回绕后保持先进先出",
    "本例用 head、tail 与 count 区分空和满，容量为三。删除后空出的槽可再次入队；索引回绕必须对容量取模。本例只验证循环数组队列，链式队列需另行验证。",
    "struct Queue{array<int,3>a{}; int head=0,tail=0,count=0; bool push(int x){if(count==3)return false; a[tail]=x; tail=tail==2?1:tail+1; ++count; return true;} bool pop(int&x){if(count==0)return false; x=a[head]; head=(head+1)%3; --count; return true;}};",
    "Queue q; q.push(10); q.push(20); if(n==1){q.push(30); int discarded; q.pop(discarded); q.push(40);} int x; while(q.pop(x))cout<<x<<' '; cout<<\"empty=\"<<q.count<<'\\n';",
    "tail=tail==2?1:tail+1;",
    "tail=(tail+1)%3;",
    "40 30 10 empty=0\n",
    "20 30 40 empty=0\n",
    "10 20 empty=0\n",
    "10 20 empty=0\n",
    "不发生回绕的短队列，区分条件覆盖",
)

add(
    3,
    3,
    "括号数量相等仍可能配对错误",
    "括号匹配须记住尚未闭合的左括号类型和嵌套顺序。遇到右括号时检查非空并与栈顶类型对应；仅计数或仅弹栈会错误接受交叉闭合。这里只允许 () 与 []，其他字符按无效处理。",
    "bool matches(char l,char r){return (l=='('&&r==')')||(l=='['&&r==']');}",
    'string s=n==1?"([)]":"([])"; stack<char> st; bool ok=true; for(char c:s){if(c==\'(\'||c==\'[\')st.push(c); else{if(st.empty()){ok=false;break;} st.pop();}} cout<<(ok&&st.empty()?"valid":"invalid")<<\'\\n\';',
    "st.pop();",
    "if(!matches(st.top(),c)){ok=false;break;} st.pop();",
    "valid\n",
    "invalid\n",
    "valid\n",
    "valid\n",
    "合法嵌套，避免一律拒绝的错误修复",
)

if __name__ == "__main__":
    book.save("CS03-linear")
