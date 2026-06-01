// global.js - Master Sync Engine (Bypass Active)
const BACKEND_HOST = 'https://accesswealth-backend-production.up.railway.app';
const API_BASE_URL = `${BACKEND_HOST}/api`;
const GLOBAL_SYNC_SKIP_PAGES = ['login.html', 'register.html', 'admin.html', 'admin-support.html', 'forgot-password.html', 'reset-password.html'];

async function apiFetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
    try {
        return await fetch(url, options);
    } catch (networkError) {
        return {
            ok: false,
            status: 0,
            statusText: networkError.message,
            json: async () => ({ success: false, error: `Network error: ${networkError.message}` }),
            text: async () => networkError.message
        };
    }
}

async function apiFetchJson(path, options = {}) {
    const response = await apiFetch(path, options);
    let data;
    try {
        data = await response.json();
    } catch (_) {
        data = { success: false, error: 'Unable to parse server response.' };
    }

    return {
        response,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        success: response.ok && data.success !== false,
        error: data.error || (!response.ok ? response.statusText || 'API request failed' : null)
    };
}

window.apiFetch = apiFetch;
window.apiFetchJson = apiFetchJson;

function isPageAllowedForSync() {
    const href = window.location.href;
    return !GLOBAL_SYNC_SKIP_PAGES.some(page => href.includes(page));
}

async function globalSync() {
    const username = localStorage.getItem('username');
    const currentUrl = window.location.href;

    // Skip protected pages that are unrelated to user data sync
    if (!isPageAllowedForSync()) {
        if (username && (currentUrl.includes('login.html') || currentUrl.includes('register.html'))) {
            window.location.href = username === 'Support_Agent' ? 'support-agent.html' : 'dashboard.html';
        }
        return;
    }

    if (!username) {
        if (!currentUrl.includes('login.html') && !currentUrl.includes('register.html')) {
            window.location.href = 'login.html';
        }
        return;
    }

    // 2. SUPPORT AGENT ROUTING: Send the CSR to their specific portal
    if (username === 'Support_Agent') {
        if (!window.location.href.includes('support-agent.html')) { 
            window.location.href = 'support-agent.html'; 
        }
        return; 
    }

    try {
        // 3. FETCH: Pull latest data from backend using the shared API host
        const { ok, data, error } = await apiFetchJson(`/user/${username}?t=${Date.now()}`);
        
        if (ok && data.success) {
            const u = data.user;
            
            // 4. STORE: Keep browser memory perfectly up to date
            localStorage.setItem('balance', u.balance || 0); 
            localStorage.setItem('taskEarnings', u.taskEarnings || 0); 
            localStorage.setItem('daily_earnings', u.daily_earnings || 0); 
            localStorage.setItem('affiliate_balance', u.affiliate_balance || 0); 
            localStorage.setItem('planActivated', u.planActivated === true || u.planActivated === 'true' ? 'true' : 'false');
            localStorage.setItem('activePackage', u.activePackage || 'Standard');
            localStorage.setItem('my_referral_id', u.my_referral_id || u.referralId || '');

            // 5. UPDATE UI GLOBALLY
            safeUpdate('sidebarName', username.toUpperCase());
            safeUpdate('cardName', username);
            safeUpdate('displayName', username.toUpperCase());
            safeUpdate('displayHandle', "@" + username.toLowerCase().replace(/\s+/g, ''));
            
            // Set Avatars globally
            const avatarUrl = `https://ui-avatars.com/api/?name=${username}&background=d4af37&color=112A46&bold=true`;
            if (document.getElementById('sidebarAvatar')) document.getElementById('sidebarAvatar').src = avatarUrl;
            if (document.getElementById('cardAvatar')) document.getElementById('cardAvatar').src = avatarUrl;
            if (document.getElementById('desktopAvatar')) document.getElementById('desktopAvatar').src = avatarUrl;
            if (document.getElementById('mobileAvatar')) document.getElementById('mobileAvatar').src = avatarUrl;
            
            // Set Referral Link globally
            const refLinkInput = document.getElementById('refLinkInput');
            if (refLinkInput) refLinkInput.value = `${window.location.origin}/register.html?ref=${u.my_referral_id}`;

            // Update Balances globally
            safeMoneyUpdate('liveBalanceDisplay', u.balance || 0); 

            // Update Premium Status globally
            if(u.planActivated === 'true') {
                safeUpdate('sidebarStatus', `Premium (${u.activePackage})`);
                safeUpdate('accountStatusText', `Premium account (${u.activePackage})`);
                
                const setupCard = document.getElementById('setupCard');
                if(setupCard) setupCard.style.display = 'none';
                
                const activateBtn = document.getElementById('activateBtn');
                if(activateBtn) activateBtn.style.display = 'none';
            }

            // Tell the dashboard the sync is complete so it can update the 5-wallet card
            window.dispatchEvent(new Event('globalSyncComplete'));
        }
    } catch (err) { 
        console.error("Access Wealth Sync Blocked. Check Terminal.", err); 
    }
}

// Helpers
function safeUpdate(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function safeMoneyUpdate(id, amount) { const el = document.getElementById(id); if (el) el.innerText = amount.toLocaleString(undefined, {minimumFractionDigits: 2}); }
function logout() { localStorage.clear(); window.location.href = 'login.html'; }

// Run the engine immediately when ANY page loads
document.addEventListener('DOMContentLoaded', globalSync);

// Inject a lightweight shared mobile navigation for pages that load `global.js`
function injectMobileNav() {
    if (document.getElementById('mobile-nav-toggle')) return; // already injected

    const links = [
        { href: 'index.html', label: 'Home' },
        { href: 'dashboard.html', label: 'Dashboard' },
        { href: 'activation.html', label: 'Activate' },
        { href: 'airtime.html', label: 'Airtime' },
        { href: 'deposit.html', label: 'Deposit' },
        { href: 'withdraw.html', label: 'Withdraw' },
        { href: 'support.html', label: 'Support' },
        { href: 'referral.html', label: 'Referral' }
    ];

    // Add admin-only link when role indicates admin
    try {
        if (localStorage.getItem('role') === 'admin') links.push({ href: 'admin.html', label: 'Admin' });
        if (localStorage.getItem('username') === 'Support_Agent') links.push({ href: 'support-agent.html', label: 'Agent' });
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

    // CSS
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

    // Interaction with persistence
    const toggle = document.getElementById('mobile-nav-toggle');
    const navPanel = document.getElementById('mobile-nav-panel');
    let open = localStorage.getItem('mobileNavOpen') === 'true';

    // restore state
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

    // Close nav when user selects a link
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

document.addEventListener('DOMContentLoaded', injectMobileNav);

// Small professional touches: toast notifications and consistent document title
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
        // theme-aware colors
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
        // accessibility
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

        container.appendChild(toast);
        // force layout then animate
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });

        // pause-on-hover with remaining time
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
    } catch (e) { console.warn('Toast error', e); }
}

window.showToast = showToast;

// Promise-based confirm modal replacement for `confirm()` to avoid blocking alerts
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

            // Overlay
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

            // container clear and append
            container.innerHTML = ''; // remove any previous
            container.appendChild(overlay);
            container.appendChild(box);

            // Accessibility & focus management
            const previousActive = document.activeElement;
            const focusable = [btnNo, btnYes];
            let focusIndex = 1; // default focus on confirm
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
                    // simple focus trap between our two buttons
                    e.preventDefault();
                    focusIndex = (focusIndex + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
                    focusable[focusIndex].focus();
                }
                if (e.key === 'Enter') {
                    // Enter should confirm when focused outside inputs
                    if (document.activeElement === btnNo) { cleanUp(false); }
                    else { cleanUp(true); }
                }
            }

            btnNo.addEventListener('click', () => cleanUp(false));
            btnYes.addEventListener('click', () => cleanUp(true));
            overlay.addEventListener('click', () => cleanUp(false));
            document.addEventListener('keydown', keyHandler);
        } catch (e) { console.warn('Confirm modal error', e); resolve(false); }
    });
}

window.showConfirm = showConfirm;

// Inject small CSS for toasts and confirm modal for consistent styling
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

// Ensure styles are available early
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectGlobalUIStyles); else injectGlobalUIStyles();

// Standardize page titles slightly for a professional touch
function ensureConsistentTitle() {
    try {
        const base = 'Access Wealth';
        if (!document.title.includes(base)) document.title = document.title ? `${document.title} — ${base}` : base;
    } catch (_) {}
}

document.addEventListener('DOMContentLoaded', ensureConsistentTitle);