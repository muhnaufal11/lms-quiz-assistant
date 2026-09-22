(function () {
    'use strict';

    console.log('[QBot] Payload script executing (SEB v4.1 - Pure Shortcut Mode).');

    // ==================== PROMPTS ====================
    const SYS_SINGLE = 'You are a precise academic assistant. Analyze the quiz question and options. Reply with ONLY the single letter of the correct answer (e.g. B). No explanation, no extra text.';
    const SYS_MULTI = 'You are a precise academic assistant. Analyze the quiz question and options. Reply with ONLY the letters of ALL correct answers separated by commas (e.g. A, C). No explanation, no extra text.';
    const SYS_ESSAY = 'You are a knowledgeable academic assistant taking an exam. Write a clear, accurate, well-structured answer to the following essay question. Respond in the SAME LANGUAGE as the question (Indonesian question -> Indonesian answer). Write ONLY the answer itself — no preamble like "Here is the answer", no meta-commentary, no markdown headings. Use plain paragraphs. Keep it focused and appropriately detailed for an exam answer.';
    const SYS_SHORT = 'You are a precise exam assistant. Reply with ONLY the final answer: a number, single word, or very short phrase — nothing else. No explanation, no working steps, no full sentence, no trailing period, no units unless the answer is meaningless without them. Use the same language as the question. For a math problem, compute and output only the final result.';
    const SYS_MATCHING = 'You are a precise academic assistant. Analyze the matching question. For each sub-question number, choose the exact matching option letter. Reply with ONLY line-by-line pairs like "1: B\n2: A". No explanation, no extra text.';

    // ==================== PROVIDERS ====================
    const PROVIDERS = {
        groq: {
            name: 'Groq',
            keyHint: 'gsk_...',
            keyUrl: 'https://console.groq.com/keys',
            models: [
                { id: 'llama-3.3-70b-versatile', name: 'LLaMA 3.3 70B' },
                { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B' },
                { id: 'llama-3.1-8b-instant', name: 'LLaMA 3.1 8B Instant' },
                { id: 'llama3-70b-8192', name: 'LLaMA 3 70B' },
                { id: 'llama3-8b-8192', name: 'LLaMA 3 8B' },
                { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
                { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B' },
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
                { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
                { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite' },
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
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
                { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
                { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
                { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
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
                { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
                { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
                { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
                { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
                { id: 'deepseek-coder', name: 'DeepSeek Coder' },
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
                { id: 'deepseek-r1', name: 'deepseek-r1' },
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

    // ==================== CONFIG (localStorage & Proxy) ====================
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
            autoQuiz: false,
            urgentThresholdHours: 24,
            autoNext: true,
            autoStart: false,
            autoSubmit: false,
            stealthMode: true,
        };
    }

    function applyConfig(raw) {
        var def = defaultConfig();
        return {
            provider: raw.provider || def.provider,
            apiKeys: Object.assign({}, def.apiKeys, raw.apiKeys || {}),
            models: Object.assign({}, def.models, raw.models || {}),
            localBaseUrl: raw.localBaseUrl || def.localBaseUrl,
            autoQuiz: raw.autoQuiz !== undefined ? raw.autoQuiz : def.autoQuiz,
            urgentThresholdHours: typeof raw.urgentThresholdHours === 'number' ? raw.urgentThresholdHours : def.urgentThresholdHours,
            autoNext: raw.autoNext !== undefined ? raw.autoNext : def.autoNext,
            autoStart: raw.autoStart !== undefined ? raw.autoStart : def.autoStart,
            autoSubmit: raw.autoSubmit !== undefined ? raw.autoSubmit : def.autoSubmit,
            stealthMode: raw.stealthMode !== undefined ? raw.stealthMode : def.stealthMode,
        };
    }

    function localFallbackConfig() {
        try { return applyConfig(JSON.parse(localStorage.getItem('qbot_config') || '{}')); }
        catch (e) { return defaultConfig(); }
    }

    function loadConfigFromServer() {
        var fetchCfg = fetch('/__qbot__/config')
            .then(function (r) { return r.json(); })
            .then(function (j) { return applyConfig(j); })
            .catch(function () { return localFallbackConfig(); });
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
    var paused = false;
    var stopFlag = false;
    var countingDown = false;
    var countdownTimer = null;
    var currentQuestionIndex = 0;

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

    // SEB Trusted Event Emulation
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

    // ==================== UI PANEL (OPTIONAL / UNHIDE VIA ALT+H) ====================
    var panelEl = null;
    var logEl, statusDot, statusText, startBtn, keyInput, modelSelect, keyLink;
    var baseUrlField, baseUrlInput, modelText, modelList;

    function createPanel() {
        if (document.getElementById('qbot-panel')) return;
        var panel = document.createElement('div');
        panel.id = 'qbot-panel';
        if (cfg.stealthMode) {
            panel.style.display = 'none';
        }
        panel.innerHTML =
            '<div class="qbot-header" id="qbot-drag">' +
                '<div class="qbot-header-left">' +
                    '<span class="qbot-header-badge">✦</span>' +
                    '<h3>Quiz Assistant <sup style="color:#818cf8;font-size:9px;font-weight:600">SEB</sup></h3>' +
                '</div>' +
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
                '<div class="qbot-card-autopilot">' +
                    '<div class="qbot-row">' +
                        '<div>' +
                            '<div style="font-size:12px;font-weight:700;color:#93c5fd;display:flex;align-items:center;gap:4px">' +
                                '<span>⚡</span> Auto Pilot Kuis <span style="font-size:10px;font-weight:500;color:#60a5fa;opacity:0.85">(Alt+A)</span>' +
                            '</div>' +
                            '<div style="font-size:10px;color:#94a3b8;margin-top:2px">Deteksi & prioritaskan jatuh tempo</div>' +
                        '</div>' +
                        '<label class="qbot-toggle">' +
                            '<input type="checkbox" id="qbot-autoquiz"' + (cfg.autoQuiz ? ' checked' : '') + ' />' +
                            '<span class="slider"></span>' +
                        '</label>' +
                    '</div>' +
                '</div>' +
                '<div class="qbot-options-group">' +
                    '<div class="qbot-opt-row">' +
                        '<span class="qbot-opt-label">Auto Next Page</span>' +
                        '<label class="qbot-toggle">' +
                            '<input type="checkbox" id="qbot-autonext"' + (cfg.autoNext ? ' checked' : '') + ' />' +
                            '<span class="slider"></span>' +
                        '</label>' +
                    '</div>' +
                    '<div class="qbot-opt-row">' +
                        '<span class="qbot-opt-label">Auto Start (saat load)</span>' +
                        '<label class="qbot-toggle">' +
                            '<input type="checkbox" id="qbot-autostart"' + (cfg.autoStart ? ' checked' : '') + ' />' +
                            '<span class="slider"></span>' +
                        '</label>' +
                    '</div>' +
                    '<div class="qbot-opt-row">' +
                        '<span class="qbot-opt-label">Auto Submit (Summary)</span>' +
                        '<label class="qbot-toggle">' +
                            '<input type="checkbox" id="qbot-autosubmit"' + (cfg.autoSubmit ? ' checked' : '') + ' />' +
                            '<span class="slider"></span>' +
                        '</label>' +
                    '</div>' +
                '</div>' +
                '<div id="qbot-prompt-box-area"></div>' +
                '<button id="qbot-start" class="idle">Start (Alt+S)</button>' +
                '<div class="qbot-status">' +
                    '<span class="qbot-dot idle" id="qbot-dot"></span>' +
                    '<span id="qbot-stxt">Idle</span>' +
                '</div>' +
                '<div id="qbot-log"></div>' +
            '</div>';
        document.body.appendChild(panel);
        panelEl = panel;

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

        document.getElementById('qbot-autoquiz').addEventListener('change', function (e) {
            cfg.autoQuiz = e.target.checked;
            saveConfig(cfg);
            log(cfg.autoQuiz ? '[Auto Pilot] AKTIF — Deteksi kuis & utamakan jatuh tempo.' : '[Auto Pilot] NONAKTIF.', 'info');
            clearPromptBox();
            evaluateCurrentPage();
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

        document.getElementById('qbot-autosubmit').addEventListener('change', function (e) {
            cfg.autoSubmit = e.target.checked;
            saveConfig(cfg);
            log(cfg.autoSubmit ? 'Auto Submit aktif.' : 'Auto Submit nonaktif.', 'info');
        });

        startBtn.addEventListener('click', function () {
            if (isSummaryPage()) {
                if (submitCountdown) {
                    cancelSubmitCountdown();
                } else {
                    submitQuizAttempt();
                }
                return;
            }
            if (isQuizViewPage()) {
                if (viewCountdownTimer) {
                    cancelViewCountdown();
                } else {
                    executeStartQuiz();
                }
                return;
            }
            if (isMyCoursesPage()) {
                if (viewCountdownTimer) {
                    cancelViewCountdown();
                } else {
                    scanAllMyCourses();
                }
                return;
            }
            if (countingDown) {
                cancelCountdown();
            } else if (running && !paused) {
                pauseProcessing();
            } else if (paused) {
                resumeProcessing();
            } else {
                startProcessing();
            }
        });

        makeDraggable(panel, document.getElementById('qbot-drag'));
    }

    function togglePanelVisibility() {
        if (!panelEl) createPanel();
        if (panelEl) {
            var isHidden = panelEl.style.display === 'none';
            panelEl.style.display = isHidden ? 'block' : 'none';
            console.log('[QBot] Panel visibility toggled:', isHidden ? 'Visible' : 'Hidden');
        }
    }

    function syncProviderUI() {
        if (!keyInput) return;
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
            if (cfg.models[cfg.provider] && !provider.models.some(function (m) { return m.id === cfg.models[cfg.provider]; })) {
                provider.models.unshift({ id: cfg.models[cfg.provider], name: cfg.models[cfg.provider] + ' (Custom/Tersimpan)' });
            } else if (!cfg.models[cfg.provider] && provider.models.length > 0) {
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
            var newLeft = Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, e.clientX - offsetX));
            var newTop = Math.max(10, Math.min(window.innerHeight - el.offsetHeight - 10, e.clientY - offsetY));
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
            el.style.right = 'auto';
        });
        document.addEventListener('mouseup', function () { dragging = false; });
    }

    function log(msg, type) {
        type = type || 'info';
        console.log('[QBot Log][' + type.toUpperCase() + '] ' + msg);
        if (!logEl) return;
        var cls = { info: 'log-info', ok: 'log-ok', warn: 'log-warn', error: 'log-err', ai: 'log-ai' };
        var d = new Date();
        var time = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return (n < 10 ? '0' : '') + n; }).join(':');
        logEl.innerHTML += '<div class="' + (cls[type] || 'log-info') + '">[' + time + '] ' + msg + '</div>';
        logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(state) {
        if (!statusDot || !statusText) return;
        statusDot.className = 'qbot-dot ' + (state === 'running' ? 'run' : state === 'paused' ? 'idle' : state === 'error' ? 'err' : 'idle');
        var labels = { idle: 'Idle', running: 'Processing...', paused: 'Paused (Alt+S to resume)', done: 'Done', error: 'Error', stopped: 'Stopped' };
        statusText.textContent = labels[state] || state;
    }

    function setButton(state) {
        if (!startBtn) return;
        if (state === 'running') {
            startBtn.className = 'running';
            startBtn.textContent = 'Pause (Alt+P)';
        } else if (state === 'paused') {
            startBtn.className = 'idle';
            startBtn.textContent = 'Resume (Alt+S)';
        } else {
            startBtn.className = 'idle';
            startBtn.textContent = 'Start (Alt+S)';
        }
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
        } else if (mode === 'matching') {
            sys = SYS_MATCHING;
            user = 'Matching question:\n' + question + '\n\nOptions:\n' + options.join('\n');
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

    // ==================== PARSER & MATCHING ENGINE ====================
    function parseLetters(response) {
        if (!response) return [];
        var text = response.trim();
        var prefixMatch = text.match(/(?:jawaban|answer|option|pilihan|opsi)(?:\s+yang\s+benar)?\s*[:\-\.]?\s*([A-Z])\b/i);
        if (prefixMatch && prefixMatch[1]) {
            return [prefixMatch[1].toUpperCase()];
        }
        var commaMatch = text.match(/^([A-Z](?:\s*,\s*[A-Z])+)/i);
        if (commaMatch) {
            return commaMatch[1].split(',').map(function (s) { return s.trim().toUpperCase(); });
        }
        var singleMatch = text.match(/^(?:\[)?([A-Z])(?:\]|\.|\)|\:|\s|$)/i);
        if (singleMatch) {
            return [singleMatch[1].toUpperCase()];
        }
        var isolated = text.match(/\b([A-Z])\b/);
        if (isolated) {
            return [isolated[1].toUpperCase()];
        }
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

    // ==================== FORM FILLING ====================
    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function textToHtml(text) {
        return text.split(/\n{2,}/).map(function (p) {
            return '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>';
        }).join('');
    }

    function fireInput(el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function fillEssay(qNode, text) {
        var html = textToHtml(text);
        var richHandled = false;

        try {
            if (window.tinymce && window.tinymce.editors && window.tinymce.editors.length) {
                window.tinymce.editors.forEach(function (ed) {
                    var ta = ed.getElement && ed.getElement();
                    if (ta && qNode.contains(ta)) {
                        ed.setContent(html);
                        if (ed.save) ed.save();
                        richHandled = true;
                    }
                });
            }
        } catch (e) {}

        var editable = qNode.querySelector('[contenteditable="true"], .editor_atto_content');
        if (editable) {
            editable.innerHTML = html;
            fireInput(editable);
            richHandled = true;
        }

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

        var textarea = qNode.querySelector('textarea');
        if (textarea) {
            textarea.value = richHandled ? html : text;
            fireInput(textarea);
            textarea.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        }

        return richHandled;
    }

    function fillShort(qNode, text) {
        var answer = text.trim();
        answer = answer.replace(/^(?:answer|jawaban|hasil|x|y)\s*[:\=]\s*/i, '');
        answer = answer.replace(/^["'\s]+|["'\s.]+$/g, '');
        var input = qNode.querySelector(
            '.answer input[type="text"], .answer input[type="number"], .answer input:not([type])'
        );
        if (input) {
            input.focus();
            input.value = answer;
            fireInput(input);
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        }
        var ta = qNode.querySelector('textarea');
        if (ta) {
            ta.value = answer;
            fireInput(ta);
            ta.dispatchEvent(new Event('blur', { bubbles: true }));
            return true;
        }
        return false;
    }

    function fillMatching(qNode, aiResponse) {
        var selects = qNode.querySelectorAll('table.matching select, .answer select');
        if (selects.length === 0) return false;
        var lines = aiResponse.split('\n');
        var map = {};
        lines.forEach(function (line) {
            var m = line.match(/^(\d+)\s*[:\-\=]\s*([A-Z])/i);
            if (m) {
                map[parseInt(m[1])] = m[2].toUpperCase();
            }
        });
        var filled = 0;
        selects.forEach(function (sel, i) {
            var targetLetter = map[i + 1];
            if (!targetLetter) return;
            var targetIdx = targetLetter.charCodeAt(0) - 65 + 1;
            var options = sel.options;
            if (targetIdx > 0 && targetIdx < options.length) {
                sel.selectedIndex = targetIdx;
                fireInput(sel);
                filled++;
            } else {
                for (var j = 0; j < options.length; j++) {
                    if (options[j].text.toUpperCase().indexOf(targetLetter) === 0) {
                        sel.selectedIndex = j;
                        fireInput(sel);
                        filled++;
                        break;
                    }
                }
            }
        });
        return filled > 0;
    }

    // ==================== QUESTION TYPE & TEXT EXTRACTION ====================
    function detectMode(qNode) {
        var cls = qNode.classList;
        if (qNode.querySelector('.answer input[type="checkbox"]')) return 'multi';
        if (qNode.querySelector('.answer input[type="radio"]')) return 'single';
        if (qNode.querySelector('table.matching, .answer select')) return 'matching';
        if (qNode.querySelector('.qtext select, .formulation select')) return 'gapselect';
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

    function extractQuestionText(qNode) {
        var src = qNode.querySelector('.qtext') || qNode;
        var clone = src.cloneNode(true);

        clone.querySelectorAll('.accesshide, .info, .clearchoice, .questionflag').forEach(function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });

        clone.querySelectorAll('.katex annotation[encoding*="tex"]').forEach(function (ann) {
            var kParent = ann.closest('.katex') || ann.parentNode;
            clone_replace(kParent, ' $' + (ann.textContent || '').trim() + '$ ');
        });

        clone.querySelectorAll('script[type^="math/tex"]').forEach(function (s) {
            clone_replace(s, ' $' + (s.textContent || '').trim() + '$ ');
        });

        clone.querySelectorAll('mjx-container').forEach(function (c) {
            var mml = c.querySelector('math');
            var tex = c.getAttribute('aria-label') || (mml ? mml.textContent : '') || '';
            clone_replace(c, ' $' + tex.trim() + '$ ');
        });

        clone.querySelectorAll('.MathJax_Preview, span.MathJax').forEach(function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
        });

        clone.querySelectorAll('img').forEach(function (img) {
            var alt = img.getAttribute('alt');
            if (alt && alt.trim()) clone_replace(img, ' ' + alt.trim() + ' ');
        });

        var text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
        return text;
    }

    function clone_replace(el, str) {
        if (el.parentNode) el.parentNode.replaceChild(document.createTextNode(str), el);
    }

    // ==================== PROCESSOR LOOP ====================
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
        paused = false;
        stopFlag = false;
        currentQuestionIndex = 0;
        setButton('running');
        setStatus('running');
        log('Mulai (' + PROVIDERS[cfg.provider].name + ' / ' + cfg.models[cfg.provider] + ')', 'ok');

        processQuestions();
    }

    function pauseProcessing() {
        if (!running || paused) return;
        paused = true;
        setButton('paused');
        setStatus('paused');
        log('Pengisian dijeda sementara (Alt+S untuk lanjut).', 'warn');
    }

    function resumeProcessing() {
        if (!running || !paused) return;
        paused = false;
        setButton('running');
        setStatus('running');
        log('Melanjutkan pengisian jawaban...', 'ok');
        processQuestions();
    }

    function stopProcessing() {
        running = false;
        paused = false;
        stopFlag = true;
        setButton('idle');
        setStatus('stopped');
        log('Dihentikan oleh user (Alt+X).', 'warn');
    }

    function processQuestions() {
        var questions = document.querySelectorAll('.que');
        if (questions.length === 0) {
            log('Tidak ada soal ditemukan di halaman ini.', 'warn');
            finish('done');
            return;
        }

        function advance() {
            currentQuestionIndex++;
            if (currentQuestionIndex < questions.length && !stopFlag && !paused) {
                var d = randomDelay();
                log('Delay ' + d + 'ms...', 'info');
                sleep(d).then(processNext);
            } else {
                processNext();
            }
        }

        function processNext() {
            if (stopFlag) { finish('stopped'); return; }
            if (paused) { log('Sedang dipause pada soal ' + (currentQuestionIndex + 1), 'warn'); return; }
            if (currentQuestionIndex >= questions.length) { afterAllQuestions(); return; }

            var qNode = questions[currentQuestionIndex];
            var qText = qNode.querySelector('.qtext');
            if (!qText) {
                log('Soal ' + (currentQuestionIndex + 1) + ': tidak bisa dibaca, skip.', 'warn');
                currentQuestionIndex++; processNext();
                return;
            }

            var questionText = extractQuestionText(qNode);
            log('Soal ' + (currentQuestionIndex + 1) + ': ' + questionText.substring(0, 60) + '...', 'info');

            var mode = detectMode(qNode);

            // ----- ESSAY -----
            if (mode === 'essay') {
                log('Soal ' + (currentQuestionIndex + 1) + ': tipe essay...', 'info');
                callLLMWithRetry(questionText, [], 'essay')
                    .then(function (answer) {
                        log('AI: "' + answer.substring(0, 70).replace(/\s+/g, ' ') + '..."', 'ai');
                        var ok = fillEssay(qNode, answer);
                        log('Soal ' + (currentQuestionIndex + 1) + (ok ? ': essay diisi.' : ': kolom essay tak ditemukan.'), ok ? 'ok' : 'error');
                    })
                    .catch(function (err) { log('Soal ' + (currentQuestionIndex + 1) + ': ' + (err.message || err), 'error'); })
                    .then(advance);
                return;
            }

            // ----- ISIAN SINGKAT -----
            if (mode === 'short') {
                log('Soal ' + (currentQuestionIndex + 1) + ': tipe isian singkat...', 'info');
                callLLMWithRetry(questionText, [], 'short')
                    .then(function (answer) {
                        log('AI: "' + answer + '"', 'ai');
                        var ok = fillShort(qNode, answer);
                        log('Soal ' + (currentQuestionIndex + 1) + (ok ? ': jawaban diisi.' : ': kolom tak ditemukan.'), ok ? 'ok' : 'error');
                    })
                    .catch(function (err) { log('Soal ' + (currentQuestionIndex + 1) + ': ' + (err.message || err), 'error'); })
                    .then(advance);
                return;
            }

            // ----- MATCHING / MENJODOHKAN -----
            if (mode === 'matching') {
                log('Soal ' + (currentQuestionIndex + 1) + ': tipe matching...', 'info');
                var selects = qNode.querySelectorAll('table.matching select, .answer select');
                var matchOptions = [];
                if (selects.length > 0 && selects[0].options) {
                    for (var m = 0; m < selects[0].options.length; m++) {
                        matchOptions.push(String.fromCharCode(65 + m) + '. ' + selects[0].options[m].text);
                    }
                }
                callLLMWithRetry(questionText, matchOptions, 'matching')
                    .then(function (answer) {
                        log('AI: "' + answer.replace(/\n/g, ' | ') + '"', 'ai');
                        var ok = fillMatching(qNode, answer);
                        log('Soal ' + (currentQuestionIndex + 1) + (ok ? ': matching diisi.' : ': gagal matching.'), ok ? 'ok' : 'error');
                    })
                    .catch(function (err) { log('Soal ' + (currentQuestionIndex + 1) + ': ' + (err.message || err), 'error'); })
                    .then(advance);
                return;
            }

            if (mode === 'unknown') {
                log('Soal ' + (currentQuestionIndex + 1) + ': tipe tidak dikenali, skip.', 'warn');
                advance();
                return;
            }

            // ----- PILIHAN GANDA (radio/checkbox) -----
            var answerContainer = qNode.querySelector('.answer');
            if (!answerContainer) {
                log('Soal ' + (currentQuestionIndex + 1) + ': tidak ada pilihan jawaban.', 'warn');
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
            }

            if (optionTexts.length === 0) {
                log('Soal ' + (currentQuestionIndex + 1) + ': gagal parsing opsi.', 'error');
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
                        log('Soal ' + (currentQuestionIndex + 1) + ': dipilih ' + letters, 'ok');
                    } else {
                        log('Soal ' + (currentQuestionIndex + 1) + ': gagal mencocokkan jawaban.', 'error');
                    }
                })
                .catch(function (err) { log('Soal ' + (currentQuestionIndex + 1) + ': ' + (err.message || err), 'error'); })
                .then(advance);
        }

        function afterAllQuestions() {
            if (stopFlag || paused) return;

            if (cfg.autoNext || cfg.autoQuiz) {
                var nextBtn = document.querySelector(
                    'input[value="Next page"], input[value="Next"], input[id="mod_quiz-next-nav"], .submitbtns .mod_quiz-next-nav, ' +
                    'input[value*="Finish attempt"], input[value*="Selesaikan"], button[id="mod_quiz-next-nav"]'
                );
                if (nextBtn) {
                    var isFinish = (nextBtn.value || nextBtn.innerText || '').toLowerCase().indexOf('finish') !== -1 ||
                                   (nextBtn.value || nextBtn.innerText || '').toLowerCase().indexOf('selesai') !== -1;
                    var d = randomDelay(3500, 6500);
                    log((isFinish ? 'Menuju halaman Summary' : 'Next page') + ' dalam ' + d + 'ms...', 'info');
                    sleep(d).then(function () {
                        if (!stopFlag && !paused) {
                            log(isFinish ? 'Membuka halaman Summary...' : 'Pindah ke halaman berikutnya.', 'ok');
                            simulateTrustedClick(nextBtn);
                            try { nextBtn.click(); } catch (e) {}
                        } else {
                            finish('stopped');
                        }
                    });
                    return;
                } else {
                    log('Semua halaman kuis selesai.', 'ok');
                }
            }

            finish('done');
        }

        processNext();
    }

    function finish(state) {
        running = false;
        paused = false;
        stopFlag = false;
        setButton('idle');
        setStatus(state);
        log(state === 'stopped' ? 'Dihentikan oleh user.' : 'Selesai.', state === 'stopped' ? 'warn' : 'ok');
    }

    // ==================== SUMMARY PAGE & AUTO SUBMIT ====================
    var submitTimer = null;
    var submitCountdown = false;

    function isSummaryPage() {
        return window.location.pathname.indexOf('/mod/quiz/summary.php') !== -1;
    }

    function cancelSubmitCountdown() {
        if (!submitCountdown) return;
        submitCountdown = false;
        if (submitTimer) { clearInterval(submitTimer); submitTimer = null; }
        if (startBtn) {
            startBtn.className = 'idle';
            startBtn.textContent = 'Submit Quiz (Alt+S)';
        }
        setStatus('stopped');
        log('Auto submit dibatalkan oleh user (Alt+X).', 'warn');
    }

    function submitQuizAttempt() {
        if (submitCountdown && submitTimer) {
            clearInterval(submitTimer);
            submitTimer = null;
            submitCountdown = false;
        }

        log('Memproses Submit all and finish...', 'info');
        setStatus('running');
        if (startBtn) {
            startBtn.className = 'running';
            startBtn.textContent = 'Submitting...';
        }

        // 1. Cari tombol Submit all and finish di halaman summary
        var submitBtn = null;
        var candidates = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], .submitbtns a, .submitbtns button'));
        for (var i = 0; i < candidates.length; i++) {
            var txt = (candidates[i].innerText || candidates[i].value || '').toLowerCase().trim();
            if (txt.indexOf('submit all and finish') !== -1 || txt.indexOf('kirim semua dan selesai') !== -1) {
                submitBtn = candidates[i];
                break;
            }
        }

        if (!submitBtn) {
            submitBtn = document.querySelector('form[action*="processattempt.php"] button, form[action*="processattempt.php"] input[type="submit"], .submitbtns button.btn-primary');
        }

        if (!submitBtn) {
            log('Tombol Submit all and finish tidak ditemukan di halaman!', 'error');
            setStatus('error');
            if (startBtn) {
                startBtn.className = 'idle';
                startBtn.textContent = 'Submit Quiz (Alt+S)';
            }
            return;
        }

        log('Mengklik tombol Submit all and finish...', 'ok');
        simulateTrustedClick(submitBtn);
        try { submitBtn.click(); } catch (e) {}

        // 2. Moodle memunculkan dialog/modal konfirmasi
        var attempts = 0;
        var maxAttempts = 20; // cek selama 4 detik
        var checkModal = setInterval(function () {
            attempts++;

            var modalBtn = null;
            var modalCandidates = document.querySelectorAll(
                '.modal.show button, .modal.show input[type="button"], .modal.show input[type="submit"], ' +
                '.moodle-dialogue-bd button, .moodle-dialogue-bd input[type="button"], ' +
                'div[role="dialog"] button, [data-action="save"]'
            );

            for (var j = 0; j < modalCandidates.length; j++) {
                var mb = modalCandidates[j];
                var mtxt = (mb.innerText || mb.value || '').toLowerCase().trim();
                var action = mb.getAttribute('data-action') || '';
                if (action === 'save' || mtxt.indexOf('submit all') !== -1 || mtxt.indexOf('kirim semua') !== -1) {
                    modalBtn = mb;
                    break;
                }
            }

            if (!modalBtn) {
                var primary = document.querySelector('.modal.show .btn-primary, div[role="dialog"] .btn-primary');
                if (primary) {
                    var ptxt = (primary.innerText || primary.value || '').toLowerCase();
                    if (ptxt.indexOf('cancel') === -1 && ptxt.indexOf('batal') === -1) {
                        modalBtn = primary;
                    }
                }
            }

            if (modalBtn) {
                clearInterval(checkModal);
                log('Modal konfirmasi terdeteksi, mengonfirmasi submit final...', 'ok');
                simulateTrustedClick(modalBtn);
                try { modalBtn.click(); } catch (e) {}
                setStatus('done');
                if (startBtn) {
                    startBtn.className = 'idle';
                    startBtn.textContent = 'Submitted';
                }
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkModal);
                // Fallback: submit form langsung bila modal tidak muncul
                var form = document.querySelector('form[action*="processattempt.php"]');
                if (form) {
                    log('Modal tidak terdeteksi, mengirim form attempt secara langsung...', 'warn');
                    form.submit();
                } else {
                    log('Selesai memicu submit.', 'ok');
                }
                setStatus('done');
                if (startBtn) {
                    startBtn.className = 'idle';
                    startBtn.textContent = 'Submitted';
                }
            }
        }, 200);
    }

    function isSummaryPage() {
        return window.location.pathname.indexOf('/mod/quiz/summary.php') !== -1;
    }

    function isQuizViewPage() {
        return window.location.pathname.indexOf('/mod/quiz/view.php') !== -1;
    }

    function isCourseViewPage() {
        return window.location.pathname.indexOf('/course/view.php') !== -1;
    }

    function isMyCoursesPage() {
        return window.location.pathname.indexOf('/my/courses.php') !== -1 || window.location.pathname.indexOf('/my/') !== -1;
    }

    // ==================== DUE DATE PARSER & FORMATTER ====================
    function parseDueDateText(text) {
        if (!text) return null;
        var months = {
            'januari': 0, 'jan': 0, 'january': 0,
            'februari': 1, 'feb': 1, 'february': 1,
            'maret': 2, 'mar': 2, 'march': 2,
            'april': 3, 'apr': 3,
            'mei': 4, 'may': 4,
            'juni': 5, 'jun': 5, 'june': 5,
            'juli': 6, 'jul': 6, 'july': 6,
            'agustus': 7, 'ags': 7, 'aug': 7, 'august': 7,
            'september': 8, 'sep': 8,
            'oktober': 9, 'okt': 9, 'oct': 9, 'october': 9,
            'november': 10, 'nov': 10,
            'desember': 11, 'des': 11, 'dec': 11, 'december': 11
        };

        var m = text.match(/(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?[,\s]+(?:pukul\s+)?(\d{1,2})[:.](\d{2})(?:\s*([ap]\.?m\.?))?/i);
        if (m) {
            var day = parseInt(m[1], 10);
            var mName = m[2].toLowerCase();
            var year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
            var hour = parseInt(m[4], 10);
            var min = parseInt(m[5], 10);
            var ampm = m[6] ? m[6].toLowerCase().replace(/\./g, '') : null;
            if (months.hasOwnProperty(mName)) {
                if (ampm === 'pm' && hour < 12) hour += 12;
                if (ampm === 'am' && hour === 12) hour = 0;
                var d = new Date(year, months[mName], day, hour, min, 0);
                if (!isNaN(d.getTime())) return d;
            }
        }

        var m2 = text.match(/([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(?:(\d{4})[,\s]+)?(?:at\s+)?(\d{1,2})[:.](\d{2})(?:\s*([ap]\.?m\.?))?/i);
        if (m2) {
            var mName2 = m2[1].toLowerCase();
            var day2 = parseInt(m2[2], 10);
            var year2 = m2[3] ? parseInt(m2[3], 10) : new Date().getFullYear();
            var hour2 = parseInt(m2[4], 10);
            var min2 = parseInt(m2[5], 10);
            var ampm2 = m2[6] ? m2[6].toLowerCase().replace(/\./g, '') : null;
            if (months.hasOwnProperty(mName2)) {
                if (ampm2 === 'pm' && hour2 < 12) hour2 += 12;
                if (ampm2 === 'am' && hour2 === 12) hour2 = 0;
                var d2 = new Date(year2, months[mName2], day2, hour2, min2, 0);
                if (!isNaN(d2.getTime())) return d2;
            }
        }

        var parsed = Date.parse(text);
        if (!isNaN(parsed)) return new Date(parsed);
        return null;
    }

    function formatRemainingTime(ms) {
        if (ms < 0) return 'Sudah lewat deadline';
        var totalMinutes = Math.floor(ms / (1000 * 60));
        var totalHours = Math.floor(totalMinutes / 60);
        var days = Math.floor(totalHours / 24);
        var hours = totalHours % 24;
        var minutes = totalMinutes % 60;
        if (days > 0) {
            return days + ' hari ' + (hours > 0 ? hours + ' jam lagi' : 'lagi');
        }
        if (hours > 0) {
            return hours + ' jam ' + (minutes > 0 ? minutes + ' mnt lagi' : 'lagi');
        }
        return totalMinutes + ' menit lagi';
    }

    function extractQuizDueDate() {
        var candidates = Array.from(document.querySelectorAll('.quizinfo, .box.py-3, [data-region="activity-dates"], #region-main, div[role="main"]'));
        for (var i = 0; i < candidates.length; i++) {
            var lines = (candidates[i].innerText || '').split('\n');
            for (var j = 0; j < lines.length; j++) {
                var line = lines[j].trim();
                var lower = line.toLowerCase();
                if (lower.indexOf('close') !== -1 || lower.indexOf('ditutup') !== -1 ||
                    lower.indexOf('due') !== -1 || lower.indexOf('batas waktu') !== -1 ||
                    lower.indexOf('jatuh tempo') !== -1) {
                    var d = parseDueDateText(line);
                    if (d) {
                        var diffMs = d.getTime() - Date.now();
                        var remainingHours = diffMs / (1000 * 60 * 60);
                        var threshold = typeof cfg.urgentThresholdHours === 'number' ? cfg.urgentThresholdHours : 24;
                        var isUrgent = remainingHours <= threshold;
                        return {
                            date: d,
                            rawText: line,
                            remainingHours: remainingHours,
                            remainingText: formatRemainingTime(diffMs),
                            isUrgent: isUrgent
                        };
                    }
                }
            }
        }
        return null;
    }

    function findStartAttemptButton() {
        var selectors = [
            'form[action*="startattempt.php"] button[type="submit"]',
            'form[action*="startattempt.php"] input[type="submit"]',
            '.quizattempt button',
            '.quizattempt input[type="submit"]',
            '#quizstartbuttondiv button',
            '#quizstartbuttondiv input[type="submit"]',
            '.singlebutton form button[type="submit"]',
            'a.btn-primary[href*="startattempt.php"]',
            'a.btn-primary[href*="attempt.php"]'
        ];
        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) return el;
        }
        var buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
        for (var j = 0; j < buttons.length; j++) {
            var txt = (buttons[j].innerText || buttons[j].value || '').toLowerCase();
            if (txt.indexOf('attempt quiz') !== -1 || txt.indexOf('kerjakan kuis') !== -1 ||
                txt.indexOf('continue the last attempt') !== -1 || txt.indexOf('lanjutkan pengerjaan') !== -1 ||
                txt.indexOf('re-attempt') !== -1 || txt.indexOf('kerjakan ulang') !== -1 ||
                txt.indexOf('preview quiz') !== -1 || txt.indexOf('lihat pratinjau') !== -1) {
                return buttons[j];
            }
        }
        return null;
    }

    function confirmStartModal() {
        return new Promise(function (resolve) {
            var attempts = 0;
            var maxAttempts = 20;
            var interval = setInterval(function () {
                attempts++;
                var modalCandidates = document.querySelectorAll(
                    '#confirmstartmodal button, #confirmstartmodal input[type="submit"], ' +
                    '.modal.show button, .modal.show input[type="submit"], ' +
                    'div[role="dialog"] button, div[role="dialog"] input[type="submit"], ' +
                    '[data-action="save"]'
                );
                for (var i = 0; i < modalCandidates.length; i++) {
                    var btn = modalCandidates[i];
                    var txt = (btn.innerText || btn.value || '').toLowerCase();
                    var action = btn.getAttribute('data-action') || '';
                    if (action === 'save' || txt.indexOf('start attempt') !== -1 || txt.indexOf('mulai pengerjaan') !== -1 || txt.indexOf('start') !== -1 || txt.indexOf('mulai') !== -1) {
                        clearInterval(interval);
                        log('Modal konfirmasi terdeteksi, mengonfirmasi mulai kuis...', 'ok');
                        simulateTrustedClick(btn);
                        try { btn.click(); } catch (e) {}
                        resolve(true);
                        return;
                    }
                }
                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 200);
        });
    }

    function executeStartQuiz() {
        var startBtnEl = findStartAttemptButton();
        if (!startBtnEl) {
            log('Tombol mulai kuis tidak ditemukan!', 'error');
            return;
        }
        log('Mengklik tombol mulai kuis...', 'ok');
        setStatus('running');
        if (startBtn) {
            startBtn.className = 'running';
            startBtn.textContent = 'Starting...';
        }
        simulateTrustedClick(startBtnEl);
        try { startBtnEl.click(); } catch (e) {}
        confirmStartModal();
    }

    function showPromptBox(title, message, onYes, onNo) {
        var container = document.getElementById('qbot-prompt-box-area');
        if (!container) return;
        var cleanTitle = title.replace(/^⚠️\s*/, '');
        container.innerHTML =
            '<div class="qbot-prompt-box">' +
                '<div class="qbot-prompt-title">' +
                    '<span style="font-size:13px">⚠️</span>' +
                    '<span>' + cleanTitle + '</span>' +
                '</div>' +
                '<div class="qbot-prompt-msg">' + message + '</div>' +
                '<div class="qbot-prompt-btns">' +
                    '<button class="qbot-btn-yes" id="qbot-btn-prompt-yes">Ya, Kerjakan Sekarang</button>' +
                    '<button class="qbot-btn-no" id="qbot-btn-prompt-no">Nanti Saja</button>' +
                '</div>' +
            '</div>';
        document.getElementById('qbot-btn-prompt-yes').addEventListener('click', function () {
            container.innerHTML = '';
            if (typeof onYes === 'function') onYes();
        });
        document.getElementById('qbot-btn-prompt-no').addEventListener('click', function () {
            container.innerHTML = '';
            if (typeof onNo === 'function') onNo();
        });
    }

    function clearPromptBox() {
        var container = document.getElementById('qbot-prompt-box-area');
        if (container) container.innerHTML = '';
    }

    // ==================== QUIZ VIEW PAGE HANDLER ====================
    var viewCountdownTimer = null;
    function cancelViewCountdown() {
        if (viewCountdownTimer) {
            clearInterval(viewCountdownTimer);
            viewCountdownTimer = null;
            if (startBtn) {
                startBtn.className = 'idle';
                startBtn.textContent = isMyCoursesPage() ? 'Pindai Ulang' : isQuizViewPage() ? 'Mulai Kuis (Alt+S)' : 'Start (Alt+S)';
            }
            setStatus('stopped');
            log('Pengerjaan otomatis kuis dibatalkan oleh user.', 'warn');
        }
    }

    var quizViewRetryCount = 0;
    function handleQuizViewPage() {
        if (!isQuizViewPage()) return;

        var titleEl = document.querySelector('.page-header-headings h1, #region-main h2, h2.main, .breadcrumb-item:last-child');
        var quizTitle = titleEl ? titleEl.textContent.trim() : document.title.replace(/\|.*/, '').trim();

        var dueInfo = extractQuizDueDate();
        var startBtnEl = findStartAttemptButton();

        if (startBtn) {
            startBtn.className = 'idle';
            startBtn.textContent = 'Mulai Kuis (Alt+S)';
        }

        if (!startBtnEl) {
            if (quizViewRetryCount < 4) {
                quizViewRetryCount++;
                setTimeout(handleQuizViewPage, 600);
                return;
            }
            log('Kuis terdeteksi: "' + quizTitle + '". Kuis ini sudah selesai atau tidak ada attempt yang dapat dimulai.', 'info');
            setStatus('done');
            return;
        }
        quizViewRetryCount = 0;

        var pwInput = document.querySelector('#id_quizpassword, input[name="quizpassword"]');
        if (pwInput && !pwInput.value.trim()) {
            log('⚠️ Kuis "' + quizTitle + '" memerlukan password. Silakan isi password pada formulir terlebih dahulu.', 'warn');
            setStatus('idle');
            return;
        }

        if (cfg.autoQuiz) {
            if (dueInfo && !dueInfo.isUrgent) {
                log('🟡 [Auto Pilot] Kuis "' + quizTitle + '" terdeteksi. Batas waktu masih lama (' + dueInfo.remainingText + '). Menunggu konfirmasi...', 'info');
                showPromptBox(
                    '⚠️ Konfirmasi Pengerjaan (Auto Pilot)',
                    'Kuis <b>' + quizTitle + '</b> batas waktunya masih <b>' + dueInfo.remainingText + '</b> (' + (dueInfo.date ? dueInfo.date.toLocaleString('id-ID') : '') + ').<br>Apakah ingin dikerjakan sekarang?',
                    function () {
                        log('User memilih untuk mengerjakan sekarang.', 'ok');
                        executeStartQuiz();
                    },
                    function () {
                        log('User memilih nanti saja. Kuis dilewati.', 'info');
                        setStatus('idle');
                    }
                );
            } else {
                var reason = dueInfo ? 'Batas waktu: ' + dueInfo.remainingText : 'Siap dikerjakan';
                log('🔴 [Auto Pilot] Kuis MENDESAK: "' + quizTitle + '" (' + reason + ')! Memulai pengerjaan otomatis dalam 3 detik...', 'warn');
                var secs = 3;
                if (startBtn) {
                    startBtn.className = 'running';
                    startBtn.textContent = 'Batal (' + secs + 's)';
                }
                setStatus('running');

                viewCountdownTimer = setInterval(function () {
                    secs--;
                    if (secs <= 0) {
                        clearInterval(viewCountdownTimer);
                        viewCountdownTimer = null;
                        executeStartQuiz();
                    } else {
                        if (startBtn) startBtn.textContent = 'Batal (' + secs + 's)';
                    }
                }, 1000);
            }
        } else {
            var dueStr = dueInfo ? ' (Deadline: ' + dueInfo.remainingText + ')' : '';
            log('Kuis terdeteksi: "' + quizTitle + '"' + dueStr + '. Tekan Alt+S atau klik "Mulai Kuis" untuk mulai.', 'info');
            setStatus('idle');
        }
    }

    // ==================== COURSE VIEW PAGE HANDLER ====================
    function handleCourseViewPage() {
        if (!isCourseViewPage()) return;

        var quizElements = Array.from(document.querySelectorAll('li.activity.quiz, div.activity-item[data-activityname], a[href*="/mod/quiz/view.php"]'));
        var foundQuizzes = [];
        var seenUrls = {};

        for (var i = 0; i < quizElements.length; i++) {
            var el = quizElements[i];
            var link = el.tagName === 'A' ? el : el.querySelector('a[href*="/mod/quiz/view.php"]');
            if (!link) continue;
            var href = link.href;
            if (seenUrls[href]) continue;
            seenUrls[href] = true;

            var title = (link.querySelector('.instancename') || link).textContent.replace(/\s+/g, ' ').trim();
            var isDone = false;
            var parentItem = link.closest('.activity, .activity-item') || el;
            if (parentItem) {
                var compTxt = (parentItem.innerText || '').toLowerCase();
                if (compTxt.indexOf('done') !== -1 || compTxt.indexOf('selesai') !== -1 || compTxt.indexOf('completed') !== -1 ||
                    parentItem.querySelector('.completion-info .badge-success, [data-action="toggle-manual-completion"][data-value="1"]')) {
                    isDone = true;
                }
            }

            var dueInfo = null;
            if (parentItem) {
                var datesEl = parentItem.querySelector('.activity-dates, .text-muted, .activity-information');
                if (datesEl) {
                    var d = parseDueDateText(datesEl.innerText || '');
                    if (d) {
                        var diffMs = d.getTime() - Date.now();
                        var remainingHours = diffMs / (1000 * 60 * 60);
                        var threshold = typeof cfg.urgentThresholdHours === 'number' ? cfg.urgentThresholdHours : 24;
                        dueInfo = {
                            date: d,
                            remainingHours: remainingHours,
                            remainingText: formatRemainingTime(diffMs),
                            isUrgent: remainingHours <= threshold
                        };
                    }
                }
            }

            foundQuizzes.push({
                title: title,
                href: href,
                isDone: isDone,
                dueInfo: dueInfo
            });
        }

        if (foundQuizzes.length === 0) {
            if (courseViewRetryCount < 4) {
                courseViewRetryCount++;
                setTimeout(handleCourseViewPage, 800);
            }
            return;
        }
        courseViewRetryCount = 0;

        foundQuizzes.sort(function (a, b) {
            if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
            var aH = a.dueInfo ? a.dueInfo.remainingHours : 999999;
            var bH = b.dueInfo ? b.dueInfo.remainingHours : 999999;
            return aH - bH;
        });

        log('[Auto Detect] Terdeteksi ' + foundQuizzes.length + ' kuis di mata kuliah ini (diurutkan prioritas deadline).', 'ok');

        var container = document.getElementById('qbot-prompt-box-area');
        if (container) {
            var html =
                '<div class="qbot-dashboard-box">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                        '<span style="font-weight:700;font-size:12px;color:#93c5fd;display:flex;align-items:center;gap:4px">📚 Kuis di Mata Kuliah Ini</span>' +
                        '<span style="font-size:10px;color:#94a3b8;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px">' + foundQuizzes.length + ' Kuis</span>' +
                    '</div>' +
                    '<div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;padding-right:2px">';
            for (var k = 0; k < foundQuizzes.length; k++) {
                var q = foundQuizzes[k];
                var badgeClass = q.isDone ? 'qbot-badge-done' : (q.dueInfo && q.dueInfo.isUrgent ? 'qbot-badge-urgent' : 'qbot-badge-normal');
                var badgeText = q.isDone ? 'Selesai' : (q.dueInfo ? q.dueInfo.remainingText : 'Tersedia');

                html +=
                    '<div class="qbot-quiz-item">' +
                        '<div class="qbot-quiz-item-head">' +
                            '<span class="qbot-quiz-item-title">' + q.title + '</span>' +
                            '<span class="qbot-badge ' + badgeClass + '">' + badgeText + '</span>' +
                        '</div>' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">' +
                            '<span class="qbot-quiz-item-due">' + (q.dueInfo ? 'Batas: ' + q.dueInfo.date.toLocaleDateString('id-ID') : 'Tanpa deadline') + '</span>' +
                            '<a class="qbot-quiz-item-btn" href="' + q.href + '">Buka Kuis &rarr;</a>' +
                        '</div>' +
                    '</div>';
            }
            html += '</div></div>';
            container.innerHTML = html;
        }

        if (cfg.autoQuiz) {
            var urgentQuizzes = foundQuizzes.filter(function (q) { return !q.isDone && q.dueInfo && q.dueInfo.isUrgent; });
            var mostUrgent = urgentQuizzes[0];
            if (mostUrgent) {
                log('🔴 [Auto Pilot] Kuis MENDESAK: "' + mostUrgent.title + '" (' + mostUrgent.dueInfo.remainingText + ')! Membuka kuis dalam 3 detik...', 'warn');
                var secs = 3;
                if (startBtn) {
                    startBtn.className = 'running';
                    startBtn.textContent = 'Batal (' + secs + 's)';
                }
                setStatus('running');

                viewCountdownTimer = setInterval(function () {
                    secs--;
                    if (secs <= 0) {
                        clearInterval(viewCountdownTimer);
                        viewCountdownTimer = null;
                        log('Membuka kuis "' + mostUrgent.title + '"...', 'ok');
                        window.location.href = mostUrgent.href;
                    } else {
                        if (startBtn) startBtn.textContent = 'Batal (' + secs + 's)';
                    }
                }, 1000);
            } else {
                var upcoming = foundQuizzes.filter(function (q) { return !q.isDone; })[0];
                if (upcoming) {
                    var dueStr = upcoming.dueInfo ? upcoming.dueInfo.remainingText : 'tanpa batas waktu ketat';
                    log('🟡 [Auto Pilot] Kuis "' + upcoming.title + '" belum jatuh tempo (' + dueStr + '). Menunggu konfirmasi...', 'info');
                    showPromptBox(
                        '⚠️ Konfirmasi Pengerjaan (Auto Pilot)',
                        'Kuis <b>' + upcoming.title + '</b> belum jatuh tempo (<b>' + dueStr + '</b>).<br>Apakah ingin dikerjakan sekarang?',
                        function () {
                            log('Membuka kuis "' + upcoming.title + '"...', 'ok');
                            window.location.href = upcoming.href;
                        },
                        function () {
                            log('User memilih nanti saja.', 'info');
                            setStatus('idle');
                        }
                    );
                }
            }
        }
    }

    // ==================== MY COURSES DASHBOARD HANDLER (/my/courses.php) ====================
    var isScanningMyCourses = false;
    var hasAutoScannedMyCourses = false;
    var myCoursesObserver = null;
    var myCoursesRetryTimer = null;
    var courseViewRetryCount = 0;

    function getEnrolledCoursesFromPage() {
        var links = Array.from(document.querySelectorAll('a[href*="/course/view.php?id="]'));
        var coursesMap = {};
        var courses = [];

        for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var href = a.href;
            var m = href.match(/\/course\/view\.php\?id=(\d+)/);
            if (!m) continue;
            var id = m[1];
            if (id === '1') continue;

            var name = '';
            var parentCard = a.closest ? a.closest('.dashboard-card, .course-info-container, .course-listitem, [data-course-id]') : null;
            if (parentCard) {
                var titleNode = parentCard.querySelector('.coursename, .course-title, h5, h6, .multiline');
                if (titleNode) {
                    name = (titleNode.innerText || '').trim();
                }
            }
            if (!name) {
                var nameEl = a.querySelector('.coursename, .multiline, .text-truncate') || a;
                name = (nameEl.innerText || a.innerText || '').trim();
            }
            name = name.replace(/\s+/g, ' ').replace(/^(Course|Mata kuliah)\s*:\s*/i, '').trim();

            if (coursesMap[id]) {
                var existing = coursesMap[id];
                if ((!existing.name || existing.name.indexOf('Mata Kuliah #') === 0) && name && name.indexOf('Mata Kuliah #') !== 0) {
                    existing.name = name;
                }
            } else {
                if (!name || name.length < 2 || name.toLowerCase() === 'home' || name.toLowerCase() === 'beranda') {
                    name = 'Mata Kuliah #' + id;
                }
                var cObj = { id: id, name: name, url: href };
                coursesMap[id] = cObj;
                courses.push(cObj);
            }
        }
        return courses;
    }

    function renderMyCoursesQuizzes(allQuizzes, totalCourses) {
        if (allQuizzes.length === 0) {
            log('Pemindaian selesai dari ' + totalCourses + ' mata kuliah: Tidak ada kuis aktif ditemukan.', 'ok');
            return;
        }

        allQuizzes.sort(function (a, b) {
            if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
            var aH = a.dueInfo ? a.dueInfo.remainingHours : 999999;
            var bH = b.dueInfo ? b.dueInfo.remainingHours : 999999;
            return aH - bH;
        });

        var urgentCount = allQuizzes.filter(function (q) { return !q.isDone && q.dueInfo && q.dueInfo.isUrgent; }).length;
        log('Pemindaian selesai! Ditemukan ' + allQuizzes.length + ' kuis (' + urgentCount + ' mendesak) dari ' + totalCourses + ' mata kuliah.', urgentCount > 0 ? 'warn' : 'ok');

        var container = document.getElementById('qbot-prompt-box-area');
        if (container) {
            var html =
                '<div class="qbot-dashboard-box">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                        '<span style="font-weight:700;font-size:12px;color:#93c5fd;display:flex;align-items:gap:4px">📋 Dashboard Kuis (' + allQuizzes.length + ')</span>' +
                        '<span style="font-size:10px;color:#94a3b8;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px">' + totalCourses + ' Matkul</span>' +
                    '</div>' +
                    '<div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;padding-right:2px">';

            for (var j = 0; j < allQuizzes.length; j++) {
                var q = allQuizzes[j];
                var badgeClass = q.isDone ? 'qbot-badge-done' : (q.dueInfo && q.dueInfo.isUrgent ? 'qbot-badge-urgent' : 'qbot-badge-normal');
                var badgeText = q.isDone ? 'Selesai' : (q.dueInfo ? q.dueInfo.remainingText : 'Tersedia');

                html +=
                    '<div class="qbot-quiz-item">' +
                        '<div class="qbot-quiz-item-head">' +
                            '<span class="qbot-quiz-item-title">' + q.title + '</span>' +
                            '<span class="qbot-badge ' + badgeClass + '">' + badgeText + '</span>' +
                        '</div>' +
                        '<div style="font-size:10px;color:#60a5fa;margin-top:2px">📚 ' + q.courseName + '</div>' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">' +
                            '<span class="qbot-quiz-item-due">' + (q.dueInfo ? 'Batas: ' + q.dueInfo.date.toLocaleDateString('id-ID') : 'Tanpa deadline') + '</span>' +
                            '<a class="qbot-quiz-item-btn" href="' + q.href + '">Buka Kuis &rarr;</a>' +
                        '</div>' +
                    '</div>';
            }
            html += '</div></div>';
            container.innerHTML = html;
        }

        if (cfg.autoQuiz) {
            var urgentQuizzes = allQuizzes.filter(function (q) { return !q.isDone && q.dueInfo && q.dueInfo.isUrgent; });
            var mostUrgent = urgentQuizzes[0];
            if (mostUrgent) {
                log('🔴 [Auto Pilot] Kuis MENDESAK: "' + mostUrgent.title + '" di "' + mostUrgent.courseName + '" (' + mostUrgent.dueInfo.remainingText + ')! Membuka otomatis dalam 3 detik...', 'warn');
                var secs = 3;
                if (startBtn) {
                    startBtn.className = 'running';
                    startBtn.textContent = 'Batal (' + secs + 's)';
                }
                setStatus('running');

                viewCountdownTimer = setInterval(function () {
                    secs--;
                    if (secs <= 0) {
                        clearInterval(viewCountdownTimer);
                        viewCountdownTimer = null;
                        log('Membuka kuis mendesak "' + mostUrgent.title + '"...', 'ok');
                        window.location.href = mostUrgent.href;
                    } else {
                        if (startBtn) startBtn.textContent = 'Batal (' + secs + 's)';
                    }
                }, 1000);
            } else {
                var upcoming = allQuizzes.filter(function (q) { return !q.isDone; })[0];
                if (upcoming) {
                    var dueStr = upcoming.dueInfo ? upcoming.dueInfo.remainingText : 'tanpa batas waktu ketat';
                    log('🟡 [Auto Pilot] Kuis "' + upcoming.title + '" di "' + upcoming.courseName + '" belum jatuh tempo (' + dueStr + '). Menunggu konfirmasi...', 'info');
                    showPromptBox(
                        '⚠️ Konfirmasi Pengerjaan (Auto Pilot)',
                        'Kuis <b>' + upcoming.title + '</b> pada mata kuliah <b>' + upcoming.courseName + '</b> belum jatuh tempo (<b>' + dueStr + '</b>).<br>Apakah ingin dikerjakan sekarang?',
                        function () {
                            log('Membuka kuis "' + upcoming.title + '"...', 'ok');
                            window.location.href = upcoming.href;
                        },
                        function () {
                            log('User memilih nanti saja.', 'info');
                            setStatus('idle');
                        }
                    );
                }
            }
        }
    }

    function scanAllMyCourses() {
        if (isScanningMyCourses) return;
        isScanningMyCourses = true;

        var courses = getEnrolledCoursesFromPage();
        if (courses.length === 0) {
            log('Tidak ada daftar mata kuliah yang terdeteksi di halaman ini. Pastikan daftar mata kuliah sudah tampil.', 'warn');
            isScanningMyCourses = false;
            return;
        }

        log('🔍 [Auto Detect] Memulai pemindaian ' + courses.length + ' mata kuliah untuk mencari kuis...', 'info');
        setStatus('running');
        if (startBtn) {
            startBtn.className = 'running';
            startBtn.textContent = 'Memindai...';
        }

        var allQuizzes = [];
        var idx = 0;

        function scanNextCourse() {
            if (idx >= courses.length) {
                isScanningMyCourses = false;
                hasAutoScannedMyCourses = true;
                setStatus('idle');
                if (startBtn) {
                    startBtn.className = 'idle';
                    startBtn.textContent = 'Pindai Ulang';
                }
                renderMyCoursesQuizzes(allQuizzes, courses.length);
                return;
            }

            var c = courses[idx];
            idx++;
            log('[' + idx + '/' + courses.length + '] Memeriksa "' + c.name + '"...', 'info');

            fetch(c.url, { credentials: 'same-origin' })
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.text();
                })
                .then(function (html) {
                    var doc = new DOMParser().parseFromString(html, 'text/html');
                    var quizElements = Array.from(doc.querySelectorAll('li.activity.quiz, div.activity-item[data-activityname], a[href*="/mod/quiz/view.php"]'));
                    var seenHref = {};

                    for (var k = 0; k < quizElements.length; k++) {
                        var el = quizElements[k];
                        var link = el.tagName === 'A' ? el : el.querySelector('a[href*="/mod/quiz/view.php"]');
                        if (!link) continue;
                        var href = link.href;
                        if (seenHref[href]) continue;
                        seenHref[href] = true;

                        var title = (link.querySelector('.instancename') || link).textContent.replace(/\s+/g, ' ').trim();
                        var isDone = false;
                        var parentItem = link.closest('.activity, .activity-item') || el;
                        if (parentItem) {
                            var compTxt = (parentItem.innerText || '').toLowerCase();
                            if (compTxt.indexOf('done') !== -1 || compTxt.indexOf('selesai') !== -1 || compTxt.indexOf('completed') !== -1 ||
                                parentItem.querySelector('.completion-info .badge-success, [data-action="toggle-manual-completion"][data-value="1"]')) {
                                isDone = true;
                            }
                        }

                        var dueInfo = null;
                        if (parentItem) {
                            var datesEl = parentItem.querySelector('.activity-dates, .text-muted, .activity-information');
                            if (datesEl) {
                                var d = parseDueDateText(datesEl.innerText || '');
                                if (d) {
                                    var diffMs = d.getTime() - Date.now();
                                    var remainingHours = diffMs / (1000 * 60 * 60);
                                    var threshold = typeof cfg.urgentThresholdHours === 'number' ? cfg.urgentThresholdHours : 24;
                                    dueInfo = {
                                        date: d,
                                        remainingHours: remainingHours,
                                        remainingText: formatRemainingTime(diffMs),
                                        isUrgent: remainingHours <= threshold
                                    };
                                }
                            }
                        }

                        allQuizzes.push({
                            courseId: c.id,
                            courseName: c.name,
                            title: title,
                            href: href,
                            isDone: isDone,
                            dueInfo: dueInfo
                        });
                    }
                })
                .catch(function (err) {
                    log('Gagal memeriksa "' + c.name + '": ' + err.message, 'warn');
                })
                .then(function () {
                    setTimeout(scanNextCourse, 250);
                });
        }

        scanNextCourse();
    }

    function startAutoDetectMyCourses() {
        if (isScanningMyCourses || hasAutoScannedMyCourses) return;

        var initialCourses = getEnrolledCoursesFromPage();
        if (initialCourses.length > 0) {
            log('[Auto Detect] Ditemukan ' + initialCourses.length + ' mata kuliah. Memulai pemindaian kuis...', 'ok');
            setTimeout(function () {
                scanAllMyCourses();
            }, 600);
            return;
        }

        log('⏳ [Auto Detect] Menunggu daftar mata kuliah dimuat oleh Moodle...', 'info');

        var attempts = 0;
        var maxAttempts = 30; // 30 x 500ms = 15 detik

        function cleanup() {
            if (myCoursesRetryTimer) {
                clearInterval(myCoursesRetryTimer);
                myCoursesRetryTimer = null;
            }
            if (myCoursesObserver) {
                myCoursesObserver.disconnect();
                myCoursesObserver = null;
            }
        }

        function tryDetect() {
            attempts++;
            var courses = getEnrolledCoursesFromPage();
            if (courses.length > 0) {
                cleanup();
                log('[Auto Detect] Daftar mata kuliah siap (' + courses.length + ' matkul). Memulai pemindaian kuis otomatis...', 'ok');
                setTimeout(function () {
                    scanAllMyCourses();
                }, 600);
                return true;
            }
            if (attempts >= maxAttempts) {
                cleanup();
                log('Daftar mata kuliah belum tampil setelah 15 detik. Klik "Pindai Kuis Matkul" bila halaman telah selesai dimuat.', 'warn');
                return false;
            }
            return false;
        }

        if (typeof MutationObserver !== 'undefined') {
            var targetNode = document.querySelector('[data-region="courses-view"], #region-main, main, body') || document.body;
            myCoursesObserver = new MutationObserver(function () {
                tryDetect();
            });
            myCoursesObserver.observe(targetNode, { childList: true, subtree: true });
        }

        myCoursesRetryTimer = setInterval(function () {
            tryDetect();
        }, 500);
    }

    function handleMyCoursesPage() {
        if (!isMyCoursesPage()) return;

        log('Halaman My Courses terdeteksi.', 'info');
        if (startBtn) {
            startBtn.className = 'idle';
            startBtn.textContent = 'Pindai Kuis Matkul';
        }
        setStatus('idle');

        startAutoDetectMyCourses();
    }

    // ==================== SUMMARY PAGE & AUTO SUBMIT ====================
    function handleSummaryPage() {
        if (!isSummaryPage()) return;

        log('Halaman Summary of attempt terdeteksi.', 'info');
        if (startBtn) {
            startBtn.className = 'idle';
            startBtn.textContent = 'Submit Quiz (Alt+S)';
        }
        setStatus('idle');

        if (cfg.autoSubmit || cfg.autoQuiz) {
            var secs = 3;
            submitCountdown = true;
            if (startBtn) {
                startBtn.className = 'running';
                startBtn.textContent = 'Cancel (' + secs + 's)';
            }
            setStatus('running');
            log((cfg.autoQuiz ? '[Auto Pilot] ' : '') + 'Auto Submit aktif! Mengirim ujian dalam ' + secs + ' detik... (Tekan Alt+X untuk batal)', 'warn');

            submitTimer = setInterval(function () {
                secs--;
                if (secs <= 0) {
                    clearInterval(submitTimer);
                    submitTimer = null;
                    submitCountdown = false;
                    submitQuizAttempt();
                } else {
                    if (startBtn) startBtn.textContent = 'Cancel (' + secs + 's)';
                }
            }, 1000);
        } else {
            log('Auto Submit nonaktif. Tekan Alt+S atau klik tombol di atas untuk submit.', 'info');
        }
    }

    // ==================== KEYBOARD SHORTCUTS ENGINE ====================
    window.addEventListener('keydown', function (e) {
        // Alt + A -> Toggle Auto Pilot
        if (e.altKey && (e.code === 'KeyA' || e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            cfg.autoQuiz = !cfg.autoQuiz;
            saveConfig(cfg);
            var cb = document.getElementById('qbot-autoquiz');
            if (cb) cb.checked = cfg.autoQuiz;
            log(cfg.autoQuiz ? '[Auto Pilot] AKTIF — Deteksi kuis & utamakan jatuh tempo.' : '[Auto Pilot] NONAKTIF.', 'ok');
            clearPromptBox();
            evaluateCurrentPage();
        }
        // Alt + S -> Start / Resume / Submit
        else if (e.altKey && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            if (isSummaryPage()) {
                log('[Shortcut Alt+S] Submit triggered', 'ok');
                submitQuizAttempt();
                return;
            }
            if (isQuizViewPage()) {
                log('[Shortcut Alt+S] Start attempt triggered', 'ok');
                clearPromptBox();
                executeStartQuiz();
                return;
            }
            if (isMyCoursesPage()) {
                log('[Shortcut Alt+S] Scan My Courses triggered', 'ok');
                scanAllMyCourses();
                return;
            }
            if (paused) {
                log('[Shortcut Alt+S] Resume triggered', 'ok');
                resumeProcessing();
            } else if (!running) {
                log('[Shortcut Alt+S] Start triggered', 'ok');
                startProcessing();
            }
        }
        // Alt + P -> Pause
        else if (e.altKey && (e.code === 'KeyP' || e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            if (running && !paused) {
                log('[Shortcut Alt+P] Pause triggered', 'warn');
                pauseProcessing();
            }
        }
        // Alt + X -> Stop / Cancel Submit / Cancel View Countdown
        else if (e.altKey && (e.code === 'KeyX' || e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            if (isSummaryPage() && submitCountdown) {
                log('[Shortcut Alt+X] Cancel Submit triggered', 'warn');
                cancelSubmitCountdown();
                return;
            }
            if (viewCountdownTimer) {
                log('[Shortcut Alt+X] Cancel View Countdown triggered', 'warn');
                cancelViewCountdown();
                return;
            }
            if (running || paused) {
                log('[Shortcut Alt+X] Stop triggered', 'warn');
                stopProcessing();
            }
        }
        // Alt + H -> Toggle Panel Visibility
        else if (e.altKey && (e.code === 'KeyH' || e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            togglePanelVisibility();
        }
    });

    // ==================== AUTO START (OPTIONAL) ====================
    function scheduleAutoStart() {
        if (!cfg.autoStart && !cfg.autoQuiz) return;
        if (document.querySelectorAll('.que').length === 0) return;
        if (!PROVIDERS[cfg.provider].keyOptional && !cfg.apiKeys[cfg.provider]) return;
        startProcessing();
    }

    // ==================== PAGE EVALUATOR ====================
    function evaluateCurrentPage() {
        if (isSummaryPage()) {
            handleSummaryPage();
        } else if (isQuizViewPage()) {
            handleQuizViewPage();
        } else if (isCourseViewPage()) {
            handleCourseViewPage();
        } else if (isMyCoursesPage()) {
            handleMyCoursesPage();
        } else {
            var qCount = document.querySelectorAll('.que').length;
            if (qCount > 0) {
                log('Terdeteksi ' + qCount + ' soal di halaman ini.', 'info');
                if (cfg.autoQuiz || cfg.autoStart) {
                    scheduleAutoStart();
                }
            } else if (window.location.pathname.indexOf('/mod/quiz/attempt.php') !== -1) {
                var attemptRetry = 0;
                var pollQue = setInterval(function () {
                    attemptRetry++;
                    var count = document.querySelectorAll('.que').length;
                    if (count > 0) {
                        clearInterval(pollQue);
                        log('Terdeteksi ' + count + ' soal di halaman ini.', 'info');
                        if (cfg.autoQuiz || cfg.autoStart) {
                            scheduleAutoStart();
                        }
                    } else if (attemptRetry >= 10) {
                        clearInterval(pollQue);
                    }
                }, 500);
            }
        }
    }

    // ==================== INIT ====================
    loadConfigFromServer().then(function (loaded) {
        cfg = loaded;
        createPanel();
        console.log('[QBot Ready] SEB Proxy v4.1 Mode | Deteksi otomatis aktif');
        evaluateCurrentPage();
    });
})();
