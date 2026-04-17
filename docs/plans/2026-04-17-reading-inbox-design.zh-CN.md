# Tab Out Reading Inbox 设计文档

**日期：** 2026-04-17

**摘要：** 将 Tab Out 从一个标签页总览插件，重新定位为一个由 AI 辅助的阅读暂存箱。该扩展仍然保持为纯 Chrome 扩展，使用 `IndexedDB` 作为已保存阅读条目的主存储层，并新增第二种首页模式来处理阅读积压。

---

## 产品定位

Tab Out 不再只是一个展示当前打开标签页的仪表盘。它将变成一个轻量、浏览器原生的阅读暂存箱，承担两个明确职责：

1. 防止重要的待读页面丢失。
2. 通过 AI 聚类、去重和阅读建议，减少阅读积压。

这个扩展**不是**用户的永久知识库。它是一个临时处理层，用户会在处理完成后，再把有价值的内容迁移到 Obsidian 或其他笔记工具中。

---

## 产品原则

- 手动优先采集。只有用户明确触发的操作才会把内容加入阅读暂存箱。
- 暂存而非归档。扩展负责保存内容用于处理，而不是做终身整理。
- AI 的目标是减少阅读工作量，而不是生成装饰性的摘要。
- Topic 分组必须稳定、可解释。
- UI 必须把“当前工作”和“阅读积压”明确分开。
- 即便引入外部 AI 模型，扩展整体范围也应保持轻量。

---

## 范围决策

### V1 包含

- 双首页模式：`Work now` 和 `Reading inbox`
- `Pinned` 单入口快捷方式，支持手动管理
- 从 `Open now` 手动触发 `Save for later`
- 使用 `IndexedDB` 作为文章和 topic 的主存储
- 使用 `Defuddle-only` 抓取内容并转换为 Markdown
- OpenAI-compatible AI 设置：
  - `base_url`
  - `api_key`
  - `model_id`
- 文章级 AI 分析
- Topic 创建、Topic 归属判断、Topic Digest 生成
- Inbox 动作：
  - `Archive`
  - `Delete`
  - `Retry`

### V1 明确不做

- 基于停留时长或被动浏览的自动保存
- 以本地文件系统作为主存储
- Markdown 导出
- 本地图片下载
- PDF 抓取或下载
- 云端同步
- Topic 手工编辑工具
- 分组式 pinned
- 动作型 pinned 条目
- 全库重聚类
- 高级搜索和复杂筛选

---

## 首页结构

### 模式一：Work now

`Work now` 用于当前动作和即时上下文。

#### Pinned

- 只支持单入口快捷方式
- 完全手动管理
- 支持的动作：
  - 从 `Open now` 把当前 tab Pin 进去
  - 编辑 pinned 的标题和 URL
  - 删除
  - 拖拽排序

#### Open now

- 保留现有按域名分组的标签页视图
- 在合适的地方继续保留原有动作
- 新增：
  - `Save for later`
  - `Pin`

### 模式二：Reading inbox

`Reading inbox` 用于处理积压的待读内容。

#### 左侧面板：Saved for later

- 宽度大致保持为当前 deferred column 的宽度
- 默认排序：`最近保存`
- 每个条目是一个处理队列项，而不是普通书签行
- 每行展示：
  - 标题
  - 站点名
  - 保存时间
  - 处理状态
  - 主 Topic 标签
  - 推荐动作
- 支持的动作：
  - 打开原文
  - Archive
  - Delete
  - Retry

#### 右侧面板：Topic Digest

- 宽于左侧面板
- 展示的是 Topic 级别的理解和建议，而不是单篇文章详情
- 默认视图是 Topic 层的整体理解
- 当用户选择某个 Inbox 条目时，右侧高亮它在对应 Topic 中的位置

---

## 采集工作流

V1 中的采集完全由手动触发。

1. 用户打开 `Work now`
2. 用户在 `Open now` 中对某个标签页点击 `Save for later`
3. 扩展立即创建一条本地 inbox 记录
4. 扩展异步使用 `Defuddle` 抓取文章内容
5. 抓取成功后，扩展执行文章级 AI 分析
6. 分析完成后，文章要么并入现有 Topic，要么作为种子创建新 Topic
7. Topic Digest 被创建或刷新

需要保证的行为：

- 条目必须先创建，再开始抓取
- 抓取失败不会删除 inbox 条目
- AI 分析失败不会删除已经抓取的内容
- 每个失败阶段都可以单独重试

---

## Topic 模型

### 什么是 Topic

Topic 是由保存下来的文章动态生成的**阅读主题容器**。它不是静态文件夹，也不是人工标签。

每个 Topic 包含：

- 稳定的 `title`
- `one_line_digest`
- `reading_question`
- `article_count`
- `key_articles`
- `overlap_groups`
- `suggested_reading_path`
- `related_topics`
- `last_updated`

### Topic 如何创建

Topic 由种子文章触发创建。

1. 一篇已抓取文章完成分析
2. 系统判断它是否能明确归入某个已有 Topic
3. 如果不存在足够强的匹配，就根据这篇文章的 AI 结果创建新 Topic
4. 后续文章继续并入后，Topic Digest 会被逐步修正和完善

### Topic 归属规则

- 每篇文章有且只有一个 `main_topic_id`
- 每篇文章还可以带有 `sub_angles`
- 文章不会同时属于多个 Topic
- 跨 Topic 的关联通过 `related_topics` 表达，而不是多重归属

### 重复模型

系统跟踪两类重复关系：

- `strict duplicate`
  - 同一个 canonical URL，或可视为完全等价的 URL
- `overlap`
  - URL 不同，但内容高度相似

严格重复不应该制造新的阅读工作量。Overlap group 的作用是帮助用户跳过重复阅读。

---

## 文章数据模型

### 原始抓取层

- `id`
- `url`
- `canonical_url`
- `title`
- `site_name`
- `author`
- `published_at`
- `saved_at`
- `markdown_content`
- `excerpt`
- `lead_image_url`
- `word_count`
- `language`
- `capture_status`

### 文章分析层

- `summary_short`
- `main_topic_label`
- `sub_angles`
- `keywords`
- `reading_time_estimate`
- `content_type`
- `novelty_score`
- `actionability_score`
- `duplicate_candidates`

### 阅读决策层

- `recommended_action`
- `why_recommended`
- `best_reason_to_read`
- `best_reason_to_skip`

### 生命周期层

- `inbox_status`
- `read_status`
- `last_analyzed_at`
- `last_opened_at`

对 V1 来说，最小的 UI 驱动字段集合为：

- `title`
- `site_name`
- `saved_at`
- `capture_status`
- `summary_short`
- `main_topic_label`
- `recommended_action`
- `inbox_status`
- `read_status`

---

## Topic Digest 要求

Digest 的职责是帮助用户决定该读什么，而不是把 Topic 重新摘要一遍。

每个 Digest 至少包含：

- `title`
- `one_line_digest`
- `best_articles_to_read`
- `skippable_or_overlapping_articles`
- `suggested_reading_path`

在信息足够时，可以补充的字段：

- `why_it_matters`
- `key_differences`
- `related_topics`

---

## AI Provider 模型

V1 只支持一种配置方式：

- OpenAI-compatible API

必填字段：

- `base_url`
- `api_key`
- `model_id`

这个唯一配置的模型同时用于：

- 文章分析
- Topic 判断和匹配
- Topic Digest 生成

配置入口放在扩展主页内部，而不是单独的 options page。

---

## 存储与状态

### 主存储

- `IndexedDB` 是阅读条目、Topic 和 AI 结果的系统主记录源

### 扩展设置

- `chrome.storage.local` 仍可继续用于轻量设置和兼容性状态，但不再承担主阅读数据库职责

### 文章生命周期

- `active`
- `archived`
- `deleted`

### 动作定义

#### Archive

- 从当前 active inbox 流程中移出
- 保留抓取内容和 AI 分析结果
- 保留该文章与 Topic 的归属关系

#### Delete

- 删除文章内容和分析结果
- 把文章从所属 Topic 中移除
- 如果 Topic 因此为空，则删除该 Topic
- 如果 Topic 仍有文章，则刷新其 Digest

#### Retry

- 重新执行失败的抓取或分析阶段，不重新创建文章条目

---

## V1 技术方向

- 保持扩展整体架构简单，并坚持浏览器原生
- 引入围绕以下职责的小型模块化结构：
  - storage
  - capture
  - AI client
  - topic engine
- 避免引入沉重的文件系统集成
- 避免与某个 provider 强耦合
- 优先展示明确的 UI 状态，而不是隐藏式后台魔法

---

## MVP 总结

如果 V1 能让用户做到以下几点，就算成功：

1. Pin 少量稳定入口作为日常工作起点
2. 把当前打开的 tab 保存进一个可靠的阅读暂存箱
3. 清楚看到每个条目的抓取/分析进度
4. 获得 AI 生成的 Topic 分组和阅读建议
5. 在不失去状态控制的前提下 Archive 或 Delete 已处理内容

这个产品最终给人的感觉，应当是一个浏览器原生的临时阅读工作区，而不是书签管理器，也不是完整的笔记系统。
