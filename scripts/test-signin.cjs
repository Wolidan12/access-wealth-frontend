'use strict';

const assert = require('assert');
const SignIn = require('../public/signin.js');

function test(name, fn) {
    fn();
    console.log(`ok - ${name}`);
}

global.ACCESS_WEALTH_API_BASE_URL = '/api';

test('production login URL is same-origin /api/login', () => {
    assert.strictEqual(SignIn.loginUrl(), '/api/login');
});

test('login body uses username and does not trim password', () => {
    const request = SignIn.buildLoginRequest('  user@example.com  ', '  secret  ');
    assert.strictEqual(request.method, 'POST');
    assert.strictEqual(request.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(request.body), {
        username: 'user@example.com',
        password: '  secret  '
    });
    assert.ok(!Object.prototype.hasOwnProperty.call(JSON.parse(request.body), 'email'));
    assert.ok(!Object.prototype.hasOwnProperty.call(JSON.parse(request.body), 'user'));
    assert.ok(!Object.prototype.hasOwnProperty.call(JSON.parse(request.body), 'userName'));
});

test('empty username and password are validated separately', () => {
    assert.strictEqual(SignIn.validateLoginFields('', '').error, 'Please enter both username and password.');
    assert.strictEqual(SignIn.validateLoginFields('', 'secret').error, 'Please enter your username or email.');
    assert.strictEqual(SignIn.validateLoginFields('user', '').error, 'Please enter your password.');
    assert.deepStrictEqual(SignIn.validateLoginFields('  demo  ', 'pw'), {
        ok: true,
        username: 'demo',
        password: 'pw'
    });
});

test('HTTP status mapping surfaces the real API error', () => {
    assert.strictEqual(
        SignIn.getSignInErrorMessage({ status: 400, data: { error: 'Invalid username or password' } }),
        'Invalid username or password'
    );
    assert.strictEqual(
        SignIn.getSignInErrorMessage({ status: 403, data: { error: 'Account suspended until 12 May.' } }),
        'Account suspended until 12 May.'
    );
    assert.strictEqual(
        SignIn.getSignInErrorMessage({ status: 429, data: { error: 'slow down' } }),
        'Too many attempts. Please try again later.'
    );
    assert.strictEqual(
        SignIn.getSignInErrorMessage({ status: 502, data: {} }),
        'The authentication service is temporarily unavailable.'
    );
    assert.strictEqual(
        SignIn.getSignInErrorMessage({ status: 503, data: {} }),
        'The authentication service is temporarily unavailable.'
    );
    assert.strictEqual(
        SignIn.getSignInErrorMessage({ status: 500, data: {} }),
        'The server could not complete sign-in. Please try again.'
    );
    assert.strictEqual(
        SignIn.getSignInErrorMessage({ networkError: true }),
        'We could not complete sign-in. Please try again.'
    );
});

test('session requires token and user, not a success boolean', () => {
    assert.strictEqual(SignIn.extractLoginSession({ success: true }), null);
    assert.deepStrictEqual(
        SignIn.extractLoginSession({
            token: 'abc.def.ghi',
            user: { username: 'ada', role: 'user' }
        }),
        { token: 'abc.def.ghi', user: { username: 'ada', role: 'user' } }
    );
    assert.deepStrictEqual(
        SignIn.extractLoginSession({
            data: { token: 'nested-token', user: { username: 'email.user@example.com' } }
        }),
        { token: 'nested-token', user: { username: 'email.user@example.com' } }
    );
});

test('logs never include password or JWT', () => {
    const redacted = SignIn.redactAuthData({
        token: 'header.payload.sig',
        password: 'super-secret',
        user: { username: 'ada' },
        error: 'Invalid username or password'
    });
    assert.strictEqual(redacted.token, '[redacted]');
    assert.strictEqual(redacted.password, '[redacted]');
    assert.strictEqual(redacted.user.username, 'ada');
    assert.strictEqual(redacted.error, 'Invalid username or password');
});

test('JSON and non-JSON bodies are both readable before showing an error', () => {
    assert.deepStrictEqual(
        SignIn.parseResponseBody('application/json', '{"error":"Invalid username or password"}'),
        { error: 'Invalid username or password' }
    );
    assert.deepStrictEqual(
        SignIn.parseResponseBody('text/html', '<html>gateway timeout</html>'),
        { error: '<html>gateway timeout</html>' }
    );
});

console.log('All sign-in helper tests passed.');
