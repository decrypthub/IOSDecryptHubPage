// 技术文章（news）数据源。
// 技术文章与正式发布说明：区分已交付能力和后续规划。
// content 为 markdown，双语。
//
// LEGACY_SLUG_ALIASES：历史文章 slug → 本文 slug，保证旧 #/<slug> 链接不 404。

export const LEGACY_SLUG_ALIASES = {
  'how-it-works-architecture': 'deep-dive',
  'hook-engine-inventory': 'deep-dive',
  'crypto-capture-semantics': 'deep-dive',
  'jailbreak-hiding-surface': 'deep-dive',
  'network-capture-layers': 'deep-dive',
  'macho-dump-internals': 'deep-dive',
  'mcp-static-analysis-tools': 'deep-dive',
  'architecture-overview': 'deep-dive',
  'crypto-capture': 'deep-dive',
  'anti-detection-and-network': 'deep-dive',
  'dump-and-mcp-analysis': 'deep-dive',
};

export const NEWS_ARTICLES = [
  {
    slug: 'v1-27-6-independent-projects',
    date: '2026-10-26',
    tag: '更新',
    tagEn: 'Release',
    title: 'v1.27.6：巨魔与越狱独立维护，越狱改用整包更新',
    summary: '两个公开项目分别发布；巨魔维持既有能力，越狱按环境提供完整 deb，交给包管理器统一升级。',
    content: `巨魔版由 [IOSDecryptHubTrollStore](https://github.com/decrypthub/IOSDecryptHubTrollStore/releases/tag/v1.27.6) 维护，继续提供现有注入、Web / MCP 与脱壳能力。

越狱版由 [IOSDecryptHubJB](https://github.com/decrypthub/IOSDecryptHubJB/releases/tag/v1.27.6) 维护，基于组织正式完整 v1 源码构建 Manager、Loader、一次性管理 daemon 和引擎。rootless 与 RootHide 分别提供适配的完整 deb。

在 Sileo / Zebra 添加 https://ios.decrypthub.com 后刷新源，升级 IOSDecryptHub 完整包。v1.27.6 的 Manager 按包架构检查 APT 版本，更新和回退交给包管理器；旧单引擎替换路径已移除。源公钥与包 ID 沿用既有配置，保留旧版本。

后续越狱版将参考 Android 项目改造常驻分析服务与手机 UI，并增加 Inline Hook / Trace。本次维护更新不包含这些新能力，当前 daemon 仍在处理请求后退出。已完成 Mac 回归与完整包构建检查，尚未进行手机安装升级验收。`,
    en: {
      title: 'v1.27.6: independent editions and complete jailbreak updates',
      summary: 'Separate public releases. TrollStore retains existing capabilities; jailbreak users update complete deb packages through their package manager.',
      content: `The [TrollStore edition](https://github.com/decrypthub/IOSDecryptHubTrollStore/releases/tag/v1.27.6) retains its existing injection, Web / MCP and dumping capabilities.

The [jailbreak edition](https://github.com/decrypthub/IOSDecryptHubJB/releases/tag/v1.27.6) packages Manager, Loader, the one-shot management daemon and engine together, with separate rootless and RootHide builds. Add https://ios.decrypthub.com in Sileo / Zebra and refresh to update the complete package. The package ID and repository signing key remain compatible; old versions are retained.

Version checks now use the APT index for the installed package architecture. Installation and rollback belong to the package manager; standalone engine replacement is removed. Persistent phone analysis services, a new Manager, Inline Hook and Trace remain future work. Mac regression and package checks passed; device installation and upgrade have not been verified.`,
    },
  },
  {
    slug: 'deep-dive',
    date: '2026-08-04',
    tag: '研究',
    tagEn: 'Research',
    title: 'IOSDecryptHub：免越狱看清加解密，兼砸壳与 MCP',
    summary: '免越狱注入目标进程，在系统 API 调用点记录加解密、网络、Keychain 等行为：取到密钥、IV、明文与调用栈，按时间窗关联成因果链，并作为 44 个 MCP 工具经 idh 提供给 AI 客户端。',
    content: `IOSDecryptHub 免越狱注入进目标进程，站在系统 API 的调用点上，记录真实发生的参数、结果和调用栈——覆盖加解密、网络、文件、Keychain 与动态加载。数据流为：hook → 语义化捕获 → 分类日志 → HTTP/MCP 服务 → idh 网关 → AI 客户端。

## 网络请求与响应

捕获 \`NSURLSession\` 的请求与响应，method、URL、请求头、请求体、响应体记录在同一条里。数据取自 App 自己的调用链，明文在进入 TLS 之前，不经过代理、不依赖证书、与 pinning 无关。分三层，统一受 \`DH_CAP_NETWORK\` 开关控制。

completion 型是主流用法。swizzle \`dataTaskWithRequest:completionHandler:\`、\`dataTaskWithURL:completionHandler:\`、\`uploadTaskWithRequest:fromData:completionHandler:\`，把 completion block 包一层——闭包捕获原方法的 request，响应到达时请求体、URL、头依然可读，请求与响应天然配对。包装体 \`@try/@catch\`，日志失败不影响原 block。

delegate 型任务没有 completion，请求只在 \`-[NSURLSessionTask resume]\` 可见；swizzle resume 从 \`task.currentRequest\` 取数。与第一层去重靠 \`objc_setAssociatedObject\`：completion 已配对的 task 打标记，resume 命中标记即跳过，一个任务只记一次。

App 自带 OpenSSL/BoringSSL、不走系统 TLS 时，fishhook \`SSL_write\` / \`SSL_read\` 抓明文字节流，\`void *ssl\` 占位不解析会话。系统 TLS 不经 App 的 import slot，这一层多不命中，定位为 best-effort 补充。网络记录锚定请求构建时刻的时间戳与线程号，不是响应到达时刻——见跨事件关联。

## 加解密：算法、密钥与明文

六族全覆盖，每次调用记录算法、模式、padding、key、IV 与明文/密文，输出形如 \`AES-256-CBC · encrypt · PKCS7\`。key 与 IV 在原函数执行前从缓冲区读取，此时仍是原始材料。

- 摘要：MD2/4/5、SHA1/224/256/384/512，一次性与流式（Init/Update/Final）都覆盖；流式用 ctx 指针关联一个累积缓冲，Final 时产出完整明文加摘要。
- HMAC：\`CCHmac\` 一次性 + \`CCHmacInit/Update/Final\` 流式。
- 对称：\`CCCrypt\` 一次性 + \`CCCryptorCreate/CreateWithMode/Update/Final/Release\` 流式。
- 非对称：\`SecKeyCreateSignature\` / \`SecKeyVerifySignature\` / \`SecKeyCreateEncryptedData\` / \`SecKeyCreateDecryptedData\`。
- KDF：\`CCKeyDerivationPBKDF\`，输入含口令明文、salt 与迭代次数，派生密钥调用后可读。
- OpenSSL EVP：\`EVP_EncryptInit_ex/_ex2\`、\`EVP_DecryptInit_ex/_ex2\`、\`EVP_CipherInit_ex/_ex2\` 及对应 Update/Final，外加 \`EVP_CIPHER_CTX_ctrl\`（AEAD 的 AAD/tag）。符号只在目标自身链接 libcrypto 时才出现在导入表。

\`CCCrypt\` 八个参数按序翻译：算法名由 \`alg\` 枚举加 \`keyLen\` 组合，模式与 padding 由 \`options\` 位判定，操作位决定 input 还是 output 标为明文。

\`\`\`
CCCrypt(op, alg, options, key, keyLen, iv, dataIn, ...)
        └ 0/1  └ AES/DES  └ ECB|PKCS7   └ 读取   └ keyLen=32 → AES-256
\`\`\`

流式对称走 Create→Update→Final 状态机，以 \`CCCryptorRef\` 为 key 维护会话表：Create 记算法/模式/key/iv，Update 追加分片不落记录，Final 拼出完整明文密文并输出一条，Release 删会话。App 反复 Update 却不 Final 的会话由 Release 钩子回收，会话表不会无限增长。

非对称算法参数是一个 CFDictionary，用 \`CFDictionaryGetValue\` 取 \`kSecAttrKeyType\`、\`kSecAttrKeySizeInBits\`、\`kSecAttrKeyClass\`，拼出 \`RSA-2048 PKCS1v15-SHA256\`、\`EC secp256r1\`；SecKeyRef 保持不透明，只记地址与用途。EVP 侧用 \`dlsym\` 懒解析 \`EVP_CIPHER_get0_name\` / \`_key_length\` / \`_iv_length\`，调原版辅助函数取算法名与长度，兼容 OpenSSL 1.1/3.x。

## 跨事件关联

以一次网络请求为锚（\`net_seq\`），聚合同一时间窗内的加解密与 Keychain 事件，按 \`deltaMs\` 排序；请求头 base64 解码为 hex 后与各事件的加密输出比对，定位它由哪次加密产生（默认扫全部 base64 头，\`X-Validator\` 优先，也可指定单个头）。

关键在时间锚点：网络记录存的 \`timestampMs\` / \`threadId\` 是请求构建时刻的值，不是响应到达时刻。慢请求若用响应时刻做锚点，会把同期加解密事件挤出关联窗口。由此，一次登录请求的签名、加密、写 Keychain 落在同一条因果链上。聚合与反查由 \`correlate_request\` 执行。

## 运行时交叉引用与符号

把运行时地址还原成语义。所有内存读取走 \`vm_read_overwrite\`，不可读页返回错误、绝不崩溃。工具按 tier 组织：

| tier | 工具 | 回答 |
|---|---|---|
| 0 | \`get_macho_info\` / \`list_images\` / \`list_imports\` | 镜像、导入符号、dyld 地图 |
| 0 | \`disassemble\` / \`analyze_function\` / \`disassemble_function\` | 字节或地址反汇编成结构化指令 |
| 1 | \`find_xrefs\` | 谁调用了它 |
| 2 | \`find_string_refs\` / \`find_selector_refs\` | 谁引用字符串 / 谁发这个 selector |
| 3 | \`find_function_refs\` / \`list_functions\` | 调用图 / 函数清单 |
| 4 | \`objc_resolve_imp\` / \`find_objc_methods\` | selector 当前 IMP / runtime 方法实体 |

\`find_xrefs\` 只认直接 \`bl\`：线性扫 \`__text\` 收集调用点，目标落在 import stub 区则经运行时已绑定的 GOT 加 \`dladdr\` 还原真实符号；\`resolved_name\` 反映运行时真正到达的目标，若该导入已被 fishhook 改写会如实显示 hook 符号。\`find_string_refs\` 识别 ADRP+ADD（直接）与 ADRP+LDR 指针槽（间接），落在字符串 section 才记，局部窗口按寄存器缓存最近 ADRP 页、寄存器被写即失效，不做跨基本块数据流。\`find_selector_refs\` 覆盖经典 selref 加载加 \`objc_msgSend\`（x1 状态机）与现代 \`__objc_stubs\` 两条路径，裸 selref 加载不报。四个扫描工具单次最多扫 48MB \`__text\`，响应带 \`next_scan_offset\`，没扫完须翻页。

反汇编内嵌 Capstone 5.0.1（仅 ARM/AArch64）。每条指令除 mnemonic/op_str 外返回结构化操作数、显式读写寄存器与控制流分组；ARM64 的 MOVZ/MOVN/MOVK 额外给常量重建（value/known_mask/complete），常量跟踪只在当前线性指令流内有效，遇控制流或寄存器覆盖即标 \`complete=false\`。\`disassemble_function\` 优先用 \`LC_FUNCTION_STARTS\` 归一化函数边界，响应带 \`boundary_source\` / \`confidence\`。\`objc_resolve_imp\` 只返回 selector 当前 IMP，声明 \`original_imp_known=false\`，不宣称恢复 swizzle 前的实现。

运行时 xref 比静态文件多三个信息源：dyld 已完成 rebase 与 bind，GOT 中为真实地址；\`dladdr\` 映射回镜像与最近符号；可直接问 runtime 某 selector 当前执行哪段代码。xref 的答案由 \`0x1029ac000\` 变为 \`-[SessionCipher encrypt:]+0x88\`。

## MCP 服务与 idh 网关

设备端内嵌 MCP 服务，将上述能力暴露为 44 个工具，复用 dylib 内嵌 HTTP 的 \`POST /api/mcp\`（Streamable HTTP + JSON-RPC 2.0，支持 initialize/tools/list/tools/call，会话经 \`Mcp-Session-Id\` 头维护，不额外占端口；默认 8088，占用时在 8088..8108 内选空闲端口）。

分析入口在 PC，\`idh\` 做连接与桥接。不做自动发现：注入场景控制不了宿主 Info.plist，Bonjour/mDNS 会静默失败，设备 IP 与端口从面板或诊断人工获取，\`idh connect <设备IP>:8088\` 手动指定并持久化。桥接把 HTTP MCP 转成 stdio，供 Claude / Codex 配置；聚合网关暴露固定工具集 \`idh_list_devices\` / \`idh_list_tools\` / \`idh_get_tool_schema\` / \`idh_call_tool\` / \`idh_get_panel_url\`，设备上下线不会让客户端缓存的 tools/list 失效。

两个约束：改状态的工具（\`set_pause\`、\`start_dump\`）必须显式传 \`allow_mutation=true\`，透明代理在 schema 里强制加这个必填字段；\`export_events\` 以 \`snapshot_until_seq\` 固定上界、\`next_after_seq\` 翻页直到 \`has_more=false\`，导出期间新事件不造成重复或漂移。

## Hook 机制

三种手段互补：fishhook 改写 GOT 与符号指针，覆盖 C 函数；ObjC method swizzle 在 runtime 换 IMP，覆盖 Objective-C 方法；dlsym 重定向拦截 \`dlsym(RTLD_DEFAULT, ...)\` 的动态取址，命中已 hook 符号时返回 wrapper 地址，堵住绕过 GOT 的旁路。

三者只改指针、不改指令。免越狱侧载拿不到 \`dynamic-codesigning\` entitlement，内核拒绝分配可执行内存，inline hook 物理上不可用——因此 TrollStore 与越狱加载器两条注入路线行为一致。每个 hook 安装后自检，失败的符号上报健康模块，\`/api/stats\` 与 MCP \`get_diag\` 可见安装/失败计数，装不上静默降级不崩溃。

## 砸壳

App Store 二进制的 \`__TEXT\` 由 FairPlay 加密（\`LC_ENCRYPTION_INFO_64\` 标记 \`cryptid=1\`），运行时内存里已是明文。砸壳是一次导出，四步：

1. \`_dyld_image_count\` / \`_dyld_get_image_header\` 枚举镜像，过滤主 bundle 内主程序与 Frameworks（排除系统库），读 \`LC_ENCRYPTION_INFO_64\` 确认 \`cryptid=1\` 才进入。
2. 进程内镜像有 rebase slide，不能整段 memcpy；复制文件头与全部 load commands 后，除 \`__LINKEDIT\` 外的段按 \`fileoff\` 把对应内存页写回（地址减 slide 才是段的内存起点）。
3. \`__LINKEDIT\`（符号表、字符串表、dyld info）在磁盘上本就是明文，从原文件直拷。
4. \`cryptid\` 置 0，并把加密段的 \`filesize\` 展开为真实大小，避免静态分析器读到截断的 \`__text\`。

产物可直接进 IDA / Ghidra / class-dump，跳过 \`SC_Info\` 与 FairPlay 残留避免误导重签工具。砸壳在 \`dump_manager\` 里作为异步任务执行，专用队列轮询状态，不阻塞 HTTP 与 hook 线程。\`PlugIns/*.appex\` 是独立进程，主进程未加载就砸不到。

## 进程内伪装

在 App 的检测点上回答一致的假答案，覆盖四类检测面；每个 swizzle 都带"配置为空则透传原实现"的守卫，不配置就不干预。

- 文件：\`hooked_open\` 命中路径黑名单（\`/var/jb\`、\`/bin/bash\`、\`libjailbreak.dylib\` 等）返回 ENOENT；access/stat 与 open 走同一判定，三条探测路径答案一致。
- dyld：\`_dyld_get_image_name\` 与 \`dladdr\` 命中黑名单镜像时返回无害占位名、抹掉 \`dli_fname\`，每条只记一次。
- ObjC：\`-[UIApplication canOpenURL:]\` 对 \`cydia\` 等 scheme 返回 NO；\`UIDevice\`、\`NSProcessInfo.operatingSystemVersion\`、\`ASIdentifierManager.advertisingIdentifier\` 返回配置值，支持随机化。
- 反调试：\`ptrace\` 的 \`PT_DENY_ATTACH\` 拦截，\`sysctl\` 的 \`KERN_PROC_PID\` 查询开启伪装时清 \`P_TRACED\` 位后返回。

所有隐藏只作用于本进程的 API 返回值，跨 App、系统服务、服务端画像不受影响。

## 存储、噪声与稳定性

\`DHLogStore\` 为每个分类维护独立环形缓冲，一类高频事件挤不爆别的类。\`MGCopyAnswer\` 这类高频系统调用按噪声规则分到独立噪声板（crypto/sys 两块独立开关），不进主事件流，面板上是收敛过的业务信号，噪声板仍可单独查询。落盘用常开 append 句柄加滚动归档，App 崩溃或被杀重启后仍可取回全量，断连不清空。

不崩溃是底线：不可信内存读取走 \`vm_read_overwrite\` 或 \`@try/@catch\`，hook 函数内禁止耗时 I/O，分配失败必须检查，日志与网络失败静默降级。

## 边界与限制

- 只覆盖可改写的导入符号与 ObjC 方法；静态链接、私有路径或未触发的 API 不产生事件，"没看到"不等于"不存在"。
- MCP 工具受变体（dev/trollstore/rootless）、目标镜像与设备环境影响，动手前先 \`get_capabilities\` 握手。
- 进程内伪装只改本进程的 API 返回值，不是隐身。
- HTTP 与 MCP 无身份认证，仅限可信局域网，不要暴露公网。
- 事件可能包含 key、IV、明文、token，按敏感材料处理。`,
    en: {
      title: 'IOSDecryptHub: see the crypto without a jailbreak — plus dumping and MCP',
      summary: 'Injects into the target process without a jailbreak and records crypto, network and Keychain behavior at system-API call sites: captures keys, IVs, plaintext and call stacks, correlates them into causal chains by time window, and exposes 44 MCP tools to AI clients via idh.',
      content: `IOSDecryptHub injects into the target process without a jailbreak and records the real arguments, results and call stacks at system-API call sites — across crypto, network, file, Keychain and dynamic loading. The data flow: hook → semantic capture → categorized logs → HTTP/MCP service → idh gateway → AI clients.

## Network requests and responses

Captures \`NSURLSession\` requests and responses — method, URL, headers, body, response body in one record. Data comes from the app's own call chain, plaintext before TLS, so no proxy, no certificate, pinning-agnostic. Three layers, all gated by \`DH_CAP_NETWORK\`.

Completion-handlers are the mainstream usage. Swizzle \`dataTaskWithRequest:completionHandler:\`, \`dataTaskWithURL:completionHandler:\` and \`uploadTaskWithRequest:fromData:completionHandler:\`, wrapping the completion block — the closure captures the original request, so when the response arrives the body, URL and headers are still readable and request pairs with response. The wrapper is \`@try/@catch\` guarded; a logging failure never touches the original block.

Delegate-style tasks have no completion block; the request is visible only at \`-[NSURLSessionTask resume]\`. Swizzle resume and read \`task.currentRequest\`. Dedup against layer one uses \`objc_setAssociatedObject\`: tasks already paired by completion carry a mark, resume skips marked ones — one task, one record.

When an app bundles OpenSSL/BoringSSL and bypasses system TLS, fishhooked \`SSL_write\` / \`SSL_read\` capture the plaintext byte stream, with \`void *ssl\` as an opaque placeholder. System TLS never passes through app import slots, so this layer often misses — positioned as best-effort. A network record is anchored at request-construction time, not response arrival — see correlation below.

## Crypto: algorithm, key, plaintext

Six families, fully covered. Each call records algorithm, mode, padding, key, IV and plaintext/ciphertext, formatted as \`AES-256-CBC · encrypt · PKCS7\`. Key and IV are read from the buffer before the original call runs, while the raw material is still there.

- Digest: MD2/4/5, SHA1/224/256/384/512, one-shot and streaming (Init/Update/Final); streaming keys an accumulation buffer to the ctx pointer and emits full plaintext plus digest at Final.
- HMAC: one-shot \`CCHmac\` + streaming \`CCHmacInit/Update/Final\`.
- Symmetric: one-shot \`CCCrypt\` + streaming \`CCCryptorCreate/CreateWithMode/Update/Final/Release\`.
- Asymmetric: \`SecKeyCreateSignature\` / \`SecKeyVerifySignature\` / \`SecKeyCreateEncryptedData\` / \`SecKeyCreateDecryptedData\`.
- KDF: \`CCKeyDerivationPBKDF\` — passphrase plaintext, salt and iteration count in the arguments; the derived key is readable afterward.
- OpenSSL EVP: \`EVP_EncryptInit_ex/_ex2\`, \`EVP_DecryptInit_ex/_ex2\`, \`EVP_CipherInit_ex/_ex2\` with their Update/Final, plus \`EVP_CIPHER_CTX_ctrl\` (AEAD AAD/tag). Symbols appear only when the target itself links libcrypto.

The eight \`CCCrypt\` arguments are translated in order: algorithm name from the \`alg\` enum plus \`keyLen\`, mode and padding from \`options\` bits, the op bit deciding whether input or output is the plaintext.

\`\`\`
CCCrypt(op, alg, options, key, keyLen, iv, dataIn, ...)
        └ 0/1  └ AES/DES  └ ECB|PKCS7   └ read   └ keyLen=32 → AES-256
\`\`\`

Streaming symmetric runs a Create→Update→Final state machine with a session table keyed by \`CCCryptorRef\`: Create records algorithm/mode/key/iv, Update appends chunks without a record, Final reassembles full plaintext/ciphertext and emits one record, Release destroys the session. A session that Updates but never Finals is reclaimed via the Release hook, so the table never grows unbounded.

The asymmetric algorithm parameter is a CFDictionary; \`CFDictionaryGetValue\` pulls \`kSecAttrKeyType\`, \`kSecAttrKeySizeInBits\` and \`kSecAttrKeyClass\` to build \`RSA-2048 PKCS1v15-SHA256\` or \`EC secp256r1\`; the SecKeyRef stays opaque. EVP lazily resolves \`EVP_CIPHER_get0_name\` / \`_key_length\` / \`_iv_length\` via \`dlsym\` and calls the originals — compatible with OpenSSL 1.1/3.x.

## Cross-event correlation

Anchored on a network request (\`net_seq\`), crypto and Keychain events in the same time window are aggregated and sorted by \`deltaMs\`; request headers are base64-decoded to hex and matched against each event's crypto output to locate which encryption produced them (all base64 headers by default, \`X-Validator\` first, or one named header).

The anchor matters: a network record's \`timestampMs\` / \`threadId\` are request-construction values, not response-arrival. Anchoring a slow request by response time would push same-window crypto out of range. One login's signature, encryption and Keychain write thus land on one causal chain. \`correlate_request\` performs the aggregation and reverse-match.

## Runtime xref and symbols

Turns runtime addresses into semantics. Every memory read goes through \`vm_read_overwrite\`; an unreadable page returns an error, never a crash. Tools are tiered:

| tier | tools | answers |
|---|---|---|
| 0 | \`get_macho_info\` / \`list_images\` / \`list_imports\` | images, imports, the dyld map |
| 0 | \`disassemble\` / \`analyze_function\` / \`disassemble_function\` | bytes or addresses into structured instructions |
| 1 | \`find_xrefs\` | who calls it |
| 2 | \`find_string_refs\` / \`find_selector_refs\` | who references a string / sends a selector |
| 3 | \`find_function_refs\` / \`list_functions\` | call graph / function inventory |
| 4 | \`objc_resolve_imp\` / \`find_objc_methods\` | a selector's current IMP / runtime method entities |

\`find_xrefs\` recognizes direct \`bl\` only: linearly scans \`__text\` for call sites; targets in import-stub regions resolve through the runtime-bound GOT plus \`dladdr\`, and \`resolved_name\` reflects the true runtime destination — a fishhooked import shows the hook symbol honestly. \`find_string_refs\` handles ADRP+ADD (direct) and ADRP+LDR pointer slots (indirect), recording only hits in string sections; a local window caches the latest ADRP page per register and invalidates on register writes — no cross-basic-block dataflow. \`find_selector_refs\` covers both the classic selref-load + \`objc_msgSend\` (x1 state machine) and the modern \`__objc_stubs\` path; bare selref loads do not count. The four scan tools cap at 48MB of \`__text\` per call and return \`next_scan_offset\` — page on if unfinished.

Disassembly embeds Capstone 5.0.1 (ARM/AArch64 only). Beyond mnemonic/op_str, each instruction carries structured operands, explicit read/write registers and control-flow groups; ARM64 MOVZ/MOVN/MOVK adds constant reconstruction (value/known_mask/complete), tracked only within the current linear stream and marked \`complete=false\` on control flow or register clobber. \`disassemble_function\` normalizes boundaries via \`LC_FUNCTION_STARTS\` with \`boundary_source\` / \`confidence\`. \`objc_resolve_imp\` returns only the selector's current IMP, declaring \`original_imp_known=false\`.

Runtime xref has three sources static files lack: dyld has finished rebase and bind so the GOT holds real addresses; \`dladdr\` maps back to image and nearest symbol; the runtime can be asked which code a selector currently runs. An xref answer goes from \`0x1029ac000\` to \`-[SessionCipher encrypt:]+0x88\`.

## MCP service and the idh gateway

The device embeds an MCP server exposing these capabilities as 44 tools over the dylib's embedded HTTP at \`POST /api/mcp\` (Streamable HTTP + JSON-RPC 2.0, initialize/tools/list/tools/call, sessions via the \`Mcp-Session-Id\` header, no extra port; default 8088, first free port in 8088..8108 on conflict).

The analysis entry point is on the PC; \`idh\` connects and bridges. No auto-discovery: an injected context cannot control the host Info.plist, so Bonjour/mDNS fails silently; device IP and port come from the panel or diagnostics, and \`idh connect <device-ip>:8088\` specifies and persists it. Bridging turns HTTP MCP into stdio for Claude / Codex; the aggregate gateway exposes a fixed toolset \`idh_list_devices\` / \`idh_list_tools\` / \`idh_get_tool_schema\` / \`idh_call_tool\` / \`idh_get_panel_url\`, so devices coming and going never invalidate the client-cached tools/list.

Two rails: mutating tools (\`set_pause\`, \`start_dump\`) require an explicit \`allow_mutation=true\`, enforced by the transparent proxy as a required schema field; \`export_events\` pins an upper bound with \`snapshot_until_seq\` and pages via \`next_after_seq\` until \`has_more=false\`, so events arriving mid-export cause no dupes or drift.

## Hook mechanism

Three complementary mechanisms: fishhook rewrites GOT and symbol pointers for C functions; ObjC method swizzle swaps IMPs at runtime for Objective-C methods; dlsym redirection intercepts \`dlsym(RTLD_DEFAULT, ...)\` and returns the wrapper address for hooked symbols, closing the GOT-bypass path.

All three change pointers, never instructions. Non-jailbreak sideloading has no \`dynamic-codesigning\` entitlement; the kernel refuses executable memory allocation, so inline hooks are physically impossible — which is why TrollStore and the jailbreak loader behave identically. Each install self-checks; failed symbols report to the health module, and install/failure counts are visible in \`/api/stats\` and MCP \`get_diag\` — a failed install degrades silently, never crashes.

## Dumping

An App Store binary's \`__TEXT\` is FairPlay-encrypted (\`LC_ENCRYPTION_INFO_64\` with \`cryptid=1\`), but runtime memory is already plaintext. Dumping is an export, in four steps:

1. Enumerate images via \`_dyld_image_count\` / \`_dyld_get_image_header\`, filter to main-bundle binaries and Frameworks (system libraries excluded), read \`LC_ENCRYPTION_INFO_64\` and proceed only when \`cryptid=1\`.
2. In-memory images carry a rebase slide, so no blind memcpy; copy the header and all load commands, then for every segment except \`__LINKEDIT\` write back the mapped pages at \`fileoff\` (subtracting the slide yields the memory origin).
3. \`__LINKEDIT\` (symbol table, string table, dyld info) is plaintext on disk — copy it from the original file.
4. Clear \`cryptid\` and expand the encrypted segment's \`filesize\` to its real size, so static analyzers don't read a truncated \`__text\`.

The artifact goes straight to IDA / Ghidra / class-dump, skipping \`SC_Info\` and FairPlay leftovers so resigning tools aren't misled. Dumping runs as an async task in \`dump_manager\` on a dedicated queue, never blocking HTTP or hook threads. \`PlugIns/*.appex\` are separate processes the main process never loaded.

## In-process spoofing

Answers consistent fake questions at the app's detection points; every swizzle carries an "empty config → pass through" guard, so nothing is touched unless configured.

- File: \`hooked_open\` returns ENOENT on blacklisted paths (\`/var/jb\`, \`/bin/bash\`, \`libjailbreak.dylib\`, ...); access/stat share the predicate with open, so all three probes agree.
- dyld: \`_dyld_get_image_name\` and \`dladdr\` return a harmless placeholder / erase \`dli_fname\` for blacklisted images, logged once each.
- ObjC: \`-[UIApplication canOpenURL:]\` returns NO for schemes like \`cydia\`; \`UIDevice\`, \`NSProcessInfo.operatingSystemVersion\` and \`ASIdentifierManager.advertisingIdentifier\` return configured values, with randomization.
- Anti-debug: \`ptrace\`'s \`PT_DENY_ATTACH\` is intercepted; \`sysctl\` \`KERN_PROC_PID\` clears the \`P_TRACED\` flag before returning when spoofing is on.

All hiding acts only on this process's API return values; cross-app calls, system services and server-side profiling are unaffected.

## Storage, noise, stability

\`DHLogStore\` keeps an independent ring buffer per category, so one hot category cannot starve others. High-frequency syscalls like \`MGCopyAnswer\` divert by rule to separate noise boards (crypto/sys toggled independently) off the main feed; the panel shows narrowed business signal, the noise boards stay separately queryable. Disk persistence uses an always-open append handle plus rolling archives — a crash or kill still yields the full history on restart; disconnection clears nothing.

No-crash is the floor: untrusted memory reads go through \`vm_read_overwrite\` or \`@try/@catch\`, hook bodies do no expensive I/O, allocation failures are checked, and logging/network failures degrade silently.

## Boundaries and limits

- Only rebindable imports and ObjC methods are covered; statically linked code, private paths or untriggered APIs produce no events — "not observed" is not "absent".
- MCP tools depend on variant (dev/trollstore/rootless), target image and device — handshake with \`get_capabilities\` first.
- In-process spoofing only changes this process's API return values; it is not invisibility.
- HTTP and MCP have no authentication — trusted LAN only, never the public internet.
- Events may contain keys, IVs, plaintext and tokens — handle as sensitive material.`,
    },
  },
];
