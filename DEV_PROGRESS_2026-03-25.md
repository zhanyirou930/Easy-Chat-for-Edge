# EasyChat for Edge - Progress 2026-03-25

## 今日完成

### 1. 三入口形态打通

- 保留了 `popup`
- 保留了 `full window`
- 新增并接通了 `sidebar`

相关文件：

- `manifest.json`
- `background.js`
- `popup.html`
- `popup.js`
- `sidebar.html`
- `chat.html`
- `chat.js`

### 2. 统一窗口级动作

已把这些动作收口到 `background.js`：

- 打开 / 聚焦 `full window`
- 打开 `side panel`
- 浏览器窗口与聊天窗口的关联记录

解决过的问题：

- `popup` 可以开 `full window`
- `popup` / `sidebar` / `full window` 都可以尝试打开侧边栏
- `full window` 能记住来源浏览器窗口，不再只靠临时状态

### 3. sidebar 独立页面

`sidebar` 已经不是 `iframe` 套 `popup`，现在是独立的 `sidebar.html` 页面，但仍然共用 `popup.js` 的聊天逻辑。

### 4. 抽出共享核心

新增：

- `shared-core.js`

已抽出的共享能力：

- `baseUrl` 规范化
- `toApiContent`
- 搜索结果注入
- `system prompt` 组装
- 搜索 provider 调用
- 请求体构造
- 非流式请求
- SSE 流式请求
- 错误响应解析
- 用户消息构造
- `display` 文案构造与解析
- 纯文本提取

### 5. 消息结构开始标准化

消息现在开始支持统一的：

- `role`
- `content`
- `display`
- `meta`
- `meta.contextSources`

已接入的来源类型包括：

- `selection`
- `page`
- `screenshot`
- `image`
- `file`
- `web_search`

### 6. 已修复的交互问题

- `sidebar` 截图时不再自动关闭自身
- `sidebar` 截图完成后可实时进入待发送框，不需要重开页面
- `full window` 能显示来自 `popup/sidebar` 的带标签消息里的图片 / 文件标签
- “联网搜索”统一为 `🌐` 前缀文本，不再渲染成绿色标签块

## 当前文件状态

今天实际改过或新增的文件：

- `manifest.json`
- `background.js`
- `chat.html`
- `chat.js`
- `popup.html`
- `popup.js`
- `sidebar.html`
- `shared-core.js`

说明：

- 当前目录不是 git 仓库
- 没有提交记录可回看

## 当前验证状态

已做：

- 多轮 JS 语法检查
- 共享 helper 引用检查
- DOM id 对齐检查

未做：

- 真实浏览器内完整人工回归
- Edge 扩展运行态逐项交互验收

## 明天继续前的建议回归项

优先手测：

1. `popup` 发消息
2. `sidebar` 发消息
3. `full window` 发消息
4. `popup -> full window -> sidebar` 链路
5. 截图、总结网页、代码解释、改写、自动标注
6. 联网搜索在三入口的显示是否一致
7. 历史记录同步是否正常

## 明天建议继续做

优先级建议：

1. 先做一轮回归修 bug
2. 再整理开源材料
3. 再继续做差异化功能

具体可继续的方向：

- 整理 `README.md`
- 补权限说明 / 数据说明 / 三入口说明
- 继续统一 `popup.js` / `chat.js` 剩余 UI 辅助逻辑
- 再往下做“来源追踪回答”
- 再做“页内替换 / 回填”

## 接续提示

明天继续时，优先从这些文件读起：

- `shared-core.js`
- `popup.js`
- `chat.js`
- `background.js`

如果先做发布整理，再读：

- `README.md`
- `manifest.json`
