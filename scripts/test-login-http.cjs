'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { URL } = require('url');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const BACKEND_HOST = 'access-wealth-backend-production.up.railway.app';

function send(res, status, body, headers = {}) {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        ...headers
    });
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function startBackend() {
    return new Promise((resolve) => {
        const seen = [];
        const server = http.createServer(async (req, res) => {
            if (req.method === 'OPTIONS') {
                send(res, 204, '');
                return;
            }

            const url = new URL(req.url, 'http://127.0.0.1');
            if (url.pathname === '/api/health') {
                send(res, 200, { ok: true, service: 'access-wealth-backend' });
                return;
            }

            if (url.pathname === '/api/login' && req.method === 'POST') {
                const raw = await readBody(req);
                let payload = {};
                try { payload = JSON.parse(raw); } catch (_) {}
                seen.push({
                    url: req.url,
                    method: req.method,
                    contentType: req.headers['content-type'],
                    payload
                });

                const username = payload.username;
                const password = payload.password;
                if (password === 'unavailable') {
                    send(res, 503, { error: 'backend down' });
                    return;
                }
                if (password === 'bad') {
                    send(res, 400, { error: 'Invalid username or password' });
                    return;
                }
                if (password === 'suspended') {
                    send(res, 403, { error: 'Account suspended until 12 May.' });
                    return;
                }
                if (username && password) {
                    send(res, 200, {
                        token: 'header.payload.sig',
                        user: { username, role: 'user' }
                    });
                    return;
                }
                send(res, 400, { error: 'Invalid username or password' });
                return;
            }

            send(res, 404, { error: 'Not found' });
        });
        server.listen(0, '127.0.0.1', () => {
            resolve({ server, port: server.address().port, seen });
        });
    });
}

function startFrontend(backendPort) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://127.0.0.1');
            if (url.pathname.startsWith('/api/')) {
                const proxy = http.request({
                    hostname: '127.0.0.1',
                    port: backendPort,
                    path: url.pathname + url.search,
                    method: req.method,
                    headers: { ...req.headers, host: BACKEND_HOST }
                }, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res);
                });
                proxy.on('error', () => send(res, 502, { error: 'proxy failed' }));
                req.pipe(proxy);
                return;
            }

            const filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'login.html' : url.pathname);
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
                    return;
                }
                const ext = path.extname(filePath);
                const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
                res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(0, '0.0.0.0', () => {
            resolve({ server, port: server.address().port });
        });
    });
}

function request(port, pathname, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: pathname,
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                let json;
                try { json = JSON.parse(body); } catch (_) {}
                resolve({ status: res.statusCode, headers: res.headers, body, json });
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

(async () => {
    const backend = await startBackend();
    const frontend = await startFrontend(backend.port);

    try {
        const health = await request(frontend.port, '/api/health');
        assert.strictEqual(health.status, 200);
        assert.deepStrictEqual(health.json, { ok: true, service: 'access-wealth-backend' });

        const validUser = await request(frontend.port, '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ada', password: 'correct' })
        });
        assert.strictEqual(validUser.status, 200);
        assert.ok(validUser.json.token);
        assert.ok(validUser.json.user);

        const validEmail = await request(frontend.port, '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ada@example.com', password: 'correct' })
        });
        assert.strictEqual(validEmail.status, 200);
        assert.strictEqual(validEmail.json.user.username, 'ada@example.com');

        const invalidPassword = await request(frontend.port, '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ada', password: 'bad' })
        });
        assert.strictEqual(invalidPassword.status, 400);
        assert.strictEqual(invalidPassword.json.error, 'Invalid username or password');

        const http400 = await request(frontend.port, '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ada', password: 'bad' })
        });
        assert.strictEqual(http400.status, 400);

        const http503 = await request(frontend.port, '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'ada', password: 'unavailable' })
        });
        assert.strictEqual(http503.status, 503);

        const last = backend.seen[backend.seen.length - 1];
        assert.strictEqual(last.method, 'POST');
        assert.ok(String(last.contentType).includes('application/json'));
        assert.ok(Object.prototype.hasOwnProperty.call(last.payload, 'username'));
        assert.ok(Object.prototype.hasOwnProperty.call(last.payload, 'password'));
        assert.ok(!Object.prototype.hasOwnProperty.call(last.payload, 'email'));

        const loginPage = await request(frontend.port, '/login.html');
        assert.strictEqual(loginPage.status, 200);
        assert.ok(loginPage.body.includes('event.preventDefault()'));
        assert.ok(loginPage.body.includes("localStorage.setItem('token'"));
        assert.ok(loginPage.body.includes("localStorage.setItem('user'"));
        assert.ok(loginPage.body.includes('Login request failed'));

        const globalJs = await request(frontend.port, '/global.js');
        assert.ok(globalJs.body.includes("const API_BASE_URL = `${API_ORIGIN}/api`"));
        assert.ok(!/API_BASE_URL = `\$\{BACKEND_HOST\}\/api`/.test(globalJs.body));

        console.log(`ok - proxied /api/health and /api/login through :${frontend.port}`);
        console.log('All HTTP proxy sign-in tests passed.');
    } finally {
        frontend.server.close();
        backend.server.close();
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
