# Depth Escalation Loop

这份文档只解决一件事：当用户说“还是浅”时，怎么判断该继续改写，还是该后退一层重建文章基础。

它是 workflow control，不是文风指南。

## 什么时候必须进入这条路

出现下面任一信号，就不要继续靠句子补强：

- 主命题还站不住，或者一句话说不清文章到底要读者接受什么判断
- 稿子的问题不在措辞，而在证据、理论、时代背景、样本边界或对象定义
- 同一批材料可以写成两篇完全不同的文章，说明视角还没锁定
- 用户说“浅”，指的是没打到更高一层，问题不在句子够不够狠
- agent 已经开始反复做局部润色，但正文的第一问题仍然没回答对

反过来，如果问题只是这些，就不要误入升级路径：

- AI 味重
- 句子拖
- 段首句无力
- 局部段落节奏不稳
- 用户已经给了明确的句子级改写

这些情况继续走 `S5_rewrite` 或 `S6_final_polish` 即可。

## 四步升级路径

### 1. 后退思考

先停写，先诊断“浅”到底浅在哪一层。

最少回答三个问题：

1. 这篇文章真正要成立的判断是什么
2. 现在缺的是哪一层：证据、理论、时代背景、样本边界，还是叙事视角
3. 当前草稿还能救，还是只能当研究笔记和素材堆

如果连第一问都答不出来，不要继续写正文，直接进入下一步。

### 2. 最强大脑调研

这里只补缺的那一层，不补“材料总量”。

常见补法：

- 缺证据：回到 `references/knowledge/EVIDENCE_ARCHITECTURE.md`
- 缺研究骨架：回到 `references/knowledge/RESEARCH_TEMPLATE.md`
- 缺 research-to-draft 压缩件：回到 `references/knowledge/RESEARCH_TO_DRAFT_HANDOFF_TEMPLATE.md`
- 缺样本和边界：先补样本口径、缺失项、反例
- 缺时代背景或更高问题：先补“为什么现在是这个问题”，再补正文

如果这轮升级要开 subagent team，默认按“课题”拆，不按“网页数量”拆。

如果当前 repo 已经有现成 research packet，优先先看它，再决定还缺什么。当前相关主题可直接从：

- `.bagakit/researcher/topics/frontier/qihan-writing-advanced-structure-techniques/index.md`

开始。

推荐拆法：

- `frontier practices`
  现在的一线实践到底怎么写、怎么定义问题、怎么给控制面
- `theory basis`
  哪个理论框架最能解释本文问题，例如控制论、工作流编排、分布式系统、经济学或制度设计
- `exemplar articles`
  哪些代表文章已经把这种结构写得很成熟
- `old answer / counterposition`
  旧答案到底解决了什么，现在又为什么不够

每条子线都要想清楚三件事：

- 要回答什么
- 不回答什么
- 第一性问题是什么

这一轮至少要拿回三样东西：

- 1 句更扎实的文章命题
- 3 到 5 个真正能支撑它的证据或代表 case
- 1 个明确边界：这篇文章不打算解决什么

最好再拿回两样压缩件：

- 1 份 `Depth Research Packet`
- 1 份 `Research To Draft Handoff`

如果这一轮之后仍然没有命题，只剩更多材料，就说明任务还在研究阶段，不在写作阶段。

### 3. 视角锁定

基础补完后，再进入叙事选择。

必读：

- `references/writing/NARRATIVE_ANGLE_SELECTION.md`
- `references/writing/NARRATIVE_ANGLE_REVIEW_HEURISTIC.md`

这里要锁定三件事：

- 标题承诺
- 读者的第一问题
- 证据怎么移动，哪些前置，哪些降级成例子或附录

如果还有两个强候选会改写标题承诺或 H2 顺序，先和用户确认，不要边写边赌。

### 4. 高质量补全

只有前面三步稳定后，才回到起草或重写。

这一步才调用文风和质检表面：

- `references/writing/VOICE.md`
- `references/writing/AI_SMELLS.md`
- `references/workflow/REWRITE_FEEDBACK_LOOP.md`
- `references/review/QA_HARD_METRICS.md`

规则很简单：

- 基础没补完前，不要用文风替代判断
- 视角没锁定前，不要靠加段落制造“内容变多了”的错觉
- 回到正文后，只补那些服务主命题的内容
- 回稿时把 `Research To Draft Handoff` 当成唯一 re-entry artifact，不要重复整理 route state，也不要重新翻完整 research packet

## 和洞察问答环的边界

`references/workflow/INSIGHT_INTERVIEW_LOOP.md` 适合“用户心里有更深判断，但还没完全说出来”。

这条升级路径适合“文章本身缺的是基础层”。

区分方法：

- 缺用户真实判断：先跑洞察问答环
- 缺证据、理论、时代背景、样本边界：先跑这条升级路径
- 两者都缺：先后退思考，先补基础，再决定是否需要问答环

## 强制停手条件

出现下面情况时，要明确告诉用户“这不是润色任务了”：

- 文章命题需要重写
- 主要证据还没找到
- 时代背景一补，正文重心就变了
- 现有草稿的大部分段落都在服务错误的第一问题

这时正确动作是把任务升级成“重建文章基础”。
