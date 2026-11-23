# Game × Harness Research

关于 AI Agent Harness 与 AI 游戏的研究、实验和 Demo。

## 回答在这里

| 题目 | 回答 | 一句话 |
|---|---|---|
| 第 1 题：Harness 对比 | **[answers/q1-harness.md](answers/q1-harness.md)** | 同一个免费小模型换五个 harness：好的行为要靠结构保证，不能靠提示词 |
| 第 2 题：AI 原生 Mod | **[answers/q2-ai-native-mod.md](answers/q2-ai-native-mod.md)** · [Demo 视频](answers/media/q2/demo-心事邮差与AI解签.mp4) | 「心事邮差」：不给 NPC 装嘴，而是给玩家的现实生活开一个入口 |
| 第 3 题：传播策划 | **[answers/q3-vista-launch.md](answers/q3-vista-launch.md)** | VISTA 最响亮的那句"满分"，也是它最大的传播风险 |
| 第 4 题：内容范式 | **[answers/q4-content-patterns.md](answers/q4-content-patterns.md)** | 播放量会骗人，弹幕、收藏和转发不会 |

## 目录

```
├── answers/        四道题的回答；图片和视频在 answers/media/
├── blog/           基于这些回答写的 5 篇博客
└── experiments/    工具、脚本和跑出来的数据，按题目分
    ├── q1-harness-comparison/   实验设计、任务、运行器、验收测试、结果和事件流
    ├── q2-ai-native-mod/        开发日志、模型调用日志、批量测试
    ├── q3-vista-launch/         来源截图脚本
    └── q4-content-patterns/     B 站数据和各平台截图脚本
```

## 数据从哪里看

- 第 1 题：[实验设计](experiments/q1-harness-comparison/notes/experiment-design.md)、[全部结果和观察](experiments/q1-harness-comparison/notes/results.md)、[汇总表](experiments/q1-harness-comparison/results/runs.csv)
- 第 2 题：[开发日志](experiments/q2-ai-native-mod/notes/dev-log.md)
- 第 4 题：[B 站原始数据](experiments/q4-content-patterns/data/bili-stats.json)

第 1 题的 `runs/` 保留了每次运行的事件流和打分；各 harness 的本机状态、被改的代码副本和余晖站基线快照没有放进仓库，所以不能直接一键重跑。

## 博客

1. [同一个免费模型，换五个 harness](blog/01-同一个模型换五个harness.md)
2. [「心事邮差」开发笔记](blog/02-心事邮差开发笔记.md)
3. [游戏 Agent 缺的往往不是更强的模型](blog/03-游戏Agent真正缺的不是模型.md)
4. [VISTA 的"满分"](blog/04-VISTA的满分.md)
5. [播放量会骗人](blog/05-播放量会骗人.md)

## 相关项目

- 余晖站（在线试玩）：https://henryhuangsice.github.io/yuhui-station/（线上是基础版，暂不含「心事邮差」；AI 版需要本地后端，请看 [demo 视频](answers/media/q2/demo-心事邮差与AI解签.mp4)）
- 「心事邮差」代码：[ai-mod 分支](https://github.com/Henryhuangsice/yuhui-station/tree/ai-mod)
- 余晖站源码：https://github.com/Henryhuangsice/yuhui-station
