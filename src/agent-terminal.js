// Claude Code-style MCP session replay for the homepage.
import { $ } from './layout.js';
import { getLang } from './i18n.js';

const PYTHON = `import os, hmac, hashlib, json, time, requests
from Crypto.Cipher import AES

# 以下 Key / IV / HMAC 来自 get_event #118 / #119 — 演示数据，勿用于真实环境
KEY = bytes.fromhex(os.environ["CAPTURED_KEY"])   # AES-256 · 32 B
IV  = bytes.fromhex(os.environ["CAPTURED_IV"])    # 16 B
MAC = bytes.fromhex(os.environ["CAPTURED_MAC"])   # HMAC-SHA256 key

API = "https://api.demo.app/v2/auth/login"

def pkcs7(data: bytes) -> bytes:
    n = 16 - (len(data) % 16)
    return data + bytes([n] * n)

def sign(ts: int) -> str:
    # HMAC 输入与 #119 明文一致：METHOD + path + ?ts=
    msg = f"POST/v2/auth/login?ts={ts}".encode()
    return hmac.new(MAC, msg, hashlib.sha256).hexdigest()

def login(user: str, password: str, timeout: float = 8.0):
    ts = int(time.time())
    body = json.dumps(
        {"user": user, "password": password, "ts": ts},
        separators=(",", ":"),
    ).encode()
    ct = AES.new(KEY, AES.MODE_CBC, IV).encrypt(pkcs7(body))
    resp = requests.post(
        API,
        headers={
            "Content-Type": "application/octet-stream",
            "X-Sign": sign(ts),
        },
        data=ct,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp

if __name__ == "__main__":
    # 口令从环境读，不写进脚本
    login(os.environ["DEMO_USER"], os.environ["DEMO_PASSWORD"])
`;

const PYTHON_EN = `import os, hmac, hashlib, json, time, requests
from Crypto.Cipher import AES

# Key / IV / HMAC from get_event #118 / #119 — demo values only
KEY = bytes.fromhex(os.environ["CAPTURED_KEY"])   # AES-256 · 32 B
IV  = bytes.fromhex(os.environ["CAPTURED_IV"])    # 16 B
MAC = bytes.fromhex(os.environ["CAPTURED_MAC"])   # HMAC-SHA256 key

API = "https://api.demo.app/v2/auth/login"

def pkcs7(data: bytes) -> bytes:
    n = 16 - (len(data) % 16)
    return data + bytes([n] * n)

def sign(ts: int) -> str:
    # HMAC input matches event #119: METHOD + path + ?ts=
    msg = f"POST/v2/auth/login?ts={ts}".encode()
    return hmac.new(MAC, msg, hashlib.sha256).hexdigest()

def login(user: str, password: str, timeout: float = 8.0):
    ts = int(time.time())
    body = json.dumps(
        {"user": user, "password": password, "ts": ts},
        separators=(",", ":"),
    ).encode()
    ct = AES.new(KEY, AES.MODE_CBC, IV).encrypt(pkcs7(body))
    resp = requests.post(
        API,
        headers={
            "Content-Type": "application/octet-stream",
            "X-Sign": sign(ts),
        },
        data=ct,
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp

if __name__ == "__main__":
    # Password stays in the environment, not in this file
    login(os.environ["DEMO_USER"], os.environ["DEMO_PASSWORD"])
`;

const ASM = `0x1029ac000  stp   x29, x30, [sp, #-0x50]!
0x1029ac004  mov   x29, sp
0x1029ac008  str   x19, [sp, #0x40]
0x1029ac00c  mov   x19, x0                 ; self
0x1029ac010  ldr   x0, [x19, #0x18]        ; key  (32 B)
0x1029ac014  ldr   x1, [x19, #0x20]        ; iv   (16 B)
0x1029ac018  ldr   x3, [x19, #0x28]        ; dataIn
0x1029ac01c  ldr   w4, [x19, #0x30]        ; dataInLength
0x1029ac020  add   x5, sp, #0x08           ; dataOut
0x1029ac024  add   x6, sp, #0x00           ; dataOutMoved
0x1029ac028  mov   w2, #0                  ; kCCEncrypt
0x1029ac02c  mov   w7, #2                  ; kCCAlgorithmAES
0x1029ac030  mov   w8, #2                  ; kCCOptionPKCS7Padding
0x1029ac034  bl    _CCCrypt
0x1029ac038  cbnz  w0, loc_err
0x1029ac03c  ldr   x0, [sp, #0x08]
0x1029ac040  ldr   x19, [sp, #0x40]
0x1029ac044  ldp   x29, x30, [sp], #0x50
0x1029ac048  ret
0x1029ac04c  loc_err:
0x1029ac04c  mov   w0, #-1
0x1029ac050  b     0x1029ac040`;

function scriptFor(lang) {
  const zh = lang !== 'en';
  return [
    {
      type: 'user',
      text: zh
        ? '已经用 TrollStore 把插件注入 CryptoTestHost，并在 App 里手动走完一次登录。帮我把这条登录链路摸清楚：请求打到哪、body 怎么加密、请求头那个 X-Sign 是怎么来的。'
        : 'CryptoTestHost is injected via TrollStore and I tapped through login once. Reconstruct the chain: where the request goes, how the body is encrypted, and how the X-Sign header is made.',
    },
    {
      type: 'assistant',
      thinkMs: 980,
      text: zh
        ? '设备端 MCP 已连上。我先握手确认变体和能力，再从网络事件里把登录请求捞出来，用时间窗把它和前后的加解密对齐。\n\n你是只要一份还原说明，还是还原完再写一份可复用的 Python 脚本？'
        : 'Device MCP is up. I will handshake for variant and capabilities, pull the login request from net events, then correlate nearby crypto in a time window.\n\nDo you want the reconstruction only, or a reusable Python script after that?',
    },
    {
      type: 'user',
      text: zh
        ? '都要。先把链路对齐并确认 X-Sign 的输入是什么，再写脚本。口令不要写进文件，用环境变量。脚本要能换时间戳重签。'
        : 'Both. Align the chain and confirm what X-Sign is hashed over, then write the script. Keep the password in env vars. The script must resign when the timestamp changes.',
    },
    {
      type: 'assistant',
      thinkMs: 720,
      text: zh
        ? '好。按协议先 get_capabilities，再看事件总量，避免一上来就在噪声里打转。'
        : 'Okay. Handshake with get_capabilities first, then check event volume so we do not start inside noise.',
    },
    {
      type: 'tool',
      name: 'get_capabilities',
      args: '{}',
      ms: 640,
      holdMs: 1100,
      result: zh
        ? 'version     1.24.6\nvariant     trollstore\narch        arm64\nphase       observe\nhost        CryptoTestHost\ncapabilities\n  hook_import   true\n  hook_method   true\n  unpack        true\n  mcp           true\ntools       44'
        : 'version     1.24.6\nvariant     trollstore\narch        arm64\nphase       observe\nhost        CryptoTestHost\ncapabilities\n  hook_import   true\n  hook_method   true\n  unpack        true\n  mcp           true\ntools       44',
    },
    {
      type: 'tool',
      name: 'get_stats',
      args: '{}',
      ms: 700,
      holdMs: 1200,
      result: zh
        ? 'total 186\n  crypto  72    file  31    sys  28\n  net     9     keychain  4    noise 42\nhealth    installed 124  failed 0\ncapture   CCCrypt on   CCHmac on   CC_SHA256 on'
        : 'total 186\n  crypto  72    file  31    sys  28\n  net     9     keychain  4    noise 42\nhealth    installed 124  failed 0\ncapture   CCCrypt on   CCHmac on   CC_SHA256 on',
    },
    {
      type: 'assistant',
      thinkMs: 860,
      text: zh
        ? 'trollstore / observe，hook 健康。186 条里网络只有 9 条，先按 login 过滤，把心跳和新闻 SDK 剔掉。'
        : 'trollstore / observe, hooks healthy. Only 9 net events in 186. I will filter on login and drop heartbeats plus the news SDK.',
    },
    {
      type: 'tool',
      name: 'query_events',
      args: 'category: net  ·  query: login  ·  limit: 8',
      ms: 920,
      holdMs: 1600,
      result: zh
        ? 'count 4   (newest first)\n#141  POST  https://api.demo.app/v2/auth/login           412 B   200\n      header  X-Sign: 9c1f4a…e2a4\n      t+12.041s  thread  com.apple.NSURLSession\n#136  GET   https://api.demo.app/v1/config               0 B     200\n#129  POST  https://news.sdk.example/v2/login/report     88 B    204   ← 新闻 SDK，忽略\n#121  GET   https://api.demo.app/v1/bootstrap            0 B     200'
        : 'count 4   (newest first)\n#141  POST  https://api.demo.app/v2/auth/login           412 B   200\n      header  X-Sign: 9c1f4a…e2a4\n      t+12.041s  thread  com.apple.NSURLSession\n#136  GET   https://api.demo.app/v1/config               0 B     200\n#129  POST  https://news.sdk.example/v2/login/report     88 B    204   ← news SDK, ignore\n#121  GET   https://api.demo.app/v1/bootstrap            0 B     200',
    },
    {
      type: 'assistant',
      thinkMs: 1100,
      text: zh
        ? '真正的登录是 #141：POST /v2/auth/login，body 412 字节，带 X-Sign。#129 是新闻 SDK 的上报，correlate 时不要被它带偏。\n\n接下来以 #141 为锚，300ms 窗口里把 AES / HMAC / Keychain 拉齐。'
        : 'The real login is #141: POST /v2/auth/login, 412-byte body, X-Sign present. #129 is news-SDK telemetry — keep it out of correlate.\n\nNext I will anchor on #141 and pull AES / HMAC / Keychain from a 300ms window.',
    },
    {
      type: 'tool',
      name: 'correlate_request',
      args: 'net_seq: 141  ·  window_ms: 300  ·  match_header: X-Sign',
      ms: 1180,
      holdMs: 1800,
      result: zh
        ? 'anchor  #141  POST /v2/auth/login   window 300ms   t=12.041s\n\n  #118  AES-256-CBC encrypt   in 53 B → out 64 B    Δ −18ms\n        op  kCCEncrypt  pad  PKCS7\n        stack  -[SessionCipher encrypt:]+0x88\n  #119  HMAC-SHA256           in 31 B → out 32 B    Δ −7ms\n        stack  -[APIClient signRequest:]+0x54\n  #140  keychain add          account demo          Δ +4ms\n\nmatch  header X-Sign\n  decoded  32 B hex  =  event #119 output\n  not matched: body (AES ciphertext, not a header)'
        : 'anchor  #141  POST /v2/auth/login   window 300ms   t=12.041s\n\n  #118  AES-256-CBC encrypt   in 53 B → out 64 B    Δ −18ms\n        op  kCCEncrypt  pad  PKCS7\n        stack  -[SessionCipher encrypt:]+0x88\n  #119  HMAC-SHA256           in 31 B → out 32 B    Δ −7ms\n        stack  -[APIClient signRequest:]+0x54\n  #140  keychain add          account demo          Δ +4ms\n\nmatch  header X-Sign\n  decoded  32 B hex  =  event #119 output\n  not matched: body (AES ciphertext, not a header)',
    },
    {
      type: 'assistant',
      thinkMs: 960,
      text: zh
        ? '因果已经立住：先 AES 加密 body（#118），再 HMAC 出 X-Sign（#119），然后才发出 POST。登录成功后 Keychain 写了 account=demo。\n\n下面把 #118 / #119 的明文和密钥整条拉出来。脚本里口令会改成环境变量，这里只确认算法和签名输入。'
        : 'Causality holds: AES encrypts the body (#118), HMAC produces X-Sign (#119), then the POST goes out. After success, Keychain writes account=demo.\n\nI will pull #118 and #119 in full. The script will read the password from the environment; here I only confirm the algorithm and the sign input.',
    },
    {
      type: 'tool',
      name: 'get_event',
      args: 'seq: 118',
      ms: 880,
      holdMs: 2000,
      result: zh
        ? '#118  AES-256-CBC / PKCS7 / kCCEncrypt\nkey     a3f1c9d0…7e0b          32 B\niv      00112233445566778899aabbccddeeff\ninLen   53   outLen 64\nplain   {"user":"demo","password":"••••••••","ts":1753238400}\nhex     7b2275736572223a2264656d6f222c2270617373…\nstack\n  -[SessionCipher encrypt:]+0x88\n  -[APIClient attachBody:]+0x2c\n  -[LoginVM submit]+0x1a4'
        : '#118  AES-256-CBC / PKCS7 / kCCEncrypt\nkey     a3f1c9d0…7e0b          32 B\niv      00112233445566778899aabbccddeeff\ninLen   53   outLen 64\nplain   {"user":"demo","password":"••••••••","ts":1753238400}\nhex     7b2275736572223a2264656d6f222c2270617373…\nstack\n  -[SessionCipher encrypt:]+0x88\n  -[APIClient attachBody:]+0x2c\n  -[LoginVM submit]+0x1a4',
    },
    {
      type: 'tool',
      name: 'get_event',
      args: 'seq: 119',
      ms: 840,
      holdMs: 2000,
      result: zh
        ? '#119  HMAC-SHA256\nkey     4b1e90aa…c31d          32 B\ninLen   31   outLen 32\nplain   POST/v2/auth/login?ts=1753238400\nhex     504f53542f76322f617574682f6c6f67696e3f74733d…\noutput  9c1f4a88c0b1…e2a4     ← 等于 #141 的 X-Sign\nstack\n  -[APIClient signRequest:]+0x54\n  -[LoginVM submit]+0x1c0'
        : '#119  HMAC-SHA256\nkey     4b1e90aa…c31d          32 B\ninLen   31   outLen 32\nplain   POST/v2/auth/login?ts=1753238400\nhex     504f53542f76322f617574682f6c6f67696e3f74733d…\noutput  9c1f4a88c0b1…e2a4     ← equals X-Sign on #141\nstack\n  -[APIClient signRequest:]+0x54\n  -[LoginVM submit]+0x1c0',
    },
    {
      type: 'user',
      text: zh
        ? 'X-Sign 看起来只签了 METHOD+path+ts，body 没进 HMAC？再确认一下是不是系统 CCCrypt，别是自实现 AES。确认完再写脚本。'
        : 'X-Sign looks like METHOD+path+ts only — body not in the HMAC? Confirm this is system CCCrypt, not a homemade AES. Then write the script.',
    },
    {
      type: 'assistant',
      thinkMs: 1200,
      text: zh
        ? '对，#119 的 31 字节明文就是 POST/v2/auth/login?ts=1753238400，没有 body。换 ts 必须重算 HMAC，这点和你要的脚本一致。\n\n我去找 CCCrypt 的 xref，再反汇编 -[SessionCipher encrypt:]，看参数是不是 kCCEncrypt + AES + PKCS7。'
        : 'Yes. The 31-byte plaintext of #119 is POST/v2/auth/login?ts=1753238400 — no body. A new ts needs a new HMAC, which matches the script you asked for.\n\nI will xref CCCrypt and disassemble -[SessionCipher encrypt:] to see kCCEncrypt + AES + PKCS7.',
    },
    {
      type: 'tool',
      name: 'find_xrefs',
      args: 'symbol: CCCrypt',
      ms: 1320,
      holdMs: 1400,
      result: zh
        ? 'count 2\n  call_site  0x1029ac034\n  from_func  -[SessionCipher encrypt:]+0x88\n  kind       call_import_stub\n  resolved   hook_CCCrypt\n\n  call_site  0x1029b41c8\n  from_func  -[SessionCipher decrypt:]+0x6c\n  kind       call_import_stub\n  resolved   hook_CCCrypt'
        : 'count 2\n  call_site  0x1029ac034\n  from_func  -[SessionCipher encrypt:]+0x88\n  kind       call_import_stub\n  resolved   hook_CCCrypt\n\n  call_site  0x1029b41c8\n  from_func  -[SessionCipher decrypt:]+0x6c\n  kind       call_import_stub\n  resolved   hook_CCCrypt',
    },
    {
      type: 'tool',
      name: 'disassemble_function',
      args: 'address: 0x1029ac000  ·  arch: arm64  ·  capstone  ·  max_bytes: 256',
      ms: 1500,
      holdMs: 2200,
      result: ASM,
    },
    {
      type: 'assistant',
      thinkMs: 1400,
      text: zh
        ? '链路可以定稿：\n\n1. LoginVM 组 JSON：user / password / ts\n2. SessionCipher 调系统 CCCrypt，AES-256-CBC + PKCS7，Key/IV 来自对象偏移 0x18 / 0x20\n3. APIClient 对 POST/v2/auth/login?ts=<unix> 做 HMAC-SHA256，写入 X-Sign\n4. NSURLSession POST，body 是密文，不是 JSON\n5. 成功后 Keychain 写入 account=demo\n\nX-Sign 不覆盖 body，所以重放时必须用同一套 JSON 字段顺序（无空格），并在每次请求时重签。下面按这个写脚本，口令走环境变量。'
        : 'Chain, finalized:\n\n1. LoginVM builds JSON: user / password / ts\n2. SessionCipher calls system CCCrypt, AES-256-CBC + PKCS7, Key/IV at ivars 0x18 / 0x20\n3. APIClient HMAC-SHA256s POST/v2/auth/login?ts=<unix> into X-Sign\n4. NSURLSession POSTs ciphertext, not JSON\n5. On success, Keychain writes account=demo\n\nX-Sign does not cover the body, so replay must keep the same JSON field order (no spaces) and resign every request. Script next; password stays in env vars.',
    },
    {
      type: 'code',
      filename: 'login.py',
      text: zh ? PYTHON : PYTHON_EN,
      holdMs: 2800,
    },
    {
      type: 'assistant',
      thinkMs: 700,
      text: zh
        ? '脚本会每次取新的 unix ts，按 #119 的格式重算 X-Sign，JSON 用 separators=(",", ":") 对齐 53 字节明文。Key / IV / HMAC key / 口令都从环境变量读。\n\n这是演示数据，只适用于你已授权分析的目标。不要把捕获到的密钥提交到仓库或发到公网。'
        : 'The script takes a fresh unix ts each time, rebuilds X-Sign in the #119 format, and emits JSON with separators=(",", ":") to match the 53-byte plaintext. Key / IV / HMAC key / password all come from the environment.\n\nDemo values only, for a target you are authorized to analyze. Do not commit captured keys or post them publicly.',
    },
  ];
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function highlightPython(src) {
  return escapeHTML(src)
    .replace(/(#.*)$/gm, '<span class="at-cmt">$1</span>')
    .replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g, '<span class="at-str">$1</span>')
    .replace(
      /\b(import|from|def|return|int|str|bytes|if|else|class|with|as|True|False|None)\b/g,
      '<span class="at-kw">$1</span>',
    );
}

function chromeHTML(lang) {
  const zh = lang !== 'en';
  return `
    <div class="agent-term__bar">
      <span class="agent-term__dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="agent-term__title">claude</span>
      <span class="agent-term__meta">CryptoTestHost · 192.168.1.42:8088</span>
    </div>
    <div class="agent-term__body"></div>
    <div class="agent-term__composer">
      <span class="agent-term__gt">&gt;</span>
      <span class="agent-term__line">
        <span class="agent-term__typed"></span><span class="agent-term__caret" aria-hidden="true"></span>
      </span>
    </div>
    <div class="agent-term__status">
      <span class="agent-term__live"></span>
      <span>${zh ? 'idh mcp · 44 个工具' : 'idh mcp · 44 tools'}</span>
      <span class="agent-term__model">opus</span>
    </div>`;
}

function append(body, html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  const node = wrap.firstElementChild;
  body.appendChild(node);
  body.scrollTop = body.scrollHeight;
  return node;
}

function makeWait(ac) {
  return (ms) => new Promise((resolve, reject) => {
    if (ac.signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const tid = setTimeout(() => {
      ac.signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(tid);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    ac.signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function typeText(el, text, wait, instant, body) {
  if (instant) {
    el.textContent = text;
    if (body) body.scrollTop = body.scrollHeight;
    return;
  }
  el.textContent = '';
  for (let i = 0; i < text.length; i += 1) {
    el.textContent += text[i];
    const slow = /[\u4e00-\u9fff]/.test(text[i]);
    const accel = i > 70 ? 0.42 : 1;
    await wait((slow ? 24 : 11) * accel);
    if (body && i % 10 === 0) body.scrollTop = body.scrollHeight;
  }
  if (body) body.scrollTop = body.scrollHeight;
}

const THINK_GLYPHS = ['·', '✢', '✶', '✻'];

async function think(body, wait, instant, ms = 640) {
  if (instant) return;
  const node = append(body, `
    <div class="at-think">
      <span class="at-think__g">✶</span>
      <span>Thinking…</span>
    </div>`);
  const g = node.querySelector('.at-think__g');
  let i = 0;
  const tick = window.setInterval(() => {
    i = (i + 1) % THINK_GLYPHS.length;
    g.textContent = THINK_GLYPHS[i];
  }, 140);
  try {
    await wait(ms);
  } finally {
    window.clearInterval(tick);
    node.remove();
  }
}

async function runStep(step, ctx) {
  const { body, typed, composer, wait, instant } = ctx;
  const hold = instant ? 0 : (step.holdMs ?? 220);

  if (step.type === 'user') {
    composer.classList.add('is-typing');
    typed.textContent = '';
    await typeText(typed, step.text, wait, instant, null);
    await wait(instant ? 0 : 280);
    typed.textContent = '';
    composer.classList.remove('is-typing');
    append(body, `
      <div class="at-msg at-msg--user">
        <span class="at-msg__prompt">&gt;</span>
        <span class="at-msg__text">${escapeHTML(step.text)}</span>
      </div>`);
    await wait(hold);
    return;
  }

  if (step.type === 'assistant') {
    composer.classList.add('is-busy');
    await think(body, wait, instant, step.thinkMs);
    const node = append(body, `
      <div class="at-msg at-msg--ai">
        <span class="at-msg__mark">●</span>
        <span class="at-msg__text"></span>
      </div>`);
    await typeText(node.querySelector('.at-msg__text'), step.text, wait, instant, body);
    composer.classList.remove('is-busy');
    body.scrollTop = body.scrollHeight;
    await wait(hold);
    return;
  }

  if (step.type === 'tool') {
    composer.classList.add('is-busy');
    const node = append(body, `
      <div class="at-tool is-run">
        <div class="at-tool__head">
          <span class="at-tool__ico">⏺</span>
          <span class="at-tool__name">${escapeHTML(step.name)}</span>
          <span class="at-tool__src">idh</span>
        </div>
        <div class="at-tool__args">${escapeHTML(step.args)}</div>
      </div>`);
    await wait(instant ? 0 : step.ms || 800);
    node.classList.remove('is-run');
    node.classList.add('is-done');
    const out = document.createElement('pre');
    out.className = 'at-tool__out';
    out.textContent = step.result;
    node.appendChild(out);
    body.scrollTop = body.scrollHeight;
    composer.classList.remove('is-busy');
    await wait(hold);
    return;
  }

  if (step.type === 'code') {
    append(body, `
      <div class="at-code">
        <div class="at-code__bar">
          <span>${escapeHTML(step.filename)}</span>
          <span>python</span>
        </div>
        <pre class="at-code__pre">${highlightPython(step.text)}</pre>
      </div>`);
    body.scrollTop = body.scrollHeight;
    await wait(hold);
  }
}

let cleanup = null;

document.addEventListener('idh:langchange', () => {
  if (document.getElementById('agent-term')) initAgentTerminal();
});

export function initAgentTerminal() {
  if (cleanup) cleanup();
  const host = $('#agent-term');
  if (!host) return;

  const lang = getLang();
  host.innerHTML = chromeHTML(lang);
  const body = $('.agent-term__body', host);
  const typed = $('.agent-term__typed', host);
  const composer = $('.agent-term__composer', host);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController();
  let observer = null;
  let started = false;

  const ctxBase = () => ({
    body,
    typed,
    composer,
    wait: makeWait(ac),
  });

  async function play(instant) {
    const steps = scriptFor(lang);
    const ctx = { ...ctxBase(), instant };
    try {
      if (instant) {
        for (const step of steps) await runStep(step, ctx);
        return;
      }
      while (!ac.signal.aborted) {
        body.innerHTML = '';
        typed.textContent = '';
        composer.classList.remove('is-busy', 'is-typing');
        for (const step of steps) {
          if (ac.signal.aborted) return;
          await runStep(step, ctx);
        }
        await ctx.wait(12000);
        if (ac.signal.aborted) return;
        body.classList.add('is-resetting');
        await ctx.wait(420);
        body.classList.remove('is-resetting');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') throw err;
    }
  }

  function start() {
    if (started) return;
    started = true;
    play(reduce);
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      start();
      observer.disconnect();
      observer = null;
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  observer.observe(host.closest('#agent') || host);

  cleanup = () => {
    ac.abort();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };
}
