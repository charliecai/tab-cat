# Tab Cat 审核测试说明

作者：charliec

提交 Tab Cat 到 Chrome Web Store 或 Microsoft Edge Add-ons 时，可以使用这份说明作为审核备注。

## 审核概述

Tab Cat 是一个 Manifest V3 新标签页扩展。它会把浏览器新标签页替换成本地标签页仪表盘，并按域名分组展示当前打开的标签页。用户可以聚焦已有标签页、关闭指定标签页、清理重复标签页、固定快捷入口，并把文章型页面保存到本地 Reading inbox。

这个扩展没有账号系统，也没有 Tab Cat 服务端。

## 测试方式

1. 从提交的扩展包安装 Tab Cat。
2. 打开几个普通网页，例如 `https://example.com`、`https://www.iana.org/` 和 `https://news.ycombinator.com/`。
3. 打开一个新标签页。Tab Cat 应该作为新标签页页面出现。
4. 确认 `Now` 视图会按域名分组展示打开的标签页。
5. 点击任意标签页标题。浏览器应该聚焦到对应的已打开标签页。
6. 打开重复网页后回到 Tab Cat。适用时页面应显示重复标签页提示。
7. 对单个标签页或重复标签页分组执行关闭操作，并确认只会执行用户选择的清理动作。
8. 将一个文章型标签页保存到稍后阅读。该条目应该出现在 `Reading inbox` 中。
9. 打开 `Reading inbox`。如果没有配置 AI，已保存文章应该显示本地保存状态和 fallback 指引。
10. 将已保存条目标记为已读，并确认它移动到已读状态。
11. 打开 `Settings`，确认可以看到 AI provider 设置和备份控制项。

## AI 功能说明

AI 分析是可选功能。审核人员不需要 AI 账号也可以测试扩展的核心功能。

如果没有配置 AI provider，Tab Cat 仍然支持：

- 新标签页仪表盘。
- 按域名分组。
- 重复标签页检测。
- 标签页聚焦和清理操作。
- 固定快捷入口。
- 本地 Reading inbox。

如果用户配置了 AI provider，Tab Cat 会把抓取到的文章正文直接从浏览器发送到用户填写的 HTTPS OpenAI-compatible provider host。Tab Cat 不会通过 Tab Cat 服务端代理这些请求。

## 权限说明

### `tabs`

用于读取打开标签页的标题和 URL、按域名分组、检测重复标签页、聚焦已有标签页，并且只在用户明确点击清理操作后关闭标签页。

### `storage`

用于保存本地设置、固定快捷入口、Reading inbox 状态、AI 设置，以及备份/导入状态。

### `scripting`

当用户把一篇文章保存到稍后阅读时，用于把 Tab Cat 打包内置的内容抓取脚本注入到用户选择的标签页中。

### `<all_urls>`

用户可能从任意普通网页保存文章型页面，因此需要对正常网页 URL 提供 host access。Tab Cat 会阻止不支持的浏览器内部页面，例如 `chrome://` 页面、扩展页面、Chrome Web Store 页面和本地 `file://` 页面。

### `activeTab`

提交前应重新检查这个权限。如果最终包中没有使用，应移除它。如果保留，只应服务于用户主动触发的 active-tab 工作流。

## 数据处理

Tab Cat 使用扩展存储和 IndexedDB，把核心数据保存在浏览器配置中。Tab Cat 不销售用户数据，不把用户数据用于广告，也不会把浏览数据发送到 Tab Cat 自有服务器。

可选 AI 分析可能会把抓取到的文章内容和用户填写的 API key 直接发送到用户配置的 OpenAI-compatible provider。这一行为已在隐私政策和 Settings UI 中披露。

## 已知不支持的页面

Tab Cat 不会从浏览器内部页面或受保护页面抓取文章内容，包括：

- `chrome://` 页面。
- 扩展页面。
- Chrome Web Store 页面。
- `file://` 页面。

在不支持的页面上，抓取功能应优雅失败或被禁用。
