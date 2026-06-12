# Research To Draft Handoff Template

这份 handoff 只解决一个漂移问题：调研已经做完，但真正回到正文时，又重新把命题、边界、视角和证据顺序想了一遍。

## 什么时候用

当你已经跑完 `DEPTH_RESEARCH_PACKET_TEMPLATE.md`，准备从 research mode 回到 drafting mode 时使用。

它不是调研记录，也不是全文提纲。它是 depth escalation 之后唯一权威的 re-entry artifact，用来代替重新写一份 route memo。

如果需要更短的 route 视图，只能从这份 handoff 派生，不要再手写第二份 authority surface。可以用：

- `python3 scripts/qihan_route_tools.py derive-route <handoff.md>`

## 填写顺序

1. 先写 `promoted_claim`，确认真正升级后的命题是什么。
2. 再写 `chosen_viewpoint` 和 `title_promise`，把主视角和文章承诺钉住。
3. 然后写 `first_question`、`evidence_movement`、`chapter_movement`、`exit_move`，把 route 状态一次压实。
4. 最后写 `hard_boundary`、`evidence_pack`、`out_of_scope_now` 和 `return_gate_passed_because`，说明为什么现在可以回稿。

## 模板

```md
# Research To Draft Handoff

- draft_topic:
- promoted_claim:
- chosen_viewpoint:
- title_promise:
- first_question:
- evidence_movement:
- chapter_movement:
- exit_move:
- hard_boundary:
- evidence_pack:
- opening_move:
- first_section_job:
- evidence_frontload:
- out_of_scope_now:
- return_gate_passed_because:
```
