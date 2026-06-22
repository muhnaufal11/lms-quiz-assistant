(function () {
    'use strict';

    console.log('[QBot] Payload script executing (SEB v4.0).');

    // ==================== PROMPTS ====================
    const SYS_SINGLE = 'You are a precise academic assistant. Analyze the quiz question and options. Reply with ONLY the single letter of the correct answer (e.g. B). No explanation, no extra text.';
    const SYS_MULTI = 'You are a precise academic assistant. Analyze the quiz question and options. Reply with ONLY the letters of ALL correct answers separated by commas (e.g. A, C). No explanation, no extra text.';
    const SYS_ESSAY = 'You are a knowledgeable academic assistant taking an exam. Write a clear, accurate, well-structured answer to the following essay question. Respond in the SAME LANGUAGE as the question (Indonesian question -> Indonesian answer). Write ONLY the answer itself — no preamble like "Here is the answer", no meta-commentary, no markdown headings. Use plain paragraphs. Keep it focused and appropriately detailed for an exam answer.';
    const SYS_SHORT = 'You are a precise exam assistant. Reply with ONLY the final answer: a number, single word, or very short phrase — nothing else. No explanation, no working steps, no full sentence, no trailing period, no units unless the answer is meaningless without them. Use the same language as the question. For a math problem, compute and output only the final result.';

    // ==================== PROVIDERS ====================
    const PROVIDERS = {
        groq: {
            name: 'Groq',
            keyHint: 'gsk_...',
            keyUrl: 'https://console.groq.com/keys',
            models: [
                { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B' },
                { id: 'llama-3.1-8b-instant', name: 'LLaMA 3.1 8B Instant' },
                { id: 'llama3-70b-8192', name: 'LLaMA 3 70B' },
                { id: 'llama3-8b-8192', name: 'LLaMA 3 8B' },
                { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
            ],
            buildRequest: function (sys, user, model, key) {
                return {
                    url: 'https://api.groq.com/openai/v1/chat/completions',
                    headers: {
                        'Authorization': 'Bearer ' + key,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: user },
                        ],
                        temperature: 0.0,
                    }),
                };
            },
            parse: function (json) {
                if (json.error) throw new Error(json.error.message || 'API error');
                return json.choices[0].message.content.trim();
            },
        },

        gemini: {
            name: 'Gemini',
            keyHint: 'AIza...',
            keyUrl: 'https://aistudio.google.com/apikey',
            models: [
                { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
                { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
                { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
                { id: 'gemma-4-31b-it', name: 'Gemma 4 31B' },
                { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B' },
                { id: 'gemma-3-27b-it', name: 'Gemma 3 27B' },
                { id: 'gemma-3-12b-it', name: 'Gemma 3 12B' },
                { id: 'gemma-3-4b-it', name: 'Gemma 3 4B' },
            ],
            buildRequest: function (sys, user, model, key) {
                var isGemma = /^gemma/i.test(model);
                var body = {
                    contents: [{
                        role: 'user',
                        parts: [{ text: isGemma ? sys + '\n\n' + user : user }],
                    }],
                    generationConfig: { temperature: 0.0 },
                };
                if (!isGemma) {
                    body.systemInstruction = { parts: [{ text: sys }] };
                }
                return {
                    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
                    headers: {
                        'x-goog-api-key': key,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify(body),
                };
            },
            parse: function (json) {
                if (json.error) throw new Error(json.error.message || 'API error');
                var cand = json.candidates && json.candidates[0];
                if (!cand) throw new Error('Tidak ada kandidat jawaban');
                if (cand.finishReason === 'SAFETY') throw new Error('Diblokir safety filter');
                var parts = (cand.content && cand.content.parts) || [];
                var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
                if (!text) throw new Error('Respon kosong');
                return text;
            },
        },

        claude: {
            name: 'Claude (Pro/Max)',
            keyHint: 'sk-ant-oat01-...',
            keyUrl: 'https://console.anthropic.com/settings/keys',
            models: [
                { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
                { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
                { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
            ],
            buildRequest: function (sys, user, model, key) {
                function generateUUID() {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                }

                var sessionId = generateUUID();
                var requestId = generateUUID();

                return {
                    url: 'https://api.anthropic.com/v1/messages',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': 'Bearer ' + key,
                        'Content-Type': 'application/json',
                        'User-Agent': 'claude-cli/2.1.183 (external, cli)',
                        'X-Claude-Code-Session-Id': sessionId,
                        'X-Stainless-Arch': 'x64',
                        'X-Stainless-Lang': 'js',
                        'X-Stainless-OS': 'Windows',
                        'X-Stainless-Package-Version': '0.94.0',
                        'X-Stainless-Retry-Count': '0',
                        'X-Stainless-Runtime': 'node',
                        'X-Stainless-Runtime-Version': 'v24.3.0',
                        'X-Stainless-Timeout': '600',
                        'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20,context-1m-2025-08-07,interleaved-thinking-2025-05-14,redact-thinking-2026-02-12,thinking-token-count-2026-05-13,context-management-2025-06-27,prompt-caching-scope-2026-01-05,mid-conversation-system-2026-04-07,advisor-tool-2026-03-01,advanced-tool-use-2025-11-20,effort-2025-11-24,afk-mode-2026-01-31,extended-cache-ttl-2025-04-11,cache-diagnosis-2026-04-07',
                        'anthropic-dangerous-direct-browser-access': 'true',
                        'anthropic-version': '2023-06-01',
                        'x-app': 'cli',
                        'x-client-request-id': requestId
                    },
                    data: JSON.stringify({
                        model: model,
                        max_tokens: 1024,
                        system: [
                            {
                                type: "text",
                                text: "x-anthropic-billing-header: cc_version=2.1.183.175; cc_entrypoint=cli; cch=7fdd4;"
                            },
                            {
                                type: "text",
                                text: sys
                            }
                        ],
                        messages: [{ role: 'user', content: user }],
                    }),
                };
            },
            parse: function (json) {
                if (json.type === 'error' || json.error) {
                    throw new Error((json.error && json.error.message) || 'API error');
                }
                var block = (json.content || []).find(function (b) { return b.type === 'text'; });
                if (!block) throw new Error('Tidak ada teks pada respon');
                return block.text.trim();
            },
        },

        deepseek: {
            name: 'DeepSeek',
            keyHint: 'sk-...',
            keyUrl: 'https://platform.deepseek.com/api_keys',
            models: [
                { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
                { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
            ],
            buildRequest: function (sys, user, model, key) {
                return {
                    url: 'https://api.deepseek.com/chat/completions',
                    headers: {
                        'Authorization': 'Bearer ' + key,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: user },
                        ],
                        temperature: 0.0,
                        stream: false,
                    }),
                };
            },
            parse: function (json) {
                if (json.error) throw new Error(json.error.message || 'API error');
                return json.choices[0].message.content.trim();
            },
        },

        local: {
            name: 'AI Lokal (Ollama/LM Studio)',
            keyHint: '(opsional, kosongkan jika tidak perlu)',
            keyUrl: 'https://ollama.com/download',
            keyOptional: true,
            custom: true,
            models: [
                { id: 'llama3.1', name: 'llama3.1' },
                { id: 'qwen2.5', name: 'qwen2.5' },
                { id: 'gemma2', name: 'gemma2' },
                { id: 'mistral', name: 'mistral' },
                { id: 'phi4', name: 'phi4' },
            ],
            buildRequest: function (sys, user, model, key) {
                var base = (cfg.localBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
                var headers = { 'Content-Type': 'application/json' };
                if (key) headers['Authorization'] = 'Bearer ' + key;
                return {
                    url: base + '/chat/completions',
                    headers: headers,
                    data: JSON.stringify({
                        model: model,
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: user },
                        ],
                        temperature: 0.0,
                        stream: false,
                    }),
                };
            },
            parse: function (json) {
                if (json.error) throw new Error((json.error.message || json.error) + '');
                if (!json.choices || !json.choices[0]) throw new Error('Respon kosong / model belum di-load');
                return json.choices[0].message.content.trim();
            },
        },
    };

    var PROVIDER_KEYS = Object.keys(PROVIDERS);

    // ==================== CONFIG (localStorage) ====================
    function defaultConfig() {
        return {
            provider: 'groq',
            apiKeys: { groq: '', gemini: '', claude: '', deepseek: '', local: '' },
            models: {
                groq: PROVIDERS.groq.models[0].id,
                gemini: PROVIDERS.gemini.models[0].id,
                claude: PROVIDERS.claude.models[0].id,
                deepseek: PROVIDERS.deepseek.models[0].id,
                local: PROVIDERS.local.models[0].id,
            },
            localBaseUrl: 'http://localhost:11434/v1',
            autoNext: true,
            autoStart: false,
        };
    }

    function applyConfig(raw) {
        var def = defaultConfig();
        return {
            provider: raw.provider || def.provider,
            apiKeys: Object.assign({}, def.apiKeys, raw.apiKeys || {}),
            models: Object.assign({}, def.models, raw.models || {}),
            localBaseUrl: raw.localBaseUrl || def.localBaseUrl,
            autoNext: raw.autoNext !== undefined ? raw.autoNext : def.autoNext,
            autoStart: raw.autoStart !== undefined ? raw.autoStart : def.autoStart,
        };
    }

    // Config primer dari server (config.json di proxy). localStorage sebagai cadangan
    // bila server tidak terjangkau (mis. dibuka di luar proxy).
    function localFallbackConfig() {
        try { return applyConfig(JSON.parse(localStorage.getItem('qbot_config') || '{}')); }
        catch (e) { return defaultConfig(); }
    }

    function loadConfigFromServer() {
        var fetchCfg = fetch('/__qbot__/config')
            .then(function (r) { return r.json(); })
            .then(function (j) { return applyConfig(j); })
            .catch(function () { return localFallbackConfig(); });
        // Jaring: kalau fetch menggantung, tetap render panel dalam 3 detik
        var timeout = new Promise(function (resolve) {
            setTimeout(function () { resolve(localFallbackConfig()); }, 3000);
        });
        return Promise.race([fetchCfg, timeout]);
    }

    function saveConfig(c) {
        try { localStorage.setItem('qbot_config', JSON.stringify(c)); } catch (e) {}
        fetch('/__qbot__/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(c),
        }).catch(function () {});
    }

    var cfg = defaultConfig();
    var running = false;
    var stopFlag = false;
    var countingDown = false;
    var countdownTimer = null;

    // ==================== HELPERS ====================
    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    function randomDelay(min, max) {
        min = min || 3500;
        max = max || 6500;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function normalizeText(text) {
        return text.replace(/^[a-zA-Z][.):\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function wordSimilarity(a, b) {
        var setA = new Set(a.split(/\s+/).filter(Boolean));
        var setB = new Set(b.split(/\s+/).filter(Boolean));
        if (setA.size === 0 && setB.size === 0) return 1;
        if (setA.size === 0 || setB.size === 0) return 0;
        var common = 0;
        setA.forEach(function (w) { if (setB.has(w)) common++; });
        return common / Math.max(setA.size, setB.size);
    }

    // SEB Trusted Event Emulation — bypass isTrusted detection
    function simulateTrustedClick(el) {
        var rect = el.getBoundingClientRect();
        var evt = new MouseEvent('click', {
            clientX: rect.left + (rect.width / 2),
            clientY: rect.top + (rect.height / 2),
            bubbles: true,
            cancelable: true,
            view: window
        });
        el.dispatchEvent(evt);
    }

    // ==================== UI ====================
    var logEl, statusDot, statusText, startBtn, keyInput, modelSelect, keyLink;
    var baseUrlField, baseUrlInput, modelText, modelList;

    function createPanel() {
        var panel = document.createElement('div');
        panel.id = 'qbot-panel';
        panel.innerHTML =
            '<div class="qbot-header" id="qbot-drag">' +
                '<h3>Quiz Assistant <sup style="color:#6b7280;font-size:9px">SEB</sup></h3>' +
                '<button class="qbot-hbtn" id="qbot-min" title="Minimize">&#x2014;</button>' +
            '</div>' +
            '<div class="qbot-body">' +
                '<div class="qbot-field">' +
                    '<label>Provider</label>' +
                    '<select id="qbot-provider">' +
                        PROVIDER_KEYS.map(function (k) {
                            return '<option value="' + k + '"' + (k === cfg.provider ? ' selected' : '') + '>' + PROVIDERS[k].name + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<div class="qbot-field" id="qbot-baseurl-field" style="display:none">' +
                    '<label>Base URL</label>' +
                    '<input type="text" id="qbot-baseurl" placeholder="http://localhost:11434/v1" />' +
                '</div>' +
                '<div class="qbot-field">' +
                    '<label>API Key <a id="qbot-keylink" href="#" target="_blank" rel="noopener">dapatkan key</a></label>' +
                    '<div class="qbot-key-wrap">' +
                        '<input type="password" id="qbot-key" />' +
                        '<button class="qbot-eye" id="qbot-eye" title="Show/Hide">&#128065;</button>' +
                    '</div>' +
                '</div>' +
                '<div class="qbot-field">' +
                    '<label>Model</label>' +
                    '<select id="qbot-model"></select>' +
                    '<input type="text" id="qbot-model-text" list="qbot-model-list" style="display:none" placeholder="nama model lokal (mis. llama3.1)" />' +
                    '<datalist id="qbot-model-list"></datalist>' +
                '</div>' +
                '<div class="qbot-row">' +
                    '<span style="font-size:12px;color:#9ca3af">Auto Next Page</span>' +
                    '<label class="qbot-toggle">' +
                        '<input type="checkbox" id="qbot-autonext"' + (cfg.autoNext ? ' checked' : '') + ' />' +
                        '<span class="slider"></span>' +
                    '</label>' +
                '</div>' +
                '<div class="qbot-row">' +
                    '<span style="font-size:12px;color:#9ca3af">Auto Start (saat load)</span>' +
                    '<label class="qbot-toggle">' +
                        '<input type="checkbox" id="qbot-autostart"' + (cfg.autoStart ? ' checked' : '') + ' />' +
                        '<span class="slider"></span>' +
                    '</label>' +
                '</div>' +
                '<button id="qbot-start" class="idle">Start</button>' +
                '<div class="qbot-status">' +
                    '<span class="qbot-dot idle" id="qbot-dot"></span>' +
                    '<span id="qbot-stxt">Idle</span>' +
                '</div>' +
                '<div id="qbot-log"></div>' +
            '</div>';
        document.body.appendChild(panel);

        logEl = document.getElementById('qbot-log');
        statusDot = document.getElementById('qbot-dot');
        statusText = document.getElementById('qbot-stxt');
        startBtn = document.getElementById('qbot-start');
        keyInput = document.getElementById('qbot-key');
        modelSelect = document.getElementById('qbot-model');
        keyLink = document.getElementById('qbot-keylink');
        baseUrlField = document.getElementById('qbot-baseurl-field');
        baseUrlInput = document.getElementById('qbot-baseurl');
        modelText = document.getElementById('qbot-model-text');
        modelList = document.getElementById('qbot-model-list');

        syncProviderUI();

        document.getElementById('qbot-min').addEventListener('click', function () {
            panel.classList.toggle('minimized');
        });

        document.getElementById('qbot-eye').addEventListener('click', function () {
            keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
        });

        document.getElementById('qbot-provider').addEventListener('change', function (e) {
            cfg.provider = e.target.value;
            saveConfig(cfg);
            syncProviderUI();
            log('Provider: ' + PROVIDERS[cfg.provider].name, 'info');
        });

        keyInput.addEventListener('change', function (e) {
            cfg.apiKeys[cfg.provider] = e.target.value.trim();
            saveConfig(cfg);
        });

        modelSelect.addEventListener('change', function (e) {
            cfg.models[cfg.provider] = e.target.value;
            saveConfig(cfg);
        });

        modelText.addEventListener('change', function (e) {
            cfg.models[cfg.provider] = e.target.value.trim();
            saveConfig(cfg);
        });

        baseUrlInput.addEventListener('change', function (e) {
            cfg.localBaseUrl = e.target.value.trim() || 'http://localhost:11434/v1';
            saveConfig(cfg);
        });

        document.getElementById('qbot-autonext').addEventListener('change', function (e) {
            cfg.autoNext = e.target.checked;
            saveConfig(cfg);
        });

        document.getElementById('qbot-autostart').addEventListener('change', function (e) {
            cfg.autoStart = e.target.checked;
            saveConfig(cfg);
            log(cfg.autoStart ? 'Auto Start aktif.' : 'Auto Start nonaktif.', 'info');
        });

        startBtn.addEventListener('click', function () {
            if (countingDown) {
                cancelCountdown();
            } else if (running) {
                stopFlag = true;
                log('Stopping...', 'warn');
            } else {
                startProcessing();
            }
        });

        makeDraggable(panel, document.getElementById('qbot-drag'));
    }

    function syncProviderUI() {
        var provider = PROVIDERS[cfg.provider];
        var isCustom = !!provider.custom;

        baseUrlField.style.display = isCustom ? 'flex' : 'none';
        if (isCustom) baseUrlInput.value = cfg.localBaseUrl || 'http://localhost:11434/v1';

        keyInput.value = cfg.apiKeys[cfg.provider] || '';
        keyInput.placeholder = provider.keyHint;
        keyLink.href = provider.keyUrl;

        if (isCustom) {
            modelSelect.style.display = 'none';
            modelText.style.display = 'block';
            modelList.innerHTML = provider.models.map(function (m) { return '<option value="' + m.id + '">'; }).join('');
            modelText.value = cfg.models[cfg.provider] || (provider.models[0] ? provider.models[0].id : '');
        } else {
            modelText.style.display = 'none';
            modelSelect.style.display = 'block';
            if (!provider.models.some(function (m) { return m.id === cfg.models[cfg.provider]; })) {
                cfg.models[cfg.provider] = provider.models[0].id;
                saveConfig(cfg);
            }
            modelSelect.innerHTML = provider.models
                .map(function (m) {
                    return '<option value="' + m.id + '"' + (m.id === cfg.models[cfg.provider] ? ' selected' : '') + '>' + m.name + '</option>';
                })
                .join('');
        }
    }

    function makeDraggable(el, handle) {
        var offsetX, offsetY, dragging = false;
        handle.addEventListener('mousedown', function (e) {
            if (e.target.tagName === 'BUTTON') return;
            dragging = true;
            offsetX = e.clientX - el.getBoundingClientRect().left;
            offsetY = e.clientY - el.getBoundingClientRect().top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            el.style.left = (e.clientX - offsetX) + 'px';
            el.style.top = (e.clientY - offsetY) + 'px';
            el.style.right = 'auto';
        });
        document.addEventListener('mouseup', function () { dragging = false; });
    }

    function log(msg, type) {
        type = type || 'info';
        var cls = { info: 'log-info', ok: 'log-ok', warn: 'log-warn', error: 'log-err', ai: 'log-ai' };
        var d = new Date();
        var time = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return (n < 10 ? '0' : '') + n; }).join(':');
        logEl.innerHTML += '<div class="' + (cls[type] || 'log-info') + '">[' + time + '] ' + msg + '</div>';
        logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(state) {
        statusDot.className = 'qbot-dot ' + (state === 'running' ? 'run' : state === 'error' ? 'err' : 'idle');
        var labels = { idle: 'Idle', running: 'Processing...', done: 'Done', error: 'Error', stopped: 'Stopped' };
        statusText.textContent = labels[state] || state;
    }

    function setButton(isRunning) {
        startBtn.className = isRunning ? 'running' : 'idle';
        startBtn.textContent = isRunning ? 'Stop' : 'Start';
    }

    // ==================== API (via SEB Proxy) ====================
    function rawRequest(req) {
        return fetch('/__qbot__/inference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: req.url,
                headers: req.headers,
                data: req.data,
            }),
        })
        .then(function (res) { return res.json(); })
        .then(function (result) {
            if (result.status && (result.status < 200 || result.status >= 300)) {
                var body = result.body || {};
                var e = body.error || {};
                var errType = e.type || 'error';
                var errMsg = e.message || JSON.stringify(body);
                throw new Error('HTTP ' + result.status + ' [' + errType + ']: ' + errMsg);
            }
            return result.body;
        });
    }

    // mode: 'single' | 'multi' | 'essay'
    function callLLM(question, options, mode) {
        var provider = PROVIDERS[cfg.provider];
        var key = cfg.apiKeys[cfg.provider];
        var model = cfg.models[cfg.provider];
        var sys, user;
        if (mode === 'essay') {
            sys = SYS_ESSAY;
            user = 'Essay question:\n' + question;
        } else if (mode === 'short') {
            sys = SYS_SHORT;
            user = 'Question:\n' + question;
        } else {
            sys = mode === 'multi' ? SYS_MULTI : SYS_SINGLE;
            var labels = options.map(function (o, i) { return String.fromCharCode(65 + i) + '. ' + o; }).join('\n');
            user = 'Question:\n' + question + '\n\nOptions:\n' + labels;
        }
        return rawRequest(provider.buildRequest(sys, user, model, key))
            .then(function (json) { return provider.parse(json); });
    }

    function callLLMWithRetry(question, options, mode, retries) {
        retries = retries || 3;
        var attempt = 0;
        function tryOnce() {
            attempt++;
            return callLLM(question, options, mode).catch(function (err) {
                if (attempt >= retries) throw err;
                log('Retry ' + attempt + '/' + retries + ': ' + (err.message || err), 'warn');
                return sleep(1000 * attempt).then(tryOnce);
            });
        }
        return tryOnce();
    }

    // ==================== ANSWER MATCHING ====================
    function parseLetters(response) {
        var cleaned = response.replace(/[^a-zA-Z,]/g, '');
        var letters = cleaned.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(function (s) { return /^[A-Z]$/.test(s); });
        if (letters.length > 0) return letters;
        var firstLetter = response.trim().match(/^([A-Za-z])/);
        if (firstLetter && /^[A-Z]$/i.test(firstLetter[1])) return [firstLetter[1].toUpperCase()];
        return [];
    }

    function matchAnswers(aiResponse, optionTexts) {
        var letters = parseLetters(aiResponse);
        if (letters.length > 0) {
            var indices = letters.map(function (l) { return l.charCodeAt(0) - 65; }).filter(function (i) { return i >= 0 && i < optionTexts.length; });
            if (indices.length > 0) return { indices: indices, method: 'letter' };
        }

        var normalized = normalizeText(aiResponse);
        for (var i = 0; i < optionTexts.length; i++) {
            if (normalizeText(optionTexts[i]) === normalized) return { indices: [i], method: 'exact' };
        }

        for (var j = 0; j < optionTexts.length; j++) {
            var norm = normalizeText(optionTexts[j]);
            if (norm.indexOf(normalized) !== -1 || normalized.indexOf(norm) !== -1) {
                return { indices: [j], method: 'contains' };
            }
        }

        var bestIdx = -1, bestScore = 0;
        for (var k = 0; k < optionTexts.length; k++) {
            var score = wordSimilarity(normalizeText(optionTexts[k]), normalized);
            if (score > bestScore) { bestScore = score; bestIdx = k; }
        }
        if (bestScore >= 0.4 && bestIdx >= 0) return { indices: [bestIdx], method: 'fuzzy' };

        return null;
    }

    // ==================== ESSAY FILLING ====================
    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Teks polos -> HTML: baris kosong jadi paragraf, newline tunggal jadi <br>
    function textToHtml(text) {
        return text.split(/\n{2,}/).map(function (p) {
            return '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>';
        }).join('');
    }

    function fireInput(el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Isi jawaban essay ke editor. Moodle bisa pakai: textarea polos,
    // editor Atto (contenteditable), atau TinyMCE (iframe / API global).
    // Selalu isi textarea tersembunyi juga karena itu yang disubmit form.
    function fillEssay(qNode, text) {
        var html = textToHtml(text);
        var richHandled = false;

        // Strategi 1: TinyMCE via API global (script kita jalan di page context)
        try {
            if (window.tinymce && window.tinymce.editors && window.tinymce.editors.length) {
                window.tinymce.editors.forEach(function (ed) {
                    var ta = ed.getElement && ed.getElement();
                    if (ta && qNode.contains(ta)) {
                        ed.setContent(html);
                        if (ed.save) ed.save(); // sync ke textarea
                        richHandled = true;
                    }
                });
            }
        } catch (e) {}

        // Strategi 2: Atto / contenteditable
        var editable = qNode.querySelector('[contenteditable="true"], .editor_atto_content');
        if (editable) {
            editable.innerHTML = html;
            fireInput(editable);
            richHandled = true;
        }

        // Strategi 3: TinyMCE iframe (kalau API global tak terjangkau)
        if (!richHandled) {
            var iframe = qNode.querySelector('iframe');
            if (iframe) {
                try {
                    var doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                    if (doc && doc.body) {
                        doc.body.innerHTML = html;
                        fireInput(doc.body);
                        richHandled = true;
                    }
                } catch (e) {}
            }
        }

        // Strategi 4: textarea (form field sebenarnya). Editor rich simpan HTML,
        // textarea polos simpan teks biasa.
        var textarea = qNode.querySelector('textarea');
        if (textarea) {
            textarea.value = richHandled ? html : text;
            fireInput(textarea);
            return true;
        }

        return richHandled;
    }

    // Isi jawaban isian singkat (short answer / numerical) ke input teks.
    function fillShort(qNode, text) {
        var answer = text.trim().replace(/^["'\s]+|["'\s.]+$/g, '');
        var input = qNode.querySelector(
            '.answer input[type="text"], .answer input[type="number"], .answer input:not([type])'
        );
        if (input) {
            input.focus();
            input.value = answer;
            fireInput(input);
            return true;
        }
        // Fallback: sebagian "isian singkat" pakai textarea kecil
        var ta = qNode.querySelector('textarea');
        if (ta) { ta.value = answer; fireInput(ta); return true; }
        return false;
    }

    // ==================== QUESTION TYPE & TEXT ====================
    // Tentukan tipe soal: 'single' | 'multi' | 'essay' | 'short' | 'unknown'
    function detectMode(qNode) {
        var cls = qNode.classList;
        if (qNode.querySelector('.answer input[type="checkbox"]')) return 'multi';
        if (qNode.querySelector('.answer input[type="radio"]')) return 'single';
        if (cls.contains('essay') ||
            qNode.querySelector('.answer textarea, .answer [contenteditable="true"], .answer .editor_atto_content, .answer iframe')) {
            return 'essay';
        }
        if (cls.contains('shortanswer') || cls.contains('numerical') ||
            cls.contains('calculated') || cls.contains('calculatedsimple') ||
            qNode.querySelector('.answer input[type="text"], .answer input[type="number"], .answer input:not([type])')) {
            return 'short';
        }
        return 'unknown';
    }

    // Ekstrak teks soal TERMASUK rumus matematika. innerText melewatkan MathJax
    // (script math/tex), MathML, dan rumus yang dirender sebagai <img alt="...">.
    function extractQuestionText(qNode) {
        var src = qNode.querySelector('.qtext') || qNode;
        var clone = src.cloneNode(true);

        // MathJax v2: <script type="math/tex">LATEX</script> (sumber LaTeX)
        clone.querySelectorAll('script[type^="math/tex"]').forEach(function (s) {
            clone_replace(s, ' ' + (s.textContent || '') + ' ');
        });
        // MathJax v3: <mjx-container> (ambil aria-label / MathML)
        clone.querySelectorAll('mjx-container').forEach(function (c) {
            var mml = c.querySelector('math');
            var tex = c.getAttribute('aria-label') || (mml ? mml.textContent : '') || '';
            clone_replace(c, ' ' + tex + ' ');
        });
        // Sisa render MathJax v2 (span) — buang agar tak jadi teks acak
        clone.querySelectorAll('.MathJax_Preview, span.MathJax').forEach(function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        // Rumus sebagai gambar (filter TeX Moodle): alt berisi LaTeX
        clone.querySelectorAll('img').forEach(function (img) {
            var alt = img.getAttribute('alt');
            if (alt && alt.trim()) clone_replace(img, ' ' + alt + ' ');
        });

        var text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
        return text;
    }

    function clone_replace(el, str) {
        if (el.parentNode) el.parentNode.replaceChild(document.createTextNode(str), el);
    }

    // ==================== PROCESSOR ====================
    function startProcessing() {
        var activeProvider = PROVIDERS[cfg.provider];
        if (!activeProvider.keyOptional && !cfg.apiKeys[cfg.provider]) {
            log('API Key ' + activeProvider.name + ' belum diisi!', 'error');
            setStatus('error');
            return;
        }
        if (!cfg.models[cfg.provider]) {
            log('Nama model belum diisi!', 'error');
            setStatus('error');
            return;
        }

        running = true;
        stopFlag = false;
        setButton(true);
        setStatus('running');
        log('Mulai (' + PROVIDERS[cfg.provider].name + ' / ' + cfg.models[cfg.provider] + ')', 'ok');

        var questions = document.querySelectorAll('.que');
        if (questions.length === 0) {
            log('Tidak ada soal ditemukan di halaman ini.', 'warn');
            finish('done');
            return;
        }

        log('Ditemukan ' + questions.length + ' soal.', 'info');

        var i = 0;

        // Maju ke soal berikutnya dengan delay acak (anti-deteksi).
        function advance() {
            i++;
            if (i < questions.length && !stopFlag) {
                var d = randomDelay();
                log('Delay ' + d + 'ms...', 'info');
                sleep(d).then(processNext);
            } else {
                processNext();
            }
        }

        function processNext() {
            if (stopFlag) { finish('stopped'); return; }
            if (i >= questions.length) { afterAllQuestions(); return; }

            var qNode = questions[i];
            var qText = qNode.querySelector('.qtext');
            if (!qText) {
                log('Soal ' + (i + 1) + ': tidak bisa dibaca, skip.', 'warn');
                i++; processNext();
                return;
            }

            qNode.classList.remove('qbot-done', 'qbot-fail');
            qNode.classList.add('qbot-active');

            var questionText = extractQuestionText(qNode);
            log('Soal ' + (i + 1) + ': ' + questionText.substring(0, 60) + '...', 'info');

            var mode = detectMode(qNode);

            // ----- ESSAY -----
            if (mode === 'essay') {
                log('Soal ' + (i + 1) + ': tipe essay, menulis jawaban...', 'info');
                callLLMWithRetry(questionText, [], 'essay')
                    .then(function (answer) {
                        log('AI: "' + answer.substring(0, 70).replace(/\s+/g, ' ') + '..."', 'ai');
                        var ok = fillEssay(qNode, answer);
                        if (ok) {
                            log('Soal ' + (i + 1) + ': jawaban essay diisi (' + answer.length + ' karakter)', 'ok');
                            qNode.classList.replace('qbot-active', 'qbot-done');
                        } else {
                            log('Soal ' + (i + 1) + ': kolom jawaban essay tidak ditemukan.', 'error');
                            qNode.classList.replace('qbot-active', 'qbot-fail');
                        }
                    })
                    .catch(function (err) {
                        log('Soal ' + (i + 1) + ': ' + (err.message || err), 'error');
                        qNode.classList.replace('qbot-active', 'qbot-fail');
                    })
                    .then(advance);
                return;
            }

            // ----- ISIAN SINGKAT (short answer / numerical) -----
            if (mode === 'short') {
                log('Soal ' + (i + 1) + ': tipe isian singkat...', 'info');
                callLLMWithRetry(questionText, [], 'short')
                    .then(function (answer) {
                        log('AI: "' + answer.replace(/\s+/g, ' ') + '"', 'ai');
                        var ok = fillShort(qNode, answer);
                        if (ok) {
                            log('Soal ' + (i + 1) + ': jawaban diisi.', 'ok');
                            qNode.classList.replace('qbot-active', 'qbot-done');
                        } else {
                            log('Soal ' + (i + 1) + ': kolom jawaban tidak ditemukan.', 'error');
                            qNode.classList.replace('qbot-active', 'qbot-fail');
                        }
                    })
                    .catch(function (err) {
                        log('Soal ' + (i + 1) + ': ' + (err.message || err), 'error');
                        qNode.classList.replace('qbot-active', 'qbot-fail');
                    })
                    .then(advance);
                return;
            }

            if (mode === 'unknown') {
                qNode.classList.replace('qbot-active', 'qbot-fail');
                log('Soal ' + (i + 1) + ': tipe soal tidak dikenali, skip.', 'warn');
                advance();
                return;
            }

            // ----- PILIHAN (radio/checkbox) -----
            var answerContainer = qNode.querySelector('.answer');
            if (!answerContainer) {
                qNode.classList.replace('qbot-active', 'qbot-fail');
                log('Soal ' + (i + 1) + ': tidak ada pilihan jawaban.', 'warn');
                advance();
                return;
            }

            var inputs = answerContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
            var isMulti = inputs.length > 0 && inputs[0].type === 'checkbox';

            var optionTexts = [];
            var optionInputs = [];

            if (inputs.length > 0) {
                inputs.forEach(function (inp) {
                    var parent = inp.closest('.answer div, .answer label, .r0, .r1') || inp.parentElement;
                    var text = parent ? parent.innerText.trim() : '';
                    optionTexts.push(text);
                    optionInputs.push(inp);
                });
            } else {
                var divs = answerContainer.querySelectorAll('div, label');
                divs.forEach(function (d) {
                    var inp = d.querySelector('input[type="radio"], input[type="checkbox"]');
                    if (inp) {
                        optionTexts.push(d.innerText.trim());
                        optionInputs.push(inp);
                    }
                });
            }

            if (optionTexts.length === 0) {
                qNode.classList.replace('qbot-active', 'qbot-fail');
                log('Soal ' + (i + 1) + ': gagal parsing opsi jawaban.', 'error');
                advance();
                return;
            }

            callLLMWithRetry(questionText, optionTexts, isMulti ? 'multi' : 'single')
                .then(function (aiResponse) {
                    log('AI: "' + aiResponse + '"', 'ai');

                    var match = matchAnswers(aiResponse, optionTexts);
                    if (match) {
                        match.indices.forEach(function (idx) { simulateTrustedClick(optionInputs[idx]); });
                        var letters = match.indices.map(function (idx) { return String.fromCharCode(65 + idx); }).join(', ');
                        log('Soal ' + (i + 1) + ': dipilih ' + letters + ' (' + match.method + ')', 'ok');
                        qNode.classList.replace('qbot-active', 'qbot-done');
                    } else {
                        log('Soal ' + (i + 1) + ': gagal mencocokkan jawaban.', 'error');
                        qNode.classList.replace('qbot-active', 'qbot-fail');
                    }
                })
                .catch(function (err) {
                    log('Soal ' + (i + 1) + ': ' + (err.message || err), 'error');
                    qNode.classList.replace('qbot-active', 'qbot-fail');
                })
                .then(advance);
        }

        function afterAllQuestions() {
            if (stopFlag) { finish('stopped'); return; }

            if (cfg.autoNext) {
                var nextBtn = document.querySelector(
                    'input[value="Next page"], input[value="Next"], input[id="mod_quiz-next-nav"], .submitbtns .mod_quiz-next-nav'
                );
                if (nextBtn) {
                    var d = randomDelay(4500, 8500);
                    log('Next page dalam ' + d + 'ms...', 'info');
                    sleep(d).then(function () {
                        if (!stopFlag) {
                            log('Pindah ke halaman berikutnya.', 'ok');
                            simulateTrustedClick(nextBtn);
                        } else {
                            finish('stopped');
                        }
                    });
                    return;
                } else {
                    log('Tidak ada tombol Next. Semua halaman selesai.', 'ok');
                }
            }

            finish('done');
        }

        processNext();
    }

    function finish(state) {
        running = false;
        stopFlag = false;
        setButton(false);
        setStatus(state);
        log(state === 'stopped' ? 'Dihentikan oleh user.' : 'Selesai.', state === 'stopped' ? 'warn' : 'ok');
    }

    // ==================== AUTO START ====================
    function cancelCountdown() {
        countingDown = false;
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        setButton(false);
        setStatus('idle');
        log('Auto start dibatalkan.', 'warn');
    }

    function scheduleAutoStart() {
        if (!cfg.autoStart) return;
        if (document.querySelectorAll('.que').length === 0) return;
        if (!PROVIDERS[cfg.provider].keyOptional && !cfg.apiKeys[cfg.provider]) {
            log('Auto Start aktif tapi API Key kosong, dilewati.', 'warn');
            return;
        }

        countingDown = true;
        var secs = 3;
        startBtn.className = 'running';
        startBtn.textContent = 'Cancel (' + secs + 's)';
        setStatus('running');
        statusText.textContent = 'Auto start...';
        log('Auto start dalam ' + secs + ' detik... klik Cancel untuk batal.', 'warn');

        countdownTimer = setInterval(function () {
            secs--;
            if (secs <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                countingDown = false;
                startProcessing();
            } else {
                startBtn.textContent = 'Cancel (' + secs + 's)';
            }
        }, 1000);
    }

    // ==================== INIT ====================
    loadConfigFromServer().then(function (loaded) {
        cfg = loaded;
        createPanel();
        log('Panel siap. Config dimuat dari server.', 'info');
        log('Mode: SEB Proxy v4.0', 'ok');

        var provName = PROVIDERS[cfg.provider] ? PROVIDERS[cfg.provider].name : cfg.provider;
        var hasKey = PROVIDERS[cfg.provider] && (PROVIDERS[cfg.provider].keyOptional || cfg.apiKeys[cfg.provider]);
        log(provName + ' / ' + cfg.models[cfg.provider] + (hasKey ? ' (key OK)' : ' (key kosong!)'), hasKey ? 'ok' : 'warn');

        var qCount = document.querySelectorAll('.que').length;
        if (qCount > 0) {
            log('Terdeteksi ' + qCount + ' soal di halaman ini.', 'info');
        }

        scheduleAutoStart();
    });
})();
