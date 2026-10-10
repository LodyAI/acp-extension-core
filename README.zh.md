# ACP Extension Core

Lody 各项扩展的提供方无关契约，构建在 [Agent Client Protocol](https://agentclientprotocol.com/) v1 之上。

Lody 需要对接多种 agent 运行时，而它们各自使用不同的原生协议。ACP 覆盖了共同的核心部分，但子代理执行的流式事件、持久目标、token 记账、速率限制等能力，需要一份稳定、共享的描述，客户端才能真正依赖它们。本仓库提供的就是这份描述：适配器把某个提供方的数据翻译成这里的类型，任何协商到对应能力的客户端都能以同样的方式读取结果，无需关心背后是哪个运行时。

扩展通过协商启用，而不是默认存在。Agent 在 `InitializeResponse.agentCapabilities._meta.lody` 上声明自己实现的能力，客户端在 `InitializeRequest.clientCapabilities._meta.lody` 上声明自己支持的能力。每个键都带各自的 `{ "version": 1 }`；缺少某个键就表示对方不支持该项能力。客户端根据协商结果分支，而不是根据连接背后的提供方分支。

[English](README.md)

## 参考实现

截至 2026-10-01，[github.com/LodyAI](https://github.com/LodyAI) 下公开的 `acp-extension-*` 仓库如下。本仓库是共享契约，其余八个是提供方适配器：它们使用 ACP v1，并把自己的提供方映射到上述契约。

| 仓库 | 覆盖范围 |
| --- | --- |
| [acp-extension-core](https://github.com/LodyAI/acp-extension-core) | 共享的 v1 类型、能力标志与 `_lody/` 方法。即本仓库。 |
| [acp-extension-claude](https://github.com/LodyAI/acp-extension-claude) | Claude Agent SDK 的 ACP agent，包含 Lody 子代理事件。 |
| [acp-extension-codex](https://github.com/LodyAI/acp-extension-codex) | Codex CLI / App Server 的 ACP 服务，包含 fork、steer 与 goal。 |
| [acp-extension-devin](https://github.com/LodyAI/acp-extension-devin) | Devin 原生 `devin acp` 之前的代理，把 Devin 私有的子代理流量翻译为 Core 事件。 |
| [acp-extension-dsh](https://github.com/LodyAI/acp-extension-dsh) | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 ACP 会话控制：模型、权限、子代理与压缩。 |
| [acp-extension-grok](https://github.com/LodyAI/acp-extension-grok) | 官方 Grok 运行时的 ACP 兼容适配器，包含定时任务与子代理事件。 |
| [acp-extension-kimi](https://github.com/LodyAI/acp-extension-kimi) | 为 Lody 打包的 Kimi Code CLI。 |
| [acp-extension-omp](https://github.com/LodyAI/acp-extension-omp) | Lody 的 Oh My Pi 适配器。 |
| [acp-extension-pi](https://github.com/LodyAI/acp-extension-pi) | 针对固定版本官方 Pi CLI（`--mode rpc`）的 ACP 适配器。 |

## 目录

- [参考实现](#参考实现)
- [设计原则](#设计原则)
- [开始使用](#开始使用)
- [扩展如何协商](#扩展如何协商)
- [能力一览](#能力一览)
- [自定义 `_lody/` 方法](#自定义-_lody-方法)
- [标准 ACP 消息上的元数据](#标准-acp-消息上的元数据)
- [共同约定](#共同约定)
- [许可证](#许可证)

## 设计原则

契约遵循三条放置规则，按优先级排列：

1. **优先使用标准 ACP。** `session/fork`、`elicitation/create`、`usage_update` 以及普通的 `tool_call` / `tool_call_update` 生命周期本身已经承载了一部分行为，能复用就复用。
2. **把 Lody 语义挂在标准消息上。** ACP 没有对应字段的内容，放到承载该行为的消息的 `_meta.lody.<feature>` 下。
3. **只有 ACP 确实没有对应方法时，才新增 `_lody/` 方法。** 这个 JSON-RPC 命名空间只用于没有标准对应物的请求和通知。

每项能力独立版本化。某一项能力上的 `{ "version": 1 }` 绝不代表其他能力也受支持。

## 开始使用

```bash
npm install acp-extension-core
```

这个包以 TypeScript 类型为主：能力结构、请求与通知映射，以及定义契约的元数据接口。它依赖 [`@agentclientprotocol/sdk`](https://www.npmjs.com/package/@agentclientprotocol/sdk) 提供 ACP 线路类型，同时也提供少量运行时辅助：

- `SessionUsageAccumulator`：把重复上报的用量快照合并为按模型累计的总量，并给出每次更新的增量。
- `LodySubagentEmitter`：把原生子代理执行映射为不透明的运行 id，并按顺序发送 `_lody/subagents/event` 消息。
- `createPlanModeConfigOption`：构造标准的 `plan_mode` ACP 配置项。
- `isLodySubagentEvent`、`isLodySubagentSnapshot`、`isLodySubagentOutput`：在消息边界做校验的运行时守卫。
- `supportsLodySubagentEvents`：从 ACP 能力对象中读取协商后的 `subagentEvents` 标志。

典型用法是先确认协商结果，再按导出的方法名分发，并在边界处校验：

```ts
import {
  LODY_EXTENSION_METHODS,
  isLodySubagentEvent,
  supportsLodySubagentEvents,
} from 'acp-extension-core';

if (supportsLodySubagentEvents(agentCapabilities)) {
  onNotification(LODY_EXTENSION_METHODS.subagentEvent, (payload) => {
    if (!isLodySubagentEvent(payload)) return;
    // payload.runId 不透明；payload 承载 snapshot、progress 或 output。
  });
}
```

在本地开发这个包：

```bash
npm install
npm run build      # 生成 dist/
npm run typecheck  # 只做类型检查
npm test           # 先构建，再运行契约测试
```

## 扩展如何协商

协商以能力为单位，部分能力需要双向确认。

- **Agent** 在 `InitializeResponse.agentCapabilities._meta.lody` 上声明自己实现的全部能力。
- **客户端** 在 `InitializeRequest.clientCapabilities._meta.lody` 上声明自己支持的能力。
- 每个键对应一个至少包含 `{ "version": 1 }` 的对象。缺少某个键表示对方不支持该能力；支持某一项也不代表支持其他项。
- 需要双向的能力（例如 `subagentEvents`）只有在双方都声明后才生效。仅属于 Agent 的能力在 Agent 声明后即可使用。

如果 ACP 已经提供合适的消息，扩展就挂在标准消息上，不再新增方法。只有 ACP 没有等价的请求或通知时，契约才定义 `_lody/...` 方法。

## 能力一览

### Agent 能力（`LodyExtensionCapabilities`）

| 能力 | v1 额外提供的内容 |
| --- | --- |
| `subagentEvents` | **双方**都声明后，Agent 通过 [`_lody/subagents/event`](#自定义-_lody-方法) 推送子代理运行的快照、进度和输出。运行 id 不透明，绝不复用原生线程 id；观测丢失时，运行状态变为 `unknown`，并带上 `outputIncomplete: true`。`LodySubagentEmitter` 是可选的适配器辅助，覆盖一个根会话。 |
| `sessionTitle` | 自动标题由适配器负责，通过带 `_meta.lody.titleSource` 的标准 ACP `session_info_update` 推送，不新增请求方法。`generated` 和 `explicit` 是可信的标题来源，`fallback` 和 `unset` 不是。用户自己设置的标题始终保留。 |
| `usage` | 上下文与 token 记账。优先使用标准 ACP `usage_update`。累计总量在 `modelUsage`；`delta` 表示新增的记账部分，并且已经包含在该总量中。可选的 `_meta.lody.usageScopeId` 让 `modelUsage` 只在对应作用域内累计，适配器重启后可以开启新作用域。费用缺失表示未知，而不是零。 |
| `rateLimits` | 通过 [`_lody/rate_limits/update`](#自定义-_lody-方法) 推送额度快照。当 `query: true` 时，Agent 同时接受 [`_lody/rate_limits/get`](#自定义-_lody-方法)。`windows` 是当前完整列表；`label` 只用于展示，时长相同的窗口仍是相互独立的额度。 |
| `forkAtTurn` | `session/fork` 可以携带 `_meta.lody.forkAtTurn`（`{ version: 1, turnId? }`），指明从哪一轮分叉。 |
| `steering` | 向进行中的轮次注入指引。Agent 声明 `transport`（`request` 走 [`_lody/session/steer`](#自定义-_lody-方法)，`prompt` 走 `_meta.lody.steer`）、`upstreamTurn`（`same` 或 `handoff`）和 `configPolicy`（`active` 或 `apply`）。结果是 `injected` 或 `failed`，由 [`_lody/session/steer_applied`](#自定义-_lody-方法) 确认对应 id。 |
| `tasks` | 后台任务（`background: true`）和定时任务（`scheduled: true`）。生命周期沿用普通的 `tool_call` / `tool_call_update`，并带 `_meta.lody.task`（`kind` 为 `background` 或 `scheduled`）。 |
| `subagents` | 子代理生命周期沿用同一套工具调用消息（`kind: "subagent"`），与 `subagentEvents` 相互独立。`list`、`cancel`、`output` 各自开启一个查询方法。只有当前运行声明了对应能力时，界面才应显示相应控件。 |
| `goal` | 持久的会话目标，而不是一条 prompt。`actions` 列出 Agent 实现的全部动作。`controlActions` 是 prompt 进行期间可经 [`_lody/session/goal`](#自定义-_lody-方法) 接受的动作，它们不会开启新轮次。`promptActions` 随 `session/prompt` 的 `_meta.lody.goalControl` 传递；`set` 和 `resume` 会开始工作，因此必须走这条通道，由此产生的轮次才归属于客户端自己的 prompt。传输方式请以这两份列表为准，不能只看 `actions`。 |
| `compaction` | 上下文压缩与重试，以工具调用生命周期上报，并带 `_meta.lody.activity`（`kind` 为 `context_compaction` 或 `retry`）。 |
| `sessionHistory` | 接受针对单个会话的 [`_lody/session/history/read`](#自定义-_lody-方法)。响应体为空。 |
| `sessionConfig` | 新建、加载、恢复、分叉时的客户端启动元数据：`{ version: 1, modelId?, configOptionValues }`。支持的选择在原生会话建立前应用；省略时保留原生默认行为。显式模型选择优先于模型选项。 |
| `worktreeProject` | 在 `session/new`、`session/load`、`session/resume`、`session/fork` 上，`_meta.lody.worktreeProject` 指明原始项目根（`originProjectPath`）。ACP `cwd` 仍然是实际执行目录。省略该字段则保持提供方原有的项目归属不变。 |
| `mcpApps` | **双方**都声明后，若工具声明了 `ui://` [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) 资源，其 `tool_call` 会携带 `_meta.lody.mcpApp`（`LodyMcpAppToolCallMeta`）。MCP 连接始终由 Agent 持有：客户端通过 [`_lody/mcp_apps/load`](#自定义-_lody-方法) 获取原始调用的输入与结果，并通过 [`_lody/mcp_apps/resource/read`](#自定义-_lody-方法) 和 [`_lody/mcp_apps/tool/call`](#自定义-_lody-方法) 代理视图的 `resources/read` 与 `tools/call`。每个请求都以 `toolCallId` 限定在原始服务器上；对于 `_meta.ui.visibility` 不包含 `"app"` 的工具，Agent 拒绝来自视图的调用。 |

### 客户端能力（`LodyClientExtensionCapabilities`）

| 能力 | v1 额外提供的内容 |
| --- | --- |
| `subagentEvents` | 客户端可以接收 [`_lody/subagents/event`](#自定义-_lody-方法)。必须与 Agent 侧的声明同时存在。 |
| `elicitation` | 客户端在标准 `elicitation/create` 上保留 Lody 字段。`answerNotes: true` 表示用户选中的选项和单独的附注在编辑、提交和只读展示中都会保留。`noteFor` 是附加说明；`customAnswerFor` 会替换所引用的答案。二者不同时使用。 |
| `mcpApps` | 客户端可以承载 MCP Apps 视图。只有声明了它，Agent 才会发出 `_meta.lody.mcpApp`。必须与 Agent 侧的声明同时存在。 |

### 标准 ACP 配置

这一项使用固定 id，不需要单独的能力标志。

| Id | v1 额外提供的内容 |
| --- | --- |
| `plan_mode` | 由 `createPlanModeConfigOption` 创建、通过 `session/set_config_option` 设置的布尔选项。只对支持独立规划的会话声明。沙箱和审批策略保持原样。 |

### 稳定工具 id

`LODY_TOOL_NAMES` 定义了 Lody 特殊处理的一批工具流程的稳定身份。适配器把提供方的原生名称映射到这些值，消费方不应根据面向用户的标题推断行为。该 id 通过 `_meta.lody.toolName` 传递。

| Id | 流程 |
| --- | --- |
| `ImageGeneration` | 图像生成 |
| `CronCreate` | 创建定时任务 |
| `CronDelete` | 删除定时任务 |
| `CronList` | 列出定时任务 |
| `ScheduleWakeup` | 唤醒一次已排程的运行 |

## 自定义 `_lody/` 方法

方法名和载荷类型从 `src/methods.ts` 导出。`LodyExtensionRequestMap` 与 `LodyExtensionNotificationMap` 把每个协议方法名绑定到对应的 DTO，适配器无法把某个方法实现成不相关的类型。

请求：

| 方法 | 请求 | 响应 |
| --- | --- | --- |
| `_lody/rate_limits/get` | 可选过滤 `sessionId`、`accountId`、`modelId`。该调用不绑定会话。 | 当前的 `RateLimitsSnapshot`。 |
| `_lody/session/steer` | `sessionId`、`prompt` 内容块、`steerId`。 | `{ outcome: "injected" \| "failed" }`。 |
| `_lody/session/goal` | `sessionId`，以及 `set`（带 `objective`）或 `pause` / `resume` / `clear`。 | `{ goal }` 快照；清除后为 `null`。 |
| `_lody/session/history/read` | `sessionId`。 | 空对象。 |
| `_lody/subagents/list` | `sessionId`，可选 `activeOnly`。 | `{ tasks }`。 |
| `_lody/subagents/cancel` | `sessionId`、`taskId`，可选 `reason`。 | 空对象。 |
| `_lody/subagents/output` | `sessionId`、`taskId`，可选 `tail`。 | `{ output }`。 |
| `_lody/mcp_apps/load` | `sessionId`、`toolCallId`。 | `{ app, toolInput, toolResult }`；原始调用完成前 `toolResult` 为 `null`。 |
| `_lody/mcp_apps/resource/read` | `sessionId`、`toolCallId`、`uri`。 | 原始服务器返回的 MCP `resources/read` 结果。 |
| `_lody/mcp_apps/tool/call` | `sessionId`、`toolCallId`、`name`，可选 `arguments`。 | 原始服务器返回的 MCP `tools/call` 结果。 |

通知（Agent 到客户端）：

| 方法 | 载荷 |
| --- | --- |
| `_lody/subagents/event` | `LodySubagentEvent`：`version: 1`、根 `sessionId`、不透明 `runId`，然后是 `snapshot`、`progress` 或 `output`（ACP 文本、思考、工具调用、工具更新或计划）。`isLodySubagentEvent` 负责校验这一边界。消息按连接顺序投递。 |
| `_lody/session/usage_update` | `SessionUsageUpdate`：`usage` 是最近一次操作，`modelUsage` 是按模型累计的总量，`delta` 可选。 |
| `_lody/rate_limits/update` | 与查询响应相同的快照结构。 |
| `_lody/session/steer_applied` | `sessionId` 和 `steerId`。 |

## 标准 ACP 消息上的元数据

下面这些字段都位于 ACP 已有消息的 `_meta.lody` 下。

| 字段 | 所在消息 | 作用 |
| --- | --- | --- |
| `forkAtTurn` | `session/fork` | 可选的来源轮次。 |
| `elicitation` | `elicitation/create` | 问题、选项、预览、密文、自动解析时间、`customAnswerFor`、`noteFor`。 |
| `task` | `tool_call`、`tool_call_update` | 子代理、后台或定时任务的生命周期（`LodyTaskMeta`）。 |
| `activity` | `tool_call`、`tool_call_update` | 压缩或重试（`LodyActivityMeta`）。 |
| `toolName` | `tool_call`、`tool_call_update` | `LODY_TOOL_NAMES` 中的稳定 id。 |
| `mcpApp` | `tool_call` | 本次调用对应的 MCP Apps 视图（`LodyMcpAppToolCallMeta`）。 |
| `titleSource` | `session_info_update` | `explicit`、`generated`、`fallback` 或 `unset`。 |
| `goal` | 会话更新 | Agent 发布的 `LodyGoalSnapshot`，或 `null`。 |
| `goalControl` | `session/prompt` | 客户端发起的目标动作。当该动作没有开启原生轮次时，prompt 正文只是后备文本。 |
| `steer` | `session/prompt` | `prompt` 传输方式下的 `{ id }`。 |
| `notice` | 会话更新 | `info`、`warning` 或 `error` 消息。 |
| `messagePhase` | 会话更新 | `commentary` 或 `final_answer`。 |
| `worktreeProject` | `session/new`、`load`、`resume`、`fork` | `{ version: 1, originProjectPath }`。 |
| `usageScopeId` | 用量更新 | 记账作用域。在同一个 ACP 会话内唯一，且不会被复用。 |
| `turnId` | 会话元数据 | 与其他会话字段一起携带的轮次 id。 |

## 共同约定

- 每项能力独立声明，支持其中一项绝不意味着其他项也可用。
- 绝对时间戳是 Unix 纪元**秒**，字段名会写明单位；以秒计的时长同样写明单位，`durationMs` 则以毫秒计。
- 提供方适配器负责把原生载荷映射为这些契约，消费方不应根据提供方私有正文分支。
- 速率限制的 `windows` 是完整的替换列表。时长、使用率或重置时间相同的窗口也不得合并。
- 提问附注是独立的字符串字段：更换选项时它仍然保留，编辑它也不会把该问题切换成自定义答案模式。空附注应省略，每条附注只引用同一 schema 中的一个问题。
- 用量分桶互不重叠：input 不含缓存读和缓存写，output 不含推理 token。`costUSD` 以美元计，可以是有说明的估算值。各作用域独立求和，不要把 `delta` 叠加到 `modelUsage` 上。
- `SessionUsageAccumulator` 只在当前进程内有效。同一会话的记账生命周期内应保持同一个实例；重放和压缩都不得重置它。
- 只移动状态的目标动作（`pause`、`clear`，以及 `controlActions` 中声明的其他动作）必须能在 prompt 进行中接受，且不得开启新轮次。
- `worktreeProject` 不授予目录访问权限，不改变 `cwd`，也不会把工作树的创建或清理交给提供方。若接受该扩展却无法解析项目根，应返回错误。
- Plan mode 不承诺沙箱变为只读；Claude 基于权限模式的 Plan 切换不属于本契约。
- 适配器只发送当前版本的契约；对旧版载荷的兼容应放在消费方边界，并设定明确的退役时间。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
