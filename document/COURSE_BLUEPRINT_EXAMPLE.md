# 课程内容包格式样例：数据结构中的栈

本文件是 [课程内容规范](COURSE_CONTENT_SPEC.md) 的**单元级格式样例**，不是一门完整课程蓝图，不代表项目发起人选定了实测课程，也不能用来声称 CS03 或第一阶段课程验收通过。

内容来源状态：栈及匹配括号是格式设计的演示对象；下列开放教材用于定位概念出处，不代表本课程教学内容已完成审校。发布前须补独立教研审阅和实际检查器记录。当前可以验证的是字段结构与内部活动—证据映射。

```yaml
schema_version: "1.0"
course:
  course_id: CS03
  title: 数据结构
  blueprint_version: CS03-example-0.1.0
  status: draft
  declared_scope:
    - unit: 栈的线性访问规则与典型应用
      depth: 用状态追踪和程序产物展示
      limitations: 不是 CS03 全课程内容
  core_objectives: [CS03-STACK-01, CS03-STACK-02]
  elective_objectives: []
  prerequisites:
    - CS01-CONDITIONALS
    - CS01-SEQUENCES
  references:
    - id: REF-CS03-STACK-01
      title: "OpenDSA, CS3 Data Structures & Algorithms, 5.8 Stacks"
      url: https://opendsa-server.cs.vt.edu/ODSA/Books/umw/cpsc340/fall-2024/CPSC340_F24/html/StackArray.html
      locator: "栈的 ADT 与 LIFO 行为；只作概念出处，不复制原文"
      accessed: 2026-10-03
      source_review_state: located
      license_review_state: pending
      usage: citation_only_no_source_text_reproduced
      curriculum_review_state: pending
    - id: REF-CS03-STACK-02
      title: "OpenDSA, CSE 396, 7.1 Pushdown Automata"
      url: https://opendsa-server.cs.vt.edu/ODSA/Books/ub/cse396/fall-2025/CSE_396_-_Fall25/html/PDA.html
      locator: "栈用于括号匹配的过程背景；只作概念出处，不复制原文"
      accessed: 2026-10-03
      source_review_state: located
      license_review_state: pending
      usage: citation_only_no_source_text_reproduced
      curriculum_review_state: pending
  reviewers: []
  chapters:
    - node_id: CS03-CH-LINEAR-STRUCTURES
      node_type: chapter
      title: 线性结构
      children:
        - node_id: CS03-UNIT-STACK
          node_type: unit
          title: 栈及括号匹配
          objective_ids: [CS03-STACK-01, CS03-STACK-02]

objectives:
  - objective_id: CS03-STACK-01
    version: 1
    statement: 给定操作序列，解释并推演栈的后进先出行为和栈状态。
    necessary_criteria:
      - 能逐项说明入栈、出栈及操作后栈顶状态
      - 能正确处理空栈出栈的题目约定，并指出约定
      - 能用后进先出解释最后输出顺序
    evidence_dimensions: [state_trace, explanation, boundary_condition]
    relations: []
  - objective_id: CS03-STACK-02
    version: 1
    statement: 对活动约定的括号种类与输入规模，设计、实现并解释括号匹配方法。
    necessary_criteria:
      - 所有闭括号需匹配最近尚未闭合的同种左括号
      - 拒绝多余闭括号、不匹配闭括号和结束时残留左括号
      - 说明本活动限定输入及空输入行为
    evidence_dimensions: [algorithm_reasoning, executable_artifact, boundary_tests, independent_explanation]
    relations:
      - type: prerequisite
        target: CS03-STACK-01
        source: curriculum_review_pending

activities:
  - activity_id: CS03-STACK-01-TRACE
    objective_ids: [CS03-STACK-01]
    problem: 预测括号流的状态，找出第一个出错输入。
    necessary_theory:
      - 活动开始前说明序列、栈顶和入栈／出栈约定。
    student_actions:
      - 在状态表逐步记录操作、栈内元素和当前栈顶。
      - 亲自判断多余出栈和输入结束时仍有元素的情况。
      - 解释为何最近尚未匹配的左括号应先处理。
    artifact: state_trace_with_explanation
    modes: [practice, checkpoint]
    verification:
      method: fixed_reviewed_trace_cases
      necessary_criteria: [operation_trace_correct, edge_case_reasoned]
      checker_status: pending
    help:
      levels: [visual_model, partial_trace, full_answer_on_student_request]
      record_disclosure: true
    next: CS03-STACK-02-IMPLEMENT

  - activity_id: CS03-STACK-02-IMPLEMENT
    objective_ids: [CS03-STACK-02]
    problem: 为限定输入编写匹配检查程序并解释栈的作用。
    student_actions:
      - 先预测一个嵌套输入的栈变化。
      - 实现或修改自己的匹配逻辑。
      - 自行补充边界输入，并解释每项处理。
    artifact: versioned_source_and_explanation
    environment:
      adapter: isolated_code_runner
      language: selected_runtime_from_tested_matrix
      runtime_version: recorded_per_actual_run
    tests:
      - id: normal-empty-pairs
        input: ""
        expected: true
        review_state: pending
      - id: balanced-nested
        input: "([])"
        expected: true
        review_state: pending
      - id: extra-closing
        input: ")"
        expected: false
        review_state: pending
      - id: leftover-opening
        input: "(()"
        expected: false
        review_state: pending
      - id: mismatched-kind
        input: "([)]"
        expected: false
        review_state: pending
    verification:
      separate_axes:
        - executable_result
        - reviewed_test_results
        - necessary_explanation
        - independent_new_variant
      criterion_status: draft_requires_human_review
    failure_routes:
      - compile_or_environment_failure: retain_unknown_and_show_actual_tool_status
      - insufficient_edge_handling: show_failing_input_then_offer_partial_hint
      - correct_output_without_explanation: record_artifact_result_without_marking_all_criteria_met
    help:
      levels: [concept_question, state_trace, targeted_hint, worked_example, full_answer]
      answers_follow_task_source_policy: true
      disclosure_is_evidence_of_help: true
    recovery:
      save: [source_revision, input_set_version, output, explanation, help_events]
      if_runtime_not_resumable: restore_source_then_rerun_and_reverify
    next:
      if_all_necessary_criteria_met: offer_application_in_new_input_conditions
      if_criteria_missing: return_to_theory_or_revision_with_actual_failure
      if_evidence_disputed: hold_for_independent_review_and_allow_other_learning
```

## 本样例的格式自检

- 组织节点仅引用两个唯一目标；不会再次作为分母目标。
- 栈状态追踪先于括号应用；先修关系的课程专家审阅状态仍待确认。
- 每项活动标有学生实际动作、作品、核验、帮助、工具失败和下一步。
- 代码测试列出空串、嵌套、额外闭括号、残留左括号和类型不匹配；预期结果尚待独立运行与审核，因此不能发布或视为课程验收证据。
- 实际语言、编译器／解释器和退出状态必须由部署的环境矩阵给出，样例不虚构版本和结果。
