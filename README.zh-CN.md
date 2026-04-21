# Tab Cat

**把杂乱标签页整理成一眼能看懂的首页。**

Tab Cat 是一个 Chrome 扩展，会把新标签页替换成一个更安静、更好整理的标签页仪表盘。它会按域名聚合你当前打开的页面，把 Gmail、X、LinkedIn、GitHub、YouTube 这类首页放进单独分组，并提供一个 `Reading inbox` 来接住你想稍后处理的文章型页面。

它是本地优先的。没有服务端，没有账号系统，也不需要额外部署。

## 主要功能

- 按域名分组展示当前打开的标签页
- 把常见首页类页面归到单独分组，方便一键清理
- 直接跳转到已经打开的标签页，不会新开重复页
- 提供重复标签页识别和快速清理
- 支持固定少量常用入口
- 支持把文章型页面保存到 `Reading inbox`
- 支持接入兼容 OpenAI 的 AI 接口，对保存文章做抓取和分析
- 核心浏览数据默认保留在 Chrome 本地

## 安装方式

1. 克隆仓库：

```bash
git clone https://github.com/charliecai/tab-cat.git
cd tab-cat
```

2. 在 Chrome 打开 `chrome://extensions`
3. 打开右上角 **Developer mode**
4. 点击 **Load unpacked**
5. 选择 `extension/` 目录

完成后，新开一个标签页就能看到 Tab Cat。

## 工作方式

- `Now` 用来展示当前打开的标签页和你固定的入口。
- `Reading inbox` 用来存放想稍后处理的文章型页面。
- 保存后的文章会在后台进入抓取和分析流程。
- 如果你在 Settings 中配置了 AI 服务，抓取到的文章正文会直接发送到你填写的 provider host。
- 即使不配置 AI，扩展的大部分能力也依然可以本地使用。

## 技术说明

- Chrome Extension：Manifest V3
- 存储：IndexedDB + `chrome.storage.local`
- 抓取：service worker + 注入式 content script
- AI：兼容 OpenAI 的 chat completions API

## 致谢

- 感谢 [zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out) 为这个项目提供了最初的灵感。
- 感谢 [RouteCat](https://routecat.io) 提供 Claude 和 Codex 的中转 API，支持这个项目的开发过程。

## License

MIT
