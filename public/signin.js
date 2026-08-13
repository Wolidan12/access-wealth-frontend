/* Shared sign-in helpers. Loaded by login.html and unit-tested in Node. */
(function (root) {
    var DEFAULT_API_BASE = '/api';
    var SECRET_KEYS = {
        token: true,
        accessToken: true,
        access_token: true,
        newToken: true,
        jwt: true,
        refreshToken: true,
        refresh_token: true,
        password: true
    };

    function getApiBaseUrl() {
        var configured = root.ACCESS_WEALTH_API_BASE_URL || DEFAULT_API_BASE;
        return String(configured).replace(/\/$/, '');
    }

    function loginUrl() {
        return getApiBaseUrl() + '/login';
    }

    function validateLoginFields(username, password) {
        var trimmedUsername = String(username == null ? '' : username).trim();
        var rawPassword = password == null ? '' : String(password);

        if (!trimmedUsername && !rawPassword) {
            return { ok: false, error: 'Please enter both username and password.' };
        }
        if (!trimmedUsername) {
            return { ok: false, error: 'Please enter your username or email.' };
        }
        if (!rawPassword) {
            return { ok: false, error: 'Please enter your password.' };
        }

        return { ok: true, username: trimmedUsername, password: rawPassword };
    }

    function buildLoginRequest(username, password) {
        return {
            url: loginUrl(),
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: String(username || '').trim(),
                password: password
            })
        };
    }

    function parseResponseBody(contentType, raw) {
        var type = contentType || '';
        var text = raw == null ? '' : String(raw);

        if (type.indexOf('application/json') !== -1) {
            try {
                return text ? JSON.parse(text) : {};
            } catch (_) {
                return { error: text || 'Unable to parse server response.' };
            }
        }

        if (!text) {
            return { error: 'Empty response from server.' };
        }

        try {
            return JSON.parse(text);
        } catch (_) {
            return { error: text };
        }
    }

    function pickToken(payload) {
        if (!payload || typeof payload !== 'object') return '';
        var candidates = [
            payload.token,
            payload.accessToken,
            payload.access_token,
            payload.newToken,
            payload.jwt
        ];
        for (var i = 0; i < candidates.length; i += 1) {
            if (typeof candidates[i] === 'string' && candidates[i].trim()) {
                return candidates[i].trim();
            }
        }
        return '';
    }

    function extractLoginSession(data) {
        if (!data || typeof data !== 'object') return null;

        var nested = data.data && typeof data.data === 'object' ? data.data : {};
        var token = pickToken(data) || pickToken(nested);
        var user = (data.user && typeof data.user === 'object' ? data.user : null)
            || (nested.user && typeof nested.user === 'object' ? nested.user : null);

        if (!token || !user) return null;
        return { token: token, user: user };
    }

    function serverErrorMessage(data) {
        if (!data || typeof data !== 'object') return '';
        if (typeof data.error === 'string' && data.error.trim()) return data.error;
        if (typeof data.message === 'string' && data.message.trim()) return data.message;
        if (typeof data.msg === 'string' && data.msg.trim()) return data.msg;
        return '';
    }

    function getSignInErrorMessage(details) {
        var status = details && details.status;
        var data = details && details.data;
        var networkError = !!(details && details.networkError);
        var serverError = serverErrorMessage(data);

        if (networkError || status == null || status === 0) {
            return 'We could not complete sign-in. Please try again.';
        }
        if (status === 400 || status === 401) {
            return serverError || 'Invalid username or password';
        }
        if (status === 403) {
            return serverError || 'Your account is not allowed to sign in.';
        }
        if (status === 429) {
            return 'Too many attempts. Please try again later.';
        }
        if (status === 502 || status === 503) {
            return 'The authentication service is temporarily unavailable.';
        }
        if (status === 500) {
            return 'The server could not complete sign-in. Please try again.';
        }
        return serverError || ('Sign-in failed with HTTP ' + status);
    }

    function redactAuthData(value) {
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(redactAuthData);

        var clone = {};
        Object.keys(value).forEach(function (key) {
            if (SECRET_KEYS[key]) {
                clone[key] = '[redacted]';
            } else if (value[key] && typeof value[key] === 'object') {
                clone[key] = redactAuthData(value[key]);
            } else {
                clone[key] = value[key];
            }
        });
        return clone;
    }

    var api = {
        getApiBaseUrl: getApiBaseUrl,
        loginUrl: loginUrl,
        validateLoginFields: validateLoginFields,
        buildLoginRequest: buildLoginRequest,
        parseResponseBody: parseResponseBody,
        extractLoginSession: extractLoginSession,
        getSignInErrorMessage: getSignInErrorMessage,
        redactAuthData: redactAuthData
    };

    root.AccessWealthSignIn = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
