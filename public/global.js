// global.js - Master Sync Engine + Theme Toggle (FULLY CORRECTED)

// Keep browser API calls on the same origin in production. Netlify rewrites
// /api/* to the Railway service (see netlify.toml), preventing a browser CORS
// failure when visitors use a Netlify domain, a deploy preview, or the custom
// domain. Local/file development continues to call Railway directly.
const BACKEND_HOST = window.__ACCESS_WEALTH_BACKEND_URL__ || 'https://access-wealth-backend-production.up.railway.app';
const hostname = window.location.hostname.toLowerCase();
const isLocalApiSession = window.location.protocol === 'file:' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
const API_BASE_URL = `${BACKEND_HOST}/api`;
const GLOBAL_SYNC_SKIP_PAGES = ['login.html', 'register.html', 'admin.html', 'admin-users.html', 'support-agent.html', 'forgot-password.html', 'reset-password.html'];
const ADMIN_PAGE_NAMES = new Set(['admin.html', 'admin-users.html']);
const SUPPORT_PAGE_NAMES = new Set(['support-agent.html']);
const AUTH_STORAGE_KEYS = [
    'token', 'user', 'username', 'role', 'planActivated', 'activePackage',
    'activePackageId', 'my_referral_id', 'referred_by', 'balance',
    'wallet_balance', 'taskEarnings', 'daily_earnings', 'affiliate_balance',
    'profile_complete', 'bank_complete', 'account_complete', 'lastTaskClaimTime'
];
window.__AW_DEBUG__ = isLocalApiSession;
window.ACCESS_WEALTH_API_BASE_URL = API_BASE_URL;

// ==========================================
// API HELPERS — token refresh is shared by JSON and multipart requests.
// ==========================================
function apiUrl(path) {
    if (!path) return API_BASE_URL;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanPath.startsWith('/api/')) {
        return `${BACKEND_HOST}${cleanPath}`;
    }
    return `${API_BASE_URL}${cleanPath}`;
}

function currentPageName() {
    const pathname = window.location.pathname || '';
    return pathname.split('/').filter(Boolean).pop() || '';
}

function apiPathParam(value) {
    return encodeURIComponent(String(value ?? ''));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    })[character]);
}

function safeExternalUrl(value) {
    if (!value) return '';
    try {
        const url = new URL(String(value), window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
        return '';
    }
}

function formatNaira(value, options = {}) {
    const amount = Number(value);
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...options
    }).format(normalizedAmount);
}

function clearAuthSession() {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function userAvatarUrl(username) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(String(username || 'User'))}&background=d4af37&color=112A46&bold=true`;
}

async function apiFetch(path, options = {}) {
    try {
        return await fetch(apiUrl(path), options);
    } catch (networkError) {
        const message = networkError?.message || 'Unable to reach the service.';
        // Keep a fetch failure shaped like a Response so callers can use the
        // same result path, while preserving enough context for a useful UI
        // message instead of incorrectly calling every failure a bad password.
        return {
            ok: false,
            status: 0,
            statusText: message,
            networkError: true,
            json: async () => ({ success: false, error: 'We could not reach the server. Please check your internet connection and try again.' }),
            text: async () => message
        };
    }
}

let refreshInFlight = null;
function isAuthRoute(path) {
    return /\/(login|register|refresh-token)(?:\?|$)/.test(path);
}

function redirectToLoginAfterRefreshFailure() {
    clearAuthSession();
    if (currentPageName() === 'login.html') return;
    window.location.assign('/login.html');
}

function saveRefreshUser(user) {
    if (!user || typeof user !== 'object') return;
    const username = user.username || localStorage.getItem('username');
    if (username) localStorage.setItem('username', username);
    localStorage.setItem('user', JSON.stringify({ ...user, username: username || user.username || '' }));
    if (user.role) localStorage.setItem('role', user.role);
}

async function refreshAccessToken() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
        const currentToken = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
        const response = await apiFetch('/refresh-token', { method: 'POST', headers, body: '{}' });
        let data = {};
        try { data = await response.json(); } catch (_) {}
        const token = data.token || data.newToken || data.access_token || data.accessToken || data.data?.token;
        if (!response.ok || !token) return null;
        localStorage.setItem('token', token);
        saveRefreshUser(data.user || data.data?.user);
        return token;
    })();
    try { return await refreshInFlight; } finally { refreshInFlight = null; }
}

async function authorizedFetch(path, options = {}, canRefresh = true) {
    const headers = { ...(options.headers || {}) };
    const token = localStorage.getItem('token');
    if (token && !isAuthRoute(path)) headers.Authorization = `Bearer ${token}`;
    let response = await apiFetch(path, { ...options, headers });
    if (canRefresh && !isAuthRoute(path) && (response.status === 401 || response.status === 403)) {
        const freshToken = await refreshAccessToken();
        if (freshToken) {
            headers.Authorization = `Bearer ${freshToken}`;
            response = await apiFetch(path, { ...options, headers }); // exactly one retry
        } else {
            redirectToLoginAfterRefreshFailure();
        }
    }
    return response;
}

async function responseResult(response) {
    let data;
    try { data = await response.json(); }
    catch (_) { data = { success: false, error: response.statusText || 'Unable to parse server response.' }; }
    const isSuccess = response.ok && data.success !== false;
    const errorMessage = data.error || data.message || data.msg || data.error_description || (!response.ok ? (response.statusText || 'API request failed') : null);
    return {
        response,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        networkError: response.networkError === true,
        data,
        success: isSuccess,
        error: errorMessage
    };
}

async function apiFetchJson(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    return responseResult(await authorizedFetch(path, { ...options, headers }));
}

async function apiFetchMultipart(path, formData, options = {}) {
    // Do not set Content-Type here — fetch supplies the multipart boundary.
    return responseResult(await authorizedFetch(path, {
        ...options, method: options.method || 'POST', headers: { ...(options.headers || {}) }, body: formData
    }));
}

// Public raw-style calls get the same refresh-and-retry behavior as JSON requests.
window.apiFetch = (path, options = {}) => authorizedFetch(path, options);
window.apiFetchJson = apiFetchJson;
window.apiFetchMultipart = apiFetchMultipart;
window.refreshAccessToken = refreshAccessToken;
window.apiPathParam = apiPathParam;
window.escapeHtml = escapeHtml;
window.safeExternalUrl = safeExternalUrl;
window.formatNaira = formatNaira;
window.clearAuthSession = clearAuthSession;
window.userAvatarUrl = userAvatarUrl;

// ==========================================
// THEME MANAGEMENT (FIXED)
// ==========================================
const THEME_STORAGE_KEY = 'accesswealth-theme';

function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // Fallback to system preference or 'light'
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    // Update all toggle buttons on the page (if any)
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
        const action = next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
        btn.setAttribute('aria-label', action);
        btn.setAttribute('title', action);
    });
    return next;
}

function initTheme() {
    const preferred = getPreferredTheme();
    applyTheme(preferred);
}

// Attach toggle handlers to all existing and future toggle buttons
function setupThemeToggle() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        if (btn.dataset.themeBound === 'true') return;
        btn.dataset.themeBound = 'true';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });
    });
}

// Expose theme functions globally
window.applyTheme = applyTheme;
window.getPreferredTheme = getPreferredTheme;
window.initTheme = initTheme;
window.setupThemeToggle = setupThemeToggle;

// ==========================================
// SESSION SYNC
// ==========================================
function isPageAllowedForSync() {
    return !GLOBAL_SYNC_SKIP_PAGES.includes(currentPageName());
}

function normalizeUserPayload(user, fallbackUsername = '') {
    const source = user && typeof user === 'object' ? user : {};
    return {
        ...source,
        username: source.username || fallbackUsername,
        role: source.role || 'user',
        profile_complete: source.profile_complete === true || source.profile_complete === 'true',
        bank_complete: source.bank_complete === true || source.bank_complete === 'true',
        account_complete: source.account_complete === true || source.account_complete === 'true',
        planActivated: source.planActivated === true || source.planActivated === 'true' || source.plan_activated === true || source.plan_activated === 'true'
    };
}

function storeNormalizedUser(normalizedUser) {
    const walletBalance = Number(normalizedUser.wallet_balance ?? normalizedUser.balance ?? 0);
    const safeWalletBalance = Number.isFinite(walletBalance) ? walletBalance : 0;
    const taskEarnings = Number(normalizedUser.taskEarnings ?? 0) || 0;
    const dailyEarnings = Number(normalizedUser.daily_earnings ?? 0) || 0;
    const affiliateBalance = Number(normalizedUser.affiliate_balance ?? 0) || 0;

    localStorage.setItem('username', normalizedUser.username || '');
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('role', normalizedUser.role || 'user');
    localStorage.setItem('profile_complete', normalizedUser.profile_complete ? 'true' : 'false');
    localStorage.setItem('bank_complete', normalizedUser.bank_complete ? 'true' : 'false');
    localStorage.setItem('account_complete', normalizedUser.account_complete ? 'true' : 'false');
    localStorage.setItem('balance', String(safeWalletBalance));
    localStorage.setItem('wallet_balance', String(safeWalletBalance));
    localStorage.setItem('taskEarnings', String(taskEarnings));
    localStorage.setItem('daily_earnings', String(dailyEarnings));
    localStorage.setItem('affiliate_balance', String(affiliateBalance));
    localStorage.setItem('planActivated', normalizedUser.planActivated ? 'true' : 'false');
    localStorage.setItem('activePackage', normalizedUser.activePackage || '');
    localStorage.setItem('activePackageId', normalizedUser.activePackageId || '');
    localStorage.setItem('my_referral_id', normalizedUser.my_referral_id || normalizedUser.referralId || '');
    localStorage.setItem('referred_by', normalizedUser.referred_by || '');

    return { safeWalletBalance, taskEarnings, dailyEarnings, affiliateBalance };
}

function updateSyncedPage(normalizedUser, balances) {
    const username = normalizedUser.username || '';
    safeUpdate('sidebarName', username.toUpperCase());
    safeUpdate('cardName', username);
    safeUpdate('displayName', username.toUpperCase());
    safeUpdate('displayHandle', `@${username.toLowerCase().replace(/\s+/g, '')}`);

    const avatarUrl = userAvatarUrl(username);
    ['sidebarAvatar', 'cardAvatar', 'desktopAvatar', 'mobileAvatar'].forEach((id) => {
        const avatar = document.getElementById(id);
        if (avatar) avatar.src = avatarUrl;
    });

    const refLinkInput = document.getElementById('refLinkInput');
    if (refLinkInput) {
        const refId = normalizedUser.my_referral_id || normalizedUser.referralId || '';
        refLinkInput.value = `${window.location.origin}/register.html${refId ? `?ref=${encodeURIComponent(refId)}` : ''}`;
    }

    safeMoneyUpdate('liveBalanceDisplay', balances.safeWalletBalance);

    if (normalizedUser.planActivated) {
        safeUpdate('sidebarStatus', `Premium (${normalizedUser.activePackage || 'Active plan'})`);
        safeUpdate('accountStatusText', `Premium account (${normalizedUser.activePackage || 'Active plan'})`);
        const setupCard = document.getElementById('setupCard');
        if (setupCard) setupCard.style.display = 'none';
        const activateBtn = document.getElementById('activateBtn');
        if (activateBtn) activateBtn.style.display = 'none';
    } else {
        safeUpdate('sidebarStatus', 'No active plan');
        safeUpdate('accountStatusText', 'No active plan');
    }
}

async function globalSync() {
    if (!isPageAllowedForSync()) return;

    const token = localStorage.getItem('token');
    if (!token) {
        clearAuthSession();
        window.location.assign('/login.html');
        return;
    }

    try {
        // Syncing the authenticated session is safer than building a route from
        // a stored username, and it restores an interrupted local session.
        const { ok, data } = await apiFetchJson('/user/sync', {
            method: 'POST',
            body: JSON.stringify({})
        });
        if (!(ok && data.success && data.user)) return;

        const normalizedUser = normalizeUserPayload(data.user, localStorage.getItem('username') || '');
        const balances = storeNormalizedUser(normalizedUser);
        const page = currentPageName();

        if (normalizedUser.role === 'support' && !SUPPORT_PAGE_NAMES.has(page)) {
            window.location.assign('/support-agent.html');
            return;
        }
        if (normalizedUser.role === 'admin' && !ADMIN_PAGE_NAMES.has(page)) {
            window.location.assign('/admin.html');
            return;
        }

        updateSyncedPage(normalizedUser, balances);
        window.dispatchEvent(new Event('globalSyncComplete'));
    } catch (err) {
        if (window.__AW_DEBUG__) console.error('Access Wealth session sync failed.', err);
    }
}

function safeUpdate(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function safeMoneyUpdate(id, amount) {
    const el = document.getElementById(id);
    if (!el) return;
    const numericAmount = Number(amount);
    el.innerText = (Number.isFinite(numericAmount) ? numericAmount : 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

window.globalSync = globalSync;
window.logout = function() {
    clearAuthSession();
    sessionStorage.clear();
    window.location.assign('/login.html');
};

// ==========================================
// MOBILE NAV, TOAST, CONFIRM (unchanged)
// ==========================================
function injectMobileNav() {
    if (document.getElementById('mobile-nav-toggle')) return;

    const links = [
        { href: 'dashboard.html', label: 'Dashboard' },
        { href: 'activation.html', label: 'Activate' },
        { href: 'airtime.html', label: 'Airtime' },
        { href: 'deposit.html', label: 'Deposit' },
        { href: 'withdraw.html', label: 'Withdraw' },
        { href: 'support.html', label: 'Support' },
        { href: 'referral.html', label: 'Referral' }
    ];

    try {
        if (localStorage.getItem('role') === 'admin') links.push({ href: 'admin.html', label: 'Admin' });
        if (localStorage.getItem('role') === 'support') links.push({ href: 'support-agent.html', label: 'Agent' });
    } catch (_) {}

    const panel = document.createElement('div');
    panel.id = 'mobile-nav';
    const html = [];
    html.push('<button id="mobile-nav-toggle" aria-label="Open menu">☰</button>');
    html.push('<div id="mobile-nav-panel" class="mobile-nav-panel" aria-hidden="true">');
    html.push('<ul>');
    links.forEach(l => html.push(`<li><a href="${l.href}">${l.label}</a></li>`));
    html.push('</ul>');
    html.push('</div>');
    panel.innerHTML = html.join('');
    document.body.appendChild(panel);

    const style = document.createElement('style');
    style.innerHTML = `
    #mobile-nav-toggle{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--primary-yellow, #d4af37);color:#071022;border:none;padding:12px 16px;border-radius:999px;box-shadow:0 8px 20px rgba(0,0,0,0.35);display:none}
    .mobile-nav-panel{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9998;background:var(--bg-cards,#112A46);color:var(--text-main,#fff);border-radius:12px;padding:10px;border:1px solid rgba(255,255,255,0.04);box-shadow:0 10px 30px rgba(0,0,0,0.4);display:none;min-width:220px}
    .mobile-nav-panel ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
    .mobile-nav-panel a{color:inherit;text-decoration:none;padding:8px 12px;border-radius:8px;display:block}
    .mobile-nav-panel a:hover{background:rgba(255,255,255,0.03)}
    .mobile-nav-panel.open{display:block}
    @media (max-width: 768px){#mobile-nav-toggle{display:block}}`;
    document.head.appendChild(style);

    const toggle = document.getElementById('mobile-nav-toggle');
    const navPanel = document.getElementById('mobile-nav-panel');
    let open = localStorage.getItem('mobileNavOpen') === 'true';

    if (open) {
        navPanel.classList.add('open');
        navPanel.setAttribute('aria-hidden', 'false');
        toggle.innerText = '✕';
    }

    toggle.addEventListener('click', () => {
        open = !open;
        localStorage.setItem('mobileNavOpen', open ? 'true' : 'false');
        if (open) {
            navPanel.classList.add('open');
            navPanel.setAttribute('aria-hidden', 'false');
            toggle.innerText = '✕';
        } else {
            navPanel.classList.remove('open');
            navPanel.setAttribute('aria-hidden', 'true');
            toggle.innerText = '☰';
        }
    });

    navPanel.addEventListener('click', (e) => {
        if (e.target && e.target.tagName === 'A') {
            navPanel.classList.remove('open');
            navPanel.setAttribute('aria-hidden', 'true');
            toggle.innerText = '☰';
            open = false;
            localStorage.setItem('mobileNavOpen', 'false');
        }
    });
}

function showToast(type, message, timeout = 4000) {
    try {
        let container = document.getElementById('global-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'global-toast-container';
            container.style.position = 'fixed';
            container.style.top = '18px';
            container.style.right = '18px';
            container.style.zIndex = 10000;
            container.setAttribute('role', 'region');
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'global-toast ' + (type || 'info');
        toast.innerText = message;
        toast.style.marginBottom = '8px';
        toast.style.padding = '10px 14px';
        toast.style.borderRadius = '8px';
        toast.style.color = '#071022';
        const bgMap = {
            success: 'var(--success,#2ecc71)',
            error: 'var(--danger,#ff4d4d)',
            info: 'var(--primary-yellow,#d4af37)',
            warning: 'var(--warning,#f39c12)'
        };
        toast.style.background = bgMap[type] || bgMap.info;
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        toast.style.fontWeight = 600;
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 200ms ease, transform 200ms ease';
        toast.style.transform = 'translateY(-6px)';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

        container.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });

        let start = Date.now();
        let remaining = timeout;
        let timeoutId = setTimeout(hide, remaining);

        function hide() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-6px)';
            setTimeout(() => toast.remove(), 250);
        }

        toast.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
            const elapsed = Date.now() - start;
            remaining = Math.max(0, remaining - elapsed);
        });

        toast.addEventListener('mouseleave', () => {
            start = Date.now();
            timeoutId = setTimeout(hide, remaining);
        });

        return toast;
    } catch (e) { if (window.__AW_DEBUG__) console.warn('Toast error', e); }
}

window.showToast = showToast;

function showConfirm(message, title = 'Please Confirm') {
    return new Promise((resolve) => {
        try {
            let container = document.getElementById('global-confirm-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'global-confirm-container';
                container.style.position = 'fixed';
                container.style.top = '0';
                container.style.left = '0';
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.zIndex = 11000;
                document.body.appendChild(container);
            }

            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.45)';
            overlay.style.backdropFilter = 'blur(2px)';

            const box = document.createElement('div');
            box.className = 'confirm-box';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            const titleId = 'confirm-title-' + Date.now();
            const descId = 'confirm-desc-' + Date.now();
            box.setAttribute('aria-labelledby', titleId);
            box.setAttribute('aria-describedby', descId);
            box.style.minWidth = '320px';
            box.style.maxWidth = '560px';
            box.style.background = 'var(--bg-cards, #112A46)';
            box.style.color = 'var(--text-main, #fff)';
            box.style.borderRadius = '12px';
            box.style.padding = '18px';
            box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.5)';
            box.style.position = 'relative';
            box.style.zIndex = 11001;

            const h = document.createElement('div');
            h.id = titleId;
            h.style.fontWeight = 700;
            h.style.marginBottom = '8px';
            h.innerText = title;

            const msg = document.createElement('div');
            msg.id = descId;
            msg.style.marginBottom = '14px';
            msg.innerText = message;

            const actions = document.createElement('div');
            actions.className = 'confirm-actions';
            actions.style.display = 'flex';
            actions.style.justifyContent = 'flex-end';
            actions.style.gap = '8px';

            const btnNo = document.createElement('button');
            btnNo.className = 'confirm-btn cancel';
            btnNo.innerText = 'Cancel';
            btnNo.style.padding = '10px 14px';
            btnNo.style.borderRadius = '8px';
            btnNo.style.border = '1px solid rgba(255,255,255,0.06)';
            btnNo.style.background = 'transparent';
            btnNo.style.color = 'var(--text-main, #fff)';
            btnNo.style.cursor = 'pointer';
            btnNo.tabIndex = 0;

            const btnYes = document.createElement('button');
            btnYes.className = 'confirm-btn confirm';
            btnYes.innerText = 'Confirm';
            btnYes.style.padding = '10px 14px';
            btnYes.style.borderRadius = '8px';
            btnYes.style.border = 'none';
            btnYes.style.background = 'var(--primary-yellow, #d4af37)';
            btnYes.style.color = '#071022';
            btnYes.style.cursor = 'pointer';
            btnYes.tabIndex = 0;

            actions.appendChild(btnNo);
            actions.appendChild(btnYes);
            box.appendChild(h);
            box.appendChild(msg);
            box.appendChild(actions);

            container.innerHTML = '';
            container.appendChild(overlay);
            container.appendChild(box);

            const previousActive = document.activeElement;
            const focusable = [btnNo, btnYes];
            let focusIndex = 1;
            btnYes.focus();

            function cleanUp(val) {
                try {
                    container.innerHTML = '';
                    if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
                } catch (_) {}
                document.removeEventListener('keydown', keyHandler);
                resolve(val);
            }

            function keyHandler(e) {
                if (e.key === 'Escape') { e.preventDefault(); cleanUp(false); }
                if (e.key === 'Tab') {
                    e.preventDefault();
                    focusIndex = (focusIndex + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
                    focusable[focusIndex].focus();
                }
                if (e.key === 'Enter') {
                    if (document.activeElement === btnNo) { cleanUp(false); }
                    else { cleanUp(true); }
                }
            }

            btnNo.addEventListener('click', () => cleanUp(false));
            btnYes.addEventListener('click', () => cleanUp(true));
            overlay.addEventListener('click', () => cleanUp(false));
            document.addEventListener('keydown', keyHandler);
        } catch (e) { if (window.__AW_DEBUG__) console.warn('Confirm modal error', e); resolve(false); }
    });
}

window.showConfirm = showConfirm;

function injectGlobalUIStyles() {
    if (document.getElementById('global-ui-styles')) return;
    const css = `
    #global-toast-container { font-family: Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
    #global-toast-container .global-toast { min-width: 180px; max-width: 420px; word-break: break-word; }
    .confirm-overlay { position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.45); backdrop-filter: blur(2px); }
    .confirm-box { min-width:320px; max-width:560px; background: var(--bg-cards,#112A46); color: var(--text-main,#fff); border-radius:12px; padding:18px; box-shadow:0 12px 40px rgba(0,0,0,0.5); }
    .confirm-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
    .confirm-btn { padding:10px 14px; border-radius:8px; cursor:pointer; font-weight:600; }
    .confirm-btn.cancel { background: transparent; border: 1px solid rgba(255,255,255,0.06); color: var(--text-main,#fff); }
    .confirm-btn.confirm { background: var(--primary-yellow,#d4af37); border: none; color: #071022; }
    @media (max-width:480px) { .confirm-box { width: calc(100% - 36px); margin: 0 18px; } #global-toast-container { left: 12px; right: 12px; } }
    `;
    const style = document.createElement('style');
    style.id = 'global-ui-styles';
    style.innerHTML = css;
    document.head.appendChild(style);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectGlobalUIStyles); else injectGlobalUIStyles();

function ensureConsistentTitle() {
    try {
        const base = 'Access Wealth';
        if (!document.title.includes(base)) document.title = document.title ? `${document.title} — ${base}` : base;
    } catch (_) {}
}

document.addEventListener('DOMContentLoaded', ensureConsistentTitle);
document.addEventListener('DOMContentLoaded', () => {
    if (isPageAllowedForSync()) injectMobileNav();
});

// ==========================================
// INITIALIZE THEME AND TOGGLE ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // Apply the saved theme (or system preference)
    initTheme();
    // Set up toggle buttons
    setupThemeToggle();
    // Quietly refresh the normalized user/wallet state on every protected page.
    if (isPageAllowedForSync()) globalSync();
});