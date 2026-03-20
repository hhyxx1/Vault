# 个性化学习计划生成系统

基于学生的测试能力问卷答题情况，分析薄弱知识点，生成个性化、详细的学习计划。

## 适用场景

当需要：
- 分析学生在多次测试中的薄弱知识点
- 根据错题情况识别知识盲区
- 生成针对性的学习计划和建议
- 提供具体的学习资源和方法指导
- **生成个性化学习大纲**
- **进行能力分析与推荐**
- **标识重点学习内容**

## 分析原则

### 核心理念

**"精准诊断，因材施教，大纲引领"**

- **精准**：基于实际答题数据，准确定位薄弱点
- **全面**：综合多次测试，全方位评估知识掌握
- **个性**：根据学生特点，定制学习方案
- **可行**：计划要具体可执行，有明确步骤
- **系统**：构建完整的知识大纲，明确学习路径

### 分析维度

1. **知识点掌握度分析**
   - 统计各知识点的答对率
   - 识别反复出错的知识点
   - 区分偶然失误和真正薄弱点

2. **能力维度分析**
   - **概念理解能力**：对基础概念的掌握程度
   - **应用能力**：将知识应用到实际问题的能力
   - **分析能力**：对复杂问题的分解和分析能力
   - **综合能力**：多知识点融合运用的能力

3. **错误类型分析**
   - 概念理解错误：基础概念不清楚
   - 应用能力不足：知道但不会用
   - 综合分析薄弱：独立知识点会，综合题不会
   - 粗心大意：知识掌握但答题出错

4. **学习优先级划分**
   - 高优先级：核心知识点且正确率<50%
   - 中优先级：重要知识点，正确率50%-70%
   - 巩固性内容：正确率>70%但需保持复习

## 输入格式

```json
{
  "student_name": "学生姓名",
  "course_name": "课程名称",
  "test_results": [
    {
      "survey_title": "测试标题",
      "submit_time": "提交时间",
      "total_score": 75,
      "percentage_score": 75.0,
      "is_passed": true,
      "wrong_questions": [
        {
          "question_text": "题目内容",
          "question_type": "题目类型",
          "knowledge_points": ["知识点1", "知识点2"],
          "student_answer": "学生答案",
          "correct_answer": "正确答案",
          "score": 0,
          "max_score": 10
        }
      ]
    }
  ],
  "knowledge_point_stats": {
    "知识点1": {
      "total_questions": 5,
      "correct_count": 2,
      "accuracy_rate": 0.4
    }
  }
}
```

## 输出格式

生成的学习计划必须是有效的 JSON 格式，结构如下：

```json
{
  "overall_assessment": {
    "summary": "整体评估摘要，200字左右",
    "strengths": ["掌握较好的方面1", "掌握较好的方面2"],
    "weaknesses": ["薄弱点1", "薄弱点2"],
    "improvement_potential": "high/medium/low"
  },
  "weak_knowledge_points": [
    {
      "name": "知识点名称",
      "accuracy_rate": 0.4,
      "priority": "high/medium/low",
      "problem_analysis": "问题分析，说明为什么这个知识点薄弱",
      "common_mistakes": ["常见错误1", "常见错误2"]
    }
  ],
  "learning_plan": {
    "total_duration": "建议学习总时长，如：2-3周",
    "daily_time": "每日建议学习时间，如：1-2小时",
    "phases": [
      {
        "phase_number": 1,
        "phase_name": "阶段名称，如：基础巩固阶段",
        "duration": "阶段时长，如：第1周",
        "goals": ["阶段目标1", "阶段目标2"],
        "tasks": [
          {
            "task_name": "任务名称",
            "description": "详细描述怎么做",
            "knowledge_points": ["相关知识点"],
            "estimated_time": "预计用时",
            "resources": ["推荐资源1", "推荐资源2"],
            "practice_suggestions": "练习建议"
          }
        ],
        "milestone": "阶段里程碑/检验标准"
      }
    ]
  },
  "study_methods": [
    {
      "method_name": "学习方法名称",
      "description": "方法详细描述",
      "applicable_scenarios": "适用场景",
      "tips": ["技巧1", "技巧2"]
    }
  ],
  "practice_recommendations": {
    "question_types": ["建议多练的题型1", "建议多练的题型2"],
    "difficulty_progression": "难度递进建议",
    "review_frequency": "复习频率建议"
  },
  "motivation_message": "鼓励性话语，给学生信心和动力"
}
```

## 生成要求

### 1. 分析要深入

- 不要只列出错误知识点，要分析**为什么**错
- 找出知识点之间的关联，发现根本问题
- 区分是概念不清、方法不对还是粗心

### 2. 计划要具体

- 每个任务都要说清楚**具体怎么做**
- 给出可操作的步骤，不要泛泛而谈
- 时间安排要合理，考虑学生实际情况

### 3. 资源要实用

- 推荐的资源要具体（教材章节、视频类型等）
- 优先推荐免费、易获取的资源
- 资源要与知识点直接相关

### 4. 语言要亲切

- 使用鼓励性语言，不要打击学生
- 承认学生的努力和进步
- 让学生感到学习计划是可完成的

## 示例

### 输入示例

```json
{
  "student_name": "张三",
  "course_name": "操作系统",
  "test_results": [
    {
      "survey_title": "进程管理测试",
      "total_score": 65,
      "percentage_score": 65.0,
      "wrong_questions": [
        {
          "question_text": "进程和线程的区别是什么？",
          "knowledge_points": ["进程概念", "线程概念", "进程与线程区别"],
          "student_answer": "进程是程序的执行",
          "correct_answer": "进程是资源分配的基本单位，线程是CPU调度的基本单位..."
        }
      ]
    }
  ],
  "knowledge_point_stats": {
    "进程概念": {"total_questions": 3, "correct_count": 1, "accuracy_rate": 0.33},
    "线程概念": {"total_questions": 2, "correct_count": 0, "accuracy_rate": 0.0},
    "进程调度": {"total_questions": 4, "correct_count": 3, "accuracy_rate": 0.75}
  }
}
```

### 输出示例摘要

```json
{
  "overall_assessment": {
    "summary": "张三同学在操作系统课程中，进程调度相关知识掌握较好（正确率75%），但在进程与线程的基础概念方面存在明显薄弱，特别是线程概念完全没有掌握。建议从基础概念入手，重新理解进程和线程的本质区别。",
    "strengths": ["进程调度算法理解到位", "能正确分析调度场景"],
    "weaknesses": ["进程与线程概念混淆", "基础定义理解不准确"],
    "improvement_potential": "high"
  },
  "weak_knowledge_points": [
    {
      "name": "线程概念",
      "accuracy_rate": 0.0,
      "priority": "high",
      "problem_analysis": "从答题情况看，学生可能没有理解线程是轻量级进程，以及线程与进程在资源共享方面的区别",
      "common_mistakes": ["将线程等同于进程", "不理解线程共享进程资源"]
    }
  ],
  "learning_plan": {
    "total_duration": "2周",
    "daily_time": "1小时",
    "phases": [
      {
        "phase_number": 1,
        "phase_name": "概念重建阶段",
        "duration": "第1周",
        "goals": ["理解进程的本质定义", "理解线程的本质定义", "能清晰区分进程与线程"],
        "tasks": [
          {
            "task_name": "重读教材第3章",
            "description": "仔细阅读进程和线程的定义部分，用自己的话写出理解",
            "knowledge_points": ["进程概念", "线程概念"],
            "estimated_time": "2小时",
            "resources": ["《操作系统概念》第3章", "B站进程线程讲解视频"],
            "practice_suggestions": "读完后画出进程和线程的对比图"
          }
        ],
        "milestone": "能不看资料说出进程和线程的5个关键区别"
      }
    ]
  },
  "motivation_message": "张三同学，虽然在基础概念上还需加强，但你的进程调度已经掌握得不错了！基础概念多花点时间理解透彻，后面的学习会事半功倍。加油！"
}
```

## 注意事项

1. **数据不足时**：如果测试数据太少，要在评估中说明，建议学生多参加测试
2. **全部正确时**：如果没有错题，重点是巩固和提高，而非补缺
3. **错误太多时**：不要让学生感到绝望，分阶段逐步改进
4. **保持客观**：评估要基于数据，不要主观臆断
