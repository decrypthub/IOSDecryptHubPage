// Minimal i18n: dictionary + language switch, persisted in localStorage.
// Default: zh. Static text uses [data-i18n="key"]; JS-rendered text uses t(key).

const LS_KEY = 'idh-lang';

export const DICT = {
  zh: {
    'nav.home': '首页',
    'nav.docs': '文档',
    'nav.news': '研究',
    'lang.switch': 'EN',
    'lang.label': 'English',

    'hero.title2': '看见运行时的真相',
    'hero.sub.1': '设备安装运行时插件，电脑安装 ',
    'hero.sub.2': '。手动连接设备地址，即可开始分析。',
    'hero.dl.meta': 'iOS 14.0+ · arm64 · TrollStore 注入器',
    'hero.dl.title': '下载 dylib v{ver}',
    'hero.src.meta': 'iOS 14.0+ · rootless / roothide',
    'hero.src.title': '添加插件源',
    'hero.src.prompt': '源',
    'hero.idh.meta': 'macOS / Linux · Python 3.10+',
    'hero.idh.title': '安装 idh',
    'hero.scroll': '向下滚动',

    'home.agent.kicker': 'AGENT · MCP',
    'home.agent.title': '像这样，把捕获交给 AI',
    'home.agent.lead': '注入后在 App 里走一遍流程。Claude Code 通过 idh 网关调用设备上的 MCP：先对齐流量、签名和加密调用点，再写出可复用的脚本。',

    'home.panel.kicker': '实时面板',
    'home.panel.title': '插件里的运行时控制台，直接在这里操作',
    'home.panel.lead': '界面与插件内置页面保持一致。切换页签、搜索测试 IPA 产生的日志；加解密页可按分类和输入大小筛选。点任意记录查看 Key、IV、输入输出、HexDump 与调用栈。',

    'home.caps.kicker': 'CAPABILITIES · 能力',
    'home.caps.title': '一条运行时链路，六个观察面',
    'home.caps.lead': '想知道每一面捕获什么，点开看。',

    'docs.kicker': 'DOCS · 文档',
    'docs.title': '从注入到证据',
    'docs.subtitle': '面向公开版本的使用与能力参考：选择注入方式，连接设备端面板，再用 idh / MCP 读取运行时事实。',
    'docs.toc.start': '开始前',
    'docs.toc.install': '安装与连接',
    'docs.toc.workflow': '分析流程',
    'docs.toc.mcp': 'MCP 工具',
    'docs.toc.limits': '边界与限制',
    'docs.start.h2': '开始前',
    'docs.start.lead': 'IOSDecryptHub 运行在目标 App 进程内。它记录调用发生时的参数、结果和调用栈，不是代理服务器，也不会替你获得目标 App 的授权。',
    'docs.start.step1t': '确认分析范围',
    'docs.start.step1d': '只对自有 App 或已获授权的测试目标操作，并准备一台支持 TrollStore 或越狱注入的设备。',
    'docs.start.step2t': '选择注入路线',
    'docs.start.step2d': 'TrollStore 路线使用 dylib 或管理器 App；越狱路线使用插件源中的 rootless / roothide 包。',
    'docs.start.step3t': '启动并连接面板',
    'docs.start.step3d': '启动目标 App 后，在可信局域网的浏览器中打开设备端显示的地址，默认端口从 8088 开始。',
    'docs.start.step4t': '决定是否接入 idh',
    'docs.start.step4d': '只看面板可以停在这里；需要命令行、事件导出或 AI 客户端时，再安装 PC 端 idh 网关。',
    'docs.start.note': '公开版本不做设备自动发现：请使用设备端显示的 IP 和端口手动连接。',
    'docs.install.h2': '安装与连接',
    'docs.install.lead': '三条注入路径共享同一份核心引擎。差别只在于谁负责把 dylib 放进目标 App 进程。',
    'docs.install.tf.h3': 'TrollStore 注入器（推荐）',
    'docs.install.tf.p1': '适用于已经安装 TrollStore 和兼容注入器的设备：',
    'docs.install.tf.s1': '从首页或 GitHub Releases 下载当前版本 dylib。',
    'docs.install.tf.s2': '在注入器中选择授权目标 App，添加 dylib 并执行注入。',
    'docs.install.tf.s3': '完全退出并重新启动目标 App。',
    'docs.install.tf.s4': '从悬浮窗或日志输出确认面板地址，再用浏览器打开。',
    'docs.install.jb.h3': '越狱插件源',
    'docs.install.jb.p1': '适用于 rootless / roothide 环境。两种包对应不同的设备架构，不能混装：',
    'docs.install.jb.s1': '在 Sileo、Zebra 等包管理器中添加插件源。',
    'docs.install.jb.s2': '安装 com.iosdecrypthub，选择与设备环境匹配的包。',
    'docs.install.jb.s3': '在“设置 → IOSDecryptHub”中选择授权目标 App。',
    'docs.install.jb.s4': '重启目标 App，并使用设备端显示的地址连接。',
    'docs.install.idh.h3': 'PC 端 · idh 网关',
    'docs.install.idh.p1': 'idh 不负责发现设备。先从设备面板、悬浮窗或诊断信息取得 IP 和实际端口，再保存连接：',
    'docs.install.idh.p2': 'idh mcp 将设备端 Streamable HTTP MCP 桥接为本机 stdio MCP，可配置给 Codex、Claude 等 AI 客户端。只有一个在线目标时可以省略 target_id。',
    'docs.workflow.h2': '分析流程',
    'docs.workflow.lead': '建议先观察，再缩小范围，最后导出证据。这样可以把高频系统噪声与真正的业务调用分开。',
    'docs.workflow.capture.h3': '先看事件流',
    'docs.workflow.capture.p': '各日志页支持关键词搜索；加解密页还可按分类和输入大小筛选。',
    'docs.workflow.trace.h3': '回到调用点',
    'docs.workflow.trace.p': '打开单条事件查看输入输出、算法元数据和应用层调用栈，再用 symbolicate 或反汇编确认上下文。',
    'docs.workflow.correlate.h3': '关联因果链',
    'docs.workflow.correlate.p': '以网络请求的构建时刻为锚点，关联同一时间窗内的摘要、签名、加密和 Keychain 操作。',
    'docs.workflow.export.h3': '保存最小证据',
    'docs.workflow.export.p': '只导出完成问题所需的事件和诊断信息，敏感字段应在本地加密保存，不要直接分享原始日志。',
    'docs.mcp.h2': 'MCP 工具',
    'docs.mcp.lead': '设备端 MCP 复用 HTTP 服务端口 POST /api/mcp，当前公开版本提供 44 个工具，覆盖反汇编、镜像与符号、运行时事件、沙盒文件、脱壳、动态观察和配置。',
    'docs.mcp.note': '先调用 get_capabilities 和 tools/list 获取当前构建的真实能力。工具可能受变体、目标镜像和设备环境影响，网页示例不是运行时结果。',
    'docs.mcp.in': 'tools/call',
    'docs.mcp.out': 'result',
    'docs.mcp.req': 'required: {r}',
    'docs.limits.h2': '边界与限制',
    'docs.limits.lead': '运行时观察能力有明确边界。把“没有看到”当成线索，而不是把它当成“绝对不存在”。',
    'docs.limits.l1': 'Hook 只覆盖实际可改写的导入符号和 Objective-C 方法；静态链接、私有调用路径或未触发的 API 可能不会出现事件。',
    'docs.limits.l2': '脱壳只处理当前进程已加载的 App Bundle Mach-O；PlugIns/*.appex 等独立进程需要单独注入。',
    'docs.limits.l3': 'MCP 的内存读取和 xref 扫描有大小、可读页和分页限制；响应中的 coverage / confidence 字段必须一并判断。',
    'docs.limits.l4': '网络层是进程内 best-effort 观察：系统 TLS、未走 NSURLSession 的实现或 App 自带库可能需要不同的观察面。',

    'news.kicker': 'RESEARCH · 研究',
    'article.toc': '目录',
    'news.latest': '最新',
    'news.article': '文章',
    'news.readmore': '阅读全文 →',
    'news.back': '← 返回文章列表',

    'foot.desc': '基于 fishhook 的 iOS App 运行时加解密审计与逆向分析平台。',
    'foot.copy': '© 2026 taisuii · IOSDecryptHub · 仅供授权安全测试与研究',
    'foot.built': '由 <a href="https://github.com/taisuii" target="_blank" rel="noopener noreferrer">taisuii</a> 构建 · Vite · Three.js',
    'foot.wechat': '微信搜一搜 DecryptHub',
    'foot.wechat.net': '微信公众号',
    'foot.copied': '已复制',

    'panel.search': '搜索本类: 算法/路径/明文/Hex…',
    'panel.filter': '筛选',
    'panel.cat': '分类',
    'panel.catAll': '全部',
    'panel.size': '输入大小',
    'panel.any': '不限',
    'panel.clear': '清除',
    'panel.meta': 'in:{in}B · out:{out}B',
    'panel.copyAll': '复制整条',
    'panel.copyInput': '复制明文',
    'panel.copied': '已复制',
    'panel.in': '输入 / INPUT',
    'panel.out': '输出 / OUTPUT',
    'panel.stack': '调用栈 ({n} 帧)',
    'panel.emptyList': '没有匹配记录',
    'panel.emptyDetail': '调整筛选条件后查看详情',
    'panel.filesHead': '沙盒根',
    'panel.symbolsHead': 'image 列表（导入符号均为 fishhook 候选）',
    'panel.symbolsPh': '过滤符号（如 SSL / CC / open）…',
    'panel.symbolsCount': '{n} / {m} 个',
    'panel.symbolsImports': '{n} 个导入符号',
    'panel.symbolsTh': '导入符号（均为 fishhook 候选）',
    'panel.dumpH2': '应用砸壳 (脱壳 / dump)',
    'panel.dumpP': '当前进程已加载的 App Bundle Mach-O 镜像',
    'panel.dumpImage': '镜像',
    'panel.dumpType': '类型',
    'panel.dumpSize': '大小',
    'panel.dumpStatus': '状态',
    'panel.dumpAction': '操作',
    'panel.dumpEnc': '已加密',
    'panel.dumpPlain': '未加密',
    'panel.dumpDownload': '下载',
    'panel.tab.crypto': '加解密',
    'panel.tab.sys': '系统',
    'panel.tab.net': '网络',
    'panel.tab.keychain': 'Keychain',
    'panel.tab.files': '文件',
    'panel.tab.symbols': '符号',
    'panel.tab.dump': 'Dump',
    'panel.cat.digest': '摘要',
    'panel.cat.hmac': 'HMAC',
    'panel.cat.symm': '对称',
    'panel.cat.asym': '非对称',
    'panel.cat.kdf': 'KDF',
    'panel.cat.file': '文件',
    'panel.cat.sys': '系统',
    'panel.cat.net': '网络',
    'panel.cat.keychain': 'Keychain',
  },

  en: {
    'nav.home': 'Home',
    'nav.docs': 'Docs',
    'nav.news': 'Research',
    'lang.switch': '中',
    'lang.label': '中文',

    'hero.title2': 'See the truth at runtime',
    'hero.sub.1': 'Install the runtime plugin on your device and ',
    'hero.sub.2': ' on your computer. Connect it to the device address to start analyzing.',
    'hero.dl.meta': 'iOS 14.0+ · arm64 · TrollStore Injector',
    'hero.dl.title': 'Download dylib v{ver}',
    'hero.src.meta': 'iOS 14.0+ · rootless / roothide',
    'hero.src.title': 'Add plugin repo',
    'hero.src.prompt': 'repo',
    'hero.idh.meta': 'macOS / Linux · Python 3.10+',
    'hero.idh.title': 'Install idh',
    'hero.scroll': 'Scroll down',

    'home.agent.kicker': 'AGENT · MCP',
    'home.agent.title': 'Hand the capture to an AI agent',
    'home.agent.lead': 'Inject, tap through a flow in the app. Claude Code calls on-device MCP through the idh gateway: align traffic, signatures and encrypt call sites, then emit a reusable script.',

    'home.panel.kicker': 'Live Panel',
    'home.panel.title': 'The plugin runtime console, right here',
    'home.panel.lead': 'Same UI as the plugin\u2019s built-in page. Switch tabs and search logs; crypto also filters by category and input size. Click any record to inspect Key, IV, input/output, HexDump and call stack.',

    'home.caps.kicker': 'CAPABILITIES',
    'home.caps.title': 'One runtime link, six observation surfaces',
    'home.caps.lead': 'Expand any row to see what it captures.',

    'docs.kicker': 'DOCS · Documentation',
    'docs.title': 'From injection to evidence',
    'docs.subtitle': 'A public-release guide to choosing an injection path, opening the runtime panel, and using idh / MCP to inspect facts from a running app.',
    'docs.toc.start': 'Before you start',
    'docs.toc.install': 'Install & connect',
    'docs.toc.workflow': 'Analysis workflow',
    'docs.toc.mcp': 'MCP tools',
    'docs.toc.limits': 'Limits',
    'docs.start.h2': 'Before you start',
    'docs.start.lead': 'IOSDecryptHub runs inside the target app process. It records arguments, results and call stacks at the point of invocation; it is not a proxy and cannot grant authorization for a target app.',
    'docs.start.step1t': 'Confirm the scope',
    'docs.start.step1d': 'Analyze only your own apps or authorized targets, and prepare a device that supports TrollStore or jailbreak injection.',
    'docs.start.step2t': 'Choose an injection path',
    'docs.start.step2d': 'The TrollStore path uses a dylib or manager app; the jailbreak path uses the rootless / roothide package from the repository.',
    'docs.start.step3t': 'Launch and open the panel',
    'docs.start.step3d': 'Launch the target app, then open the address shown by the device in a trusted LAN browser. The default port range starts at 8088.',
    'docs.start.step4t': 'Add idh only when needed',
    'docs.start.step4d': 'Stop at the panel for interactive inspection; install the PC gateway when you need CLI commands, exports or an AI client.',
    'docs.start.note': 'The public release does not auto-discover devices: connect manually with the IP and port shown by the device.',
    'docs.install.h2': 'Install & connect',
    'docs.install.lead': 'All three injection paths share one core engine. The difference is which carrier places the dylib inside the target app process.',
    'docs.install.tf.h3': 'TrollStore injector (recommended)',
    'docs.install.tf.p1': 'For devices with TrollStore and a compatible injector installed:',
    'docs.install.tf.s1': 'Download the current dylib from the homepage or GitHub Releases.',
    'docs.install.tf.s2': 'Select the authorized target app, add the dylib and run the injection.',
    'docs.install.tf.s3': 'Fully quit and relaunch the target app.',
    'docs.install.tf.s4': 'Use the floating status window or diagnostics to get the panel address, then open it in a browser.',
    'docs.install.jb.h3': 'Jailbreak package repository',
    'docs.install.jb.p1': 'For rootless / roothide environments. The two packages target different device architectures and must not be mixed:',
    'docs.install.jb.s1': 'Add the repository in Sileo, Zebra or another package manager.',
    'docs.install.jb.s2': 'Install com.iosdecrypthub and choose the package matching the device environment.',
    'docs.install.jb.s3': 'Select the authorized target app under Settings → IOSDecryptHub.',
    'docs.install.jb.s4': 'Relaunch the target app and connect to the address shown by the device.',
    'docs.install.idh.h3': 'PC side · idh gateway',
    'docs.install.idh.p1': 'idh does not discover devices. Get the IP and actual port from the panel, floating window or diagnostics, then save the connection:',
    'docs.install.idh.p2': 'idh mcp bridges the device Streamable HTTP MCP to local stdio MCP for Codex, Claude and other AI clients. With one online target, target_id can be omitted.',
    'docs.workflow.h2': 'Analysis workflow',
    'docs.workflow.lead': 'Observe first, narrow the scope second, and export evidence last. This keeps high-volume system noise separate from business calls.',
    'docs.workflow.capture.h3': 'Start with the event stream',
    'docs.workflow.capture.p': 'Every log tab supports keyword search; the crypto tab also filters by category and input size.',
    'docs.workflow.trace.h3': 'Return to the call site',
    'docs.workflow.trace.p': 'Open an event to inspect input/output, algorithm metadata and the app call stack, then use symbolicate or disassembly to confirm context.',
    'docs.workflow.correlate.h3': 'Build the causal chain',
    'docs.workflow.correlate.p': 'Use the network request build time as an anchor and correlate digest, signature, encryption and Keychain operations in the same window.',
    'docs.workflow.export.h3': 'Keep the smallest evidence set',
    'docs.workflow.export.p': 'Export only what answers the question. Encrypt sensitive fields locally and never share raw logs by default.',
    'docs.mcp.h2': 'MCP tools',
    'docs.mcp.lead': 'The device MCP server reuses the HTTP endpoint POST /api/mcp. The public build exposes 44 tools across disassembly, images and symbols, runtime events, sandbox files, dumps, dynamic observation and configuration.',
    'docs.mcp.note': 'Call get_capabilities and tools/list first to discover the real capabilities of the current build. Tools vary with the variant, target image and device environment; the web examples are not live results.',
    'docs.mcp.in': 'tools/call',
    'docs.mcp.out': 'result',
    'docs.mcp.req': 'required: {r}',
    'docs.limits.h2': 'Limits',
    'docs.limits.lead': 'Runtime observation has hard boundaries. Treat “not observed” as a lead, not as proof of absence.',
    'docs.limits.l1': 'Hooks cover rebindable imported symbols and Objective-C methods; statically linked code, private paths or APIs that were not exercised may produce no event.',
    'docs.limits.l2': 'Dumping covers App Bundle Mach-Os loaded in the current process; independent processes such as PlugIns/*.appex need separate injection.',
    'docs.limits.l3': 'MCP memory reads and xref scans have size, readable-page and paging limits; always inspect coverage and confidence fields in the response.',
    'docs.limits.l4': 'The network layer is best-effort and in-process: system TLS, non-NSURLSession implementations or bundled libraries may require a different observation surface.',

    'news.kicker': 'RESEARCH',
    'article.toc': 'Contents',
    'news.latest': 'Latest',
    'news.article': 'Article',
    'news.readmore': 'Read more →',
    'news.back': '← Back to list',

    'foot.desc': 'fishhook-based runtime crypto audit & reverse engineering platform for iOS apps.',
    'foot.copy': '© 2026 taisuii · IOSDecryptHub · For authorized security testing & research only',
    'foot.built': 'Created by <a href="https://github.com/taisuii" target="_blank" rel="noopener noreferrer">taisuii</a> · Vite · Three.js',
    'foot.wechat': 'Search WeChat for DecryptHub',
    'foot.wechat.net': 'WeChat Official',
    'foot.copied': 'Copied',

    'panel.search': 'Search: algo/path/plain/hex…',
    'panel.filter': 'Filters',
    'panel.cat': 'Category',
    'panel.catAll': 'All',
    'panel.size': 'Input size',
    'panel.any': 'any',
    'panel.clear': 'Clear',
    'panel.meta': 'in:{in}B · out:{out}B',
    'panel.copyAll': 'Copy all',
    'panel.copyInput': 'Copy plaintext',
    'panel.copied': 'Copied',
    'panel.in': 'INPUT',
    'panel.out': 'OUTPUT',
    'panel.stack': 'Call stack ({n} frames)',
    'panel.emptyList': 'No matching records',
    'panel.emptyDetail': 'Adjust filters to see details',
    'panel.filesHead': 'Sandbox root',
    'panel.symbolsHead': 'images (all imports are fishhook candidates)',
    'panel.symbolsPh': 'Filter symbols (SSL / CC / open)…',
    'panel.symbolsCount': '{n} / {m}',
    'panel.symbolsImports': '{n} imports',
    'panel.symbolsTh': 'Imported symbols (fishhook candidates)',
    'panel.dumpH2': 'App decrypt (dump)',
    'panel.dumpP': 'App Bundle Mach-O images loaded in this process',
    'panel.dumpImage': 'Image',
    'panel.dumpType': 'Type',
    'panel.dumpSize': 'Size',
    'panel.dumpStatus': 'Status',
    'panel.dumpAction': 'Action',
    'panel.dumpEnc': 'Encrypted',
    'panel.dumpPlain': 'Not encrypted',
    'panel.dumpDownload': 'Download',
    'panel.tab.crypto': 'Crypto',
    'panel.tab.sys': 'System',
    'panel.tab.net': 'Network',
    'panel.tab.keychain': 'Keychain',
    'panel.tab.files': 'Files',
    'panel.tab.symbols': 'Symbols',
    'panel.tab.dump': 'Dump',
    'panel.cat.digest': 'Digest',
    'panel.cat.hmac': 'HMAC',
    'panel.cat.symm': 'Symmetric',
    'panel.cat.asym': 'Asymmetric',
    'panel.cat.kdf': 'KDF',
    'panel.cat.file': 'File',
    'panel.cat.sys': 'System',
    'panel.cat.net': 'Network',
    'panel.cat.keychain': 'Keychain',
  },
};

function storedLang() {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

let lang = storedLang() === 'en' ? 'en' : 'zh';

export function getLang() {
  return lang;
}

export function t(key) {
  const table = DICT[lang] || DICT.zh;
  return table[key] ?? DICT.zh[key] ?? key;
}

export function tpl(key, values) {
  return Object.entries(values).reduce((out, [k, v]) => out.replace(`{${k}}`, String(v)), t(key));
}

export function translateStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPh);
  });
}

export function setLang(next, { persist = true } = {}) {
  if (next !== 'zh' && next !== 'en') return;
  lang = next;
  if (persist) {
    try {
      localStorage.setItem(LS_KEY, next);
    } catch {
      /* ignore */
    }
  }
  document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
  translateStatic();
  document.dispatchEvent(new CustomEvent('idh:langchange', { detail: next }));
}

export function initI18n() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  translateStatic();
}
