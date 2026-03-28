# EasyChat for Edge - Progress 2026-03-28

## 今日收尾

### 1. 后台流恢复时的 loading 空白已修掉

- 修复了 `popup -> sidebar / full window` 接管正在进行中的后台流时，等待界面会消失的问题
- 现在当后台流已接上、但还没有可展示正文或推理预览页时，会稳定回退到等待条 loading
- 不再出现“请求还在继续，但新入口打开后界面空白”的状态

相关文件：

- `popup.js`
- `chat.js`

### 2. `full window` 切会话卡顿做了一轮减负

- 切会话时不再每次都把整份 `sessions + tokenUsage` 重写进 storage
- `full window` 的历史列表 active 态改成轻量更新，不再每次全量重建
- 消息区全量重绘改成先走 `DocumentFragment`，降低长对话切换时的布局开销
- assistant markdown 渲染增加了有上限的缓存，重复切回同一批会话时不会每次都重新 `marked.parse`

相关文件：

- `chat.js`

### 3. 三入口“打开时同步一次，打开后各自独立”已落地

本轮把之前“共享一个当前会话指针”的方式拆开了，避免三个入口互相拖着切会话。

当前规则：

- `popup` 维护自己的 `currentPopupSessionId`
- `sidebar` 维护自己的 `currentSidebarSessionId`
- `full window` 维护自己的 `currentId`
- 从某个入口打开另一个入口时，只同步一次当前会话
- 打开后，各入口继续切会话时不再互相覆盖

当前已确认的链路：

- `popup -> full window`：打开时会带过去当前会话
- `popup -> sidebar`：打开时会带过去当前会话
- `sidebar -> full window`：打开时会带过去 sidebar 当前会话
- 打开后 `popup / sidebar / full window` 各自切换不会联动

相关文件：

- `popup.js`
- `chat.js`
- `background.js`

### 4. `popup` 发消息时不再把 `full window` 强行跳过去

- `popup` 借 `full window` 代发消息的代理链路仍然保留
- 但如果 `full window` 当前看的不是那条会话，现在只后台代跑并写入会话，不会强制切视图
- 只有当 `full window` 本来就在同一会话时，才会继续显示对应的 loading 和流式内容

相关文件：

- `chat.js`

### 5. 打开已存在的 `full window` 时的会话定位也补稳了

- 新开 `full window` 时，会通过 URL 参数显式带入目标 `sessionId`
- 如果 `full window` 已经开着，再次从 `popup / sidebar` 打开时，会显式发送一次 `OPEN_CHAT_SESSION`
- 不再只依赖 storage 写入和初始化时序

相关文件：

- `popup.js`
- `background.js`
- `chat.js`

## 当前验证状态

已做：

- `node --check background.js`
- `node --check chat.js`
- `node --check popup.js`
- 多轮关键路径代码阅读与事件流交叉检查
- 对这些链路做了最小行为收口：
  - loading 恢复
  - `popup -> full window`
  - `popup -> sidebar`
  - 入口间会话解耦
  - `popup` 发消息不强制跳转 `full window`

未做：

- Edge 浏览器里的完整人工回归清单
- `sidebar` 代发消息时对其它入口的完整交互回归
- 长时间连续使用下的性能与状态稳定性观察

## 当前建议的最终回归项

优先手测：

1. `popup -> full window` 打开时落到当前会话，打开后两边切换不联动
2. `popup -> sidebar` 打开时落到当前会话，打开后两边切换不联动
3. `sidebar -> full window` 打开时落到 sidebar 当前会话
4. `popup` 发消息时，`full window / sidebar` 不会被强制跳转到那条会话
5. 如果目标入口本来就在同一会话，loading 与流式显示仍然正常
6. `Stop` 按钮在三入口仍然有效
7. 关闭 `popup` 后后台流仍然继续到底

## 现在可以收口的结论

这一轮已经不再是“继续扩功能”，而是把三入口之间最容易互相干扰的几条主链路收住了：

1. 后台流接管时不再出现空白 loading
2. `full window` 会话切换卡顿已明显减轻
3. 三入口只在打开瞬间同步当前会话，打开后彼此独立
4. `popup` 代发消息不会再强行拖着 `full window` 切会话

如果最终人工回归通过，这一批可以作为一个稳定快照提交。
