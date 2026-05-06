(function () {
  const namespace = (globalThis.TabOutI18n = globalThis.TabOutI18n || {});

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural;
  }

  const MESSAGES = {
    en: {
      spec: {
        fallbackOnly: 'English fallback only',
      },
      mode: {
        now: 'Now',
        readingInbox: 'Reading inbox',
      },
      header: {
        modeSwitcherLabel: 'Homepage mode switcher',
      },
      banner: {
        tabOutDupesPrefix: 'You have',
        tabOutDupesSuffix: 'Tab Cat tabs open. Keep just this one?',
      },
      settings: {
        trigger: 'Settings',
        title: 'Settings',
        subtitle: 'Provider setup and a lightweight debug surface stay inside the homepage.',
        close: 'Close',
        closeAriaLabel: 'Close settings',
        provider: {
          title: 'AI Provider',
          copy: 'Use an OpenAI-compatible provider. Article content only leaves the browser when analysis runs against this host.',
          baseUrlLabel: 'Base URL',
          baseUrlPlaceholder: 'https://api.example.com/v1',
          apiKeyLabel: 'API Key',
          apiKeyPlaceholder: 'sk-...',
          apiKeyHelp: 'Stored in plaintext inside your browser profile. Do not use on shared machines.',
          modelIdLabel: 'Model ID',
          modelIdPlaceholder: 'gpt-4.1-mini',
          captureHelp: 'Captured article content will be sent to the configured AI host when analysis runs.',
        },
        language: {
          title: 'Language',
          label: 'Display and AI language',
          help: 'Control UI copy and AI outputs for new analysis runs.',
          options: {
            auto: 'Follow browser',
            en: 'English',
            zhCn: '简体中文',
          },
          status: {
            refreshRequired: 'Language saved. Refresh the page to load it.',
          },
        },
        backup: {
          title: 'Backup',
          copy: 'Export a full local snapshot before risky testing, then import it later to restore your inbox, pins, deferred tabs, and AI settings.',
          actions: {
            export: 'Export data',
            import: 'Import data',
          },
          status: {
            idle: 'Export a local snapshot before risky testing or import one to replace current Tab Cat data.',
            exporting: 'Preparing local backup…',
            importing: 'Restoring local backup…',
            exported: 'Backup exported. Keep the JSON somewhere safe.',
            restored: 'Backup restored. Current Tab Cat data was replaced.',
            failed: ({ error }) => (error ? `Backup failed · ${error}` : 'Backup failed'),
          },
          confirm: {
            title: 'Import this backup?',
            body: 'This file includes AI credentials and will replace all current Tab Cat data on this browser profile.',
          },
        },
        actions: {
          testConnection: 'Test connection',
          saveSettings: 'Save settings',
        },
        status: {
          notConfigured: 'Not configured',
          saved: ({ host }) =>
            host
              ? `Saved · ${host} · Test connection before retry becomes available`
              : 'Saved · Test connection before retry becomes available',
          ready: ({ host }) => (host ? `Ready · ${host}` : 'Ready'),
          failed: ({ error }) => (error ? `Last request failed · ${error}` : 'Last request failed'),
          testing: 'Testing connection…',
        },
      },
      section: {
        pinned: 'Pinned',
        openNow: 'Open now',
        readingInbox: 'Reading inbox',
        readingFilters: 'Filters',
        topicOverview: 'Topic overview',
        debug: 'Debug',
      },
      pinned: {
        empty: 'Pin a stable shortcut from an open tab.',
        reorderHandle: 'Drag to reorder pinned shortcut',
        menu: {
          moreActions: 'More actions',
        },
        editor: {
          title: 'Edit pinned shortcut',
          subtitle: 'Update the label and destination for this shortcut.',
          nameLabel: 'Name',
          namePlaceholder: 'Project docs',
          urlLabel: 'URL',
          urlPlaceholder: 'https://example.com',
          save: 'Save',
          cancel: 'Cancel',
          close: 'Close',
          closeAriaLabel: 'Close pinned shortcut editor',
          invalidUrl: 'Enter a valid http or https URL.',
        },
      },
      reading: {
        emptyActive: 'Save your first article from Now to start a reading inbox.',
        emptyFiltered: 'No saved articles match the current filters.',
        emptyRead: 'Nothing marked as read yet.',
        active: 'Active',
        read: 'Read',
        topicPending: 'Topic pending',
        deleteConfirm: 'Delete this saved article?',
        filtersPlaceholder: 'Filters will appear as your reading queue grows.',
        resultsPlaceholder: 'Narrow the queue on the left and reopen the right article from here.',
        searchPlaceholder: 'Search title or site',
        labelsPending: 'Analyzing',
        labelsWaitingForAi: 'Waiting for AI',
        clearFilters: 'Clear filters',
        resultsCount: ({ count, total }) => `${count} of ${total} articles`,
        readingTimeMinutes: ({ count }) => `${count} min read`,
        lifecycle: {
          all: 'All',
          active: 'Unread',
          read: 'Read',
        },
        filters: {
          lifecycle: 'Reading state',
          search: 'Search',
          labels: 'Labels',
          source: 'Source',
          time: 'Time',
          status: 'Status',
          empty: 'No filters yet',
        },
        priority: {
          readNow: 'Read now',
          worthKeeping: 'Worth keeping',
          skimLater: 'Skim later',
        },
        time: {
          today: 'Today',
          last_3_days: 'Last 3 days',
          last_7_days: 'Last 7 days',
          older: 'Older',
        },
        status: {
          ready: 'Ready',
          processing: 'Processing',
          failed: 'Failed',
          unopened: 'Unopened',
          opened: 'Opened',
        },
      },
      readingPageActions: {
        dismiss: 'Dismiss Reading inbox actions',
        markRead: 'Mark read',
        delete: 'Delete',
      },
      topic: {
        initialLead: 'This panel will summarize your backlog by topic instead of opening into article detail.',
        initialBody: 'Once items are saved, analyzed, and grouped, this becomes the calm decision layer for what to read next.',
        emptyLead: 'Nothing saved yet.',
        emptyBody: 'Save an article from Now and topic guidance will appear here.',
        fallbackLead: 'Content is saved, but topic guidance is waiting on analysis or AI configuration.',
        fallbackBody: 'The left queue still tracks the item so you can retry or continue once analysis is available.',
        fallbackBodyWithSource: ({ site }) =>
          `Saved from ${site}. Topic guidance will appear after AI analysis is ready.`,
        defaultTitle: 'Topic',
        defaultLead: 'A lightweight topic view derived from analyzed articles.',
        defaultBody: 'Use this panel to decide what to read next, not to dump full article detail.',
        defaultAction: 'Review the freshest article in this topic.',
        representativeArticles: 'Representative articles',
        formingLead: 'Articles are saved, but topic guidance is still forming.',
        formingBody: 'Capture and analysis can complete before topic assignment. Failed or unassigned items stay visible on the left so you never lose them.',
        clusterLead: 'Your backlog is starting to cluster into a few clear themes.',
        clusterCardLead: 'A lightweight topic cluster drawn from your saved articles.',
        startWith: ({ title }) => `Start with ${title}`,
        untitled: 'Untitled topic',
        nothingToTriageLead: 'Nothing to triage yet.',
        nothingToTriageBody: 'Save an article from Now and the inbox will start building a calm topic overview here.',
      },
      footer: {
        openTabs: 'Open tabs',
      },
      actions: {
        open: 'Open',
        saveForLater: 'Save for later',
        closeThisTab: 'Close this tab',
        pinToShortcuts: 'Pin to shortcuts',
        closeExtras: 'Close extras',
        closeAllTabs: ({ count }) => `Close all ${count} ${pluralize(count, 'tab', 'tabs')}`,
        closeDuplicates: ({ count }) => `Close ${count} ${pluralize(count, 'duplicate', 'duplicates')}`,
        markRead: 'Mark read',
        delete: 'Delete',
        cancel: 'Cancel',
        retry: 'Retry',
        retryCapture: 'Retry capture',
        retryAnalysis: 'Retry analysis',
        resumeAnalysis: 'Continue analysis',
        edit: 'Edit',
        remove: 'Remove',
        dismiss: 'Dismiss',
      },
      counts: {
        domains: ({ count }) => `${count} ${pluralize(count, 'domain', 'domains')}`,
        tabs: ({ count }) => `${count} ${pluralize(count, 'tab', 'tabs')}`,
        tabsOpen: ({ count }) => `${count} ${pluralize(count, 'tab', 'tabs')} open`,
        duplicates: ({ count }) => `${count} ${pluralize(count, 'duplicate', 'duplicates')}`,
        savedPins: ({ count }) => `${count} saved`,
        activeItems: ({ count }) => `${count} active`,
        items: ({ count }) => `${count} ${pluralize(count, 'item', 'items')}`,
        articles: ({ count }) => `${count} ${pluralize(count, 'article', 'articles')}`,
        moreTabs: ({ count }) => `+${count} more`,
      },
      labels: {
        homepages: 'Homepages',
        tabs: 'tabs',
        noResults: 'No results',
        captureUnavailable: 'Capture unavailable on this page',
      },
      processing: {
        queued: 'Queued',
        capturing: 'Capturing',
        captured: 'Captured',
        analyzing: 'Analyzing',
        analyzed: 'Analyzed',
        assigning: 'Assigning',
        assigned: 'Ready',
        ready: 'Ready',
        waiting_for_ai: 'Waiting for AI',
        capture_failed: 'Capture failed',
        analysis_failed: 'Analysis failed',
        assignment_failed: 'Assignment failed',
        pending: 'Pending',
      },
      recommendedAction: {
        reviewTopic: 'Review topic',
        retryAfterFixingAi: 'Retry after fixing AI settings',
        retryCapture: 'Retry capture',
        waitingForAnalysis: 'Waiting for analysis',
      },
      reason: {
        captureFailed: 'Could not capture article content.',
        analysisFailed: 'Content is saved, but AI analysis failed.',
        assignmentFailed: 'Analysis finished, but topic assignment failed.',
        readyInTopic: 'Ready inside its current topic.',
        readyForTopicReview: 'Ready for topic review.',
        readyToReopen: 'Ready to reopen when you are.',
        waitingForAi: 'Saved locally. Retry becomes available after AI is tested successfully.',
        waitingForPipeline: 'Waiting for the background pipeline.',
      },
      statusDetail: {
        waitingForAiBlocked: 'Saved locally. Finish AI setup in Settings before analysis can continue.',
        waitingForAiReady: 'AI is ready. Click to continue analysis on the saved article text.',
        captureFailed: ({ reason, retry, action }) => `${reason} ${retry} ${action}`,
        analysisFailed: ({ reason, retry, action }) => `${reason} ${retry} ${action}`,
        autoRetryAt: ({ time }) => `Auto-retry ${time}.`,
        manualRetry: 'No auto-retry is scheduled.',
        retryCaptureAction: 'Click "Retry capture" to fetch the page again, then continue analysis.',
        retryAnalysisAction: 'Click "Retry analysis" to reuse the saved text without fetching again.',
      },
      statusReason: {
        source_tab_closed_before_payload: 'The source tab closed before the article text was handed off.',
        source_tab_loading: 'The source page did not finish loading in time.',
        runtime_message_failed: 'The page could not return article text to the extension.',
        provider_unavailable: 'The capture service was temporarily unavailable.',
        source_tab_reloaded: 'The source page reloaded during capture.',
        unsupported_url: 'This page does not allow article capture.',
        invalid_analysis_payload: 'The AI response was not in the expected format.',
        unknown_error: 'The step did not finish successfully.',
      },
      debug: {
        copy: 'Recent article pipeline states stay visible here so you can debug capture, analysis, and assignment without leaving the homepage.',
        emptyTitle: 'No pipeline activity yet',
        emptyBody: 'Recent article jobs, errors, host usage, and retry controls will appear here.',
        noRecentError: 'No recent error',
        noAiHost: 'No AI host',
        waitingForAi: 'Waiting for AI setup to be tested successfully before retry is allowed.',
        analyzedAgo: ({ time }) => ` · analyzed ${time}`,
        stagePrefetch: 'Prefetch',
        sourceUnknown: 'source: background',
        sourcePrefetchHit: 'source: prefetch-hit',
        sourceSaveFallback: 'source: save-fallback',
        sourceRetry: 'source: retry',
        attemptCount: ({ count }) => `attempt ${count}`,
        nextRetryIn: ({ time }) => `retry ${time}`,
        textSize: ({ count }) => `${count} chars`,
        errorCode: ({ code }) => `code ${code}`,
      },
      lifecycle: {
        active: 'Active',
        read: 'Read',
      },
      toast: {
        closedExtraTabOutTabs: 'Closed extra Tab Cat tabs',
        alreadyPinned: 'Already pinned',
        pinnedToNow: 'Pinned to Now',
        settingsSaved: 'Settings saved',
        languageSavedRefreshRequired: 'Language saved. Refresh the page to load it.',
        aiConnectionReady: 'AI connection ready',
        aiConnectionFailed: 'AI connection failed',
        tabClosed: 'Tab closed',
        alreadySavedRequeued: 'Already saved. Re-queued for processing.',
        alreadySaved: 'Already saved',
        savedToReadingInbox: 'Saved to Reading inbox',
        failedToSaveTab: 'Failed to save tab',
        markedRead: 'Marked as read',
        deleted: 'Deleted',
        queuedForRetry: 'Queued for retry',
        pinUpdated: 'Pin updated',
        pinRemoved: 'Pin removed',
        backupExported: 'Backup exported',
        backupRestored: 'Backup restored',
        backupFailed: 'Backup failed',
        closedTabsFromGroup: ({ count, group }) => `Closed ${count} ${pluralize(count, 'tab', 'tabs')} from ${group}`,
        closedDuplicates: 'Closed duplicates, kept one copy each',
        allTabsClosed: 'All tabs closed. Fresh start.',
      },
      prompt: {
        pinnedTitle: 'Pinned title',
      },
      emptyState: {
        title: 'Inbox zero, but for tabs.',
        subtitle: "You're free.",
      },
      greeting: {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening',
      },
      timeAgo: {
        justNow: 'just now',
        minAgo: ({ count }) => `${count} min ago`,
        hourAgo: ({ count }) => `${count} ${pluralize(count, 'hr', 'hrs')} ago`,
        yesterday: 'yesterday',
        dayAgo: ({ count }) => `${count} days ago`,
      },
      aiOutput: {
        languageName: 'English',
      },
    },
    'zh-CN': {
      mode: {
        now: '当前',
        readingInbox: '阅读收件箱',
      },
      header: {
        modeSwitcherLabel: '首页模式切换',
      },
      banner: {
        tabOutDupesPrefix: '你当前打开了',
        tabOutDupesSuffix: '个 Tab Cat 标签页。只保留当前这个吗？',
      },
      settings: {
        trigger: '设置',
        title: '设置',
        subtitle: '提供方配置和轻量调试面板都在首页内完成。',
        close: '关闭',
        closeAriaLabel: '关闭设置',
        provider: {
          title: 'AI 提供方',
          copy: '使用 OpenAI 兼容提供方。只有在分析运行时，文章内容才会离开浏览器发送到该主机。',
          baseUrlLabel: 'Base URL',
          baseUrlPlaceholder: 'https://api.example.com/v1',
          apiKeyLabel: 'API Key',
          apiKeyPlaceholder: 'sk-...',
          apiKeyHelp: '明文保存在你的浏览器配置中。请勿在共享设备上使用。',
          modelIdLabel: 'Model ID',
          modelIdPlaceholder: 'gpt-4.1-mini',
          captureHelp: '分析运行时，抓取到的文章内容会发送到配置的 AI 主机。',
        },
        language: {
          title: '语言',
          label: '界面与 AI 语言',
          help: '设置同时控制界面文案与后续 AI 分析输出语言。',
          options: {
            auto: '跟随浏览器',
            en: 'English',
            zhCn: '简体中文',
          },
          status: {
            refreshRequired: '语言已保存，请刷新页面加载新语言。',
          },
        },
        backup: {
          title: '备份',
          copy: '在高风险测试前导出一份完整本地快照，之后可以再导入，把收件箱、固定入口、旧 deferred 列表和 AI 设置一起恢复回来。',
          actions: {
            export: '导出数据',
            import: '导入数据',
          },
          status: {
            idle: '你可以先导出一份本地快照，或导入一份备份来整体替换当前 Tab Cat 数据。',
            exporting: '正在准备本地备份…',
            importing: '正在恢复本地备份…',
            exported: '备份已导出。请把这个 JSON 文件妥善保存。',
            restored: '备份已恢复，当前 Tab Cat 数据已被替换。',
            failed: ({ error }) => (error ? `备份失败 · ${error}` : '备份失败'),
          },
          confirm: {
            title: '要导入这份备份吗？',
            body: '这个文件包含 AI 凭据，并且会整体替换当前浏览器配置里的所有 Tab Cat 数据。',
          },
        },
        actions: {
          testConnection: '测试连接',
          saveSettings: '保存设置',
        },
        status: {
          notConfigured: '未配置',
          saved: ({ host }) =>
            host
              ? `已保存 · ${host} · 测试成功前不会开放重试`
              : '已保存 · 测试成功前不会开放重试',
          ready: ({ host }) => (host ? `已就绪 · ${host}` : '已就绪'),
          failed: ({ error }) => (error ? `上次请求失败 · ${error}` : '上次请求失败'),
          testing: '正在测试连接…',
        },
      },
      section: {
        pinned: '固定入口',
        openNow: '当前打开',
        readingInbox: '阅读收件箱',
        readingFilters: '筛选',
        topicOverview: '主题概览',
        debug: '调试',
      },
      pinned: {
        empty: '从当前打开的标签页固定常用快捷入口。',
        reorderHandle: '拖动以调整固定入口顺序',
        menu: {
          moreActions: '更多操作',
        },
        editor: {
          title: '编辑固定入口',
          subtitle: '更新这个快捷入口的名称和目标地址。',
          nameLabel: '名称',
          namePlaceholder: '项目文档',
          urlLabel: 'URL',
          urlPlaceholder: 'https://example.com',
          save: '保存',
          cancel: '取消',
          close: '关闭',
          closeAriaLabel: '关闭固定入口编辑弹层',
          invalidUrl: '请输入有效的 http 或 https URL。',
        },
      },
      reading: {
        emptyActive: '从“当前”里保存第一篇文章，开始建立阅读收件箱。',
        emptyFiltered: '当前筛选条件下没有匹配的文章。',
        emptyRead: '还没有标记为已读的文章。',
        active: '待读',
        read: '已读',
        topicPending: '主题待定',
        deleteConfirm: '确定删除这篇已保存文章吗？',
        filtersPlaceholder: '随着待读队列增长，这里会出现筛选条件。',
        resultsPlaceholder: '先在左侧收窄范围，再从这里重新打开要读的文章。',
        searchPlaceholder: '搜索标题或站点',
        labelsPending: '分析中',
        labelsWaitingForAi: '等待 AI',
        clearFilters: '清空筛选',
        resultsCount: ({ count, total }) => `${count} / ${total} 篇文章`,
        readingTimeMinutes: ({ count }) => `${count} 分钟阅读`,
        lifecycle: {
          all: '全部',
          active: '未读',
          read: '已读',
        },
        filters: {
          lifecycle: '阅读状态',
          search: '搜索',
          labels: '标签',
          source: '来源',
          time: '时间',
          status: '状态',
          empty: '还没有可用筛选',
        },
        priority: {
          readNow: '现在读',
          worthKeeping: '值得保留',
          skimLater: '稍后略读',
        },
        time: {
          today: '今天',
          last_3_days: '近 3 天',
          last_7_days: '近 7 天',
          older: '更早',
        },
        status: {
          ready: '可读',
          processing: '处理中',
          failed: '失败',
          unopened: '未打开',
          opened: '已打开',
        },
      },
      readingPageActions: {
        dismiss: '隐藏阅读收件箱操作',
        markRead: '标记已读',
        delete: '删除',
      },
      topic: {
        initialLead: '这里会按主题总结你的待读内容，而不是直接展开单篇文章详情。',
        initialBody: '当条目被保存、分析并聚类后，这里会成为你决定下一篇读什么的平静决策层。',
        emptyLead: '还没有保存内容。',
        emptyBody: '从“当前”里保存一篇文章后，这里就会出现主题指引。',
        fallbackLead: '内容已经保存，但主题指引还在等待分析或 AI 配置完成。',
        fallbackBody: '左侧队列仍会保留该条目，等分析可用后你可以继续或重试。',
        fallbackBodyWithSource: ({ site }) => `内容已从 ${site} 保存，等 AI 分析可用后这里会出现主题指引。`,
        defaultTitle: '主题',
        defaultLead: '这是一个基于已分析文章生成的轻量主题视图。',
        defaultBody: '用这个面板来决定下一篇读什么，而不是把完整文章细节堆在这里。',
        defaultAction: '先看这个主题里最新的一篇。',
        representativeArticles: '代表文章',
        formingLead: '文章已经保存，但主题指引仍在形成中。',
        formingBody: '抓取和分析可能会先于主题归类完成。失败或未归类的条目仍会显示在左侧，不会丢失。',
        clusterLead: '你的待读内容已经开始聚成几个清晰主题。',
        clusterCardLead: '这是一个从已保存文章中提炼出的轻量主题簇。',
        startWith: ({ title }) => `先从 ${title} 开始`,
        untitled: '未命名主题',
        nothingToTriageLead: '还没有需要整理的内容。',
        nothingToTriageBody: '从“当前”里保存文章后，这里会逐步形成一个平静的主题概览。',
      },
      footer: {
        openTabs: '打开标签页',
      },
      actions: {
        open: '打开',
        saveForLater: '稍后阅读',
        closeThisTab: '关闭这个标签页',
        pinToShortcuts: '固定到快捷入口',
        closeExtras: '关闭多余标签页',
        closeAllTabs: ({ count }) => `关闭全部 ${count} 个标签页`,
        closeDuplicates: ({ count }) => `关闭 ${count} 个重复标签页`,
        markRead: '标记已读',
        delete: '删除',
        cancel: '取消',
        retry: '重试',
        retryCapture: '重新抓取',
        retryAnalysis: '重新分析',
        resumeAnalysis: '继续分析',
        edit: '编辑',
        remove: '移除',
        dismiss: '移除',
      },
      counts: {
        domains: ({ count }) => `${count} 个域名`,
        tabs: ({ count }) => `${count} 个标签页`,
        tabsOpen: ({ count }) => `${count} 个标签页打开中`,
        duplicates: ({ count }) => `${count} 个重复项`,
        savedPins: ({ count }) => `${count} 个已固定`,
        activeItems: ({ count }) => `${count} 个待读`,
        items: ({ count }) => `${count} 项`,
        articles: ({ count }) => `${count} 篇文章`,
        moreTabs: ({ count }) => `还有 ${count} 个`,
      },
      labels: {
        homepages: '首页类标签',
        tabs: '标签页',
        noResults: '无结果',
        captureUnavailable: '当前页面无法抓取',
      },
      processing: {
        queued: '已排队',
        capturing: '抓取中',
        captured: '已抓取',
        analyzing: '分析中',
        analyzed: '已分析',
        assigning: '归类中',
        assigned: '已就绪',
        ready: '已就绪',
        waiting_for_ai: '等待 AI',
        capture_failed: '抓取失败',
        analysis_failed: '分析失败',
        assignment_failed: '归类失败',
        pending: '等待中',
      },
      recommendedAction: {
        reviewTopic: '查看主题',
        retryAfterFixingAi: '修复 AI 设置后重试',
        retryCapture: '重新抓取',
        waitingForAnalysis: '等待分析',
      },
      reason: {
        captureFailed: '未能抓取文章内容。',
        analysisFailed: '内容已保存，但 AI 分析失败。',
        assignmentFailed: '分析已完成，但主题归类失败。',
        readyInTopic: '已经可以在当前主题中处理。',
        readyForTopicReview: '可以开始查看主题。',
        readyToReopen: '随时可以重新打开继续阅读。',
        waitingForAi: '已完成本地保存。等 AI 测试成功后，这里才会开放重试。',
        waitingForPipeline: '等待后台处理流程完成。',
      },
      statusDetail: {
        waitingForAiBlocked: '文章已经保存在本地；先去 Settings 完成 AI 设置，之后才能继续分析。',
        waitingForAiReady: 'AI 已就绪；点击后会直接继续分析已保存的正文。',
        captureFailed: ({ reason, retry, action }) => `${reason} ${retry} ${action}`,
        analysisFailed: ({ reason, retry, action }) => `${reason} ${retry} ${action}`,
        autoRetryAt: ({ time }) => `系统会在 ${time} 自动重试。`,
        manualRetry: '当前没有安排自动重试。',
        retryCaptureAction: '点击“重新抓取”会重新获取正文，然后继续分析。',
        retryAnalysisAction: '点击“重新分析”会直接复用已保存的正文，不会重新抓取。',
      },
      statusReason: {
        source_tab_closed_before_payload: '源标签页在正文交接前就关闭了。',
        source_tab_loading: '页面一直没有加载完成。',
        runtime_message_failed: '页面没能把正文传回扩展。',
        provider_unavailable: '抓取服务暂时不可用。',
        source_tab_reloaded: '页面在抓取过程中被重新加载了。',
        unsupported_url: '这个页面不支持正文抓取。',
        invalid_analysis_payload: 'AI 返回的结果格式不对。',
        unknown_error: '这一步没有成功完成。',
      },
      debug: {
        copy: '最近的文章处理状态会显示在这里，方便你直接在首页调试抓取、分析和归类。',
        emptyTitle: '还没有流水线活动',
        emptyBody: '最近的文章任务、错误、主机使用情况和重试入口会显示在这里。',
        noRecentError: '最近没有错误',
        noAiHost: '暂无 AI 主机',
        waitingForAi: '等待 AI 设置测试成功后，才允许重试。',
        analyzedAgo: ({ time }) => ` · 分析于 ${time}`,
        stagePrefetch: '预抓取',
        sourceUnknown: '来源：后台',
        sourcePrefetchHit: '来源：预热命中',
        sourceSaveFallback: '来源：保存回退',
        sourceRetry: '来源：重试',
        attemptCount: ({ count }) => `尝试 ${count} 次`,
        nextRetryIn: ({ time }) => `下次重试 ${time}`,
        textSize: ({ count }) => `${count} 字符`,
        errorCode: ({ code }) => `错误码 ${code}`,
      },
      lifecycle: {
        active: '待读',
        read: '已读',
      },
      toast: {
        closedExtraTabOutTabs: '已关闭多余的 Tab Cat 标签页',
        alreadyPinned: '已经固定过了',
        pinnedToNow: '已固定到当前页',
        settingsSaved: '设置已保存',
        languageSavedRefreshRequired: '语言已保存，请刷新页面加载新语言。',
        aiConnectionReady: 'AI 连接已就绪',
        aiConnectionFailed: 'AI 连接失败',
        tabClosed: '标签页已关闭',
        alreadySavedRequeued: '已经保存过，已重新加入处理队列。',
        alreadySaved: '已经保存过了',
        savedToReadingInbox: '已保存到阅读收件箱',
        failedToSaveTab: '保存标签页失败',
        markedRead: '已标记为已读',
        deleted: '已删除',
        queuedForRetry: '已加入重试队列',
        pinUpdated: '固定入口已更新',
        pinRemoved: '固定入口已移除',
        backupExported: '备份已导出',
        backupRestored: '备份已恢复',
        backupFailed: '备份失败',
        closedTabsFromGroup: ({ count, group }) => `已从 ${group} 关闭 ${count} 个标签页`,
        closedDuplicates: '已关闭重复标签页，并保留一份',
        allTabsClosed: '所有标签页都已关闭，重新开始吧。',
      },
      prompt: {
        pinnedTitle: '固定入口标题',
      },
      emptyState: {
        title: '标签页版的 Inbox Zero。',
        subtitle: '你现在轻装上阵了。',
      },
      greeting: {
        morning: '早上好',
        afternoon: '下午好',
        evening: '晚上好',
      },
      timeAgo: {
        justNow: '刚刚',
        minAgo: ({ count }) => `${count} 分钟前`,
        hourAgo: ({ count }) => `${count} 小时前`,
        yesterday: '昨天',
        dayAgo: ({ count }) => `${count} 天前`,
      },
      aiOutput: {
        languageName: 'Simplified Chinese',
      },
    },
  };

  const state = {
    preference: 'auto',
    browserLanguage:
      (typeof navigator !== 'undefined' && navigator.language) || 'en-US',
  };

  function normalizePreference(preference) {
    if (preference === 'zh-CN' || preference === 'en') return preference;
    return 'auto';
  }

  function resolveEffectiveLanguage(preference, browserLanguage) {
    const normalizedPreference = normalizePreference(preference);
    if (normalizedPreference !== 'auto') return normalizedPreference;
    return String(browserLanguage || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  }

  function lookupMessage(language, key) {
    return key.split('.').reduce((current, part) => {
      if (!current || typeof current !== 'object') return undefined;
      return current[part];
    }, MESSAGES[language]);
  }

  function interpolate(template, params) {
    return String(template).replace(/\{(\w+)\}/g, (_, token) => {
      const value = params && Object.prototype.hasOwnProperty.call(params, token)
        ? params[token]
        : '';
      return value == null ? '' : String(value);
    });
  }

  function getEffectiveLanguage() {
    return resolveEffectiveLanguage(state.preference, state.browserLanguage);
  }

  function getLocale() {
    return getEffectiveLanguage() === 'zh-CN' ? 'zh-CN' : 'en-US';
  }

  function t(key, params = {}) {
    const language = getEffectiveLanguage();
    const message =
      lookupMessage(language, key) ??
      lookupMessage('en', key);

    if (typeof message === 'function') {
      return message(params);
    }
    if (typeof message === 'string') {
      return interpolate(message, params);
    }
    return key;
  }

  function setLanguagePreference(preference, browserLanguage) {
    state.preference = normalizePreference(preference);
    if (browserLanguage) {
      state.browserLanguage = browserLanguage;
    }
    return getEffectiveLanguage();
  }

  function getLanguagePreference() {
    return state.preference;
  }

  function apply(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;

    root.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((node) => {
      node.setAttribute('title', t(node.dataset.i18nTitle));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
      node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
    });
  }

  namespace.resolveEffectiveLanguage = resolveEffectiveLanguage;
  namespace.setLanguagePreference = setLanguagePreference;
  namespace.getLanguagePreference = getLanguagePreference;
  namespace.getEffectiveLanguage = getEffectiveLanguage;
  namespace.getLocale = getLocale;
  namespace.t = t;
  namespace.apply = apply;
})();
