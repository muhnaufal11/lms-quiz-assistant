// ==UserScript==
// @name         TelU LMS Quiz Assistant
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Quiz assistant for Telkom University Moodle LMS (Groq / Gemini / Claude / DeepSeek / Local AI) — pilihan ganda + essay
// @author       Developer Matrix
// @match        https://lms.telkomuniversity.ac.id/mod/quiz/*
// @match        https://lms.telkomuniversity.ac.id/course/view.php*
// @match        https://lms.telkomuniversity.ac.id/my/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
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
            buildRequest(sys, user, model, key) {
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
                { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
                { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
                { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
            ],
            buildRequest(sys, user, model, key) {
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
                    anonymous: true,
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
                { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
                { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
                { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
                { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
                { id: 'deepseek-coder', name: 'DeepSeek Coder' },
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
            autoQuiz: false,
            urgentThresholdHours: 24,
            autoNext: true,
            autoStart: false,
            autoSubmit: false,
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
                autoQuiz: raw.autoQuiz !== undefined ? raw.autoQuiz : def.autoQuiz,
                urgentThresholdHours: typeof raw.urgentThresholdHours === 'number' ? raw.urgentThresholdHours : def.urgentThresholdHours,
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
            position: fixed; top: 18px; right: 18px; width: 330px;
            background: rgba(15, 23, 42, 0.94);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            color: #e2e8f0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
            font-size: 13px;
            z-index: 999999;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
            transition: box-shadow .3s ease, transform .2s ease;
            overflow: hidden;
        }
        #qbot-panel.minimized { width: auto; border-radius: 12px; }
        #qbot-panel.minimized .qbot-body { display: none; }
        .qbot-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 14px;
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            cursor: move; user-select: none;
        }
        #qbot-panel.minimized .qbot-header { border-bottom: none; }
        .qbot-header-left {
            display: flex; align-items: center; gap: 8px;
        }
        .qbot-header-badge {
            width: 22px; height: 22px; border-radius: 6px;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            display: inline-flex; align-items: center; justify-content: center;
            font-size: 11px; color: #fff; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
        }
        .qbot-header h3 {
            margin: 0; font-size: 13.5px; font-weight: 700;
            letter-spacing: -0.2px; color: #f8fafc;
        }
        .qbot-hbtn {
            background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.06);
            color: #94a3b8; cursor: pointer;
            width: 24px; height: 24px; border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; line-height: 1; transition: all .2s;
        }
        .qbot-hbtn:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.15); }
        .qbot-body { padding: 13px 14px; display: flex; flex-direction: column; gap: 9px; }
        .qbot-field { display: flex; flex-direction: column; gap: 4px; }
        .qbot-field label {
            font-size: 10.5px; color: #94a3b8; text-transform: uppercase;
            letter-spacing: .6px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;
        }
        .qbot-field label a {
            color: #818cf8; text-transform: none; letter-spacing: 0; font-size: 11px;
            font-weight: 500; text-decoration: none; transition: color .2s;
        }
        .qbot-field label a:hover { color: #a5b4fc; text-decoration: underline; }
        .qbot-field input, .qbot-field select {
            background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px; padding: 7px 11px; color: #f1f5f9; font-size: 12.5px;
            outline: none; width: 100%; box-sizing: border-box;
            transition: all .2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .qbot-field select {
            appearance: none; -webkit-appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            padding-right: 32px;
            cursor: pointer;
        }
        .qbot-field select option { background: #1e293b; color: #f1f5f9; }
        .qbot-field input:focus, .qbot-field select:focus {
            border-color: #6366f1; background: rgba(30, 41, 59, 0.9);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
        }
        .qbot-key-wrap { position: relative; }
        .qbot-key-wrap input { padding-right: 36px; }
        .qbot-eye {
            position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
            background: none; border: none; color: #64748b; cursor: pointer; font-size: 14px; padding: 3px;
            display: flex; align-items: center; justify-content: center; transition: color .2s;
        }
        .qbot-eye:hover { color: #cbd5e1; }

        /* Auto Pilot Hero Card */
        .qbot-card-autopilot {
            background: linear-gradient(135deg, rgba(37, 99, 235, 0.16) 0%, rgba(99, 102, 241, 0.08) 100%);
            border: 1px solid rgba(96, 165, 250, 0.28);
            border-radius: 11px;
            padding: 9px 11px;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.08);
            transition: all .25s ease;
        }
        .qbot-card-autopilot:hover {
            border-color: rgba(96, 165, 250, 0.45);
            box-shadow: 0 6px 18px rgba(37, 99, 235, 0.16);
        }

        /* Grouped Options */
        .qbot-options-group {
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 11px;
            padding: 8px 11px;
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        .qbot-opt-row {
            display: flex; align-items: center; justify-content: space-between;
        }
        .qbot-opt-label {
            font-size: 12px; font-weight: 500; color: #cbd5e1;
        }

        /* Modern Toggle */
        .qbot-row { display: flex; align-items: center; justify-content: space-between; }
        .qbot-toggle { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
        .qbot-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .qbot-toggle .slider {
            position: absolute; inset: 0; background: rgba(71, 85, 105, 0.6);
            border-radius: 20px; cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .qbot-toggle .slider::before {
            content: ''; position: absolute; width: 16px; height: 16px;
            left: 2px; bottom: 2px; background: #e2e8f0; border-radius: 50%;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        .qbot-toggle input:checked + .slider {
            background: linear-gradient(135deg, #2563eb, #6366f1);
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);
        }
        .qbot-toggle input:checked + .slider::before {
            transform: translateX(16px); background: #ffffff;
        }

        /* Main Action Button */
        #qbot-start {
            width: 100%; padding: 10px; border: none; border-radius: 10px;
            font-size: 13px; font-weight: 700; letter-spacing: 0.3px; cursor: pointer;
            transition: all .2s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        #qbot-start.idle {
            background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
            color: #ffffff;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }
        #qbot-start.idle:hover {
            background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.55);
            transform: translateY(-1px);
        }
        #qbot-start.running {
            background: linear-gradient(135deg, #dc2626 0%, #e11d48 100%);
            color: #ffffff;
            box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);
        }
        #qbot-start.running:hover {
            background: linear-gradient(135deg, #ef4444 0%, #f43f5e 100%);
            box-shadow: 0 6px 20px rgba(220, 38, 38, 0.55);
            transform: translateY(-1px);
        }
        #qbot-start:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Status Bar */
        .qbot-status {
            display: flex; align-items: center; gap: 7px; font-size: 11px;
            font-weight: 500; color: #94a3b8; padding: 1px 2px;
        }
        .qbot-dot {
            width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
            transition: all .3s ease;
        }
        .qbot-dot.idle {
            background: #64748b;
            box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.2);
        }
        .qbot-dot.run {
            background: #10b981;
            box-shadow: 0 0 8px #10b981, 0 0 0 3px rgba(16, 185, 129, 0.25);
            animation: qpulse 1.6s infinite;
        }
        .qbot-dot.err {
            background: #f43f5e;
            box-shadow: 0 0 8px #f43f5e, 0 0 0 3px rgba(244, 63, 94, 0.25);
        }
        @keyframes qpulse { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* Log Terminal */
        #qbot-log {
            max-height: 180px; overflow-y: auto;
            background: rgba(10, 15, 29, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 10px;
            padding: 9px 11px;
            font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
            font-size: 10.5px; line-height: 1.65;
            box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
        }
        #qbot-log::-webkit-scrollbar { width: 5px; }
        #qbot-log::-webkit-scrollbar-track { background: transparent; }
        #qbot-log::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        #qbot-log::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
        .log-info { color: #94a3b8; }
        .log-ok { color: #34d399; }
        .log-warn { color: #fbbf24; }
        .log-err { color: #f87171; }
        .log-ai { color: #a78bfa; }

        /* Questions Outline */
        .que.qbot-active { outline: 2px solid #fbbf24 !important; outline-offset: 3px; }
        .que.qbot-done { outline: 2px solid #34d399 !important; outline-offset: 3px; }
        .que.qbot-fail { outline: 2px solid #f87171 !important; outline-offset: 3px; }

        /* Prompt Dialog & Due Date Styles */
        .qbot-prompt-box {
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
            border: 1px solid rgba(245, 158, 11, 0.35);
            border-left: 4px solid #f59e0b;
            border-radius: 12px;
            padding: 12px 13px;
            margin: 4px 0;
            display: flex;
            flex-direction: column;
            gap: 9px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.1);
            animation: qfadein .25s ease-out;
        }
        .qbot-prompt-title {
            font-size: 12px; font-weight: 700; color: #fbbf24;
            display: flex; align-items: center; gap: 6px;
        }
        .qbot-prompt-msg {
            font-size: 11.5px; color: #e2e8f0; line-height: 1.55;
        }
        .qbot-prompt-btns { display: flex; gap: 8px; margin-top: 3px; }
        .qbot-btn-yes {
            flex: 1.2; padding: 7px 12px;
            background: linear-gradient(135deg, #2563eb, #4f46e5);
            color: #ffffff; border: none; border-radius: 8px;
            font-size: 11.5px; font-weight: 600; cursor: pointer;
            transition: all .2s ease;
            box-shadow: 0 3px 10px rgba(37, 99, 235, 0.35);
        }
        .qbot-btn-yes:hover {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            box-shadow: 0 5px 15px rgba(37, 99, 235, 0.5);
            transform: translateY(-1px);
        }
        .qbot-btn-no {
            flex: 1; padding: 7px 12px;
            background: rgba(51, 65, 85, 0.6); color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px; font-size: 11.5px; font-weight: 600;
            cursor: pointer; transition: all .2s ease;
        }
        .qbot-btn-no:hover {
            background: rgba(71, 85, 105, 0.85); color: #ffffff;
        }

        /* Dashboard & Timeline Items */
        .qbot-dashboard-box {
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8));
            border: 1px solid rgba(96, 165, 250, 0.25);
            border-radius: 12px; padding: 10px 12px; margin: 4px 0;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        }
        .qbot-quiz-item {
            background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column;
            gap: 5px; font-size: 11px; transition: all .2s ease;
        }
        .qbot-quiz-item:hover {
            background: rgba(30, 41, 59, 0.9); border-color: rgba(96, 165, 250, 0.3);
            transform: translateY(-1px);
        }
        .qbot-quiz-item-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .qbot-quiz-item-title { font-weight: 600; color: #f1f5f9; word-break: break-word; }
        .qbot-quiz-item-due { color: #94a3b8; font-size: 10px; }
        .qbot-quiz-item-btn {
            align-self: flex-start; margin-top: 3px; padding: 4px 9px;
            background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff;
            border-radius: 6px; text-decoration: none; font-size: 10.5px; font-weight: 600;
            transition: all .2s; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
        }
        .qbot-quiz-item-btn:hover {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.5);
        }

        .qbot-badge {
            display: inline-flex; align-items: center; padding: 2px 7px;
            border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.2px;
        }
        .qbot-badge-urgent {
            background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35);
        }
        .qbot-badge-normal {
            background: rgba(245, 158, 11, 0.15); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .qbot-badge-done {
            background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.35);
        }
        @keyframes qfadein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
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
                <div class="qbot-header-left">
                    <span class="qbot-header-badge">✦</span>
                    <h3>Quiz Assistant</h3>
                </div>
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
                <div class="qbot-card-autopilot">
                    <div class="qbot-row">
                        <div>
                            <div style="font-size:12px;font-weight:700;color:#93c5fd;display:flex;align-items:center;gap:4px">
                                <span>⚡</span> Auto Pilot Kuis <span style="font-size:10px;font-weight:500;color:#60a5fa;opacity:0.85">(Alt+A)</span>
                            </div>
                            <div style="font-size:10px;color:#94a3b8;margin-top:2px">Deteksi & prioritaskan jatuh tempo</div>
                        </div>
                        <label class="qbot-toggle">
                            <input type="checkbox" id="qbot-autoquiz" ${cfg.autoQuiz ? 'checked' : ''} />
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="qbot-options-group">
                    <div class="qbot-opt-row">
                        <span class="qbot-opt-label">Auto Next Page</span>
                        <label class="qbot-toggle">
                            <input type="checkbox" id="qbot-autonext" ${cfg.autoNext ? 'checked' : ''} />
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="qbot-opt-row">
                        <span class="qbot-opt-label">Auto Start (saat load)</span>
                        <label class="qbot-toggle">
                            <input type="checkbox" id="qbot-autostart" ${cfg.autoStart ? 'checked' : ''} />
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="qbot-opt-row">
                        <span class="qbot-opt-label">Auto Submit (Summary)</span>
                        <label class="qbot-toggle">
                            <input type="checkbox" id="qbot-autosubmit" ${cfg.autoSubmit ? 'checked' : ''} />
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div id="qbot-prompt-box-area"></div>
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

        document.getElementById('qbot-autoquiz').addEventListener('change', e => {
            cfg.autoQuiz = e.target.checked;
            saveConfig(cfg);
            log(cfg.autoQuiz ? '[Auto Pilot] AKTIF — Deteksi kuis & utamakan jatuh tempo.' : '[Auto Pilot] NONAKTIF.', 'info');
            clearPromptBox();
            evaluateCurrentPage();
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

        document.getElementById('qbot-autosubmit').addEventListener('change', e => {
            cfg.autoSubmit = e.target.checked;
            saveConfig(cfg);
            log(cfg.autoSubmit ? 'Auto Submit aktif.' : 'Auto Submit nonaktif.', 'info');
        });

        startBtn.addEventListener('click', () => {
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
            // Fallback bila model tersimpan tidak ada di daftar default, pertahankan agar tidak hilang
            if (!provider.models.some(m => m.id === cfg.models[cfg.provider])) {
                if (cfg.models[cfg.provider]) {
                    provider.models.unshift({ id: cfg.models[cfg.provider], name: cfg.models[cfg.provider] });
                } else {
                    cfg.models[cfg.provider] = provider.models[0].id;
                    saveConfig(cfg);
                }
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

    // mode: 'single' | 'multi' | 'essay'
    async function callLLM(question, options, mode) {
        const provider = PROVIDERS[cfg.provider];
        const key = cfg.apiKeys[cfg.provider];
        const model = cfg.models[cfg.provider];
        let sys, user;
        if (mode === 'essay') {
            sys = SYS_ESSAY;
            user = `Essay question:\n${question}`;
        } else if (mode === 'short') {
            sys = SYS_SHORT;
            user = `Question:\n${question}`;
        } else {
            sys = mode === 'multi' ? SYS_MULTI : SYS_SINGLE;
            const labels = options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');
            user = `Question:\n${question}\n\nOptions:\n${labels}`;
        }
        const json = await rawRequest(provider.buildRequest(sys, user, model, key));
        return provider.parse(json);
    }

    async function callLLMWithRetry(question, options, mode, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await callLLM(question, options, mode);
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

    // ==================== ESSAY FILLING ====================
    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Teks polos -> HTML: baris kosong jadi paragraf, newline tunggal jadi <br>
    function textToHtml(text) {
        return text.split(/\n{2,}/)
            .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    function fireInput(el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Isi jawaban essay ke editor Moodle: textarea polos, Atto (contenteditable),
    // atau TinyMCE (API global / iframe). Selalu isi textarea tersembunyi juga
    // karena itu yang benar-benar disubmit form.
    function fillEssay(qNode, text) {
        const html = textToHtml(text);
        let richHandled = false;

        // Strategi 1: TinyMCE via API global. Di Tampermonkey, global halaman
        // diakses lewat unsafeWindow (sandbox), bukan window.
        const pageWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        try {
            if (pageWin.tinymce && pageWin.tinymce.editors && pageWin.tinymce.editors.length) {
                pageWin.tinymce.editors.forEach(ed => {
                    const ta = ed.getElement && ed.getElement();
                    if (ta && qNode.contains(ta)) {
                        ed.setContent(html);
                        if (ed.save) ed.save();
                        richHandled = true;
                    }
                });
            }
        } catch (e) {}

        // Strategi 2: Atto / contenteditable
        const editable = qNode.querySelector('[contenteditable="true"], .editor_atto_content');
        if (editable) {
            editable.innerHTML = html;
            fireInput(editable);
            richHandled = true;
        }

        // Strategi 3: TinyMCE iframe (kalau API global tak terjangkau)
        if (!richHandled) {
            const iframe = qNode.querySelector('iframe');
            if (iframe) {
                try {
                    const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                    if (doc && doc.body) {
                        doc.body.innerHTML = html;
                        fireInput(doc.body);
                        richHandled = true;
                    }
                } catch (e) {}
            }
        }

        // Strategi 4: textarea (form field sebenarnya)
        const textarea = qNode.querySelector('textarea');
        if (textarea) {
            textarea.value = richHandled ? html : text;
            fireInput(textarea);
            return true;
        }

        return richHandled;
    }

    // Isi jawaban isian singkat (short answer / numerical) ke input teks.
    function fillShort(qNode, text) {
        const answer = text.trim().replace(/^["'\s]+|["'\s.]+$/g, '');
        const input = qNode.querySelector(
            '.answer input[type="text"], .answer input[type="number"], .answer input:not([type])'
        );
        if (input) {
            input.focus();
            input.value = answer;
            fireInput(input);
            return true;
        }
        const ta = qNode.querySelector('textarea');
        if (ta) { ta.value = answer; fireInput(ta); return true; }
        return false;
    }

    // ==================== QUESTION TYPE & TEXT ====================
    // 'single' | 'multi' | 'essay' | 'short' | 'unknown'
    function detectMode(qNode) {
        const cls = qNode.classList;
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

    function cloneReplace(el, str) {
        if (el.parentNode) el.parentNode.replaceChild(document.createTextNode(str), el);
    }

    // Ekstrak teks soal TERMASUK rumus. innerText melewatkan MathJax (script
    // math/tex), MathML, dan rumus yang dirender sebagai <img alt="...">.
    function extractQuestionText(qNode) {
        const src = qNode.querySelector('.qtext') || qNode;
        const clone = src.cloneNode(true);

        clone.querySelectorAll('script[type^="math/tex"]').forEach(s => {
            cloneReplace(s, ' ' + (s.textContent || '') + ' ');
        });
        clone.querySelectorAll('mjx-container').forEach(c => {
            const mml = c.querySelector('math');
            const tex = c.getAttribute('aria-label') || (mml ? mml.textContent : '') || '';
            cloneReplace(c, ' ' + tex + ' ');
        });
        clone.querySelectorAll('.MathJax_Preview, span.MathJax').forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        clone.querySelectorAll('img').forEach(img => {
            const alt = img.getAttribute('alt');
            if (alt && alt.trim()) cloneReplace(img, ' ' + alt + ' ');
        });

        return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
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

            const questionText = extractQuestionText(qNode);
            log(`Soal ${i + 1}: ${questionText.substring(0, 60)}...`, 'info');

            const mode = detectMode(qNode);

            // ----- ESSAY -----
            if (mode === 'essay') {
                log(`Soal ${i + 1}: tipe essay, menulis jawaban...`, 'info');
                try {
                    const answer = await callLLMWithRetry(questionText, [], 'essay');
                    log(`AI: "${answer.substring(0, 70).replace(/\s+/g, ' ')}..."`, 'ai');
                    if (fillEssay(qNode, answer)) {
                        log(`Soal ${i + 1}: jawaban essay diisi (${answer.length} karakter)`, 'ok');
                        qNode.classList.replace('qbot-active', 'qbot-done');
                    } else {
                        log(`Soal ${i + 1}: kolom jawaban essay tidak ditemukan.`, 'error');
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
                continue;
            }

            // ----- ISIAN SINGKAT (short answer / numerical) -----
            if (mode === 'short') {
                log(`Soal ${i + 1}: tipe isian singkat...`, 'info');
                try {
                    const answer = await callLLMWithRetry(questionText, [], 'short');
                    log(`AI: "${answer.replace(/\s+/g, ' ')}"`, 'ai');
                    if (fillShort(qNode, answer)) {
                        log(`Soal ${i + 1}: jawaban diisi.`, 'ok');
                        qNode.classList.replace('qbot-active', 'qbot-done');
                    } else {
                        log(`Soal ${i + 1}: kolom jawaban tidak ditemukan.`, 'error');
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
                continue;
            }

            if (mode === 'unknown') {
                qNode.classList.replace('qbot-active', 'qbot-fail');
                log(`Soal ${i + 1}: tipe soal tidak dikenali, skip.`, 'warn');
                continue;
            }

            // ----- PILIHAN (radio/checkbox) -----
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
                const aiResponse = await callLLMWithRetry(questionText, optionTexts, isMulti ? 'multi' : 'single');
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

        if (cfg.autoNext || cfg.autoQuiz) {
            const nextBtn = document.querySelector(
                'input[value="Next page"], input[value="Next"], input[id="mod_quiz-next-nav"], .submitbtns .mod_quiz-next-nav, ' +
                'input[value*="Finish attempt"], input[value*="Selesaikan"], button[id="mod_quiz-next-nav"]'
            );
            if (nextBtn) {
                const isFinish = (nextBtn.value || nextBtn.innerText || '').toLowerCase().includes('finish') ||
                               (nextBtn.value || nextBtn.innerText || '').toLowerCase().includes('selesai');
                const d = randomDelay(2500, 5000);
                log(`${isFinish ? 'Menuju halaman Summary' : 'Next page'} dalam ${d}ms...`, 'info');
                await sleep(d);
                if (!stopFlag) {
                    log(isFinish ? 'Membuka halaman Summary...' : 'Pindah ke halaman berikutnya.', 'ok');
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

    // ==================== SUMMARY PAGE & AUTO SUBMIT ====================
    let submitTimer = null;
    let submitCountdown = false;

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
        log('Auto submit dibatalkan oleh user.', 'warn');
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
        let submitBtn = null;
        const candidates = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], .submitbtns a, .submitbtns button'));
        for (const el of candidates) {
            const txt = (el.innerText || el.value || '').toLowerCase().trim();
            if (txt.includes('submit all and finish') || txt.includes('kirim semua dan selesai')) {
                submitBtn = el;
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
        submitBtn.click();

        // 2. Moodle memunculkan dialog/modal konfirmasi
        let attempts = 0;
        const maxAttempts = 20; // 4 detik
        const checkModal = setInterval(() => {
            attempts++;

            let modalBtn = null;
            const modalCandidates = document.querySelectorAll(
                '.modal.show button, .modal.show input[type="button"], .modal.show input[type="submit"], ' +
                '.moodle-dialogue-bd button, .moodle-dialogue-bd input[type="button"], ' +
                'div[role="dialog"] button, [data-action="save"]'
            );

            for (const mb of modalCandidates) {
                const mtxt = (mb.innerText || mb.value || '').toLowerCase().trim();
                const action = mb.getAttribute('data-action') || '';
                if (action === 'save' || mtxt.includes('submit all') || mtxt.includes('kirim semua')) {
                    modalBtn = mb;
                    break;
                }
            }

            if (!modalBtn) {
                const primary = document.querySelector('.modal.show .btn-primary, div[role="dialog"] .btn-primary');
                if (primary) {
                    const ptxt = (primary.innerText || primary.value || '').toLowerCase();
                    if (!ptxt.includes('cancel') && !ptxt.includes('batal')) {
                        modalBtn = primary;
                    }
                }
            }

            if (modalBtn) {
                clearInterval(checkModal);
                log('Modal konfirmasi terdeteksi, mengonfirmasi submit final...', 'ok');
                modalBtn.click();
                setStatus('done');
                if (startBtn) {
                    startBtn.className = 'idle';
                    startBtn.textContent = 'Submitted';
                }
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(checkModal);
                const form = document.querySelector('form[action*="processattempt.php"]');
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

    // ==================== SIMULATED TRUSTED CLICK ====================
    function simulateTrustedClick(el) {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const evt = new MouseEvent('click', {
            clientX: rect.left + (rect.width / 2),
            clientY: rect.top + (rect.height / 2),
            bubbles: true,
            cancelable: true,
            view: window
        });
        el.dispatchEvent(evt);
        try { el.click(); } catch (e) {}
    }

    // ==================== DUE DATE PARSER & FORMATTER ====================
    function parseDueDateText(text) {
        if (!text) return null;
        const months = {
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

        const m = text.match(/(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?[,\s]+(?:pukul\s+)?(\d{1,2})[:.](\d{2})(?:\s*([ap]\.?m\.?))?/i);
        if (m) {
            const day = parseInt(m[1], 10);
            const mName = m[2].toLowerCase();
            const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
            let hour = parseInt(m[4], 10);
            const min = parseInt(m[5], 10);
            const ampm = m[6] ? m[6].toLowerCase().replace(/\./g, '') : null;
            if (months.hasOwnProperty(mName)) {
                if (ampm === 'pm' && hour < 12) hour += 12;
                if (ampm === 'am' && hour === 12) hour = 0;
                const d = new Date(year, months[mName], day, hour, min, 0);
                if (!isNaN(d.getTime())) return d;
            }
        }

        const m2 = text.match(/([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(?:(\d{4})[,\s]+)?(?:at\s+)?(\d{1,2})[:.](\d{2})(?:\s*([ap]\.?m\.?))?/i);
        if (m2) {
            const mName2 = m2[1].toLowerCase();
            const day2 = parseInt(m2[2], 10);
            const year2 = m2[3] ? parseInt(m2[3], 10) : new Date().getFullYear();
            let hour2 = parseInt(m2[4], 10);
            const min2 = parseInt(m2[5], 10);
            const ampm2 = m2[6] ? m2[6].toLowerCase().replace(/\./g, '') : null;
            if (months.hasOwnProperty(mName2)) {
                if (ampm2 === 'pm' && hour2 < 12) hour2 += 12;
                if (ampm2 === 'am' && hour2 === 12) hour2 = 0;
                const d2 = new Date(year2, months[mName2], day2, hour2, min2, 0);
                if (!isNaN(d2.getTime())) return d2;
            }
        }

        const parsed = Date.parse(text);
        if (!isNaN(parsed)) return new Date(parsed);
        return null;
    }

    function formatRemainingTime(ms) {
        if (ms < 0) return 'Sudah lewat deadline';
        const totalMinutes = Math.floor(ms / (1000 * 60));
        const totalHours = Math.floor(totalMinutes / 60);
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        const minutes = totalMinutes % 60;
        if (days > 0) {
            return `${days} hari ${hours > 0 ? `${hours} jam lagi` : 'lagi'}`;
        }
        if (hours > 0) {
            return `${hours} jam ${minutes > 0 ? `${minutes} mnt lagi` : 'lagi'}`;
        }
        return `${totalMinutes} menit lagi`;
    }

    function extractQuizDueDate() {
        const candidates = Array.from(document.querySelectorAll('.quizinfo, .box.py-3, [data-region="activity-dates"], #region-main, div[role="main"]'));
        for (const cand of candidates) {
            const lines = (cand.innerText || '').split('\n');
            for (const rawLine of lines) {
                const line = rawLine.trim();
                const lower = line.toLowerCase();
                if (lower.includes('close') || lower.includes('ditutup') || lower.includes('due') || lower.includes('batas waktu') || lower.includes('jatuh tempo')) {
                    const d = parseDueDateText(line);
                    if (d) {
                        const diffMs = d.getTime() - Date.now();
                        const remainingHours = diffMs / (1000 * 60 * 60);
                        const threshold = typeof cfg.urgentThresholdHours === 'number' ? cfg.urgentThresholdHours : 24;
                        const isUrgent = remainingHours <= threshold;
                        return {
                            date: d,
                            rawText: line,
                            remainingHours,
                            remainingText: formatRemainingTime(diffMs),
                            isUrgent
                        };
                    }
                }
            }
        }
        return null;
    }

    function findStartAttemptButton() {
        const selectors = [
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
        for (const s of selectors) {
            const el = document.querySelector(s);
            if (el) return el;
        }
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a.btn'));
        for (const b of buttons) {
            const txt = (b.innerText || b.value || '').toLowerCase();
            if (txt.includes('attempt quiz') || txt.includes('kerjakan kuis') ||
                txt.includes('continue the last attempt') || txt.includes('lanjutkan pengerjaan') ||
                txt.includes('re-attempt') || txt.includes('kerjakan ulang') ||
                txt.includes('preview quiz') || txt.includes('lihat pratinjau')) {
                return b;
            }
        }
        return null;
    }

    function confirmStartModal() {
        return new Promise(resolve => {
            let attempts = 0;
            const maxAttempts = 20;
            const interval = setInterval(() => {
                attempts++;
                const modalCandidates = document.querySelectorAll(
                    '#confirmstartmodal button, #confirmstartmodal input[type="submit"], ' +
                    '.modal.show button, .modal.show input[type="submit"], ' +
                    'div[role="dialog"] button, div[role="dialog"] input[type="submit"], ' +
                    '[data-action="save"]'
                );
                for (const btn of modalCandidates) {
                    const txt = (btn.innerText || btn.value || '').toLowerCase();
                    const action = btn.getAttribute('data-action') || '';
                    if (action === 'save' || txt.includes('start attempt') || txt.includes('mulai pengerjaan') || txt.includes('start') || txt.includes('mulai')) {
                        clearInterval(interval);
                        log('Modal konfirmasi terdeteksi, mengonfirmasi mulai kuis...', 'ok');
                        simulateTrustedClick(btn);
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
        const startBtnEl = findStartAttemptButton();
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
        confirmStartModal();
    }

    function showPromptBox(title, message, onYes, onNo) {
        const container = document.getElementById('qbot-prompt-box-area');
        if (!container) return;
        const cleanTitle = title.replace(/^⚠️\s*/, '');
        container.innerHTML = `
            <div class="qbot-prompt-box">
                <div class="qbot-prompt-title">
                    <span style="font-size:13px">⚠️</span>
                    <span>${cleanTitle}</span>
                </div>
                <div class="qbot-prompt-msg">${message}</div>
                <div class="qbot-prompt-btns">
                    <button class="qbot-btn-yes" id="qbot-btn-prompt-yes">Ya, Kerjakan Sekarang</button>
                    <button class="qbot-btn-no" id="qbot-btn-prompt-no">Nanti Saja</button>
                </div>
            </div>
        `;
        document.getElementById('qbot-btn-prompt-yes').addEventListener('click', () => {
            container.innerHTML = '';
            if (typeof onYes === 'function') onYes();
        });
        document.getElementById('qbot-btn-prompt-no').addEventListener('click', () => {
            container.innerHTML = '';
            if (typeof onNo === 'function') onNo();
        });
    }

    function clearPromptBox() {
        const container = document.getElementById('qbot-prompt-box-area');
        if (container) container.innerHTML = '';
    }

    // ==================== QUIZ VIEW PAGE HANDLER ====================
    let viewCountdownTimer = null;
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

    let quizViewRetryCount = 0;
    function handleQuizViewPage() {
        if (!isQuizViewPage()) return;

        const titleEl = document.querySelector('.page-header-headings h1, #region-main h2, h2.main, .breadcrumb-item:last-child');
        const quizTitle = titleEl ? titleEl.textContent.trim() : document.title.replace(/\|.*/, '').trim();

        const dueInfo = extractQuizDueDate();
        const startBtnEl = findStartAttemptButton();

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
            log(`Kuis terdeteksi: "${quizTitle}". Kuis ini sudah selesai atau tidak ada attempt yang dapat dimulai.`, 'info');
            setStatus('done');
            return;
        }
        quizViewRetryCount = 0;

        const pwInput = document.querySelector('#id_quizpassword, input[name="quizpassword"]');
        if (pwInput && !pwInput.value.trim()) {
            log(`⚠️ Kuis "${quizTitle}" memerlukan password. Silakan isi password pada formulir terlebih dahulu.`, 'warn');
            setStatus('idle');
            return;
        }

        if (cfg.autoQuiz) {
            if (dueInfo && !dueInfo.isUrgent) {
                log(`🟡 [Auto Pilot] Kuis "${quizTitle}" terdeteksi. Batas waktu masih lama (${dueInfo.remainingText}). Menunggu konfirmasi...`, 'info');
                showPromptBox(
                    '⚠️ Konfirmasi Pengerjaan (Auto Pilot)',
                    `Kuis <b>${quizTitle}</b> batas waktunya masih <b>${dueInfo.remainingText}</b> (${dueInfo.date ? dueInfo.date.toLocaleString('id-ID') : ''}).<br>Apakah ingin dikerjakan sekarang?`,
                    () => {
                        log('User memilih untuk mengerjakan sekarang.', 'ok');
                        executeStartQuiz();
                    },
                    () => {
                        log('User memilih nanti saja. Kuis dilewati.', 'info');
                        setStatus('idle');
                    }
                );
            } else {
                const reason = dueInfo ? `Batas waktu: ${dueInfo.remainingText}` : 'Siap dikerjakan';
                log(`🔴 [Auto Pilot] Kuis MENDESAK: "${quizTitle}" (${reason})! Memulai pengerjaan otomatis dalam 3 detik...`, 'warn');
                let secs = 3;
                if (startBtn) {
                    startBtn.className = 'running';
                    startBtn.textContent = `Batal (${secs}s)`;
                }
                setStatus('running');

                viewCountdownTimer = setInterval(() => {
                    secs--;
                    if (secs <= 0) {
                        clearInterval(viewCountdownTimer);
                        viewCountdownTimer = null;
                        executeStartQuiz();
                    } else {
                        if (startBtn) startBtn.textContent = `Batal (${secs}s)`;
                    }
                }, 1000);
            }
        } else {
            const dueStr = dueInfo ? ` (Deadline: ${dueInfo.remainingText})` : '';
            log(`Kuis terdeteksi: "${quizTitle}"${dueStr}. Tekan Alt+S atau klik "Mulai Kuis" untuk mulai.`, 'info');
            setStatus('idle');
        }
    }

    // ==================== COURSE VIEW PAGE HANDLER ====================
    function handleCourseViewPage() {
        if (!isCourseViewPage()) return;

        const quizElements = Array.from(document.querySelectorAll('li.activity.quiz, div.activity-item[data-activityname], a[href*="/mod/quiz/view.php"]'));
        const foundQuizzes = [];
        const seenUrls = {};

        for (const el of quizElements) {
            const link = el.tagName === 'A' ? el : el.querySelector('a[href*="/mod/quiz/view.php"]');
            if (!link) continue;
            const href = link.href;
            if (seenUrls[href]) continue;
            seenUrls[href] = true;

            const title = (link.querySelector('.instancename') || link).textContent.replace(/\s+/g, ' ').trim();
            let isDone = false;
            const parentItem = link.closest('.activity, .activity-item') || el;
            if (parentItem) {
                const compTxt = (parentItem.innerText || '').toLowerCase();
                if (compTxt.includes('done') || compTxt.includes('selesai') || compTxt.includes('completed') ||
                    parentItem.querySelector('.completion-info .badge-success, [data-action="toggle-manual-completion"][data-value="1"]')) {
                    isDone = true;
                }
            }

            let dueInfo = null;
            if (parentItem) {
                const datesEl = parentItem.querySelector('.activity-dates, .text-muted, .activity-information');
                if (datesEl) {
                    const d = parseDueDateText(datesEl.innerText || '');
                    if (d) {
                        const diffMs = d.getTime() - Date.now();
                        const remainingHours = diffMs / (1000 * 60 * 60);
                        const threshold = typeof cfg.urgentThresholdHours === 'number' ? cfg.urgentThresholdHours : 24;
                        dueInfo = {
                            date: d,
                            remainingHours,
                            remainingText: formatRemainingTime(diffMs),
                            isUrgent: remainingHours <= threshold
                        };
                    }
                }
            }

            foundQuizzes.push({
                title,
                href,
                isDone,
                dueInfo
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

        foundQuizzes.sort((a, b) => {
            if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
            const aH = a.dueInfo ? a.dueInfo.remainingHours : 999999;
            const bH = b.dueInfo ? b.dueInfo.remainingHours : 999999;
            return aH - bH;
        });

        log(`[Auto Detect] Terdeteksi ${foundQuizzes.length} kuis di mata kuliah ini (diurutkan prioritas deadline).`, 'ok');

        const container = document.getElementById('qbot-prompt-box-area');
        if (container) {
            let html = `
                <div class="qbot-dashboard-box">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-weight:700;font-size:12px;color:#93c5fd;display:flex;align-items:center;gap:4px">📚 Kuis di Mata Kuliah Ini</span>
                        <span style="font-size:10px;color:#94a3b8;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px">${foundQuizzes.length} Kuis</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;padding-right:2px">`;
            for (const q of foundQuizzes) {
                const badgeClass = q.isDone ? 'qbot-badge-done' : (q.dueInfo && q.dueInfo.isUrgent ? 'qbot-badge-urgent' : 'qbot-badge-normal');
                const badgeText = q.isDone ? 'Selesai' : (q.dueInfo ? q.dueInfo.remainingText : 'Tersedia');

                html += `
                    <div class="qbot-quiz-item">
                        <div class="qbot-quiz-item-head">
                            <span class="qbot-quiz-item-title">${q.title}</span>
                            <span class="qbot-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">
                            <span class="qbot-quiz-item-due">${q.dueInfo ? 'Batas: ' + q.dueInfo.date.toLocaleDateString('id-ID') : 'Tanpa deadline'}</span>
                            <a class="qbot-quiz-item-btn" href="${q.href}">Buka Kuis &rarr;</a>
                        </div>
                    </div>`;
            }
            html += '</div></div>';
            container.innerHTML = html;
        }

        if (cfg.autoQuiz) {
            const urgentQuizzes = foundQuizzes.filter(q => !q.isDone && q.dueInfo && q.dueInfo.isUrgent);
            const mostUrgent = urgentQuizzes[0];
            if (mostUrgent) {
                log(`🔴 [Auto Pilot] Kuis MENDESAK: "${mostUrgent.title}" (${mostUrgent.dueInfo.remainingText})! Membuka kuis dalam 3 detik...`, 'warn');
                let secs = 3;
                if (startBtn) {
                    startBtn.className = 'running';
                    startBtn.textContent = `Batal (${secs}s)`;
                }
                setStatus('running');

                viewCountdownTimer = setInterval(() => {
                    secs--;
                    if (secs <= 0) {
                        clearInterval(viewCountdownTimer);
                        viewCountdownTimer = null;
                        log(`Membuka kuis "${mostUrgent.title}"...`, 'ok');
                        window.location.href = mostUrgent.href;
                    } else {
                        if (startBtn) startBtn.textContent = `Batal (${secs}s)`;
                    }
                }, 1000);
            } else {
                const upcoming = foundQuizzes.filter(q => !q.isDone)[0];
                if (upcoming) {
                    const dueStr = upcoming.dueInfo ? upcoming.dueInfo.remainingText : 'tanpa batas waktu ketat';
                    log(`🟡 [Auto Pilot] Kuis "${upcoming.title}" belum jatuh tempo (${dueStr}). Menunggu konfirmasi...`, 'info');
                    showPromptBox(
                        '⚠️ Konfirmasi Pengerjaan (Auto Pilot)',
                        `Kuis <b>${upcoming.title}</b> belum jatuh tempo (<b>${dueStr}</b>).<br>Apakah ingin dikerjakan sekarang?`,
                        () => {
                            log(`Membuka kuis "${upcoming.title}"...`, 'ok');
                            window.location.href = upcoming.href;
                        },
                        () => {
                            log('User memilih nanti saja.', 'info');
                            setStatus('idle');
                        }
                    );
                }
            }
        }
    }

    // ==================== MY COURSES DASHBOARD HANDLER (/my/courses.php) ====================
    let isScanningMyCourses = false;
    let hasAutoScannedMyCourses = false;
    let myCoursesObserver = null;
    let myCoursesRetryTimer = null;
    let courseViewRetryCount = 0;

    function getEnrolledCoursesFromPage() {
        const links = Array.from(document.querySelectorAll('a[href*="/course/view.php?id="]'));
        const coursesMap = new Map();

        for (const a of links) {
            const href = a.href;
            const m = href.match(/\/course\/view\.php\?id=(\d+)/);
            if (!m) continue;
            const id = m[1];
            if (id === '1') continue;

            let name = '';
            const parentCard = a.closest('.dashboard-card, .course-info-container, .course-listitem, [data-course-id]');
            if (parentCard) {
                const titleNode = parentCard.querySelector('.coursename, .course-title, h5, h6, .multiline');
                if (titleNode) {
                    name = (titleNode.innerText || '').trim();
                }
            }
            if (!name) {
                const nameEl = a.querySelector('.coursename, .multiline, .text-truncate') || a;
                name = (nameEl.innerText || a.innerText || '').trim();
            }
            name = name.replace(/\s+/g, ' ').replace(/^(Course|Mata kuliah)\s*:\s*/i, '').trim();

            if (coursesMap.has(id)) {
                const existing = coursesMap.get(id);
                if ((!existing.name || existing.name.startsWith('Mata Kuliah #')) && name && !name.startsWith('Mata Kuliah #')) {
                    existing.name = name;
                }
            } else {
                if (!name || name.length < 2 || name.toLowerCase() === 'home' || name.toLowerCase() === 'beranda') {
                    name = `Mata Kuliah #${id}`;
                }
                coursesMap.set(id, { id, name, url: href });
            }
        }
        return Array.from(coursesMap.values());
    }

    async function scanAllMyCourses() {
        if (isScanningMyCourses) return;
        isScanningMyCourses = true;

        const courses = getEnrolledCoursesFromPage();
        if (courses.length === 0) {
            log('Tidak ada daftar mata kuliah yang terdeteksi di halaman ini. Pastikan daftar mata kuliah sudah tampil.', 'warn');
            isScanningMyCourses = false;
            return;
        }

        log(`🔍 [Auto Detect] Memulai pemindaian ${courses.length} mata kuliah untuk mencari kuis...`, 'info');
        setStatus('running');
        if (startBtn) {
            startBtn.className = 'running';
            startBtn.textContent = 'Memindai...';
        }

        const allQuizzes = [];
        for (let i = 0; i < courses.length; i++) {
            const c = courses[i];
            log(`[${i + 1}/${courses.length}] Memeriksa "${c.name}"...`, 'info');
            try {
                const res = await fetch(c.url, { credentials: 'same-origin' });
                if (res.ok) {
                    const html = await res.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const quizElements = Array.from(doc.querySelectorAll('li.activity.quiz, div.activity-item[data-activityname], a[href*="/mod/quiz/view.php"]'));
                    const seenHref = new Set();

                    for (const el of quizElements) {
                        const link = el.tagName === 'A' ? el : el.querySelector('a[href*="/mod/quiz/view.php"]');
                        if (!link) continue;
                        const href = link.href;
                        if (seenHref.has(href)) continue;
                        seenHref.add(href);

                        const title = (link.querySelector('.instancename') || link).textContent.replace(/\s+/g, ' ').trim();
                        let isDone = false;
                        const parentItem = link.closest('.activity, .activity-item') || el;
                        if (parentItem) {
                            const compTxt = (parentItem.innerText || '').toLowerCase();
                            if (compTxt.includes('done') || compTxt.includes('selesai') || compTxt.includes('completed') ||
                                parentItem.querySelector('.completion-info .badge-success, [data-action="toggle-manual-completion"][data-value="1"]')) {
                                isDone = true;
                            }
                        }

                        let dueInfo = null;
                        if (parentItem) {
                            const datesEl = parentItem.querySelector('.activity-dates, .text-muted, .activity-information');
                            if (datesEl) {
                                const d = parseDueDateText(datesEl.innerText || '');
                                if (d) {
                                    const diffMs = d.getTime() - Date.now();
                                    const remainingHours = diffMs / (1000 * 60 * 60);
                                    const threshold = typeof cfg.urgentThresholdHours === 'number' ? cfg.urgentThresholdHours : 24;
                                    dueInfo = {
                                        date: d,
                                        remainingHours,
                                        remainingText: formatRemainingTime(diffMs),
                                        isUrgent: remainingHours <= threshold
                                    };
                                }
                            }
                        }

                        allQuizzes.push({
                            courseId: c.id,
                            courseName: c.name,
                            title,
                            href,
                            isDone,
                            dueInfo
                        });
                    }
                }
            } catch (err) {
                log(`Gagal memeriksa "${c.name}": ${err.message}`, 'warn');
            }
            await sleep(250);
        }

        isScanningMyCourses = false;
        hasAutoScannedMyCourses = true;
        setStatus('idle');
        if (startBtn) {
            startBtn.className = 'idle';
            startBtn.textContent = 'Pindai Ulang';
        }

        renderMyCoursesQuizzes(allQuizzes, courses.length);
    }

    function renderMyCoursesQuizzes(allQuizzes, totalCourses) {
        if (allQuizzes.length === 0) {
            log(`Pemindaian selesai dari ${totalCourses} mata kuliah: Tidak ada kuis aktif ditemukan.`, 'ok');
            return;
        }

        allQuizzes.sort((a, b) => {
            if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
            const aH = a.dueInfo ? a.dueInfo.remainingHours : 999999;
            const bH = b.dueInfo ? b.dueInfo.remainingHours : 999999;
            return aH - bH;
        });

        const urgentCount = allQuizzes.filter(q => !q.isDone && q.dueInfo && q.dueInfo.isUrgent).length;
        log(`Pemindaian selesai! Ditemukan ${allQuizzes.length} kuis (${urgentCount} mendesak) dari ${totalCourses} mata kuliah.`, urgentCount > 0 ? 'warn' : 'ok');

        const container = document.getElementById('qbot-prompt-box-area');
        if (container) {
            let html = `
                <div class="qbot-dashboard-box">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-weight:700;font-size:12px;color:#93c5fd;display:flex;align-items:center;gap:4px">📋 Dashboard Kuis (${allQuizzes.length})</span>
                        <span style="font-size:10px;color:#94a3b8;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px">${totalCourses} Matkul</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;padding-right:2px">`;

            for (const q of allQuizzes) {
                const badgeClass = q.isDone ? 'qbot-badge-done' : (q.dueInfo && q.dueInfo.isUrgent ? 'qbot-badge-urgent' : 'qbot-badge-normal');
                const badgeText = q.isDone ? 'Selesai' : (q.dueInfo ? q.dueInfo.remainingText : 'Tersedia');

                html += `
                    <div class="qbot-quiz-item">
                        <div class="qbot-quiz-item-head">
                            <span class="qbot-quiz-item-title">${q.title}</span>
                            <span class="qbot-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div style="font-size:10px;color:#60a5fa;margin-top:2px">📚 ${q.courseName}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
                            <span class="qbot-quiz-item-due">${q.dueInfo ? 'Batas: ' + q.dueInfo.date.toLocaleDateString('id-ID') : 'Tanpa deadline'}</span>
                            <a class="qbot-quiz-item-btn" href="${q.href}">Buka Kuis &rarr;</a>
                        </div>
                    </div>`;
            }
            html += `</div></div>`;
            container.innerHTML = html;
        }

        if (cfg.autoQuiz) {
            const urgentQuizzes = allQuizzes.filter(q => !q.isDone && q.dueInfo && q.dueInfo.isUrgent);
            const mostUrgent = urgentQuizzes[0];
            if (mostUrgent) {
                log(`🔴 [Auto Pilot] Kuis MENDESAK: "${mostUrgent.title}" di "${mostUrgent.courseName}" (${mostUrgent.dueInfo.remainingText})! Membuka otomatis dalam 3 detik...`, 'warn');
                let secs = 3;
                if (startBtn) {
                    startBtn.className = 'running';
                    startBtn.textContent = `Batal (${secs}s)`;
                }
                setStatus('running');

                viewCountdownTimer = setInterval(() => {
                    secs--;
                    if (secs <= 0) {
                        clearInterval(viewCountdownTimer);
                        viewCountdownTimer = null;
                        log(`Membuka kuis mendesak "${mostUrgent.title}"...`, 'ok');
                        window.location.href = mostUrgent.href;
                    } else {
                        if (startBtn) startBtn.textContent = `Batal (${secs}s)`;
                    }
                }, 1000);
            } else {
                const upcoming = allQuizzes.filter(q => !q.isDone)[0];
                if (upcoming) {
                    const dueStr = upcoming.dueInfo ? upcoming.dueInfo.remainingText : 'tanpa batas waktu ketat';
                    log(`🟡 [Auto Pilot] Kuis "${upcoming.title}" di "${upcoming.courseName}" belum jatuh tempo (${dueStr}). Menunggu konfirmasi...`, 'info');
                    showPromptBox(
                        '⚠️ Konfirmasi Pengerjaan (Auto Pilot)',
                        `Kuis <b>${upcoming.title}</b> pada mata kuliah <b>${upcoming.courseName}</b> belum jatuh tempo (<b>${dueStr}</b>).<br>Apakah ingin dikerjakan sekarang?`,
                        () => {
                            log(`Membuka kuis "${upcoming.title}"...`, 'ok');
                            window.location.href = upcoming.href;
                        },
                        () => {
                            log('User memilih nanti saja.', 'info');
                            setStatus('idle');
                        }
                    );
                }
            }
        }
    }

    function startAutoDetectMyCourses() {
        if (isScanningMyCourses || hasAutoScannedMyCourses) return;

        const initialCourses = getEnrolledCoursesFromPage();
        if (initialCourses.length > 0) {
            log(`[Auto Detect] Ditemukan ${initialCourses.length} mata kuliah. Memulai pemindaian kuis...`, 'ok');
            setTimeout(() => {
                scanAllMyCourses();
            }, 600);
            return;
        }

        log('⏳ [Auto Detect] Menunggu daftar mata kuliah dimuat oleh Moodle...', 'info');

        let attempts = 0;
        const maxAttempts = 30; // 30 x 500ms = 15 detik

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
            const courses = getEnrolledCoursesFromPage();
            if (courses.length > 0) {
                cleanup();
                log(`[Auto Detect] Daftar mata kuliah siap (${courses.length} matkul). Memulai pemindaian kuis otomatis...`, 'ok');
                setTimeout(() => {
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
            const targetNode = document.querySelector('[data-region="courses-view"], #region-main, main, body') || document.body;
            myCoursesObserver = new MutationObserver(() => {
                tryDetect();
            });
            myCoursesObserver.observe(targetNode, { childList: true, subtree: true });
        }

        myCoursesRetryTimer = setInterval(() => {
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
            let secs = 3;
            submitCountdown = true;
            if (startBtn) {
                startBtn.className = 'running';
                startBtn.textContent = `Cancel (${secs}s)`;
            }
            setStatus('running');
            log(`${cfg.autoQuiz ? '[Auto Pilot] ' : ''}Auto Submit aktif! Mengirim ujian dalam ${secs} detik... (Klik Cancel atau Alt+X untuk batal)`, 'warn');

            submitTimer = setInterval(() => {
                secs--;
                if (secs <= 0) {
                    clearInterval(submitTimer);
                    submitTimer = null;
                    submitCountdown = false;
                    submitQuizAttempt();
                } else {
                    if (startBtn) startBtn.textContent = `Cancel (${secs}s)`;
                }
            }, 1000);
        } else {
            log('Auto Submit nonaktif. Tekan Alt+S atau klik tombol di atas untuk submit.', 'info');
        }
    }

    // Keyboard shortcut support
    window.addEventListener('keydown', e => {
        // Alt + A -> Toggle Auto Pilot
        if (e.altKey && (e.code === 'KeyA' || e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            cfg.autoQuiz = !cfg.autoQuiz;
            saveConfig(cfg);
            const cb = document.getElementById('qbot-autoquiz');
            if (cb) cb.checked = cfg.autoQuiz;
            log(cfg.autoQuiz ? '[Auto Pilot] AKTIF — Deteksi kuis & utamakan jatuh tempo.' : '[Auto Pilot] NONAKTIF.', 'ok');
            clearPromptBox();
            evaluateCurrentPage();
        }
        // Alt + S -> Start / Submit / Scan My Courses
        else if (e.altKey && (e.code === 'KeyS' || e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            if (isSummaryPage()) {
                submitQuizAttempt();
            } else if (isQuizViewPage()) {
                clearPromptBox();
                executeStartQuiz();
            } else if (isMyCoursesPage()) {
                if (viewCountdownTimer) {
                    cancelViewCountdown();
                } else {
                    scanAllMyCourses();
                }
                return;
            } else if (!running) {
                startProcessing();
            }
        }
        // Alt + X -> Cancel / Stop
        else if (e.altKey && (e.code === 'KeyX' || e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            if (isSummaryPage() && submitCountdown) {
                cancelSubmitCountdown();
            } else if (viewCountdownTimer) {
                cancelViewCountdown();
            } else if (running) {
                stopFlag = true;
            }
        }
    });

    // ==================== AUTO START ====================
    function cancelCountdown() {
        countingDown = false;
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        setButton(false);
        setStatus('idle');
        log('Auto start dibatalkan.', 'warn');
    }

    function scheduleAutoStart() {
        if (!cfg.autoStart && !cfg.autoQuiz) return;
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
        log(`Auto start dalam ${secs} detik... klik Cancel atau Alt+X untuk batal.`, 'warn');

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
            const qCount = document.querySelectorAll('.que').length;
            if (qCount > 0) {
                log(`Terdeteksi ${qCount} soal di halaman ini.`, 'info');
                if (cfg.autoQuiz || cfg.autoStart) {
                    scheduleAutoStart();
                }
            } else if (window.location.pathname.indexOf('/mod/quiz/attempt.php') !== -1) {
                let attemptRetry = 0;
                const pollQue = setInterval(() => {
                    attemptRetry++;
                    const count = document.querySelectorAll('.que').length;
                    if (count > 0) {
                        clearInterval(pollQue);
                        log(`Terdeteksi ${count} soal di halaman ini.`, 'info');
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
    createPanel();
    log('Panel siap. Deteksi otomatis kuis & mata kuliah aktif.', 'info');
    evaluateCurrentPage();
})();
