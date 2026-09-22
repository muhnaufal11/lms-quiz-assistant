const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const certManager = require('./cert-manager');
const { getPayload } = require('./payload');
const configStore = require('./config-store');

const TARGET_HOST = 'lms.telkomuniversity.ac.id';
const PROXY_PORT = 8080;

// Dashboard HTML (config page) — dibaca sekali saat start
let dashboardHtml = '';
try {
    dashboardHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'dashboard.html'), 'utf8');
} catch (e) {
    dashboardHtml = '<h1>Dashboard tidak ditemukan</h1>';
}

// ==================== INIT ====================
console.log('[SEB Proxy] Initializing...');

const caResult = certManager.init();
if (caResult.generated) {
    console.log('[SEB Proxy] Root CA certificate generated (first run).');
    console.log('[SEB Proxy] Install CA cert before using: node generate-ca.js');
} else {
    console.log('[SEB Proxy] Root CA certificate loaded.');
}

// Pre-load payload
const payload = getPayload();
console.log('[SEB Proxy] Frontend payload loaded (' + payload.length + ' bytes).');

// ==================== API RELAY ====================
function handleApiRelay(req, res) {
    var bodyChunks = [];
    req.on('data', function (chunk) { bodyChunks.push(chunk); });
    req.on('end', function () {
        var bodyStr = Buffer.concat(bodyChunks).toString('utf8');
        var parsed;
        try {
            parsed = JSON.parse(bodyStr);
        } catch (e) {
            sendJson(res, 400, { status: 400, body: { error: { message: 'Invalid JSON' } } });
            return;
        }

        var targetUrl;
        try {
            targetUrl = new URL(parsed.url);
        } catch (e) {
            sendJson(res, 400, { status: 400, body: { error: { message: 'Invalid URL: ' + parsed.url } } });
            return;
        }

        var isHttps = targetUrl.protocol === 'https:';
        var transport = isHttps ? https : http;
        var defaultPort = isHttps ? 443 : 80;

        var options = {
            hostname: targetUrl.hostname,
            port: parseInt(targetUrl.port) || defaultPort,
            path: targetUrl.pathname + targetUrl.search,
            method: 'POST',
            headers: parsed.headers || {},
            timeout: 60000,
        };

        console.log('[API Relay] ' + options.method + ' ' + targetUrl.hostname + options.path);

        var apiReq = transport.request(options, function (apiRes) {
            var chunks = [];
            apiRes.on('data', function (chunk) { chunks.push(chunk); });
            apiRes.on('end', function () {
                var rawBuf = Buffer.concat(chunks);
                var encoding = (apiRes.headers['content-encoding'] || '').toLowerCase();
                decompressBuffer(rawBuf, encoding, function (err, decompressed) {
                    var raw = decompressed.toString('utf8');
                    var responseBody;
                    try {
                        responseBody = JSON.parse(raw);
                    } catch (e) {
                        responseBody = { raw: raw };
                    }
                    sendJson(res, 200, { status: apiRes.statusCode, body: responseBody });
                });
            });
        });

        apiReq.on('error', function (err) {
            console.error('[API Relay] Error:', err.message);
            sendJson(res, 200, { status: 502, body: { error: { message: 'Proxy relay error: ' + err.message } } });
        });

        apiReq.on('timeout', function () {
            apiReq.destroy();
            sendJson(res, 200, { status: 504, body: { error: { message: 'API request timeout' } } });
        });

        if (parsed.data) {
            apiReq.write(parsed.data);
        }
        apiReq.end();
    });
}

function sendJson(res, statusCode, obj) {
    var body = JSON.stringify(obj);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
}

// ==================== CONFIG ENDPOINTS ====================
function handleConfigGet(res) {
    var cfg = configStore.load();
    sendJson(res, 200, cfg);
}

function handleConfigPost(req, res) {
    var bodyChunks = [];
    req.on('data', function (chunk) { bodyChunks.push(chunk); });
    req.on('end', function () {
        var bodyStr = Buffer.concat(bodyChunks).toString('utf8');
        try {
            var patch = JSON.parse(bodyStr);
            var saved = configStore.save(patch);
            console.log('[Config] Updated — provider=' + saved.provider + ', model=' + (saved.models[saved.provider] || '?'));
            sendJson(res, 200, { ok: true, config: saved });
        } catch (e) {
            sendJson(res, 200, { ok: false, error: 'Invalid JSON: ' + e.message });
        }
    });
}

function serveDashboard(res) {
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(dashboardHtml),
    });
    res.end(dashboardHtml);
}

// Shared router for /__qbot__/* endpoints (dipakai MITM handler & main proxy handler).
// Return true bila request sudah ditangani.
function handleQbotRoute(req, res) {
    var rawUrl = req.url || '';
    var urlPath = '';
    try {
        urlPath = new URL(rawUrl, 'http://127.0.0.1:8080').pathname;
    } catch (e) {
        urlPath = rawUrl;
    }

    if (urlPath.startsWith('/__qbot__/')) {
        if (req.method === 'OPTIONS') {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Content-Length': '0',
            });
            res.end();
            return true;
        }
        if (urlPath.startsWith('/__qbot__/inference') && req.method === 'POST') {
            handleApiRelay(req, res);
            return true;
        }
        if (urlPath.startsWith('/__qbot__/config')) {
            if (req.method === 'GET') { handleConfigGet(res); return true; }
            if (req.method === 'POST') { handleConfigPost(req, res); return true; }
        }
        // File frontend (dibaca fresh tiap request -> edit cukup reload, no restart)
        if (urlPath.startsWith('/__qbot__/assistant.js')) {
            serveStatic(res, 'assistant.js', 'application/javascript; charset=utf-8');
            return true;
        }
        if (urlPath.startsWith('/__qbot__/assistant.css')) {
            serveStatic(res, 'assistant.css', 'text/css; charset=utf-8');
            return true;
        }
        // Unknown qbot path
        sendJson(res, 404, { error: 'Unknown endpoint' });
        return true;
    }

    return false;
}

function serveStatic(res, name, type) {
    try {
        var content = fs.readFileSync(path.join(__dirname, 'frontend', name));
        res.writeHead(200, {
            'Content-Type': type,
            'Content-Length': content.length,
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
        });
        res.end(content);
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found: ' + name);
    }
}

// ==================== MITM REQUEST HANDLER ====================
function handleMitmRequest(req, res) {
    var urlPath = req.url;

    // QBot endpoints (inference / config / preflight)
    if (handleQbotRoute(req, res)) return;

    // Forward to real LMS server (injeksi ke halaman kuis, matakuliah, dan my courses)
    var shouldInject = urlPath.indexOf('/mod/quiz/') !== -1 ||
                       urlPath.indexOf('/course/view.php') !== -1 ||
                       urlPath.indexOf('/my/') !== -1;

    var fwdHeaders = Object.assign({}, req.headers);
    fwdHeaders.host = TARGET_HOST;
    delete fwdHeaders['proxy-connection'];
    delete fwdHeaders['proxy-authorization'];

    // Strip compression for pages we need to inject into
    if (shouldInject) {
        delete fwdHeaders['accept-encoding'];
    }

    var options = {
        hostname: TARGET_HOST,
        port: 443,
        path: urlPath,
        method: req.method,
        headers: fwdHeaders,
        timeout: 30000,
    };

    var proxyReq = https.request(options, function (proxyRes) {
        if (!shouldInject) {
            // Pass through without modification
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
            return;
        }

        // Buffer response for HTML injection
        var chunks = [];
        proxyRes.on('data', function (chunk) { chunks.push(chunk); });
        proxyRes.on('end', function () {
            var raw = Buffer.concat(chunks);

            // Handle compressed responses (fallback if server ignores accept-encoding removal)
            var encoding = (proxyRes.headers['content-encoding'] || '').toLowerCase();
            decompressBuffer(raw, encoding, function (err, decompressed) {
                if (err) {
                    console.error('[Inject] Decompression failed:', err.message);
                    if (!res.headersSent) {
                        res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    }
                    res.end(raw);
                    return;
                }

                var html = decompressed.toString('utf8');

                // Hapus meta CSP dalam HTML (Moodle kadang taruh CSP via <meta>),
                // agar inline <script>/<style> kita tidak diblokir browser.
                html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

                // Inject payload before </body>
                if (html.indexOf('</body>') !== -1) {
                    html = html.replace('</body>', payload + '</body>');
                    console.log('[Inject] Payload injected into quiz page.');
                } else if (html.indexOf('</html>') !== -1) {
                    html = html.replace('</html>', payload + '</html>');
                    console.log('[Inject] Payload injected before </html>.');
                } else {
                    html += payload;
                    console.log('[Inject] Payload appended to response.');
                }

                var resultBuf = Buffer.from(html, 'utf8');

                // Build response headers — remove compression & update length
                var resHeaders = Object.assign({}, proxyRes.headers);
                delete resHeaders['content-encoding'];
                delete resHeaders['transfer-encoding'];
                // Hapus CSP agar inline script/style injeksi diizinkan browser
                delete resHeaders['content-security-policy'];
                delete resHeaders['content-security-policy-report-only'];
                delete resHeaders['x-content-security-policy'];
                delete resHeaders['x-webkit-csp'];
                resHeaders['content-length'] = resultBuf.length;

                res.writeHead(proxyRes.statusCode, resHeaders);
                res.end(resultBuf);
            });
        });
    });

    proxyReq.on('error', function (err) {
        console.error('[MITM] Forward error:', err.message);
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Bad Gateway: ' + err.message);
        } else {
            res.end();
        }
    });

    proxyReq.on('timeout', function () {
        proxyReq.destroy();
        if (!res.headersSent) {
            res.writeHead(504, { 'Content-Type': 'text/plain' });
            res.end('Gateway Timeout');
        } else {
            res.end();
        }
    });

    // Forward request body (for POST forms, etc.)
    req.pipe(proxyReq);
}

function decompressBuffer(buf, encoding, cb) {
    if (encoding === 'gzip') {
        zlib.gunzip(buf, cb);
    } else if (encoding === 'deflate') {
        zlib.inflate(buf, cb);
    } else if (encoding === 'br') {
        zlib.brotliDecompress(buf, cb);
    } else {
        cb(null, buf);
    }
}

// ==================== MITM HTTP SERVER (no-listen) ====================
var mitmServer = http.createServer(handleMitmRequest);

// ==================== MAIN PROXY SERVER ====================
var proxy = http.createServer(function (req, res) {
    // Direct HTTP requests to the proxy (not CONNECT).
    // Diakses lewat http://127.0.0.1:8080/ (browser bypass proxy untuk loopback).

    // QBot endpoints (config GET/POST, inference, preflight)
    if (handleQbotRoute(req, res)) return;

    // Dashboard config — root path
    if (req.method === 'GET' && (req.url === '/' || req.url === '/dashboard' || req.url.startsWith('/?'))) {
        serveDashboard(res);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Quiz Assistant Proxy aktif. Buka http://127.0.0.1:' + PROXY_PORT + '/ untuk konfigurasi.');
});

proxy.on('connect', function (req, clientSocket, head) {
    var parts = req.url.split(':');
    var hostname = parts[0];
    var port = parseInt(parts[1]) || 443;

    if (hostname === TARGET_HOST) {
        // MITM for target host
        console.log('[MITM] Intercepting: ' + hostname);

        // Guard the raw client socket — browser may drop the connection
        // mid-handshake (tab switch, navigation cancel) and emit ECONNRESET.
        clientSocket.on('error', function () { /* swallow */ });

        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        var domainCert = certManager.getCert(hostname);

        var tlsSocket = new tls.TLSSocket(clientSocket, {
            isServer: true,
            key: domainCert.key,
            cert: domainCert.cert,
        });

        tlsSocket.on('error', function (err) {
            if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ECANCELED') return;
            console.error('[TLS] Error:', err.message);
        });

        // Feed decrypted TLS socket to internal HTTP server
        mitmServer.emit('connection', tlsSocket);
    } else {
        // Plain tunnel for all other hosts
        var remote = net.connect(port, hostname, function () {
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head && head.length > 0) remote.write(head);
            clientSocket.pipe(remote).pipe(clientSocket);
        });

        remote.on('error', function (err) {
            if (err.code !== 'ECONNRESET') {
                console.error('[Tunnel] ' + hostname + ': ' + err.message);
            }
            clientSocket.destroy();
        });
        clientSocket.on('error', function () { remote.destroy(); });
    }
});

proxy.on('error', function (err) {
    console.error('[Proxy] Server error:', err.message);
});

// Safety net: jangan biarkan proxy mati total di tengah ujian.
// Lebih baik log error lalu tetap listening daripada crash & internet putus.
process.on('uncaughtException', function (err) {
    console.error('[UNCAUGHT] ' + (err && err.message ? err.message : err));
});
process.on('unhandledRejection', function (reason) {
    console.error('[UNHANDLED] ' + (reason && reason.message ? reason.message : reason));
});

// ==================== START ====================
proxy.listen(PROXY_PORT, function () {
    console.log('');
    console.log('========================================');
    console.log('  LMS SEB Proxy v4.0 — Active');
    console.log('  Port: ' + PROXY_PORT);
    console.log('  Target: ' + TARGET_HOST);
    console.log('========================================');
    console.log('');
    console.log('Konfigurasi SEB / Browser:');
    console.log('  HTTP Proxy  : 127.0.0.1');
    console.log('  HTTPS Proxy : 127.0.0.1');
    console.log('  Port        : ' + PROXY_PORT);
    console.log('');
    console.log('Pastikan CA certificate sudah terinstall!');
    console.log('  Jalankan: node generate-ca.js');
    console.log('');
});
