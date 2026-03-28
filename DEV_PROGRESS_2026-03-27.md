# EasyChat for Edge - Progress 2026-03-27

## 今日完成

### 1. 主聊天页加载动画已对齐 `ChatGPT for 次瓦`

- `full window` 的加载态已经从原来的简单 thinking bubble 改成了次瓦版风格
- 已加入等待条动画
- 已加入 Grok 推理预览翻页动画
- 已加入“推理中只显示加载，正文出来再切正式气泡”的逻辑

相关文件：

- `chat.html`
- `chat.js`

### 2. `popup / sidebar` 也换成了同款加载动画

- `popup.html`
- `sidebar.html`
- `popup.js`

已接入：

- 等待条动画
- Grok 推理预览翻页
- 正文切换后的正式 markdown 渲染

### 3. 开始处理“popup 关闭后请求中断”问题

本次不是只改 UI，已经往“请求不绑在 popup 页面本身”这个方向推进：

- 在 `background.js` 新增了后台托管流式请求
- 新增了后台流状态保存
- 新增了后台流广播：
  - `STREAM_CHUNK`
  - `STREAM_DONE`
  - `STREAM_ERROR`
- `popup.js` 现在在没有打开 `chat.html` 的情况下，会尝试走后台流
- `popup/sidebar` 重新打开时，会尝试恢复当前会话对应的后台流显示
- `chat.js` 也接入了后台流恢复

相关文件：

- `background.js`
- `popup.js`
- `chat.js`

### 4. 当前会话定位开始统一

为了解决“从 popup 打开 sidebar / full window 时自动定位到 popup 当前对话”，本次开始统一写入：

- `currentPopupSessionId`
- `currentId`

当前已做：

- `popup` 切换会话时会保存当前会话 id
- 从 `popup` 打开 `sidebar`
- 从 `popup` 打开 `full window`
- `chat.html` 初始化时会优先读取共享 `currentId`
- `popup/sidebar` 初始化时也会优先读取共享 `currentId`
- `chat.js` / `popup.js` 已增加一部分 `storage.onChanged` 会话切换同步

## 当前未解决问题

### 1. 关键 bug 还没收尾

用户刚反馈的现象仍然存在：

> 在 popup 发消息后，回复还没完成时立刻打开 sidebar，sidebar 里的加载动画会消失。

这说明“请求不中断”这条链路已经开始改，但“新入口接管正在加载中的 UI 状态”还没有完全闭合。

### 2. 目前判断的排查重点

明天优先看这几个点：

1. `popup.js` 的 `restoreBackgroundStreamForCurrentSession()`
2. `popup.js` 的 `STREAM_CHUNK / STREAM_DONE / STREAM_ERROR` 监听
3. `chat.js` 的 `restoreBackgroundStreamForCurrentSession()`
4. 打开 `sidebar` 时：
   - 是否拿到了正确的 `currentId`
   - 是否拿到了 `GET_ACTIVE_STREAM`
   - 如果 `rawFull` 还没有正文，是否正确进入 `showReasoningPreview()` / `showTyping()`
5. 是否存在 `removeTyping()` 被过早调用，把新页面刚恢复的加载态清掉

### 3. 很可能的根因方向

初步怀疑点：

- 新页面打开后，已经连接到后台流，但 UI 恢复逻辑在“无正文阶段”只短暂进入了 loading，然后被别的清理逻辑移除
- 或者 `storage.onChanged` / `renderMessages()` 抢先跑了一次，把临时 loading DOM 清掉
- 或者 `currentId` 同步和 `GET_ACTIVE_STREAM` 恢复存在时序竞争

## 今日实际改动文件

- `background.js`
- `chat.html`
- `chat.js`
- `popup.html`
- `popup.js`
- `sidebar.html`

## 当前验证状态

已做：

- `node --check background.js`
- `node --check chat.js`
- `node --check popup.js`
- 关键函数 / 事件名交叉检索
- 加载动画样式与逻辑挂接检查

未做：

- Edge 浏览器里的完整人工回归
- “popup 正在流式 -> 关闭 popup -> 打开 sidebar / full window” 的逐步断点验证

## 明天继续时建议顺序

第一优先级：

1. 先只盯一个场景：
   `popup 发消息 -> 立刻打开 sidebar -> 观察 loading 为什么消失`
2. 用最小路径检查：
   - `currentId`
   - `GET_ACTIVE_STREAM`
   - `restoreBackgroundStreamForCurrentSession()`
   - `removeTyping()`
3. 修好后再测：
   - `popup -> sidebar`
   - `popup -> full window`
   - `sidebar -> full window`
   - 关闭 popup 后回复是否继续到底

第二优先级：

1. 再确认 stop 按钮是否能正确停止后台流
2. 再确认切会话时是否会把别的会话的流错误接管过来
3. 再做一次三入口的当前对话自动定位回归

## 明天接着看这些文件

- `background.js`
- `popup.js`
- `chat.js`
- `popup.html`
- `sidebar.html`

## 给明天自己的结论

今天不是没做，而是做到了“请求托管”和“会话定位”的一半以上，但交互收尾还没完成。

明天不要再扩功能，先把这两个目标彻底修完：

1. `popup` 关闭 / 切换入口时，请求不能停
2. 从 `popup` 打开 `sidebar / full window`，必须自动落到当前对话，并保留正确加载态
