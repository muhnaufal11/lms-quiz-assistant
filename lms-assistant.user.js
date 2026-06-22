// ==UserScript==
// @name         TelU LMS Quiz Assistant
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Quiz assistant for Telkom University Moodle LMS (Groq / Gemini / Claude / DeepSeek / Local AI)
// @author       Developer Matrix
// @match        https://lms.telkomuniversity.ac.id/mod/quiz/attempt.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      api.groq.com
// @connect      generativelanguage.googleapis.com
// @connect      api.anthropic.com
// @connect      api.deepseek.com
// @connect      localhost
// @connect      127.0.0.1
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ==================== PROMPTS ====================
    const SYS_SINGLE = 'You are a precise academic assistant. Analyze the quiz question and options. Reply with ONLY the single letter of the correct answer (e.g. B). No explanation, no extra text.';
    const SYS_MULTI = 'You are a precise academic assistant. Analyze the quiz question and options. Reply with ONLY the letters of ALL correct answers separated by commas (e.g. A, C). No explanation, no extra text.';

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
            buildRequest(sys, user, model, key) {
                return {
                    url: 'https://api.groq.com/openai/v1/chat/completions',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: user },
                        ],
                        temperature: 0.0,
                    }),
                };
            },
            parse(json) {
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
            buildRequest(sys, user, model, key) {
                // Gemma 3 error jika dikirim systemInstruction; gabung ke user content
                // (aman juga untuk Gemma 4 yang sebenarnya sudah mendukung systemInstruction)
                const isGemma = /^gemma/i.test(model);
                const body = {
                    contents: [{
                        role: 'user',
                        parts: [{ text: isGemma ? `${sys}\n\n${user}` : user }],
                    }],
                    generationConfig: { temperature: 0.0 },
                };
                if (!isGemma) {
                    body.systemInstruction = { parts: [{ text: sys }] };
                }
                return {
                    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                    headers: {
                        'x-goog-api-key': key,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify(body),
                };
            },
            parse(json) {
                if (json.error) throw new Error(json.error.message || 'API error');
                const cand = json.candidates && json.candidates[0];
                if (!cand) throw new Error('Tidak ada kandidat jawaban');
                if (cand.finishReason === 'SAFETY') throw new Error('Diblokir safety filter');
                const parts = (cand.content && cand.content.parts) || [];
                const text = parts.map(p => p.text || '').join('').trim();
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
            buildRequest(sys, user, model, key) {
                // Fungsi rahasia pembuat Session ID ala CLI
                function generateUUID() {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                }

                const sessionId = generateUUID();
                const requestId = generateUUID();

                return {
                    url: 'https://api.anthropic.com/v1/messages',
                    anonymous: true, // Menghindari bocornya cookie LMS Anda
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${key}`,
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
                        // INJEKSI BILLING HEADER CLI
                        system: [
                            {
                                type: "text",
                                text: "x-anthropic-billing-header: cc_version=2.1.183.175; cc_entrypoint=cli; cch=7fdd4;"
                            },
                            {
                                type: "text",
                                text: sys // Prompt instruksi kuis bawaan Tampermonkey
                            }
                        ],
                        messages: [{ role: 'user', content: user }],
                    }),
                };
            },
            parse(json) {
                if (json.type === 'error' || json.error) {
                    throw new Error((json.error && json.error.message) || 'API error');
                }
                const block = (json.content || []).find(b => b.type === 'text');
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
            buildRequest(sys, user, model, key) {
                return {
                    url: 'https://api.deepseek.com/chat/completions',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: user },
                        ],
                        temperature: 0.0,
                        stream: false,
                    }),
                };
            },
            parse(json) {
                if (json.error) throw new Error(json.error.message || 'API error');
                return json.choices[0].message.content.trim();
            },
        },

        local: {
            name: 'AI Lokal (Ollama/LM Studio)',
            keyHint: '(opsional, kosongkan jika tidak perlu)',
            keyUrl: 'https://ollama.com/download',
            keyOptional: true,   // tidak butuh API key
            custom: true,        // base URL & model diisi manual
            models: [
                // Sekadar saran autocomplete; bisa diketik bebas sesuai model yang ter-install
                { id: 'llama3.1', name: 'llama3.1' },
                { id: 'qwen2.5', name: 'qwen2.5' },
                { id: 'gemma2', name: 'gemma2' },
                { id: 'mistral', name: 'mistral' },
                { id: 'phi4', name: 'phi4' },
            ],
            buildRequest(sys, user, model, key) {
                const base = (cfg.localBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
                const headers = { 'Content-Type': 'application/json' };
                if (key) headers['Authorization'] = `Bearer ${key}`;
                return {
                    url: `${base}/chat/completions`,
                    headers,
                    data: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: user },
                        ],
                        temperature: 0.0,
                        stream: false,
                    }),
                };
            },
            parse(json) {
                if (json.error) throw new Error((json.error.message || json.error) + '');
                if (!json.choices || !json.choices[0]) throw new Error('Respon kosong / model belum di-load');
                return json.choices[0].message.content.trim();
            },
        },
    };

    const PROVIDER_KEYS = Object.keys(PROVIDERS);

    // ==================== CONFIG ====================
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

    function loadConfig() {
        const def = defaultConfig();
        try {
            const raw = JSON.parse(GM_getValue('qbot_config', '{}'));
            return {
                ...def,
                ...raw,
                apiKeys: { ...def.apiKeys, ...(raw.apiKeys || {}) },
                models: { ...def.models, ...(raw.models || {}) },
            };
        } catch {
            return def;
        }
    }

    function saveConfig(c) {
        GM_setValue('qbot_config', JSON.stringify(c));
    }

    let cfg = loadConfig();
    let running = false;
    let stopFlag = false;
    let countingDown = false;
    let countdownTimer = null;

    // ==================== STYLES ====================
    GM_addStyle(`
        #qbot-panel {
            position: fixed; top: 16px; right: 16px; width: 320px;
            background: #111827; border: 1px solid #1f2937; border-radius: 12px;
            color: #d1d5db; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 13px;
            z-index: 999999; box-shadow: 0 20px 60px rgba(0,0,0,.5); transition: all .3s ease;
        }
        #qbot-panel.minimized .qbot-body { display: none; }
        #qbot-panel.minimized { width: auto; }
        .qbot-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px; background: #1f2937; border-radius: 11px 11px 0 0;
            cursor: move; user-select: none;
        }
        #qbot-panel.minimized .qbot-header { border-radius: 11px; }
        .qbot-header h3 { margin: 0; font-size: 13px; font-weight: 600; color: #60a5fa; }
        .qbot-hbtn {
            background: none; border: none; color: #9ca3af; cursor: pointer;
            font-size: 16px; padding: 2px 6px; border-radius: 4px; line-height: 1;
        }
        .qbot-hbtn:hover { color: #fff; background: #374151; }
        .qbot-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
        .qbot-field { display: flex; flex-direction: column; gap: 4px; }
        .qbot-field label {
            font-size: 11px; color: #9ca3af; text-transform: uppercase;
            letter-spacing: .5px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;
        }
        .qbot-field label a { color: #60a5fa; text-transform: none; letter-spacing: 0; font-size: 10px; text-decoration: none; }
        .qbot-field label a:hover { text-decoration: underline; }
        .qbot-field input, .qbot-field select {
            background: #1f2937; border: 1px solid #374151; border-radius: 6px;
            padding: 7px 10px; color: #e5e7eb; font-size: 13px; outline: none; width: 100%; box-sizing: border-box;
        }
        .qbot-field input:focus, .qbot-field select:focus { border-color: #60a5fa; }
        .qbot-row { display: flex; align-items: center; justify-content: space-between; }
        .qbot-toggle { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
        .qbot-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .qbot-toggle .slider {
            position: absolute; inset: 0; background: #374151; border-radius: 10px;
            cursor: pointer; transition: .2s;
        }
        .qbot-toggle .slider::before {
            content: ''; position: absolute; width: 16px; height: 16px;
            left: 2px; bottom: 2px; background: #9ca3af; border-radius: 50%; transition: .2s;
        }
        .qbot-toggle input:checked + .slider { background: #2563eb; }
        .qbot-toggle input:checked + .slider::before { transform: translateX(16px); background: #fff; }
        #qbot-start {
            width: 100%; padding: 9px; border: none; border-radius: 8px;
            font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s;
        }
        #qbot-start.idle { background: #2563eb; color: #fff; }
        #qbot-start.idle:hover { background: #3b82f6; }
        #qbot-start.running { background: #dc2626; color: #fff; }
        #qbot-start.running:hover { background: #ef4444; }
        #qbot-start:disabled { opacity: .5; cursor: not-allowed; }
        #qbot-log {
            max-height: 200px; overflow-y: auto; background: #0b0f19; border-radius: 8px;
            padding: 8px 10px; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
            font-size: 11px; line-height: 1.7;
        }
        #qbot-log::-webkit-scrollbar { width: 4px; }
        #qbot-log::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
        .log-info { color: #9ca3af; }
        .log-ok { color: #34d399; }
        .log-warn { color: #fbbf24; }
        .log-err { color: #f87171; }
        .log-ai { color: #a78bfa; }
        .qbot-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b7280; }
        .qbot-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .qbot-dot.idle { background: #6b7280; }
        .qbot-dot.run { background: #34d399; animation: qpulse 1.5s infinite; }
        .qbot-dot.err { background: #f87171; }
        @keyframes qpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        .que.qbot-active { outline: 2px solid #fbbf24 !important; outline-offset: 3px; }
        .que.qbot-done { outline: 2px solid #34d399 !important; outline-offset: 3px; }
        .que.qbot-fail { outline: 2px solid #f87171 !important; outline-offset: 3px; }
        .qbot-key-wrap { position: relative; }
        .qbot-key-wrap input { padding-right: 36px; }
        .qbot-eye {
            position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
            background: none; border: none; color: #6b7280; cursor: pointer; font-size: 14px; padding: 2px;
        }
        .qbot-eye:hover { color: #d1d5db; }
    `);

    // ==================== HELPERS ====================
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function randomDelay(min = 6000, max = 35000) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function normalizeText(text) {
        return text.replace(/^[a-zA-Z][.):\s]+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function wordSimilarity(a, b) {
        const setA = new Set(a.split(/\s+/).filter(Boolean));
        const setB = new Set(b.split(/\s+/).filter(Boolean));
        if (setA.size === 0 && setB.size === 0) return 1;
        if (setA.size === 0 || setB.size === 0) return 0;
        let common = 0;
        for (const w of setA) { if (setB.has(w)) common++; }
        return common / Math.max(setA.size, setB.size);
    }

    // ==================== UI ====================
    let logEl, statusDot, statusText, startBtn, keyInput, modelSelect, keyLink;
    let baseUrlField, baseUrlInput, modelText, modelList;

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'qbot-panel';
        panel.innerHTML = `
            <div class="qbot-header" id="qbot-drag">
                <h3>Quiz Assistant</h3>
                <button class="qbot-hbtn" id="qbot-min" title="Minimize">&#x2014;</button>
            </div>
            <div class="qbot-body">
                <div class="qbot-field">
                    <label>Provider</label>
                    <select id="qbot-provider">
                        ${PROVIDER_KEYS.map(k => `<option value="${k}" ${k === cfg.provider ? 'selected' : ''}>${PROVIDERS[k].name}</option>`).join('')}
                    </select>
                </div>
                <div class="qbot-field" id="qbot-baseurl-field" style="display:none">
                    <label>Base URL</label>
                    <input type="text" id="qbot-baseurl" placeholder="http://localhost:11434/v1" />
                </div>
                <div class="qbot-field">
                    <label>API Key <a id="qbot-keylink" href="#" target="_blank" rel="noopener">dapatkan key</a></label>
                    <div class="qbot-key-wrap">
                        <input type="password" id="qbot-key" />
                        <button class="qbot-eye" id="qbot-eye" title="Show/Hide">&#128065;</button>
                    </div>
                </div>
                <div class="qbot-field">
                    <label>Model</label>
                    <select id="qbot-model"></select>
                    <input type="text" id="qbot-model-text" list="qbot-model-list" style="display:none" placeholder="nama model lokal (mis. llama3.1)" />
                    <datalist id="qbot-model-list"></datalist>
                </div>
                <div class="qbot-row">
                    <span style="font-size:12px;color:#9ca3af">Auto Next Page</span>
                    <label class="qbot-toggle">
                        <input type="checkbox" id="qbot-autonext" ${cfg.autoNext ? 'checked' : ''} />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="qbot-row">
                    <span style="font-size:12px;color:#9ca3af">Auto Start (saat load)</span>
                    <label class="qbot-toggle">
                        <input type="checkbox" id="qbot-autostart" ${cfg.autoStart ? 'checked' : ''} />
                        <span class="slider"></span>
                    </label>
                </div>
                <button id="qbot-start" class="idle">Start</button>
                <div class="qbot-status">
                    <span class="qbot-dot idle" id="qbot-dot"></span>
                    <span id="qbot-stxt">Idle</span>
                </div>
                <div id="qbot-log"></div>
            </div>
        `;
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

        document.getElementById('qbot-min').addEventListener('click', () => {
            panel.classList.toggle('minimized');
        });

        document.getElementById('qbot-eye').addEventListener('click', () => {
            keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
        });

        document.getElementById('qbot-provider').addEventListener('change', e => {
            cfg.provider = e.target.value;
            saveConfig(cfg);
            syncProviderUI();
            log(`Provider: ${PROVIDERS[cfg.provider].name}`, 'info');
        });

        keyInput.addEventListener('change', e => {
            cfg.apiKeys[cfg.provider] = e.target.value.trim();
            saveConfig(cfg);
        });

        modelSelect.addEventListener('change', e => {
            cfg.models[cfg.provider] = e.target.value;
            saveConfig(cfg);
        });

        modelText.addEventListener('change', e => {
            cfg.models[cfg.provider] = e.target.value.trim();
            saveConfig(cfg);
        });

        baseUrlInput.addEventListener('change', e => {
            cfg.localBaseUrl = e.target.value.trim() || 'http://localhost:11434/v1';
            saveConfig(cfg);
        });

        document.getElementById('qbot-autonext').addEventListener('change', e => {
            cfg.autoNext = e.target.checked;
            saveConfig(cfg);
        });

        document.getElementById('qbot-autostart').addEventListener('change', e => {
            cfg.autoStart = e.target.checked;
            saveConfig(cfg);
            log(cfg.autoStart ? 'Auto Start aktif.' : 'Auto Start nonaktif.', 'info');
        });

        startBtn.addEventListener('click', () => {
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
        const provider = PROVIDERS[cfg.provider];
        const isCustom = !!provider.custom;

        // Field Base URL hanya muncul untuk provider custom (AI lokal)
        baseUrlField.style.display = isCustom ? 'flex' : 'none';
        if (isCustom) baseUrlInput.value = cfg.localBaseUrl || 'http://localhost:11434/v1';

        keyInput.value = cfg.apiKeys[cfg.provider] || '';
        keyInput.placeholder = provider.keyHint;
        keyLink.href = provider.keyUrl;

        if (isCustom) {
            // Provider lokal: model diketik bebas (datalist hanya saran)
            modelSelect.style.display = 'none';
            modelText.style.display = 'block';
            modelList.innerHTML = provider.models.map(m => `<option value="${m.id}">`).join('');
            modelText.value = cfg.models[cfg.provider] || (provider.models[0] ? provider.models[0].id : '');
        } else {
            modelText.style.display = 'none';
            modelSelect.style.display = 'block';
            // Fallback bila model tersimpan tidak ada lagi di daftar (mis. model lama dihapus)
            if (!provider.models.some(m => m.id === cfg.models[cfg.provider])) {
                cfg.models[cfg.provider] = provider.models[0].id;
                saveConfig(cfg);
            }
            modelSelect.innerHTML = provider.models
                .map(m => `<option value="${m.id}" ${m.id === cfg.models[cfg.provider] ? 'selected' : ''}>${m.name}</option>`)
                .join('');
        }
    }

    function makeDraggable(el, handle) {
        let offsetX, offsetY, dragging = false;
        handle.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            dragging = true;
            offsetX = e.clientX - el.getBoundingClientRect().left;
            offsetY = e.clientY - el.getBoundingClientRect().top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            el.style.left = (e.clientX - offsetX) + 'px';
            el.style.top = (e.clientY - offsetY) + 'px';
            el.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => { dragging = false; });
    }

    function log(msg, type = 'info') {
        const cls = { info: 'log-info', ok: 'log-ok', warn: 'log-warn', error: 'log-err', ai: 'log-ai' };
        const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logEl.innerHTML += `<div class="${cls[type] || 'log-info'}">[${time}] ${msg}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(state) {
        statusDot.className = 'qbot-dot ' + (state === 'running' ? 'run' : state === 'error' ? 'err' : 'idle');
        const labels = { idle: 'Idle', running: 'Processing...', done: 'Done', error: 'Error', stopped: 'Stopped' };
        statusText.textContent = labels[state] || state;
    }

    function setButton(isRunning) {
        startBtn.className = isRunning ? 'running' : 'idle';
        startBtn.textContent = isRunning ? 'Stop' : 'Start';
    }

    // ==================== API ====================
    function rawRequest(req) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: req.url,
                headers: req.headers,
                data: req.data,
                timeout: 30000,
                onload(res) {
                    let json;
                    try {
                        json = JSON.parse(res.responseText);
                    } catch {
                        reject(`HTTP ${res.status}: respon tidak valid`);
                        return;
                    }
                    if (res.status < 200 || res.status >= 300) {
                        // Perbaikan pelaporan error agar memunculkan kode HTTP
                        const e = json.error || {};
                        const errType = e.type || 'unknown_error';
                        const errMsg = e.message || res.responseText;
                        reject(`HTTP ${res.status} [${errType}]: ${errMsg}`);
                        return;
                    }
                    resolve(json);
                },
                onerror(err) { reject('Network error: ' + (err.statusText || 'gagal konek')); },
                ontimeout() { reject('Request timeout'); },
            });
        });
    }

    async function callLLM(question, options, isMulti) {
        const provider = PROVIDERS[cfg.provider];
        const key = cfg.apiKeys[cfg.provider];
        const model = cfg.models[cfg.provider];
        const labels = options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
        const sys = isMulti ? SYS_MULTI : SYS_SINGLE;
        const user = `Question:\n${question}\n\nOptions:\n${labels}`;
        const json = await rawRequest(provider.buildRequest(sys, user, model, key));
        return provider.parse(json);
    }

    async function callLLMWithRetry(question, options, isMulti, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await callLLM(question, options, isMulti);
            } catch (err) {
                if (attempt === retries) throw err;
                log(`Retry ${attempt}/${retries}: ${err.message || err}`, 'warn');
                await sleep(1000 * attempt);
            }
        }
    }

    // ==================== ANSWER MATCHING ====================
    function parseLetters(response) {
        const cleaned = response.replace(/[^a-zA-Z,]/g, '');
        const letters = cleaned.split(',').map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]$/.test(s));
        if (letters.length > 0) return letters;
        const firstLetter = response.trim().match(/^([A-Za-z])/);
        if (firstLetter && /^[A-Z]$/i.test(firstLetter[1])) return [firstLetter[1].toUpperCase()];
        return [];
    }

    function matchAnswers(aiResponse, optionTexts) {
        const letters = parseLetters(aiResponse);
        if (letters.length > 0) {
            const indices = letters.map(l => l.charCodeAt(0) - 65).filter(i => i >= 0 && i < optionTexts.length);
            if (indices.length > 0) return { indices, method: 'letter' };
        }

        const normalized = normalizeText(aiResponse);
        for (let i = 0; i < optionTexts.length; i++) {
            if (normalizeText(optionTexts[i]) === normalized) return { indices: [i], method: 'exact' };
        }

        for (let i = 0; i < optionTexts.length; i++) {
            const norm = normalizeText(optionTexts[i]);
            if (norm.includes(normalized) || normalized.includes(norm)) {
                return { indices: [i], method: 'contains' };
            }
        }

        let bestIdx = -1, bestScore = 0;
        for (let i = 0; i < optionTexts.length; i++) {
            const score = wordSimilarity(normalizeText(optionTexts[i]), normalized);
            if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
        if (bestScore >= 0.4 && bestIdx >= 0) return { indices: [bestIdx], method: 'fuzzy' };

        return null;
    }

    // ==================== PROCESSOR ====================
    async function startProcessing() {
        const activeProvider = PROVIDERS[cfg.provider];
        if (!activeProvider.keyOptional && !cfg.apiKeys[cfg.provider]) {
            log(`API Key ${activeProvider.name} belum diisi!`, 'error');
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
        log(`Mulai (${PROVIDERS[cfg.provider].name} / ${cfg.models[cfg.provider]})`, 'ok');

        const questions = document.querySelectorAll('.que');
        if (questions.length === 0) {
            log('Tidak ada soal ditemukan di halaman ini.', 'warn');
            finish('done');
            return;
        }

        log(`Ditemukan ${questions.length} soal.`, 'info');

        for (let i = 0; i < questions.length; i++) {
            if (stopFlag) { finish('stopped'); return; }

            const qNode = questions[i];
            const qText = qNode.querySelector('.qtext');
            if (!qText) {
                log(`Soal ${i + 1}: tidak bisa dibaca, skip.`, 'warn');
                continue;
            }

            qNode.classList.remove('qbot-done', 'qbot-fail');
            qNode.classList.add('qbot-active');

            const questionText = qText.innerText.trim();
            log(`Soal ${i + 1}: ${questionText.substring(0, 60)}...`, 'info');

            const answerContainer = qNode.querySelector('.answer');
            if (!answerContainer) {
                qNode.classList.replace('qbot-active', 'qbot-fail');
                log(`Soal ${i + 1}: tidak ada pilihan jawaban.`, 'warn');
                continue;
            }

            const inputs = answerContainer.querySelectorAll('input[type="radio"], input[type="checkbox"]');
            const isMulti = inputs.length > 0 && inputs[0].type === 'checkbox';

            let optionTexts = [];
            let optionInputs = [];

            if (inputs.length > 0) {
                inputs.forEach(inp => {
                    const parent = inp.closest('.answer div, .answer label, .r0, .r1') || inp.parentElement;
                    const text = parent ? parent.innerText.trim() : '';
                    optionTexts.push(text);
                    optionInputs.push(inp);
                });
            } else {
                const divs = answerContainer.querySelectorAll('div, label');
                divs.forEach(d => {
                    const inp = d.querySelector('input[type="radio"], input[type="checkbox"]');
                    if (inp) {
                        optionTexts.push(d.innerText.trim());
                        optionInputs.push(inp);
                    }
                });
            }

            if (optionTexts.length === 0) {
                qNode.classList.replace('qbot-active', 'qbot-fail');
                log(`Soal ${i + 1}: gagal parsing opsi jawaban.`, 'error');
                continue;
            }

            try {
                const aiResponse = await callLLMWithRetry(questionText, optionTexts, isMulti);
                log(`AI: "${aiResponse}"`, 'ai');

                const match = matchAnswers(aiResponse, optionTexts);
                if (match) {
                    match.indices.forEach(idx => optionInputs[idx].click());
                    const letters = match.indices.map(idx => String.fromCharCode(65 + idx)).join(', ');
                    log(`Soal ${i + 1}: dipilih ${letters} (${match.method})`, 'ok');
                    qNode.classList.replace('qbot-active', 'qbot-done');
                } else {
                    log(`Soal ${i + 1}: gagal mencocokkan jawaban.`, 'error');
                    qNode.classList.replace('qbot-active', 'qbot-fail');
                }
            } catch (err) {
                log(`Soal ${i + 1}: ${err.message || err}`, 'error');
                qNode.classList.replace('qbot-active', 'qbot-fail');
            }

            if (i < questions.length - 1) {
                const d = randomDelay();
                log(`Delay ${d}ms...`, 'info');
                await sleep(d);
            }
        }

        if (stopFlag) { finish('stopped'); return; }

        if (cfg.autoNext) {
            const nextBtn = document.querySelector(
                'input[value="Next page"], input[value="Next"], input[id="mod_quiz-next-nav"], .submitbtns .mod_quiz-next-nav'
            );
            if (nextBtn) {
                const d = randomDelay(2500, 5000);
                log(`Next page dalam ${d}ms...`, 'info');
                await sleep(d);
                if (!stopFlag) {
                    log('Pindah ke halaman berikutnya.', 'ok');
                    nextBtn.click();
                    return;
                }
            } else {
                log('Tidak ada tombol Next. Semua halaman selesai.', 'ok');
            }
        }

        finish('done');
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
        let secs = 3;
        startBtn.className = 'running';
        startBtn.textContent = `Cancel (${secs}s)`;
        setStatus('running');
        statusText.textContent = 'Auto start...';
        log(`Auto start dalam ${secs} detik... klik Cancel untuk batal.`, 'warn');

        countdownTimer = setInterval(() => {
            secs--;
            if (secs <= 0) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                countingDown = false;
                startProcessing();
            } else {
                startBtn.textContent = `Cancel (${secs}s)`;
            }
        }, 1000);
    }

    // ==================== INIT ====================
    createPanel();
    log('Panel siap. Pilih provider, isi API Key, lalu Start.', 'info');

    const qCount = document.querySelectorAll('.que').length;
    if (qCount > 0) {
        log(`Terdeteksi ${qCount} soal di halaman ini.`, 'info');
    }

    scheduleAutoStart();
})();
