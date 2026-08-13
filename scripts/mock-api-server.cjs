#!/usr/bin/env node
/**
 * Local-only mock of the Access Wealth API, used to verify the frontend wiring
 * for the admin Command Center and the user dashboard plan display.
 *
 * It is NOT used in production — it only exists so the pages can be exercised
 * against the documented response contracts without touching the real backend.
 *
 *   node scripts/mock-api-server.cjs [port]
 *
 * Scenario switching (drives what the mock returns):
 *   GET /__mock/scenario?role=admin|user|none&plan=active|none&fail=none|network|401|403|500
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 4173);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const scenario = { role: 'admin', plan: 'active', fail: 'none' };

const PACKAGES = [
    { id: 1, name: 'Starter', tier: 'Starter', capital: 5000, daily_rate: 0.05, cycle_days: 40, daily_earning: 250, total_payout: 15000, referral_bonus: 500 },
    { id: 2, name: 'Starter Plus', tier: 'Starter', capital: 10000, daily_rate: 0.05, cycle_days: 40, daily_earning: 500, total_payout: 30000, referral_bonus: 1000 },
    { id: 3, name: 'Growth', tier: 'Growth', capital: 50000, daily_rate: 0.06, cycle_days: 45, daily_earning: 3000, total_payout: 185000, referral_bonus: 5000 },
    { id: 4, name: 'Growth Pro', tier: 'Growth', capital: 150000, daily_rate: 0.06, cycle_days: 45, daily_earning: 9000, total_payout: 555000, referral_bonus: 15000 },
    { id: 5, name: 'Elite', tier: 'Elite', capital: 1000000, daily_rate: 0.08, cycle_days: 50, daily_earning: 80000, total_payout: 5000000, referral_bonus: 100000 }
];

const BASE_USERS = [
    { username: 'ada', balance: 125000, wallet_balance: 125000, taskEarnings: 4200, daily_earnings: 18000, affiliate_balance: 9500, activePackage: 'Growth', planActivated: 'true', status: 'active' },
    { username: 'bola', balance: 0, wallet_balance: 0, taskEarnings: 0, daily_earnings: 0, affiliate_balance: 1500, activePackage: '', planActivated: 'false', status: 'active' },
    { username: 'chidi', balance: 2450000, wallet_balance: 2450000, taskEarnings: 15500, daily_earnings: 240000, affiliate_balance: 88000, activePackage: 'Elite', planActivated: true, status: 'banned' }
];

const BASE_BROADCASTS = [
    { id: 1, title: 'Withdrawals now instant', message: 'All approved withdrawals are settled within 10 minutes.', created_at: '2026-08-11T09:30:00.000Z' }
];

const USERS = JSON.parse(JSON.stringify(BASE_USERS));
const broadcasts = JSON.parse(JSON.stringify(BASE_BROADCASTS));

function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { resolve({}); }
        });
    });
}

function adminGate(req, res) {
    if (scenario.fail === '401') { json(res, 401, { success: false, error: 'Invalid or expired token' }); return false; }
    if (scenario.fail === '500') { json(res, 500, { success: false, error: 'Database connection lost' }); return false; }
    if (scenario.fail === '403' || scenario.role !== 'admin') {
        json(res, 403, { error: 'Admin access required' });
        return false;
    }
    if (!(req.headers.authorization || '').startsWith('Bearer ')) {
        json(res, 401, { success: false, error: 'Missing authentication token' });
        return false;
    }
    return true;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain' };

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/' || pathname === '/__mock') {
        // Dev launcher: seeds a session then links into each page/scenario.
        // Served from the mock only, so nothing dev-only ships in public/.
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Access Wealth — local verification</title>
<style>body{background:#070d14;color:#fff;font-family:system-ui,sans-serif;margin:0;padding:32px;line-height:1.6}
h1{color:#d4af37;font-size:20px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#8a99af;margin:28px 0 10px}
a{display:inline-block;background:#112A46;border:1px solid rgba(212,175,55,.3);color:#fff;text-decoration:none;padding:11px 16px;border-radius:9px;margin:5px 6px 5px 0;font-size:14px}
a:hover{border-color:#d4af37}code{background:#112A46;padding:2px 6px;border-radius:4px;font-size:12px}</style>
<script>
function go(page, params){
  localStorage.setItem('token','mock-token');
  localStorage.setItem('role', params.role === 'admin' ? 'admin' : 'user');
  localStorage.setItem('username', params.role === 'admin' ? 'admin' : 'ada');
  fetch('/__mock/scenario?' + new URLSearchParams(params)).then(() => location.href = page);
}
</script></head><body>
<h1>Access Wealth — local verification harness</h1>
<p>Each button sets the mock scenario, seeds a session, then opens the real page.</p>
<h2>Admin Command Center</h2>
<a href="#" onclick="go('/admin.html',{role:'admin',fail:'none'});return false">Admin (working)</a>
<a href="#" onclick="go('/admin.html',{role:'user',fail:'none'});return false">Non-admin → 403 banner</a>
<a href="#" onclick="go('/admin.html',{role:'admin',fail:'401'});return false">401 session expired</a>
<a href="#" onclick="go('/admin.html',{role:'admin',fail:'network'});return false">Network failure</a>
<a href="#" onclick="go('/admin.html',{role:'admin',fail:'500'});return false">500 verbatim error</a>
<h2>User dashboard plan</h2>
<a href="#" onclick="go('/dashboard.html',{role:'user',plan:'active',fail:'none'});return false">Active plan</a>
<a href="#" onclick="go('/dashboard.html',{role:'user',plan:'none',fail:'none'});return false">No plan → CTA</a>
<a href="#" onclick="go('/dashboard.html',{role:'user',plan:'active',fail:'500'});return false">Real error + retry</a>
<h2>Plans / activation</h2>
<a href="#" onclick="go('/activation.html',{role:'user',plan:'active',fail:'none'});return false">With active plan (upgrades)</a>
<a href="#" onclick="go('/activation.html',{role:'user',plan:'none',fail:'none'});return false">No plan (activate)</a>
<a href="#" onclick="go('/activation.html',{role:'user',plan:'none',fail:'500'});return false">Packages error + retry</a>
<h2>Login</h2>
<a href="/login.html?reason=admin-required">?reason=admin-required</a>
<a href="/login.html?reason=session-expired">?reason=session-expired</a>
<p style="margin-top:28px;color:#8a99af;font-size:13px">Scenario switch: <code>/__mock/scenario?role=admin|user|none&amp;plan=active|none&amp;fail=none|network|401|403|500</code></p>
</body></html>`);
    }

    if (pathname === '/__mock/reset') {
        // Restore mutable fixtures so repeated test runs are deterministic.
        USERS.length = 0;
        USERS.push(...JSON.parse(JSON.stringify(BASE_USERS)));
        broadcasts.length = 0;
        broadcasts.push(...JSON.parse(JSON.stringify(BASE_BROADCASTS)));
        return json(res, 200, { ok: true, reset: true });
    }

    if (pathname === '/__mock/scenario') {
        ['role', 'plan', 'fail'].forEach((key) => {
            if (url.searchParams.has(key)) scenario[key] = url.searchParams.get(key);
        });
        return json(res, 200, { ok: true, scenario });
    }

    if (pathname.startsWith('/api/')) {
        const route = pathname.slice(4);
        const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};

        if (scenario.fail === 'network') { res.destroy(); return; }

        if (route === '/refresh-token') return json(res, 401, { success: false, error: 'Refresh token rejected' });

        if (route === '/packages') return json(res, 200, { success: true, packages: PACKAGES });

        if (route === '/user/sync') {
            if (scenario.role === 'none') return json(res, 401, { success: false, error: 'Invalid or expired token' });
            return json(res, 200, {
                success: true,
                user: {
                    username: scenario.role === 'admin' ? 'admin' : 'ada',
                    role: scenario.role,
                    wallet_balance: 125000, balance: 125000, taskEarnings: 4200,
                    daily_earnings: 18000, affiliate_balance: 9500,
                    planActivated: scenario.plan === 'active', activePackage: scenario.plan === 'active' ? 'Growth' : '',
                    my_referral_id: 'AW-ADA-77', profile_complete: true, bank_complete: true, account_complete: true
                }
            });
        }

        if (route === '/active-investment') {
            if (scenario.fail === '401') return json(res, 401, { success: false, error: 'Invalid or expired token' });
            if (scenario.fail === '403') return json(res, 403, { error: 'Access denied' });
            if (scenario.fail === '500') return json(res, 500, { success: false, error: 'Investment ledger unavailable' });
            if (scenario.plan !== 'active') return json(res, 200, { success: true, hasActive: false, investment: null, balance: 125000 });
            return json(res, 200, {
                success: true, hasActive: true, balance: 125000,
                investment: {
                    id: 91, package_id: 3, package_name: 'Growth', capital: 50000,
                    daily_rate: 0.06, daily_earning: 3000, cycle_days: 45,
                    total_payout: 185000, days_credited: 12, status: 'active',
                    started_at: '2026-08-01T00:00:00.000Z'
                }
            });
        }

        if (route === '/broadcasts' || route === '/broadcasts/all') return json(res, 200, { success: true, broadcasts });
        if (route === '/sponsored-posts') return json(res, 200, { success: true, posts: [] });
        if (route === '/my-deposits') return json(res, 200, { success: true, deposits: [] });
        if (route === '/site-settings') return json(res, 200, { success: true, settings: {} });

        if (route.startsWith('/admin/')) {
            if (!adminGate(req, res)) return;
            if (route === '/admin/stats') {
                return json(res, 200, {
                    success: true,
                    stats: { totalUsers: 1284, activePlans: 417, revenue: 28450000.5, pendingDeposits: 7, pendingWithdrawals: 3 }
                });
            }
            if (route === '/admin/users') return json(res, 200, { success: true, users: USERS });
            if (route === '/admin/broadcast') {
                if (!body.message) return json(res, 400, { success: false, error: 'Message is required' });
                broadcasts.unshift({ id: broadcasts.length + 1, title: body.title || 'Announcement', message: body.message, created_at: new Date().toISOString() });
                return json(res, 200, { success: true, message: 'Broadcast sent to all users' });
            }
            if (route === '/admin/adjust-balance') {
                const user = USERS.find((item) => item.username === body.username);
                if (!user) return json(res, 404, { success: false, error: 'User not found' });
                const delta = (body.action === 'subtract' ? -1 : 1) * Number(body.amount || 0);
                const key = body.walletType === 'balance' ? 'wallet_balance' : body.walletType;
                user[key] = Math.max(0, Number(user[key] || 0) + delta);
                if (key === 'wallet_balance') user.balance = user.wallet_balance;
                return json(res, 200, { success: true, message: `${body.action === 'subtract' ? 'Subtracted' : 'Added'} successfully for ${body.username}` });
            }
            if (route === '/admin/change-user-plan') {
                const user = USERS.find((item) => item.username === body.username);
                const pkg = PACKAGES.find((item) => String(item.id) === String(body.packageId));
                if (!user || !pkg) return json(res, 400, { success: false, error: 'Unknown user or package' });
                user.activePackage = pkg.name;
                user.planActivated = 'true';
                return json(res, 200, { success: true, message: `${pkg.name} assigned to ${user.username}` });
            }
            if (route === '/admin/toggle-user-status') {
                const user = USERS.find((item) => item.username === body.username);
                if (!user) return json(res, 404, { success: false, error: 'User not found' });
                user.status = body.status;
                return json(res, 200, { success: true, message: `${user.username} is now ${body.status}` });
            }
            if (route === '/admin/deposits') return json(res, 200, { success: true, deposits: [] });
            if (route === '/admin/withdrawals' || route === '/admin/all-withdrawals') return json(res, 200, { success: true, withdrawals: [] });
            if (route === '/admin/sponsored-submissions') return json(res, 200, { success: true, submissions: [] });
            if (route === '/admin/migrations/legacy-plans/status') return json(res, 200, { success: true, status: 'completed', migration: { completed_at: '2026-07-01T00:00:00.000Z' } });
            return json(res, 200, { success: true, message: 'Mock action accepted' });
        }

        return json(res, 404, { success: false, error: `No mock route for ${route}` });
    }

    // Static files
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'login.html' : pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(PUBLIC_DIR, 'index.html');
    if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Mock Access Wealth API + static site on http://0.0.0.0:${PORT}`);
    console.log('Scenario switch: /__mock/scenario?role=admin|user|none&plan=active|none&fail=none|network|401|403|500');
});
