# Tab Cat 商店数据披露说明

这份文件汇总了 Tab Cat 在 Chrome Web Store 和 Microsoft Edge Add-ons 中建议填写的隐私与数据披露口径。

作者：charliec

## 产品用途

Tab Cat 会把浏览器新标签页替换成本地标签页仪表盘。它会按域名分组展示打开的标签页，识别重复标签页，支持标签页清理操作，保存固定快捷入口，并为文章型页面提供本地 Reading inbox。用户也可以选择使用自己的 OpenAI-compatible provider 启用 AI 分析。

## 建议披露的数据类别

### Web Browsing Activity

披露：Yes。

原因：Tab Cat 会读取打开标签页的 URL、标题、favicon、tab ID 和 window ID，用于分组标签页、检测重复标签页、跳转到已有标签页、关闭用户选择的标签页，以及构建新标签页仪表盘。

处理方式：除非包含在用户主动导出的备份文件、浏览器配置同步或系统备份中，否则这些数据会在本地存储和处理。

### Website Content

披露：Yes。

原因：当用户把文章型标签页保存到稍后阅读时，Tab Cat 会把本地抓取脚本注入到该用户选择的页面中，并提取可读文章正文和元数据，用于 Reading inbox。

处理方式：数据会保存在本地 IndexedDB 中。如果用户配置 AI provider 并运行分析，抓取到的文章正文可能会直接发送到用户配置的 provider host。

### Authentication Information

披露：如果商店表单把用户填写的 API key 归入该类别，则选择 Yes。

原因：用户可以选择在 Tab Cat 设置中保存 AI provider API key。

处理方式：API key 会保存在浏览器扩展存储中。只有在测试连接或运行文章分析时，才会发送到用户配置的 AI provider host。用户导出的备份文件可能包含该凭据。

### User Activity

披露：如果商店表单把扩展状态和阅读操作视为用户活动，则选择 Yes。

原因：Tab Cat 会保存阅读条目的生命周期状态，例如 saved、read、archived 和 processing status，用于驱动 Reading inbox。

处理方式：数据会保存在本地 IndexedDB 和浏览器扩展存储中。

### Personally Identifiable Information

披露：No，除非未来版本有意收集姓名、邮箱、手机号或账号标识符等个人资料信息。

当前行为：Tab Cat 没有账号系统，也不会有意收集身份资料字段。用户保存的页面内容或 URL 可能偶然包含个人信息，因此隐私政策仍应说明已保存的网站内容可能是敏感的。

### Location

披露：No。

当前行为：Tab Cat 不请求浏览器地理位置权限，也不会有意收集精确位置。

### Financial and Payment Information

披露：No。

当前行为：Tab Cat 没有支付流程，也不会有意收集支付信息。

### Health Information

披露：No。

当前行为：Tab Cat 不会有意收集健康信息。用户保存的页面可能偶然包含敏感内容，但扩展不会把健康数据作为产品功能进行分类或请求。

### Personal Communications

披露：对于有意收集，选择 No。

当前行为：Tab Cat 可能展示或保存用户已打开网站的 URL 和标题。它不会把消息、邮件正文、聊天内容或通信内容作为专门功能进行有意收集。

## 数据使用声明

填写商店隐私表单时，可以使用这些声明：

- Tab Cat 不销售用户数据。
- Tab Cat 不把用户数据用于广告。
- Tab Cat 不把用户数据用于信用、借贷或资格决策。
- Tab Cat 不会把数据传输到 Tab Cat 自有服务器。
- 可选 AI 分析会把抓取到的文章内容直接从浏览器发送到用户配置的 OpenAI-compatible provider。
- 不配置 AI provider 时，核心功能仍然可用。
- 数据会使用扩展存储和 IndexedDB 保存在浏览器配置中。

## 权限说明

### `tabs`

用于读取打开标签页的标题和 URL、按域名分组、检测重复标签页、聚焦已有标签页，并且只在用户点击清理操作时关闭标签页。

### `storage`

用于保存本地设置、固定快捷入口、Reading inbox 状态、旧版 saved-tab 数据、AI 设置，以及导入/导出状态。

### `scripting`

当用户把某个页面保存到稍后阅读时，用于把 Tab Cat 打包内置的内容抓取脚本注入到该用户选择的页面中。

### `activeTab`

提交前应重新检查。如果未使用，应在打包前移除。如果保留，只应在某个功能确实需要用户交互后临时访问当前 active tab 时说明。

### `<all_urls>` Host Access

用户可能从任意普通网页保存文章型页面，因此需要该权限。Tab Cat 会阻止不支持的浏览器内部页面，例如 `chrome://` 页面、扩展页面、Chrome Web Store 页面和本地 `file://` 页面。

## 远程代码披露

Tab Cat 不会执行远程托管的 JavaScript 作为扩展代码。运行时脚本都打包在扩展内部。

可选 AI 请求是发送到用户配置 provider API 的网络请求，不用于下载可执行扩展代码。

## Edge Add-ons 个人信息问题建议回答

建议回答：Yes。

原因：Tab Cat 会访问浏览数据，并能抓取用户选择的网站内容。如果用户配置 AI，它可以把抓取到的文章内容和 API key 发送到用户配置的 provider。提交时应提供隐私政策 URL。
