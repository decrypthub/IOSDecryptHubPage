// 技术文章（news）数据源。
// 公开发布版本只保留一篇完整的技术长文：把架构、Hook 引擎、算法捕获、伪装、
// 网络、脱壳、Capstone/MCP 分析全部写透。content 为 markdown，双语。
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
    slug: 'deep-dive',
    date: '2026-08-04',
    tag: '研究',
    tagEn: 'Research',
    title: 'IOSDecryptHub 研究：免越狱 iOS 运行时分析是如何实现的',
    summary: '一篇讲透全部实现的长文：constructor 启动顺序、fishhook + swizzle + dlsym 三种 hook 手段与安装面全景、加解密参数语义化与流式会话状态机、进程内伪装的五条检测面、三层网络捕获配对、Mach-O 脱壳重写与零依赖 zip，以及 Capstone/MCP 如何把运行时地址还原成语义。',
    content: `IOSDecryptHub 是一个注入到目标 App 进程内的运行时分析 dylib：在不越狱的设备上，实时捕获加解密、文件、网络、Keychain 与动态加载行为，并通过内嵌 Web 面板和 MCP 服务对外暴露分析能力。它不是代理，也不改写任何指令——它站在系统 API 的调用点上，把真实发生的参数、结果和调用栈记录下来。

这篇文章是项目的完整技术阐述：从 \`main()\` 之前的第一行代码，到 AI 客户端读到的结构化事件，把每一层的实现与取舍讲清楚。

## 总体架构：一条运行时链路

整个系统是一条单向数据流，每一层只做一件事，层与层之间通过统一的日志条目（\`DHLogEntry\`）传递：

\`\`\`
hook (fishhook + ObjC swizzle + dlsym 重定向)
  → 捕获与语义化 (算法解析 / 流式会话 / 行为事件)
    → DHLogStore (分类环形缓冲 + 噪声分流 + 落盘滚动)
      → HTTP 服务 (Web 面板 / /api/stats / MCP POST /api/mcp)
        → idh 网关 (手动连接 + stdio 桥接) → AI 客户端
\`\`\`

- **hook 层**负责“拦得到”：用三种互补手段覆盖 C 函数与 Objective-C 方法；
- **捕获层**负责“看得懂”：把寄存器和指针里的原始参数翻译成算法名、模式、Key/IV、明文密文；
- **存储层**负责“活得稳”：在别人的进程里做日志，任何一步都不能把宿主 App 弄死；
- **服务层**负责“取得到”：一个端口同时承载浏览器面板与健康统计、MCP 工具服务；
- **网关层**负责“接得上”：把设备端的 HTTP MCP 桥接成 PC 上 AI 客户端可直接配置的 stdio MCP。

理解这条链路之后，后面每一章其实都是在展开其中某一层的细节。

## 启动顺序：main() 之前的五步

dylib 通过 \`__attribute__((constructor))\` 在宿主 \`main()\` 之前启动。这段引导代码的顺序是写死的，不能调换：

1. **预热 Foundation**。先调用一次时间格式化与调用栈采集，强制完成 \`NSDateFormatter\` 和 backtrace 的懒加载；
2. **加载配置**。诊断落盘目录、\`.dh_capture.conf\`（捕获开关）、\`.dh_noise.conf\`(噪声规则)、\`.dh_spoof.conf\`（伪装配置）都在装 hook 之前就绪，持久化的开关从一开始就生效；
3. **安装全部 hook**。\`dh_install_all_hooks()\` 一次性装完所有模块——要尽早，否则早期发生的加解密会漏抓；
4. **启动 HTTP 服务**。不依赖 UIApplication，构造函数里立刻可访问；
5. **悬浮窗后置初始化**。等 \`UIApplicationDidFinishLaunchingNotification\` 之后创建，另有 0.8 秒兜底，应对加载 dylib 时 UIApplication 已存在的场景。

顺序不能换的原因非常实际：如果先装 hook 再预热，\`hooked_open\` 内部首次触发 \`NSDateFormatter\` 的懒加载会再次调用 \`open\`——无限递归，直接锁死宿主进程。线程级的 \`dh_in_hook\` 标志是第二道保险：hook 体内置位期间，对被 hook 符号的调用直接透传原实现。

## Hook 引擎：三种手段与安装面全景

### 三种手段各管一段

- **fishhook**：改写 GOT / 懒加载符号表指针，管所有 C 函数。除了经典的间接符号表路径，还支持 iOS 15+ 的 \`LC_DYLD_CHAINED_FIXUPS\` 链式修复指针格式（含 arm64e PAC 感知：strip 原始指针、按 key/diversity 重签名替换），以及 \`__AUTH_CONST\` 认证 GOT 段扫描，两条路径并行执行以覆盖混合格式；
- **ObjC method swizzle**：runtime 换 IMP，管 Objective-C 方法——\`NSURLSession\` 建任务、设备信息查询这类 fishhook 够不到的面;
- **dlsym 重定向**：\`dlsym(RTLD_DEFAULT, "CCCrypt")\` 这类动态取址会绕过 GOT 改写。\`hooked_dlsym\` 先调原实现拿到真实地址，再查一张与 fishhook rebinding 数组同源的重定向注册表，命中已 hook 符号时返回 wrapper 地址——dyld / SSL 的 hook 同样注册进这张表，堵住“函数指针旁路”。

三者共用同一条技术边界：**只改指针，不改指令**。免越狱侧载拿不到 \`dynamic-codesigning\` entitlement，内核拒绝分配可执行内存，inline hook 物理上不可能——这不是工程取舍，而是硬约束。它同时保证了两条注入路线（TrollStore 与越狱加载器）行为完全一致。

### 加解密六类的 rebinding 清单

摘要类用宏一次生成 8 个一次性函数加 24 个流式函数：

\`\`\`c
#define HOOK_DIGEST(NAME, CTX_T)                                        \\
    static unsigned char *hooked_##NAME(const void *data, CC_LONG len, unsigned char *md) { \\
        ... /* 记录 data/len/md */                                      \\
        return orig_##NAME(data, len, md);                              \\
    }                                                                   \\
    static int hooked_##NAME##_Init(CTX_T *c) { ... }                   \\
    static int hooked_##NAME##_Update(CTX_T *c, const void *data, CC_LONG len) { ... } \\
    static int hooked_##NAME##_Final(unsigned char *md, CTX_T *c) { ... }

HOOK_DIGEST(CC_MD2,  CC_MD2_CTX)   HOOK_DIGEST(CC_MD4,  CC_MD2_CTX)
HOOK_DIGEST(CC_MD5,  CC_MD5_CTX)   HOOK_DIGEST(CC_SHA1, CC_SHA1_CTX)
HOOK_DIGEST(CC_SHA224, CC_SHA256_CTX)  /* SHA256/384/512 同理 */
\`\`\`

其余几类：

| 类别 | 覆盖的 API |
|---|---|
| HMAC | \`CCHmac\` 一次性 + \`CCHmacInit/Update/Final\` 流式 |
| 对称 | \`CCCrypt\` + \`CCCryptorCreate/CreateWithMode/Update/Final/Release\` 六个 |
| 非对称 | \`SecKeyCreateSignature / SecKeyVerifySignature / SecKeyCreateEncryptedData / SecKeyCreateDecryptedData\` 四个 |
| KDF | \`CCKeyDerivationPBKDF\` |
| OpenSSL EVP | \`EVP_EncryptInit_ex/_ex2\`、\`EVP_DecryptInit_ex/_ex2\`、\`EVP_CipherInit_ex/_ex2\` 及对应 Update/Final 全家族，外加 \`EVP_CIPHER_CTX_ctrl\`（AEAD 的 AAD/tag） |

EVP 家族按 OpenSSL 1.1+ 命名展开；目标 App 只有在自己链接了 libcrypto 时这些符号才出现在导入表里——这也意味着“没抓到 EVP 事件”不代表目标没用加密，只是没走这条路径。

### 行为面的 hook 清单

- **file**：\`open / write / read / pread / mmap / close / unlink / rename\` 八个。\`hooked_open\` 还按 \`flags\` 解析出“读/写/创建/追加/截断”语义；
- **system**：\`dlopen\`（记录加载的库）与 \`dlsym\`（见上文重定向）；
- **keychain**：\`SecItemCopyMatching / SecItemAdd / SecItemUpdate / SecItemDelete\` 四件套，把 CFDictionary 里的 service/account/data 字段翻译成可读记录；
- **env**：\`ptrace / csops / sysctl / sysctlbyname / uname / getenv / stat / lstat / access / faccessat / fstatat\`——既是行为观察点，也是反调试与伪装的执行点；
- **ObjC 伪装层**：\`canOpenURL:\`、\`UIDevice\` 系列、\`NSProcessInfo.operatingSystemVersion\`、\`ASIdentifierManager.advertisingIdentifier\` 的 swizzle（见“进程内伪装”一章）；
- **dyld**：\`_dyld_get_image_name\` 与 \`dladdr\`——“谁在枚举我”的观察点，同时承担镜像隐藏；
- **network**：\`NSURLSession\` 三个 completion 建任务方法与 \`-[NSURLSessionTask resume]\`（swizzle）+ \`SSL_write / SSL_read\`（fishhook，针对自带 TLS 的 App）。

### fail-loud：装没装上都告诉你

每个 hook 安装后自检，失败的符号（例如某些 iOS 版本上方法缺失）通过健康模块上报，\`/api/stats\` 的 health 字段与 MCP 的 \`get_diag\` 都能看到安装/失败计数与审查时间线。这是“不崩溃原则”的延伸——装不上就静默降级并如实报告，绝不 crash。

## 算法捕获：从寄存器参数到可读语义

加解密捕获的技术含量不在拦截，而在两件事：**参数语义化**与**会话状态管理**。原始 C 参数是一堆枚举和指针，要变成 “AES-256-CBC · encrypt · PKCS7” 这种可读记录。

### 一次性调用：CCCrypt 的参数翻译

\`CCCrypt\` 的八个参数全在寄存器与栈上，hook 拿到后按序解析：

\`\`\`c
CCCryptorStatus CCCrypt(
    CCOperation op,        // 0=encrypt 1=decrypt
    CCAlgorithm alg,       // kCCAlgorithmAES=0, DES=1, 3DES=2, CAST=5 ...
    CCOptions options,     // kCCOptionPKCS7Padding(1) | kCCOptionECBMode(2)
    const void *key, size_t keyLen,
    const void *iv,
    const void *dataIn, size_t dataInLength,
    void *dataOut, size_t dataOutLength, size_t *dataOutMoved);
\`\`\`

翻译规则：

- **算法名**：\`alg\` 枚举 + \`keyLen\` 组合，AES 且 keyLen=32 即 AES-256；
- **模式与填充**：\`options & kCCOptionECBMode\` 置位即 ECB，否则 CBC；填充位来自 \`kCCOptionPKCS7Padding\`；
- **key/iv 必须在调用原函数之前读取**——加解密执行前缓冲区里还是原始材料；
- **明文方向**：encrypt 时 input 是明文，decrypt 时 output 是明文，操作位决定哪个字段标记 \`plain\`。

### 流式会话：Create → Update → Final 状态机

大数据走 \`CCCryptorCreate/Update/Final/Release\`，四条独立调用之间只隔一个不透明的 \`CCCryptorRef\`。hook 维护一张以 cryptorRef 为 key 的会话表：

| 调用 | hook 动作 |
|---|---|
| \`Create\` / \`CreateWithMode\` | 建会话：记算法、模式、key、iv、操作位 |
| \`Update\` | 把分片追加进会话缓冲，**不落记录**（单次分片没有分析意义） |
| \`Final\` | 拼出完整明文/密文，此时才输出一条完整记录（含累计长度） |
| \`Release\` | 删除会话 |

两个 edge case：多次 Update 按调用序追加、Final 时一次性输出；以及“永不 Final”的会话——App 持有 cryptorRef 反复 Update 却不收尾，这是状态泄漏，靠 Release 钩子回收，避免会话表无限增长。

### SecKey：从 CFDictionary 抠算法，但不读内部结构

非对称签名/加密的算法参数是一个 CFDictionary。hook 用 \`CFDictionaryGetValue\` 逐个取出 \`kSecAttrKeyType\`（RSA/EC）、\`kSecAttrKeySizeInBits\`、\`kSecAttrKeyClass\`（private/public），拼出 "RSA-2048 PKCS1v15-SHA256"、"EC secp256r1" 这样的算法标识。SecKeyRef 本身是不透明指针——工具**不读它的内部**，只记录地址与用途，避免触碰 Apple 私有结构。

### EVP：辅助符号的懒解析

OpenSSL 1.1+ 把算法元数据藏在 \`EVP_CIPHER\` 结构体里。hook 侧用 \`dlsym\` 懒解析官方辅助函数：

\`\`\`c
fn_CIPHER_get0_name  = dlsym(RTLD_DEFAULT, "EVP_CIPHER_get0_name");
fn_CIPHER_key_length = dlsym(RTLD_DEFAULT, "EVP_CIPHER_key_length");
fn_CIPHER_iv_length  = dlsym(RTLD_DEFAULT, "EVP_CIPHER_iv_length");
\`\`\`

拿到 cipher 指针后调用这些**原版**函数取算法名与长度，而不是自己解析结构体布局——天然兼容 OpenSSL 1.1/3.x。AEAD（AES-GCM / ChaCha20-Poly1305）的 AAD 与 tag 通过 \`EVP_CIPHER_CTX_ctrl\` 设置，该调用被单独 hook 并记录。

### KDF：把口令留在证据里

\`CCKeyDerivationPBKDF\` 的输入直接包含口令明文、salt 和迭代次数，调用后派生密钥也可读。这类记录是弱口令/慢哈希分析的输入——也正因如此，导出这类事件必须按敏感材料对待（见“边界与合规”）。

## 进程内伪装：在检测点上回答假答案

“隐藏越狱/注入”不是把自己藏起来，而是**在 App 的检测点上回答一致的假答案**。常见检测面有五类：文件系统探测、URL scheme 查询、动态库枚举、沙箱逃逸探测、反调试。逐条看对应的实现。

### 文件层：路径黑名单回 ENOENT

\`hooked_open\` 在放行前先过黑名单：

\`\`\`c
if (dh_spoof_jb_should_hide_path(path)) {
    dh_log_hidden("open", path);
    errno = ENOENT;
    return -1;
}
int fd = orig_open(path, flags, mode);
\`\`\`

黑名单默认覆盖 \`/var/jb\`、\`/bin/bash\`、\`libjailbreak.dylib\` 等典型探测路径，支持运行期追加。关键是 **access/stat 与 open 走同一判定函数**，三条探测路径返回一致——不会出现 stat 说存在、open 说不存在的自相矛盾。

### dyld 层：枚举观察点改答案

\`_dyld_get_image_name\` 与 \`dladdr\` 被 hook，两者既是“谁在枚举我”的观察点，也是镜像隐藏的执行点：

\`\`\`c
static const char *hooked_dyld_get_image_name(uint32_t index) {
    const char *real = orig_dyld_get_image_name(index);
    if (real && dh_spoof_should_hide_image(real)) {
        dyld_log_hidden_once(real);
        return kBenignImageName;   // 返回无害占位名
    }
    return real;
}
\`\`\`

\`dladdr\` 同理：调用成功的前提下抹掉 \`dli_fname\`。\`dyld_log_hidden_once\` 保证每条隐藏只记一次，不刷屏。

### ObjC 层：scheme 过滤与设备伪装

- \`-[UIApplication canOpenURL:]\`：解析 scheme，命中 \`cydia\` 等黑名单返回 NO；
- \`UIDevice\` 的 systemVersion/name/identifierForVendor、\`NSProcessInfo.operatingSystemVersion\`、\`ASIdentifierManager.advertisingIdentifier\`：返回配置值，支持随机化。

每个 swizzle 都带“配置为空则透传原实现”的守卫——伪装是**可选能力**，不配置就不干预。

### 反调试：ptrace 与 sysctl

\`ptrace\` 的 \`PT_DENY_ATTACH\` 被直接拦截；\`sysctl\` 的 \`KERN_PROC_PID\` 查询被记录，开启伪装时 \`P_TRACED\` 标志位清零后返回。设计原则是让**查询方**看到“未被调试”，而不是让调试器真的失败——后者反而暴露存在。

### 边界：进程内伪装 ≠ 隐身

所有隐藏都只作用在**本进程的 API 返回值**上。跨 App 调用、系统服务、服务端设备画像不受影响。所以它的准确名字是“进程内伪装”，不是“隐身”——这个边界在安全评估里必须如实陈述。

## 网络捕获：不装证书的三层配对

代理抓包要解决证书信任与 pinning 两座山；进程内抓包直接在 App 自己的调用链里取数据，两个问题都不存在。实现分三层，全部受 \`DH_CAP_NETWORK\` 捕获开关控制，统一记入网络分类。

### 第一层：completion 回调配对

主流用法是 completion-handler。swizzle 三个建任务方法，核心技巧是**包装 completion block**：

\`\`\`c
DHDataCH wrapped = ^(NSData *data, NSURLResponse *resp, NSError *err) {
    net_log_pair(rc.HTTPMethod, rc.URL.absoluteString,
                 rc.allHTTPHeaderFields, rc.HTTPBody,
                 data, resp, err, cs, reqMs, reqTid);
    ch(data, resp, err);   // 原 block 照常执行，App 无感
};
\`\`\`

包装块的闭包捕获了原方法的 \`request\` 参数——响应到达时请求体、URL、headers 依然可读，请求与响应在一条记录里天然配对。包装体内 \`@try/@catch\`，日志失败绝不影响原 block。

这里有个重要的设计细节——**请求时刻锚点**：\`reqMs\` /\`reqTid\` 在建任务时记录，而不是响应到达时。慢请求若用响应时刻做锚点，会把同窗的加解密事件推出关联窗口（下一节详述）。

### 第二层：resume 兜底与去重

delegate 型任务没有 completion block，请求只在 \`-[NSURLSessionTask resume]\` 可见。swizzle resume 并从 \`task.currentRequest\` 取数据。与第一层的重复问题用 \`objc_setAssociatedObject\` 解决：completion 配对捕获过的 task 打上标记，resume 命中标记即跳过——一个任务只记一次。

### 第三层：自带 TLS 明文

App 自带 OpenSSL/BoringSSL（不走系统 TLS）时，fishhook \`SSL_write / SSL_read\` 抓明文字节流。\`void *ssl\` 占位即可——只记字节流不解析会话。系统 TLS 不经 App 的 import slot，这一层多不命中属正常，定位就是 best-effort 补充。

### 跨事件关联：时间窗因果链

网络与加解密共享时间线是这个设计最有价值的地方。网络记录的 \`timestampMs/threadId\` 存的是**请求构建时刻**的值，\`correlate_request\` 以某条网络请求为锚点，聚合同一时间窗内的加解密与 Keychain 事件，并把 Base64 请求头反查到对应的加密输出——一次登录请求的签名、加密、写 Keychain 就此落在同一条因果链上。

## 脱壳：把内核已解密的镜像导出回来

App Store 分发的二进制其 \`__TEXT\` 由 FairPlay 加密（\`LC_ENCRYPTION_INFO_64\` 标记 \`cryptid=1\`），但运行时内存里已经是明文——内核在映射代码页前完成了解密。脱壳本质是一次**导出**：把进程内已解密的 Mach-O 按规范重写回磁盘。

### 四步重写

1. **枚举与判定**：\`_dyld_image_count/_dyld_get_image_header\` 枚举镜像，过滤出主 bundle 内的主程序与 Frameworks（排除系统库），读 \`LC_ENCRYPTION_INFO_64\` 确认 \`cryptid=1\` 才进入流程；
2. **按 load command 重排写回**：进程内镜像经过 rebase 有 slide 偏移，不能整段 memcpy。复制文件头与全部 load commands 后，除 \`__LINKEDIT\` 外的段按 \`fileoff\` 把对应内存页写回（地址减 slide 才是段的内存起点）；
3. **\`__LINKEDIT\` 直拷**：符号表、字符串表、dyld info 在磁盘上本来就是明文，直接从原始文件复制；
4. **收尾**：\`cryptid\` 置 0，并把加密段的 \`filesize\` 展开为真实大小——磁盘上的 filesize 是密文大小（可能小于明文且按页对齐），照抄会导致静态分析器读到截断的 \`__text\`。

产物可直接交给 IDA/Ghidra/class-dump，或继续重签安装。

### 零依赖 zip 写入器

IPA 模式要在设备端生成 zip，项目实现了零依赖写入器：

- 手工构造 local file header / central directory / EOCD 三段结构，压缩方法只用 STORE（0）不压缩；
- CRC-32 用查表法：预计算 256 项表（多项式 \`0xEDB88320\`），每字节做 \`table[(crc ^ byte) & 0xFF] ^ (crc >> 8)\`，与 zlib 逐字节结果一致；
- 只写 \`Payload/App.app\` 下必要条目，**跳过 \`SC_Info\`、FairPlay 残留**——避免重签工具被残留加密元数据误导。

### 异步任务模型与边界

砸壳在 \`dump_manager\` 里作为异步任务执行：提交任务后轮询状态，专用队列运行，不阻塞 HTTP 与 hook 线程——注入场景下任何长任务都必须离地执行。边界同样明确：\`PlugIns/*.appex\` 是独立进程，主进程未加载就砸不到；按需触发，不点按钮零开销；仅限授权目标。

## Capstone 与 MCP：把地址还原成语义

设备端内嵌一个 MCP (Model Context Protocol) 服务器，复用 HTTP 端口的 \`POST /api/mcp\` 端点（Streamable HTTP 传输，JSON-RPC 2.0，支持 initialize/tools/list/tools/call，会话经 \`Mcp-Session-Id\` 头维护）。当前公开版本提供 44 个工具。其中最硬核的部分是把**运行时地址还原成语义**。

### 安全读取是一切的前提

\`analyze_function / read_memory / search_memory\` 以及所有 xref 扫描的内存读取都走 \`vm_read_overwrite\`：

\`\`\`c
kern_return_t kr = vm_read_overwrite(mach_task_self(), addr, size, buf, &len);
if (kr != KERN_SUCCESS) return isError;   // 不可读页返回错误，绝不崩溃
\`\`\`

目标进程的任何地址都可能不可读，崩溃一次就是杀死宿主。这条底线与 hook、脱壳共享。

### Capstone 集成与诚实的边界

Capstone 5.0.1 以源码方式内嵌（只编 ARM/AArch64，约 2MB）。三个反汇编工具的每条指令除 mnemonic/op_str 外还返回结构化操作数、显式读写寄存器与控制流分组；ARM64 的 MOVZ/MOVN/MOVK 会额外给出常量重建（value/known_mask/complete）。常量跟踪只在当前线性指令流内工作，遇到控制流或寄存器覆盖即失效——工具如实标注 \`complete=false\`，不会把未知位当成 0。

\`disassemble_function\` 优先用 \`LC_FUNCTION_STARTS\` 归一化函数边界：接受函数中间地址，读到真实入口与结束位置，响应带 \`boundary_source/confidence\`；缺少函数元数据时退化为低置信度的 ret 启发式。**工具不假装比实际更确定**——置信度字段必须一并判断。

### xref 家族：tier 化的依赖关系

| tier | 工具 | 回答的问题 |
|---|---|---|
| tier-0 | \`get_macho_info\` / \`list_images\` / \`list_imports\` / \`list_loaded_images\` | 有哪些镜像、哪些导入符号（fishhook 候选）、完整 dyld 地图 |
| tier-0 | \`disassemble\` / \`analyze_function\` | 给字节或给地址，反汇编成结构化指令 |
| tier-1 | \`find_xrefs\` | 谁调用了它 |
| tier-2A | \`find_string_refs\` | 谁引用了这个字符串 |
| tier-2B | \`find_selector_refs\` | 谁把这个 selector 用在了 objc 消送上 |
| tier-3A | \`find_function_refs\` | 内部调用图（callers/callees/both） |
| tier-3B | \`list_functions\` | LC_FUNCTION_STARTS 函数清单（其余工具的归属底座） |
| tier-4 | \`objc_resolve_imp\` / \`find_objc_methods\` | selector 当前实际执行的 IMP；runtime 方法实体查询 |

几个代表性实现：

- **find_xrefs** 只认直接 \`bl\`：线性扫 \\\`__text\\\` 收集调用点，目标落在 import stub 区则经运行时已绑定的 GOT + dladdr 还原真实符号。\`resolved_name\` 反映运行时真正到达的目标——若该导入已被 fishhook 改写，会如实显示 hook 符号；
- **find_string_refs** 识别两种取址：ADRP+ADD（直接）与 ADRP+LDR 指针槽（间接，仅认白名单槽位），落在字符串 section 才记引用。局部窗口回溯按寄存器缓存最近 ADRP 页，寄存器被写即失效——不做跨基本块数据流，边界如实；
- **find_selector_refs** 只报真实消息发送：经典路径（selref 加载 + blr/bl objc_msgSend，x1 状态机追踪）与现代 \`__objc_stubs\` 路径都覆盖，裸 selref 加载不报；
- **大镜像分页**：四个扫描工具单次最多扫 48MB \\\`__text\\\`，响应的 \`scan\` 结构给全文覆盖信息与 \`next_scan_offset\`——没扫完必须翻页，不能断言“不存在引用”。

### 为什么运行时 xref 优于静态文件

静态分析器对 strip 过的二进制只能还原地址；运行时多了三个信息源：dyld 已完成 rebase 与 bind，GOT 里是真实地址；dladdr 把地址映射回镜像与最近符号；可以直接问 runtime 某个 selector 当前执行哪段代码（\`objc_resolve_imp\`，诚实声明只返回当前实现、\`original_imp_known=false\`，不宣称恢复 swizzle 前 IMP）。三者叠加，xref 的答案从"0x1029ac000"变成"\`-[SessionCipher encrypt:]\` + 0x88"，语义完整。

## 存储与服务层：为“宿主不能死”设计

### 分类环形缓冲 + 噪声分流

\`DHLogStore\` 为每个分类维护独立环形缓冲：加解密、文件、系统、网络、Keychain 各占一桶，一类高频事件挤不爆别的类。\`MGCopyAnswer\` 这类高频系统调用按噪声规则（精确匹配特征串，crypto/sys 两块噪声板独立开关）分流到独立噪声桶，不进主事件流——面板上看到的是刻意收敛过的业务信号，噪声板仍可单独查询。

### 落盘滚动与崩溃闭环取证

落盘使用常开 append 句柄（避免每条 open/close），单条 blob 上限 64KB；超过配置上限后滚动归档保留 \`.1/.2/.3\` 三份备份。下载接口按时序拼接全部段——App 崩溃或被杀后重启仍可取回全量日志，断连不清空，形成崩溃可闭环的取证链路。

### 一个端口承载全部

HTTP 服务在一个监听端口上同时扮演三个角色：Web 面板（\`/\`）、健康统计（\`/api/stats\`）、MCP（\`POST /api/mcp\`）。默认从 8088 开始，端口占用时在 8088..8108 范围内选第一个空闲端口。不额外开端口——注入场景每多一个监听端口就多一分被检测的风险。服务有并发上限与请求体上限，防止 slow-client 耗尽资源。

### 不崩溃原则的完整清单

- 所有不可信内存读取必须走 \`vm_read_overwrite\` 或等价防护；
- ObjC 边界按需 \`@try/@catch\`，不可读地址返回错误；
- hook 函数内禁止耗时 I/O（网络请求、文件读写），避免卡死宿主；
- 内存分配失败必须检查；日志与网络失败静默降级；
- 启动顺序不可调换（见第二章）；装不上的 hook 上报健康而非崩溃。

## idh 网关：AI 客户端的确定性入口

设备端只负责捕获与暴露，分析入口在 PC。idh 做两件事：连接与桥接。

### 为什么不做自动发现

注入场景无法控制宿主 App 的 Info.plist，Bonjour/mDNS 注册会静默失败；UDP 广播信标虽可行，却带来额外协议复杂度与调试噪音。最终方案是不做自动发现：设备 IP 与端口从面板、悬浮窗或诊断信息人工获取，\`idh connect <ip>:<port>\` 手动指定并持久化保存。简单，且不易出错。

### stdio 桥接与固定工具集

dylib 的 MCP 是 Streamable HTTP，而 Codex/Claude 等 AI 客户端主要支持 stdio。\`idh mcp\` 把前者桥接成后者。聚合网关暴露一组**固定工具**（\`idh_list_devices / idh_list_tools / idh_get_tool_schema / idh_call_tool / idh_get_panel_url\`），避免设备上下线导致客户端缓存的 tools/list 失效；AI 按 schema 确定性路由，而不是 idh 替 AI 猜意图。

两个值得强调的安全设计：

- **修改型工具需显式确认**：\`set_pause\`、\`start_dump\` 这类有副作用的调用必须传 \`allow_mutation=true\`，透明代理会在 schema 里强制加这个必填字段；
- **导出走稳定游标**：\`export_events\` 以 \`snapshot_until_seq\` 固定上界、\`next_after_seq\` 翻页直到 \`has_more=false\`，防止导出期间新事件插入造成重复或漂移。

## 边界、限制与合规

最后把公开使用必须知道的边界集中说清楚：

- **观察边界**：hook 只覆盖可改写的导入符号与 ObjC 方法；静态链接、私有调用路径或未被触发的 API 不会有事件。“没看到”是线索，不是“不存在”的证明；
- **能力随环境变化**：MCP 工具受变体（dev/trollstore/rootless）、目标镜像与设备环境影响，应先 \`get_capabilities\` 握手确认真实能力再动手；
- **服务无认证**：HTTP 与 MCP 服务没有身份认证，仅限可信局域网使用，绝不要暴露到公网；
- **数据敏感**：事件、导出 JSON 与 MCP 响应可能包含 Key、IV、明文、Token、路径与请求数据，必须按敏感材料保存与分享；提交 Issue 前先脱敏；
- **授权前提**：仅限分析自有 App 或已获授权的目标；分发受版权保护的程序可能违法。

## 结语

从 \`main()\` 之前的第一行代码，到 AI 客户端读到的结构化事件，这条链路的每一层都围绕同一个约束设计：**稳定地活在别人的进程里**。只改指针不改指令、一切读取有防护、失败静默降级但如实上报、一个端口承载全部服务——把这些约束贯彻到底，免越狱的运行时分析才能从“演示”变成“工具”。`,
    en: {
      title: 'IOSDecryptHub internals: how jailbreak-free iOS runtime analysis works',
      summary: 'One long-form article covering the entire implementation: the constructor startup order, the three hook mechanisms and their full install surface, crypto parameter semantics and the streaming session state machine, the five in-process anti-detection surfaces, three-layer network capture pairing, Mach-O dump rewriting with a zero-dependency zip writer, and how Capstone/MCP turn runtime addresses into semantics.',
      content: `IOSDecryptHub is a runtime analysis dylib injected into the target app process: on non-jailbroken devices it captures crypto, file, network, Keychain and dynamic-loading behavior in real time, and exposes analysis capabilities through an embedded web panel and an MCP service. It is not a proxy and it rewrites no instructions — it stands at the call sites of system APIs and records the arguments, results and call stacks that actually happen.

This article is the project's complete technical write-up: from the first line of code before \`main()\` to the structured events an AI client reads, explaining every layer's implementation and trade-offs.

## Overall architecture: one runtime pipeline

The whole system is a one-way data flow. Each layer does one thing; layers communicate through a uniform log entry (\`DHLogEntry\`):

\`\`\`
hook (fishhook + ObjC swizzle + dlsym redirection)
  → capture & semantics (algorithm parsing / streaming sessions / behavior events)
    → DHLogStore (per-category ring buffers + noise diversion + rolling disk logs)
      → HTTP service (web panel / /api/stats / MCP POST /api/mcp)
        → idh gateway (manual connect + stdio bridging) → AI clients
\`\`\`

- The **hook layer** makes interception possible: three complementary mechanisms cover C functions and Objective-C methods;
- The **capture layer** makes records readable: raw register and pointer arguments become algorithm names, modes, key/IV and plaintext/ciphertext;
- The **storage layer** keeps the host alive: logging inside someone else's process must never crash it;
- The **service layer** makes data reachable: one port serves the browser panel, health stats and MCP tools;
- The **gateway layer** connects AI clients: the device's HTTP MCP becomes a locally configurable stdio MCP on the PC.

With that pipeline in mind, each following chapter expands one of its layers.

## Startup order: five steps before main()

The dylib starts before the host's \`main()\` via \`__attribute__((constructor))\`. The bootstrap order is fixed and must not change:

1. **Warm up Foundation**. Call timestamp formatting and backtrace capture once, forcing \`NSDateFormatter\` and backtrace lazy loading to complete;
2. **Load configuration**. The diagnostics directory, \`.dh_capture.conf\` (capture toggles), \`.dh_noise.conf\` (noise rules) and \`.dh_spoof.conf\` (spoof config) are all ready before hooks install, so persisted switches apply from the very start;
3. **Install all hooks**. \`dh_install_all_hooks()\` installs every module at once — as early as possible, or early crypto calls are missed;
4. **Start the HTTP service**. No UIApplication dependency; reachable immediately from the constructor;
5. **Post-initialize the floating window**. Created after \`UIApplicationDidFinishLaunchingNotification\`, with a 0.8s fallback for apps whose UIApplication already exists.

Why the order cannot change: if hooks installed before the warm-up, the first lazy \`NSDateFormatter\` load inside \`hooked_open\` would call \`open\` again — infinite recursion, locking up the host process. A thread-level \`dh_in_hook\` flag is the second safety net: while set inside a hook body, calls to hooked symbols pass straight through to the original.

## Hook engine: three mechanisms and the full install surface

### Three tools, three layers

- **fishhook**: rewrites GOT / lazy symbol pointer entries for C functions. Beyond the classic indirect symbol table path it supports iOS 15+ chained fixups (\`LC_DYLD_CHAINED_FIXUPS\`, including arm64e PAC awareness: strip the raw pointer, re-sign by key/diversity) and scans the \`__AUTH_CONST\` authenticated GOT segment; both paths run in parallel to cover mixed formats;
- **ObjC method swizzle**: swaps IMPs at runtime for Objective-C methods — task creation on \`NSURLSession\`, device info queries and other surfaces fishhook cannot reach;
- **dlsym redirection**: dynamic lookups like \`dlsym(RTLD_DEFAULT, "CCCrypt")\` bypass GOT rewriting. \`hooked_dlsym\` calls the original first, then consults a redirect registry sharing the same source as the fishhook rebinding array; hooked symbols return the wrapper address — dyld/SSL hooks register here too, closing the function-pointer bypass.

All three share one technical boundary: **change pointers, never instructions**. Non-jailbreak sideloading has no \`dynamic-codesigning\` entitlement; the kernel refuses executable memory allocation, so inline hooks are physically impossible — a hard constraint, not an engineering choice. It also guarantees identical behavior across both injection routes (TrollStore and the jailbreak loader).

### The crypto rebinding inventory

Digest hooks are generated by macro: 8 one-shot functions plus 24 streaming ones:

\`\`\`c
#define HOOK_DIGEST(NAME, CTX_T)                                        \\
    static unsigned char *hooked_##NAME(const void *data, CC_LONG len, unsigned char *md) { \\
        ... /* record data/len/md */                                    \\
        return orig_##NAME(data, len, md);                              \\
    }                                                                   \\
    static int hooked_##NAME##_Init(CTX_T *c) { ... }                   \\
    static int hooked_##NAME##_Update(CTX_T *c, const void *data, CC_LONG len) { ... } \\
    static int hooked_##NAME##_Final(unsigned char *md, CTX_T *c) { ... }

HOOK_DIGEST(CC_MD2,  CC_MD2_CTX)   HOOK_DIGEST(CC_MD4,  CC_MD2_CTX)
HOOK_DIGEST(CC_MD5,  CC_MD5_CTX)   HOOK_DIGEST(CC_SHA1, CC_SHA1_CTX)
HOOK_DIGEST(CC_SHA224, CC_SHA256_CTX)  /* SHA256/384/512 likewise */
\`\`\`

The remaining families:

| Family | Covered APIs |
|---|---|
| HMAC | one-shot \`CCHmac\` + streaming \`CCHmacInit/Update/Final\` |
| Symmetric | \`CCCrypt\` plus \`CCCryptorCreate/CreateWithMode/Update/Final/Release\` — six total |
| Asymmetric | \`SecKeyCreateSignature / SecKeyVerifySignature / SecKeyCreateEncryptedData / SecKeyCreateDecryptedData\` |
| KDF | \`CCKeyDerivationPBKDF\` |
| OpenSSL EVP | \`EVP_EncryptInit_ex/_ex2\`, \`EVP_DecryptInit_ex/_ex2\`, \`EVP_CipherInit_ex/_ex2\` with their Update/Final families, plus \`EVP_CIPHER_CTX_ctrl\` (AEAD AAD/tag) |

The EVP family follows OpenSSL 1.1+ naming; those symbols only appear in the import table when the target itself links libcrypto — which also means "no EVP events" does not mean "no encryption", only that this path was not taken.

### The behavior hook inventory

- **file**: eight functions — \`open / write / read / pread / mmap / close / unlink / rename\`; \`hooked_open\` additionally decodes read/write/create/append/truncate semantics from \`flags\`;
- **system**: \`dlopen\` (records loaded libraries) and \`dlsym\` (redirection above);
- **keychain**: the \`SecItemCopyMatching / SecItemAdd / SecItemUpdate / SecItemDelete\` quartet, translating CFDictionary service/account/data fields into readable records;
- **env**: \`ptrace / csops / sysctl / sysctlbyname / uname / getenv / stat / lstat / access / faccessat / fstatat\` — both observation points and the execution points for anti-debug and spoofing;
- **ObjC spoof layer**: swizzles for \`canOpenURL:\`, the \`UIDevice\` family, \`NSProcessInfo.operatingSystemVersion\` and \`ASIdentifierManager.advertisingIdentifier\` (see the in-process spoofing chapter);
- **dyld**: \`_dyld_get_image_name\` and \`dladdr\` — the "who is enumerating me" observation points that double as image hiding;
- **network**: three completion-style task-creation methods plus \`-[NSURLSessionTask resume]\` (swizzle), and \`SSL_write / SSL_read\` via fishhook for apps bundling their own TLS.

### Fail-loud health reporting

Every install self-checks; symbols that fail (missing selectors on some iOS versions, say) report through the health module. The health fields in \`/api/stats\` and MCP \`get_diag\` expose install/failure counts and an audit timeline. This extends the no-crash principle — degrade silently but report honestly, never crash.

## Crypto capture: from registers to readable semantics

The hard part of crypto capture is not interception but two things: **parameter semantics** and **session state management**. Raw C arguments are enums and pointers; they must become records like "AES-256-CBC · encrypt · PKCS7".

### One-shot calls: translating CCCrypt

All eight arguments of \`CCCrypt\` arrive in registers and on the stack; the hook parses them in order:

\`\`\`c
CCCryptorStatus CCCrypt(
    CCOperation op,        // 0=encrypt 1=decrypt
    CCAlgorithm alg,       // kCCAlgorithmAES=0, DES=1, 3DES=2, CAST=5 ...
    CCOptions options,     // kCCOptionPKCS7Padding(1) | kCCOptionECBMode(2)
    const void *key, size_t keyLen,
    const void *iv,
    const void *dataIn, size_t dataInLength,
    void *dataOut, size_t dataOutLength, size_t *dataOutMoved);
\`\`\`

Translation rules:

- **Algorithm name**: the \`alg\` enum combined with \`keyLen\` — AES with keyLen=32 is AES-256;
- **Mode and padding**: ECB when \`options & kCCOptionECBMode\`, otherwise CBC; padding from \`kCCOptionPKCS7Padding\`;
- **key/iv are read before invoking the original** — pre-op buffers still hold the raw material;
- **Plaintext direction**: on encrypt the input is plaintext, on decrypt the output is; the op bit decides which field is marked \`plain\`.

### Streaming sessions: the Create → Update → Final state machine

Large payloads use \`CCCryptorCreate/Update/Final/Release\` — four separate calls joined only by an opaque \`CCCryptorRef\`. The hook keeps a session table keyed by cryptorRef:

| Call | Hook action |
|---|---|
| \`Create\` / \`CreateWithMode\` | create session: algorithm, mode, key, iv, direction |
| \`Update\` | append the chunk to the session buffer, **no record yet** (a lone chunk carries no meaning) |
| \`Final\` | reassemble full plaintext/ciphertext, only now emit one complete record (with cumulative length) |
| \`Release\` | destroy session |

Two edge cases: multiple Updates append in call order and flush once at Final; and the "never-Final" session — an app holding a cryptorRef and Update-looping without closing is state leakage, reclaimed via the Release hook so the table never grows unbounded.

### SecKey: read the dictionary, never the struct

The algorithm parameter for asymmetric sign/encrypt is a CFDictionary. The hook pulls \`kSecAttrKeyType\` (RSA/EC), \`kSecAttrKeySizeInBits\` and \`kSecAttrKeyClass\` (private/public) via \`CFDictionaryGetValue\` to build ids like "RSA-2048 PKCS1v15-SHA256" or "EC secp256r1". The SecKeyRef itself stays opaque — the tool never reads its internals, only records the address and purpose, avoiding Apple private structures.

### EVP: lazily resolving helper symbols

OpenSSL 1.1+ hides algorithm metadata inside the \`EVP_CIPHER\` struct. The hook lazily resolves official helpers with \`dlsym\`:

\`\`\`c
fn_CIPHER_get0_name  = dlsym(RTLD_DEFAULT, "EVP_CIPHER_get0_name");
fn_CIPHER_key_length = dlsym(RTLD_DEFAULT, "EVP_CIPHER_key_length");
fn_CIPHER_iv_length  = dlsym(RTLD_DEFAULT, "EVP_CIPHER_iv_length");
\`\`\`

Given the cipher pointer it calls these **original** functions for name and lengths instead of parsing struct layout — compatible with OpenSSL 1.1/3.x out of the box. AEAD (AES-GCM / ChaCha20-Poly1305) AAD and tags flow through \`EVP_CIPHER_CTX_ctrl\`, which is hooked and logged separately.

### KDF: keep the passphrase in evidence

\`CCKeyDerivationPBKDF\` receives the passphrase plaintext, salt and iteration count directly, and the derived key is readable afterward. These records feed weak-password/slow-hash analysis — which is exactly why exporting them must be treated as sensitive material (see boundaries and compliance).

## In-process spoofing: fake answers at detection points

Hiding a jailbreak or injection is not about hiding yourself; it is about **answering consistently fake questions at the app's detection points**. Five common surfaces: filesystem probes, URL scheme queries, dylib enumeration, sandbox-escape probes and anti-debugging.

### File layer: ENOENT from a path blacklist

\`hooked_open\` checks a blacklist before passing through:

\`\`\`c
if (dh_spoof_jb_should_hide_path(path)) {
    dh_log_hidden("open", path);
    errno = ENOENT;
    return -1;
}
int fd = orig_open(path, flags, mode);
\`\`\`

Defaults cover typical probe paths like \`/var/jb\`, \`/bin/bash\` and \`libjailbreak.dylib\`, extensible at runtime. Crucially **access/stat share the same predicate as open**, so all three probe paths agree — no contradiction where stat says "exists" and open says "not found".

### dyld layer: rewriting enumeration answers

\`_dyld_get_image_name\` and \`dladdr\` are hooked; both observe "who enumerates me" and execute image hiding:

\`\`\`c
static const char *hooked_dyld_get_image_name(uint32_t index) {
    const char *real = orig_dyld_get_image_name(index);
    if (real && dh_spoof_should_hide_image(real)) {
        dyld_log_hidden_once(real);
        return kBenignImageName;   // harmless placeholder
    }
    return real;
}
\`\`\`

\`dladdr\` likewise erases \`dli_fname\` on success. \`dyld_log_hidden_once\` logs each hidden item once, without flooding.

### ObjC layer: scheme filtering and device spoofing

- \`-[UIApplication canOpenURL:]\`: schemes like \`cydia\` on the blacklist return NO;
- \`UIDevice\` systemVersion/name/identifierForVendor, \`NSProcessInfo.operatingSystemVersion\` and \`ASIdentifierManager.advertisingIdentifier\` return configured values, with randomization support.

Every swizzle carries the guard "empty config → pass through the original" — spoofing is an **optional capability**; unconfigured means untouched.

### Anti-debugging: ptrace and sysctl

\`ptrace\`'s \`PT_DENY_ATTACH\` is intercepted outright; \`sysctl\` \`KERN_PROC_PID\` queries are logged and, with spoofing enabled, the \`P_TRACED\` flag is cleared before returning. The design principle: make the **querier** see "not debugged" rather than making the debugger actually fail, which would advertise presence.

### Boundary: in-process spoofing ≠ invisibility

All hiding acts only on **this process's API return values**. Cross-app calls, system services and server-side device profiling are unaffected. Its accurate name is "in-process spoofing", not "invisibility" — a boundary security assessments must state honestly.

## Network capture: three-layer pairing without certificates

Proxy capture must solve certificate trust and pinning; in-process capture takes data straight from the app's own call chain and solves neither. Three layers, all gated by the \`DH_CAP_NETWORK\` capture toggle, recorded under the network category.

### Layer 1: completion-callback pairing

The mainstream usage is completion handlers. Task-creation methods are swizzled and the core trick is **wrapping the completion block**:

\`\`\`c
DHDataCH wrapped = ^(NSData *data, NSURLResponse *resp, NSError *err) {
    net_log_pair(rc.HTTPMethod, rc.URL.absoluteString,
                 rc.allHTTPHeaderFields, rc.HTTPBody,
                 data, resp, err, cs, reqMs, reqTid);
    ch(data, resp, err);   // original block runs untouched
};
\`\`\`

The wrapper's closure captures the original method's \`request\` argument — when the response arrives the body, URL and headers are still readable, and request and response pair naturally in one record. The wrapper body is \`@try/@catch\` guarded; log failures never affect the original block.

An important design detail — the **request-time anchor**: \`reqMs\`/\`reqTid\` are recorded at task creation, not at response arrival. Anchoring slow requests by response time would push same-window crypto events out of correlation range (next section).

### Layer 2: resume backstop and dedupe

Delegate-style tasks have no completion block; the request is visible only at \`-[NSURLSessionTask resume]\`. Swizzle resume and read \`task.currentRequest\`. Overlap with layer 1 is resolved with \`objc_setAssociatedObject\`: tasks already captured by completion pairing carry a mark, and resume skips marked tasks — one task, one record.

### Layer 3: bundled TLS plaintext

When an app bundles its own OpenSSL/BoringSSL (bypassing system TLS), fishhooked \`SSL_write / SSL_read\` capture plaintext byte streams. \`void *ssl\` placeholder suffices — record bytes, don't parse sessions. System TLS never passes through app import slots, so misses at this layer are expected; it is positioned as best-effort.

### Cross-event correlation: the time-window causal chain

Network and crypto sharing one timeline is this design's most valuable trait. A network record's \`timestampMs/threadId\` hold **request-construction-time** values; \`correlate_request\` anchors on a network event and aggregates crypto and Keychain events within the window, reverse-matching Base64 request headers against encrypted outputs — one login request's signature, encryption and Keychain writes land on a single causal chain.

## Dumping: exporting what the kernel already decrypted

App Store binaries ship a FairPlay-encrypted \`__TEXT\` (\`LC_ENCRYPTION_INFO_64\` with \`cryptid=1\`), but runtime memory is already plaintext — the kernel decrypts code pages before mapping. Dumping is essentially an **export**: re-serializing the decrypted in-memory Mach-O back to disk per spec.

### Four-step rewrite

1. **Enumerate and gate**: walk images via \`_dyld_image_count/_dyld_get_image_header\`, filter to main-bundle binaries and Frameworks (system libraries excluded), read \`LC_ENCRYPTION_INFO_64\` and proceed only when \`cryptid=1\`;
2. **Re-serialize per load command**: in-memory images carry a rebase slide, so no blind memcpy. Copy the file header and all load commands, then for every segment except \`__LINKEDIT\` write back the mapped pages at \`fileoff\` (subtracting the slide yields the memory origin);
3. **Copy \`__LINKEDIT\` verbatim**: symbol tables, string tables and dyld info are plaintext on disk anyway — copy them from the original file;
4. **Finish**: clear \`cryptid\` and expand the encrypted segment's \`filesize\` to its real value — the on-disk filesize is ciphertext size (possibly smaller than plaintext, page-aligned); copying it verbatim leaves static analyzers reading a truncated \`__text\`.

The artifact goes straight to IDA/Ghidra/class-dump, or onward to re-signing and installation.

### Zero-dependency zip writer

IPA mode generates zip on-device with a zero-dependency writer:

- Hand-built local file header / central directory / EOCD structures; compression method STORE (0) only;
- Table-driven CRC-32: a precomputed 256-entry table (polynomial \`0xEDB88320\`), each byte computing \`table[(crc ^ byte) & 0xFF] ^ (crc >> 8)\` — byte-identical to zlib;
- Only necessary entries under \`Payload/App.app\` are written; \`SC_Info\` and FairPlay leftovers are skipped so resigning tools aren't misled by stale encryption metadata.

### Async task model and boundaries

Dumping runs as an async task in \`dump_manager\`: submit then poll status, on a dedicated queue that never blocks HTTP or hook threads — in an injected context every long operation must run off-thread. Boundaries are equally explicit: \`PlugIns/*.appex\` are separate processes the main process never loaded; triggered on demand with zero cost otherwise; authorized targets only.

## Capstone and MCP: turning addresses into semantics

The device embeds an MCP (Model Context Protocol) server reusing the HTTP port at \`POST /api/mcp\` (Streamable HTTP transport, JSON-RPC 2.0, initialize/tools/list/tools/call, sessions tracked via the \`Mcp-Session-Id\` header). The public build exposes 44 tools. The hardest part is turning **runtime addresses into semantics**.

### Safe reads are the precondition for everything

Memory reads across \`analyze_function / read_memory / search_memory\` and every xref scan go through \`vm_read_overwrite\`:

\`\`\`c
kern_return_t kr = vm_read_overwrite(mach_task_self(), addr, size, buf, &len);
if (kr != KERN_SUCCESS) return isError;   // unreadable page returns an error, never a crash
\`\`\`

Any address in the target may be unreadable; one crash kills the host. This floor is shared with hooking and dumping.

### Capstone integration and honest boundaries

Capstone 5.0.1 is embedded as source (ARM/AArch64 only, ~2MB). Each instruction from the three disassembly tools carries structured operands, explicit read/write register sets and control-flow groups beyond mnemonic/op_str; ARM64 MOVZ/MOVN/MOVK gets extra constant reconstruction (value/known_mask/complete). Constant tracking works only within the current linear instruction stream — control flow or register clobber invalidates it, reported honestly as \`complete=false\` rather than treating unknown bits as zero.

\`disassemble_function\` normalizes boundaries via \`LC_FUNCTION_STARTS\` first: accept a mid-function address, decode to the real entry and end, respond with \`boundary_source/confidence\`; without function metadata it degrades to a low-confidence ret heuristic. **The tool never pretends more certainty than it has** — confidence fields must be read together.

### The xref family: tiered dependencies

| Tier | Tools | Question answered |
|---|---|---|
| tier-0 | \`get_macho_info\` / \`list_images\` / \`list_imports\` / \`list_loaded_images\` | which images exist, which imports are fishhook candidates, the complete dyld map |
| tier-0 | \`disassemble\` / \`analyze_function\` | bytes or addresses into structured instructions |
| tier-1 | \`find_xrefs\` | who calls it |
| tier-2A | \`find_string_refs\` | who references this string |
| tier-2B | \`find_selector_refs\` | who sends messages with this selector |
| tier-3A | \`find_function_refs\` | internal call graph (callers/callees/both) |
| tier-3B | \`list_functions\` | LC_FUNCTION_STARTS inventory — the attribution base for everything else |
| tier-4 | \`objc_resolve_imp\` / \`find_objc_methods\` | which IMP a selector executes right now; runtime method-entity queries |

Representative implementations:

- **find_xrefs** recognizes direct \`bl\` only: linearly scan \\\`__text\\\` collecting call sites; targets landing in import-stub regions resolve through runtime-bound GOT entries plus dladdr. \`resolved_name\` reflects the true runtime destination — if fishhook rewrote that import, the hook symbol shows honestly;
- **find_string_refs** handles both addressing forms: ADRP+ADD (direct) and ADRP+LDR pointer slots (indirect, whitelist slots only), recording hits that land in string sections. Local-window backtracking caches the most recent ADRP page per register and invalidates on register writes — no cross-basic-block dataflow, stated plainly;
- **find_selector_refs** reports real message sends only: classic paths (selref load + blr/bl objc_msgSend with an x1 state machine) and modern \`__objc_stubs\` are both covered; bare selref loads do not count;
- **Large-image paging**: the four scan tools cap at 48MB of \\\`__text\\\` per call; the response's \`scan\` structure carries full coverage info and \`next_scan_offset\` — unfinished scans must page on before claiming "no references".

### Why runtime xref beats static files

Static analyzers can only restore addresses on stripped binaries; runtime adds three sources: dyld has finished rebasing and binding so GOT entries hold real addresses; dladdr maps addresses back to images and nearest symbols; and you can ask the runtime which code a selector currently executes (\`objc_resolve_imp\`, honestly reporting only the current implementation with \`original_imp_known=false\`, never claiming to recover pre-swizzle IMPs). Combined, an xref answer goes from "0x1029ac000" to "\`-[SessionCipher encrypt:]\` + 0x88" — full semantics.

## Storage and services: designed so the host cannot die

### Per-category ring buffers + noise diversion

\`DHLogStore\` keeps independent ring buffers per category: crypto, file, system, network and Keychain each get a bucket, so one hot category cannot starve others. High-frequency system calls like \`MGCopyAnswer\` divert to noise boards (exact-match patterns, crypto/sys boards toggled independently) off the main feed — the panel shows deliberately narrowed business signals while noise stays separately queryable.

### Rolling disk logs and closed-loop crash forensics

Disk persistence keeps one append handle open (no open/close per record) with a 64KB blob cap; past the configured limit it rotates keeping \`.1/.2/.3\` backups. The download endpoint stitches segments chronologically — after a crash or kill, a restart still retrieves the full history; disconnection clears nothing, forming a crash-recoverable evidence chain.

### One port for everything

The HTTP service plays three roles on one listener: web panel (\`/\`), health stats (\`/api/stats\`) and MCP (\`POST /api/mcp\`). It starts at 8088 and picks the first free port within 8088..8108 on conflict. No extra ports — every additional listener is another detection surface in an injected context. Concurrency and body-size caps protect against slow-client resource exhaustion.

### The complete no-crash checklist

- All untrusted memory reads go through \`vm_read_overwrite\` or equivalent guards;
- ObjC boundaries use \`@try/@catch\` as needed; unreadable addresses return errors;
- No expensive I/O inside hook bodies (network requests, file I/O) that could stall the host;
- Allocation failures must be checked; logging and network failures degrade silently;
- Startup order is fixed (chapter two); failed installs report health instead of crashing.

## The idh gateway: deterministic access for AI clients

The device captures and exposes; the analysis entry point lives on the PC. idh does two things: connect and bridge.

### Why no auto-discovery

Injected contexts cannot control the host app's Info.plist, so Bonjour/mDNS registration fails silently; UDP broadcast beacons would work but add protocol complexity and debugging noise. The final design skips discovery entirely: get IP and port manually from the panel, floating window or diagnostics, then \`idh connect <ip>:<port>\` specifies and persists the connection. Simple, and hard to get wrong.

### stdio bridging and a fixed toolset

The dylib's MCP speaks Streamable HTTP while Codex/Claude-class AI clients mainly speak stdio. \`idh mcp\` bridges the former into the latter. The aggregate gateway exposes a **fixed toolset** (\`idh_list_devices / idh_list_tools / idh_get_tool_schema / idh_call_tool / idh_get_panel_url\`) so devices coming and going never invalidate client-cached tools/list; AI routes deterministically by schema rather than idh guessing intent.

Two safety designs worth highlighting:

- **Explicit confirmation for mutating tools**: side-effecting calls like \`set_pause\` or \`start_dump\` require \`allow_mutation=true\`; the transparent proxy enforces it as a required schema field;
- **Stable-cursor exports**: \`export_events\` pins an upper bound with \`snapshot_until_seq\` and pages via \`next_after_seq\` until \`has_more=false\`, preventing duplicates or drift from events arriving mid-export.

## Boundaries, limits and compliance

Finally, the boundaries any public use must know:

- **Observation limits**: hooks cover rebindable imports and ObjC methods only; statically linked code, private call paths or APIs never exercised produce no events. "Not observed" is a lead, not proof of absence;
- **Capabilities vary by environment**: MCP tools depend on variant (dev/trollstore/rootless), target image and device; handshake with \`get_capabilities\` before relying on anything;
- **Unauthenticated services**: HTTP and MCP have no authentication — trusted LANs only, never exposed to the public internet;
- **Sensitive data**: events, exported JSON and MCP responses may contain keys, IVs, plaintext, tokens, paths and request data; store and share as sensitive material and redact before filing issues;
- **Authorization first**: analyze only your own apps or authorized targets; redistributing copyrighted programs may be unlawful.

## Closing

From the first line before \`main()\` to the structured events an AI client reads, every layer of this pipeline serves one constraint: **live stably inside someone else's process**. Change pointers never instructions, guard every read, degrade silently but report honestly, serve everything from one port — carried through consistently, jailbreak-free runtime analysis stops being a demo and becomes a tool.`,
    },
  },
];
