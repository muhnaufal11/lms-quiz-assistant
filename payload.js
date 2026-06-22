const fs = require('fs');
const path = require('path');

// Injeksi sebagai REFERENSI EKSTERNAL (bukan inline). Keuntungan:
//  - Kebal terhadap string '</script>' di dalam kode (yang mematahkan inline script)
//  - Diizinkan CSP 'self' karena same-origin
//  - Edit assistant.js cukup reload halaman (proxy serve file fresh, no-store)
function getPayload() {
    let v = '4';
    try {
        const st = fs.statSync(path.join(__dirname, 'frontend', 'assistant.js'));
        v = String(Math.floor(st.mtimeMs));
    } catch (e) {}
    return '\n<link rel="stylesheet" href="/__qbot__/assistant.css?v=' + v + '">\n' +
           '<script src="/__qbot__/assistant.js?v=' + v + '"></script>\n';
}

module.exports = { getPayload };
