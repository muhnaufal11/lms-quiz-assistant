const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function defaultConfig() {
    return {
        provider: 'groq',
        apiKeys: { groq: '', gemini: '', claude: '', deepseek: '', local: '' },
        models: {
            groq: 'llama-3.3-70b-versatile',
            gemini: 'gemini-2.0-flash',
            claude: 'claude-3-7-sonnet-latest',
            deepseek: 'deepseek-chat',
            local: 'llama3.1',
        },
        localBaseUrl: 'http://localhost:11434/v1',
        autoNext: true,
        autoStart: false,
        autoSubmit: false,
        autoQuiz: false,
        urgentThresholdHours: 24,
        stealthMode: true,
    };
}

function load() {
    const def = defaultConfig();
    try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return {
            provider: raw.provider || def.provider,
            apiKeys: Object.assign({}, def.apiKeys, raw.apiKeys || {}),
            models: Object.assign({}, def.models, raw.models || {}),
            localBaseUrl: raw.localBaseUrl || def.localBaseUrl,
            autoNext: raw.autoNext !== undefined ? raw.autoNext : def.autoNext,
            autoStart: raw.autoStart !== undefined ? raw.autoStart : def.autoStart,
            autoSubmit: raw.autoSubmit !== undefined ? raw.autoSubmit : def.autoSubmit,
            autoQuiz: raw.autoQuiz !== undefined ? raw.autoQuiz : def.autoQuiz,
            urgentThresholdHours: typeof raw.urgentThresholdHours === 'number' ? raw.urgentThresholdHours : def.urgentThresholdHours,
            stealthMode: raw.stealthMode !== undefined ? raw.stealthMode : def.stealthMode,
        };
    } catch (e) {
        return def;
    }
}

function save(patch) {
    const current = load();
    const merged = {
        provider: patch.provider || current.provider,
        apiKeys: Object.assign({}, current.apiKeys, patch.apiKeys || {}),
        models: Object.assign({}, current.models, patch.models || {}),
        localBaseUrl: patch.localBaseUrl || current.localBaseUrl,
        autoNext: patch.autoNext !== undefined ? patch.autoNext : current.autoNext,
        autoStart: patch.autoStart !== undefined ? patch.autoStart : current.autoStart,
        autoSubmit: patch.autoSubmit !== undefined ? patch.autoSubmit : current.autoSubmit,
        autoQuiz: patch.autoQuiz !== undefined ? patch.autoQuiz : current.autoQuiz,
        urgentThresholdHours: typeof patch.urgentThresholdHours === 'number' ? patch.urgentThresholdHours : current.urgentThresholdHours,
        stealthMode: patch.stealthMode !== undefined ? patch.stealthMode : current.stealthMode,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
    return merged;
}

module.exports = { load, save, defaultConfig, CONFIG_PATH };
