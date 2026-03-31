"""
Stealth Scripts — Inject vào browser để tránh bị phát hiện bot

Các script này override các API mà TikTok dùng để detect automation:
- navigator.webdriver
- navigator.plugins
- navigator.languages
- chrome.runtime
- WebGL renderer
- Permission API
"""

# JavaScript stealth scripts — inject vào mỗi page
STEALTH_SCRIPTS = """
// ===== 1. Override navigator.webdriver =====
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
});

// ===== 2. Override navigator.plugins (fake Chrome plugins) =====
Object.defineProperty(navigator, 'plugins', {
    get: () => {
        const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.length = 3;
        return plugins;
    },
});

// ===== 3. Override navigator.languages =====
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en', 'vi'],
});

// ===== 4. Override navigator.platform =====
Object.defineProperty(navigator, 'platform', {
    get: () => 'Win32',
});

// ===== 5. Override navigator.hardwareConcurrency =====
Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 8,
});

// ===== 6. Override navigator.deviceMemory =====
Object.defineProperty(navigator, 'deviceMemory', {
    get: () => 8,
});

// ===== 7. Fix chrome.runtime (ChromeDriver detection) =====
window.chrome = {
    runtime: {
        onConnect: undefined,
        onMessage: undefined,
        connect: () => {},
        sendMessage: () => {},
    },
    loadTimes: () => ({
        requestTime: Date.now() / 1000,
        startLoadTime: Date.now() / 1000,
        commitLoadTime: Date.now() / 1000,
        finishDocumentLoadTime: Date.now() / 1000,
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: false,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2',
    }),
    csi: () => ({
        onloadT: Date.now(),
        startE: Date.now(),
        pageT: 1000,
        tran: 15,
    }),
};

// ===== 8. Fix Permission API =====
const originalQuery = window.navigator.permissions?.query;
if (originalQuery) {
    window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
}

// ===== 9. Prevent iframe detection =====
Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get: function () {
        return window;
    },
});

// ===== 10. Override WebGL renderer =====
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function (parameter) {
    if (parameter === 37445) return 'Intel Inc.';
    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
    return getParameter.call(this, parameter);
};

// ===== 11. Fix toString detection =====
// Prevent detection via Function.toString()
const nativeToString = Function.prototype.toString;
const customToString = function () {
    if (this === navigator.permissions.query) {
        return 'function query() { [native code] }';
    }
    return nativeToString.call(this);
};
Function.prototype.toString = customToString;

console.log('[STEALTH] Anti-detection scripts injected');
"""


async def inject_stealth(page):
    """Inject stealth scripts vào page để tránh bị phát hiện bot"""
    try:
        await page.add_init_script(STEALTH_SCRIPTS)
    except Exception as e:
        print(f"[STEALTH] Warning: Failed to inject stealth scripts: {e}", flush=True)


async def inject_stealth_to_context(context):
    """Inject stealth scripts vào context — tự động apply cho mọi page mới"""
    try:
        await context.add_init_script(STEALTH_SCRIPTS)
        print("[STEALTH] ✅ Anti-detection scripts injected into context", flush=True)
    except Exception as e:
        print(f"[STEALTH] Warning: Failed to inject stealth scripts: {e}", flush=True)
