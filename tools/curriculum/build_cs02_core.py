"""Original Java21 bounded exercises; expected results precede actual execution."""

from pathlib import Path

from code_authoring import CodeBook

ROOT = Path(__file__).resolve().parents[2]
book = CodeBook(
    ROOT,
    "CS02-core-scope-0.1.0",
    "CS02-core-practice-0.1.0",
    "24 目标具备受限 Java 实践；设计解释、独立迁移、综合项目深度及整课验收未完成。",
    course="CS02",
    standard="code-fixed-condition-v1",
)

SOURCES = [
    (
        "jls21-classes",
        "Java21 类和对象",
        "https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html",
        "8.3.1.1,8.4,8.8",
    ),
    (
        "jls21-interfaces",
        "Java21 接口",
        "https://docs.oracle.com/javase/specs/jls/se21/html/jls-9.html",
        "9.1,9.4",
    ),
    (
        "jls21-resources",
        "Java21 异常与资源",
        "https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html",
        "14.20.3",
    ),
    (
        "java21-object",
        "Java21 Object 契约",
        "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html",
        "equals,hashCode",
    ),
    (
        "java21-collections",
        "Java21 集合",
        "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Collection.html",
        "集合约定",
    ),
    (
        "java21-files",
        "Java21 Files",
        "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/Files.html",
        "writeString,readString",
    ),
]
book.package["sources"] = [
    {
        "id": code,
        "title": title,
        "url": url,
        "locator": locator,
        "checked_at": "2026-10-10",
        "status": "authority_checked",
    }
    for code, title, url, locator in SOURCES
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
    inputs=("1", "2"),
    source="jls21-classes",
    variant="改变条件后复跑",
):
    goal = f"CS02-M{module:02d}-O{objective:02d}"
    initial = (
        "import java.util.*;\nimport java.io.*;\nimport java.nio.file.*;\npublic class Main {\n"
        + declarations
        + "\npublic static void main(String[] args) throws Exception {\nint n=Integer.parseInt(new Scanner(System.in).nextLine());\n"
        + body
        + "\n}\n}\n"
    )
    assert wrong in initial, goal
    repaired = initial.replace(wrong, right)
    cases = []
    for task, label, stdin, first, second in [
        ("base", title, inputs[0], before, after),
        ("changed-condition", variant, inputs[1], variant_before, variant_after),
    ]:
        request = {
            "language": "java21",
            "entry": "Main.java",
            "files": {"Main.java": initial},
            "stdin": stdin + "\n",
        }
        answer = {**request, "files": {"Main.java": repaired}}
        cases.append(
            (
                task,
                label,
                "先预测状态、调用和异常；修改后重跑并解释约束。",
                request,
                answer,
                first,
                second,
            )
        )
    book.add(
        goal,
        title,
        "先预测并运行错误作品，修改后比较真实输出；解释依据，再进入新条件。有限比较不证明设计合理或独立掌握。",
        [
            theory,
            "本任务业务约束是原创情境规则；必须说明为何修改满足约束，以及未测试的条件。",
        ],
        [
            "定位状态变化或依赖调用，先给出反例。",
            "把约束检查放在状态提交之前；接口使用按对象职责安排。",
        ],
        [source],
        cases,
    )


# M01: distinguish per-object fields, visibility, construction and mutation.
add(
    1,
    1,
    "两本书不能共用库存字段",
    "static 字段属于类，实例字段分别属于对象；创建多个对象不意味着 static 状态自动独立。",
    "static class Book { static int copies; Book(int x){copies=x;} }",
    'Book a=new Book(n); Book b=new Book(n+1); System.out.println(a.copies+" "+b.copies);',
    "static int copies",
    "int copies",
    "2 2\n",
    "1 2\n",
    "3 3\n",
    "2 3\n",
)
add(
    1,
    2,
    "封装库存并保留受控读取",
    "private 限制直接字段访问；受控方法和访问修饰符不是同一个问题，隐藏字段仍要验证修改方法。",
    "static class Book { public int copies; Book(int x){copies=x;} int available(){return copies;} }",
    'Book b=new Book(n); System.out.println("private="+java.lang.reflect.Modifier.isPrivate(Book.class.getDeclaredField("copies").getModifiers())+" available="+b.available());',
    "public int copies",
    "private int copies",
    "private=false available=1\n",
    "private=true available=1\n",
    "private=false available=2\n",
    "private=true available=2\n",
)
add(
    1,
    3,
    "负初值与重复归还不能破坏容量",
    "对象不变量需要构造器及全部修改路径共同维持；拒绝构造的对象不能被当作有效状态。",
    "static class Book {int count,capacity; Book(int n){capacity=n;count=n;} void giveBack(){if(count<capacity)count++;}}",
    'try {Book b=new Book(n);b.giveBack();b.giveBack();System.out.println("count="+b.count);} catch(IllegalArgumentException e){System.out.println("rejected");}',
    "capacity=n;count=n;",
    "if(n<0)throw new IllegalArgumentException();capacity=n;count=n;",
    "count=-1\n",
    "rejected\n",
    "count=2\n",
    "count=2\n",
    inputs=("-1", "2"),
    variant="容量已满时重复归还",
)

# M02: responsibility and composition are behavioural examples, not design grades.
add(
    2,
    1,
    "计费规则由注入的政策负责",
    "职责分配可通过可替换策略观察；类数量增加不是设计质量证据。这里不对开放设计作自动结论。",
    "interface Fee {int cents(int days);} static class Service {Fee fee;Service(Fee f){fee=f;}int charge(int d){return 1;}}",
    'Service s=new Service(days->days*2);System.out.println("fee="+s.charge(n));',
    "return 1;",
    "return fee.cents(d);",
    "fee=1\n",
    "fee=2\n",
    "fee=1\n",
    "fee=4\n",
    source="jls21-interfaces",
)
add(
    2,
    2,
    "组合服务必须使用同一仓库实例",
    "对象引用表达关联，业务服务持有仓库可表达组合；复制对象和引用同一对象的后续状态不同。",
    "static class Repo {int copies;Repo(int c){copies=c;}} static class Service {Repo repo;Service(Repo r){repo=new Repo(r.copies);}void borrow(){if(repo.copies>0)repo.copies--;}}",
    'Repo r=new Repo(n);Service s=new Service(r);s.borrow();System.out.println("repo="+r.copies);',
    "repo=new Repo(r.copies);",
    "repo=r;",
    "repo=1\n",
    "repo=0\n",
    "repo=2\n",
    "repo=1\n",
)
add(
    2,
    3,
    "替换仓库后业务不得绕过接口",
    "业务依赖仓库契约而不是创建固定实现；调用计数可以观察是否真正使用了注入对象，不能证明所有依赖都合理。",
    "interface Repo {int get();} static class Spy implements Repo {int calls;public int get(){calls++;return 7;}} static class Service {Repo r;Service(Repo r){this.r=r;}int available(){return 0;}}",
    'Spy spy=new Spy();Service s=new Service(spy);for(int i=0;i<n;i++)s.available();System.out.println("calls="+spy.calls);',
    "return 0;",
    "return r.get();",
    "calls=0\n",
    "calls=1\n",
    "calls=0\n",
    "calls=2\n",
    source="jls21-interfaces",
)

# M03: dispatch and client contracts.
add(
    3,
    1,
    "通过接口调用实际政策",
    "接口变量可引用不同实现，实例方法调用按实际对象分派；选择正确对象是业务逻辑的一部分。",
    "interface Policy {int days();} static class Standard implements Policy {public int days(){return 14;}} static class Limited implements Policy {int limit;Limited(int x){limit=x;}public int days(){return limit;}}",
    'Policy p=new Limited(n);System.out.println("days="+new Standard().days());',
    "new Standard().days()",
    "p.days()",
    "days=14\n",
    "days=1\n",
    "days=14\n",
    "days=2\n",
    source="jls21-interfaces",
)
add(
    3,
    2,
    "子类不能额外拒绝契约允许的零天",
    "替换原则是业务契约要求，不是 Java 编译器自动证明的性质。本任务接口允许 days>=0，实现不能缩小这个前提。",
    "interface Policy {int fee(int days);} static class Limited implements Policy {public int fee(int days){if(days<=0)throw new IllegalArgumentException();return days*2;}}",
    'Policy p=new Limited();try{System.out.println("fee="+p.fee(n));}catch(IllegalArgumentException e){System.out.println("rejected");}',
    "if(days<=0)",
    "if(days<0)",
    "rejected\n",
    "fee=0\n",
    "fee=6\n",
    "fee=6\n",
    inputs=("0", "3"),
    source="jls21-interfaces",
    variant="正天数回归",
)
add(
    3,
    3,
    "组合政策变化不需改业务服务",
    "继承表达类型关系，组合允许将变化放入持有对象；哪一种更合适要对照变化和契约，不能由出现 interface 自动评分。",
    "interface Policy {int days();} static class Loan {Policy p;Loan(Policy p){this.p=p;}int due(){return 14;}}",
    'Loan l=new Loan(()->n*3);System.out.println("due="+l.due());',
    "return 14;",
    "return p.days();",
    "due=14\n",
    "due=3\n",
    "due=14\n",
    "due=6\n",
    source="jls21-interfaces",
)

# M04: generic list behaviour, collection semantics, equals/hashCode.
add(
    4,
    1,
    "类型化容器不能用错误索引代替业务记录",
    "List<Book> 提供元素类型约束，但不会替程序选择正确元素；类型安全与业务正确性分别验证。",
    "record Book(int id) {}",
    'List<Book> books=List.of(new Book(7),new Book(8));System.out.println("id="+books.get(0).id());',
    "books.get(0)",
    "books.get(n)",
    "id=7\n",
    "id=8\n",
    "id=7\n",
    "id=7\n",
    inputs=("1", "0"),
    source="java21-collections",
    variant="首条记录回归",
)
add(
    4,
    2,
    "集合去重不等于列表计数",
    "List 可保留重复元素，Set 表达不重复语义；题目按 ISBN 值去重，不按插入次数计算图书种类。",
    "",
    'Collection<Integer> ids=new ArrayList<>();ids.add(n);ids.add(n);ids.add(n+1);System.out.println("unique="+ids.size());',
    "new ArrayList<>()",
    "new LinkedHashSet<>()",
    "unique=3\n",
    "unique=2\n",
    "unique=3\n",
    "unique=2\n",
    source="java21-collections",
)
add(
    4,
    3,
    "同 ISBN 对象必须满足相等与哈希契约",
    "equals 相等的对象必须具有相同 hashCode；同 hashCode 不要求 equals 相等。本任务使用不可变 ISBN，避免可变键导致检索语义变化。",
    "static class Book {final int isbn;Book(int n){isbn=n;}public int hashCode(){return isbn;}public boolean equals(Object other){return this==other;}}",
    'Set<Book> books=new HashSet<>();books.add(new Book(n));books.add(new Book(n));books.add(new Book(n+1));System.out.println("unique="+books.size());',
    "return this==other;",
    "return other instanceof Book b && isbn==b.isbn;",
    "unique=3\n",
    "unique=2\n",
    "unique=3\n",
    "unique=2\n",
    source="java21-object",
)

# M05: fail loudly, preserve state, actual AutoCloseable control flow.
add(
    5,
    1,
    "存储异常不能被报告成成功",
    "异常边界可以转译错误，但不可吞掉失败再返回成功。这里明确方法成功返回 false，调用者仍须安排重试策略。",
    "static boolean store(int n){try{throw new IOException();}catch(IOException e){return true;}}",
    'System.out.println("saved="+store(n));',
    "return true;",
    "return false;",
    "saved=true\n",
    "saved=false\n",
    "saved=true\n",
    "saved=false\n",
    source="jls21-resources",
)
add(
    5,
    2,
    "失败后仍保留旧库存",
    "先改变状态再执行可能失败的操作会破坏失败后的约定；本任务以可注入仓库异常观察提交顺序，不证明并发原子性。",
    "static class Book {int copies=2;void borrow(int n)throws IOException{copies--;if(n==1)throw new IOException();}}",
    'Book b=new Book();try{b.borrow(n);}catch(IOException e){}System.out.println("copies="+b.copies);',
    "copies--;if(n==1)throw new IOException();",
    "if(n==1)throw new IOException();copies--;",
    "copies=1\n",
    "copies=2\n",
    "copies=1\n",
    "copies=1\n",
    source="jls21-resources",
    variant="存储成功时提交",
)
add(
    5,
    3,
    "异常离开时资源也应关闭",
    "try-with-resources 对成功初始化的资源安排关闭；close 自身也可能失败。任务实际调用 AutoCloseable，未模拟真实网络连接。",
    "static class Resource implements AutoCloseable {boolean closed;public void close(){closed=true;}}",
    'Resource r=new Resource();try {if(n==1)throw new IOException();}catch(IOException e){}System.out.println("closed="+r.closed);',
    "try {if(n==1)",
    "try(r) {if(n==1)",
    "closed=false\n",
    "closed=true\n",
    "closed=false\n",
    "closed=true\n",
    source="jls21-resources",
    variant="正常离开也关闭",
)

# M06: explicit lifecycle and observer choices, no pattern-name scoring.
add(
    6,
    1,
    "取消订阅解除对象关联",
    "取消订阅是本任务显式生命周期协议，不等于保证对象被垃圾回收。引用关系和业务事件订阅要分别观察。",
    "static class Bus {Set<Integer> subscribers=new LinkedHashSet<>();void remove(int id){subscribers.add(id);}}",
    'Bus b=new Bus();b.subscribers.add(n);b.remove(n);System.out.println("subscribers="+b.subscribers.size());',
    "subscribers.add(id);",
    "subscribers.remove(id);",
    "subscribers=1\n",
    "subscribers=0\n",
    "subscribers=1\n",
    "subscribers=0\n",
    source="java21-collections",
)
add(
    6,
    2,
    "重复注册不得重复通知",
    "观察者的重复订阅政策由业务约定决定。本任务按同一对象去重；不同对象即使行为相似也可能是不同订阅者。",
    "static class Bus {Collection<Runnable> listeners=new ArrayList<>();void publish(){for(Runnable r:listeners)r.run();}}",
    'Bus b=new Bus();int[] count={0};Runnable listener=()->count[0]++;for(int i=0;i<n+1;i++)b.listeners.add(listener);b.publish();System.out.println("notified="+count[0]);',
    "new ArrayList<>()",
    "new LinkedHashSet<>()",
    "notified=2\n",
    "notified=1\n",
    "notified=3\n",
    "notified=1\n",
    source="java21-collections",
)
add(
    6,
    3,
    "按约定隔离观察者失败",
    "本任务选择尽力通知其他订阅者，并单独统计错误；传播异常或隔离异常都是可能的设计，必须明确业务要求，不靠模式名判好坏。",
    "static class Bus {List<Runnable> listeners=new ArrayList<>();int errors;void publish(){try{for(Runnable r:listeners)r.run();}catch(IllegalStateException e){errors++;}}}",
    'Bus b=new Bus();int[] count={0};b.listeners.add(()->{throw new IllegalStateException();});for(int i=0;i<n;i++)b.listeners.add(()->count[0]++);b.publish();System.out.println("notified="+count[0]+" errors="+b.errors);',
    "try{for(Runnable r:listeners)r.run();}catch(IllegalStateException e){errors++;}",
    "for(Runnable r:listeners){try{r.run();}catch(IllegalStateException e){errors++;}}",
    "notified=0 errors=1\n",
    "notified=1 errors=1\n",
    "notified=0 errors=1\n",
    "notified=2 errors=1\n",
    source="jls21-resources",
)

# M07: original bounded record codec, injected dependency, actual file round trip.
add(
    7,
    1,
    "对象记录往返不能丢失库存",
    "序列化格式须明确版本与字段含义；本单元使用原创两字段文本协议，不冒充 JSON 解析器。JSON 缺失和未知字段仍须后续独立任务。",
    'record Book(int id,int copies) {} static String encode(Book b){return b.id()+",0";}static Book decode(String s){String[] p=s.split(",");return new Book(Integer.parseInt(p[0]),Integer.parseInt(p[1]));}',
    'Book b=decode(encode(new Book(7,n)));System.out.println("id="+b.id()+" copies="+b.copies());',
    'return b.id()+",0";',
    'return b.id()+","+b.copies();',
    "id=7 copies=0\n",
    "id=7 copies=1\n",
    "id=7 copies=0\n",
    "id=7 copies=2\n",
)
add(
    7,
    2,
    "仓库替身与真实实现应遵守同一接口",
    "替身可以核验业务调用，但不能证明真实文件或数据库工作。本任务确认相同业务逻辑读取两种实现，而非用模拟通过替代集成证据。",
    "interface Repo {int load();} static class Service {Repo r;Service(Repo r){this.r=r;}int available(){return 7;}}",
    'Service first=new Service(()->n);Service second=new Service(()->n+1);System.out.println(first.available()+" "+second.available());',
    "return 7;",
    "return r.load();",
    "7 7\n",
    "1 2\n",
    "7 7\n",
    "2 3\n",
    source="jls21-interfaces",
)
add(
    7,
    3,
    "集成测试要真正保存并读取文件",
    "Files.writeString 和 readString 在当前隔离文件系统执行；关闭作业后文件清理，不能由一次往返推断跨作业恢复或崩溃安全。",
    "",
    'Path p=Path.of("/box/tmp/book.txt");Files.writeString(p,"7,0");String loaded=Files.readString(p);System.out.println("loaded="+loaded);',
    'Files.writeString(p,"7,0")',
    'Files.writeString(p,"7,"+n)',
    "loaded=7,0\n",
    "loaded=7,1\n",
    "loaded=7,0\n",
    "loaded=7,2\n",
    source="java21-files",
)

# M08: genuine policy injection, regression, and a small borrowing/reservation model.
add(
    8,
    1,
    "新增借阅政策不得写死角色分支",
    "变化影响分析应寻找稳定契约与可变政策；固定输入的调用测试只能观察这一处依赖，不自动验证整个设计。",
    "interface Limit {int copies();}static class Library {Limit limit;Library(Limit l){limit=l;}boolean canBorrow(int held){return held<1;}}",
    'Library library=new Library(()->3);System.out.println("allowed="+library.canBorrow(n));',
    "return held<1;",
    "return held<limit.copies();",
    "allowed=false\n",
    "allowed=true\n",
    "allowed=false\n",
    "allowed=true\n",
    source="jls21-interfaces",
)
add(
    8,
    2,
    "重构后复跑零库存与普通借阅",
    "重构要求既有可观察行为保持，新增结构不能替代回归。至少区分成功路径与零库存拒绝的状态副作用。",
    "static class Book {int copies;Book(int n){copies=n;}boolean borrow(){copies--;return copies>=0;}}",
    'Book b=new Book(n);boolean accepted=b.borrow();System.out.println("accepted="+accepted+" copies="+b.copies);',
    "copies--;return copies>=0;",
    "if(copies==0)return false;copies--;return true;",
    "accepted=false copies=-1\n",
    "accepted=false copies=0\n",
    "accepted=true copies=1\n",
    "accepted=true copies=1\n",
    inputs=("0", "2"),
    variant="原成功路径回归",
)
add(
    8,
    3,
    "借阅与预约使用一致的库存约束",
    "本任务预约是受限需求：借阅失败才可登记预约，归还后优先交给预约者。测试模型未涉及并发、真实用户权限或持久化。",
    "static class Library {int copies;Queue<Integer> waiting=new ArrayDeque<>();Library(int c){copies=c;}void reserve(int user){waiting.add(user);}int giveBack(){copies++;return waiting.isEmpty()?-1:waiting.remove();}}",
    'Library l=new Library(0);l.reserve(n);int assigned=l.giveBack();System.out.println("assigned="+assigned+" available="+l.copies);',
    "copies++;return waiting.isEmpty()?-1:waiting.remove();",
    "if(waiting.isEmpty()){copies++;return -1;}return waiting.remove();",
    "assigned=1 available=1\n",
    "assigned=1 available=0\n",
    "assigned=2 available=1\n",
    "assigned=2 available=0\n",
    source="java21-collections",
)

if __name__ == "__main__":
    edges = [
        ("M01-O01", "M02-O02", "conceptual_association", "jls21-classes", "8.3", "区分实例状态用于识别组合服务是否引用同一仓库。"),
        ("M01-O02", "M01-O03", "conceptual_association", "jls21-classes", "8.3,8.8", "字段可见性与构造及修改方法共同约束对象状态。"),
        ("M01-O03", "M05-O02", "application", "jls21-classes", "8.8", "对象不变量用于检查存储失败后是否保留有效状态。"),
        ("M02-O01", "M02-O03", "conceptual_association", "jls21-interfaces", "9.1", "职责分离与仓库接口方向共同决定可替换边界。"),
        ("M02-O02", "M03-O03", "application", "jls21-classes", "8.3", "持有策略对象是比较组合和继承的具体工件。"),
        ("M02-O03", "M07-O02", "application", "jls21-interfaces", "9.1", "仓库接口用于注入替身并检验业务调用。"),
        ("M03-O01", "M06-O02", "application", "jls21-interfaces", "9.4", "接口分派用于调用不同通知实现。"),
        ("M03-O02", "M08-O03", "application", "jls21-interfaces", "9.1", "统一借阅契约用于复核新增预约行为是否破坏旧约束。"),
        ("M03-O03", "M08-O01", "application", "jls21-interfaces", "9.1", "可替换政策用于避免新增角色时修改固定业务分支。"),
        ("M04-O01", "M04-O02", "conceptual_association", "java21-collections", "Collection", "元素类型安全与集合重复语义是不同条件。"),
        ("M04-O02", "M06-O02", "application", "java21-collections", "Collection", "集合去重用于实现本任务的重复订阅政策。"),
        ("M04-O03", "M04-O02", "application", "java21-object", "equals,hashCode", "相等与哈希契约用于按 ISBN 而非实例去重。"),
        ("M05-O01", "M05-O03", "conceptual_association", "jls21-resources", "14.20.3", "异常传播与资源关闭分别需要可观察证据。"),
        ("M05-O02", "M07-O01", "application", "jls21-classes", "8.4", "状态提交约定用于检查记录解码失败时保留旧对象。"),
        ("M05-O03", "M07-O03", "application", "java21-files", "writeString,readString", "真实文件往返需要核对资源和错误边界。"),
        ("M06-O01", "M06-O03", "conceptual_association", "java21-collections", "Collection", "订阅生命周期与通知失败政策共同构成观察者取舍。"),
        ("M06-O02", "M06-O03", "application", "jls21-resources", "14.20", "通知循环用于暴露单观察者异常影响其他通知的反例。"),
        ("M07-O01", "M07-O03", "application", "java21-files", "writeString,readString", "对象记录转换用于实际持久化往返集成测试。"),
        ("M07-O02", "M08-O01", "application", "jls21-interfaces", "9.1", "依赖替换用于观察变更是否越过稳定边界。"),
        ("M07-O03", "M08-O02", "application", "java21-files", "readString", "实际运行回归用于检测重构后的可观察行为变化。"),
        ("M08-O02", "M08-O03", "application", "jls21-classes", "8.4", "原借阅回归用于复核预约交付后的库存约束。"),
    ]
    for start, end, kind, source, locator, reason in edges:
        book.package["relations"].append({
            "from": "CS02-" + start, "to": "CS02-" + end, "kind": kind,
            "reason": reason, "source_locator": source + ":" + locator,
            "course_version_id": book.version, "review_state": "authority_checked",
            "source": f"原创任务关联：{reason} 语言机制见 {source} §{locator}；专业审校不可用。",
        })
    book.save("CS02-core")
