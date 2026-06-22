# TelU LMS Quiz Assistant

Alat bantu yang membaca soal kuis di Moodle LMS Telkom University, mengirimnya ke
LLM (Groq / Gemini / Claude / DeepSeek / AI Lokal), lalu otomatis mengisi jawaban.

Tersedia **dua mode**:

| Mode | Untuk | File utama |
|------|-------|-----------|
| **A. Userscript** | Browser biasa (Chrome/Edge/Firefox) + Tampermonkey | `lms-assistant.user.js` |
| **B. SEB Proxy** | Safe Exam Browser — saat ekstensi & DevTools diblokir | `server.js` + `frontend/` |

- **Berjalan di:** `https://lms.telkomuniversity.ac.id/mod/quiz/attempt.php*`
- **Versi:** Userscript 3.2 · SEB Proxy 4.0
- **Spesifikasi teknis lengkap:** `memory/MEMORY.md`

> Catatan: alat bantu pribadi untuk belajar. Gunakan sesuai aturan akademik &
> Ketentuan Layanan yang berlaku. Segala konsekuensi menjadi tanggung jawab pengguna.

---

## Tipe soal yang didukung (kedua mode)

| Tipe | Cara dijawab |
|------|--------------|
| **Pilihan tunggal** (radio) | LLM balas huruf (A/B/C…), lalu klik opsi yang cocok |
| **Pilihan ganda** (checkbox) | LLM balas beberapa huruf, klik semua yang cocok |
| **Essay** | LLM menulis jawaban lengkap (bahasa ikut soal), diisi ke editor (textarea / Atto / TinyMCE) |
| **Isian singkat** (short answer / numerical) | LLM balas jawaban ringkas (angka/kata), diisi ke kolom teks |

Soal yang mengandung **rumus matematika** (MathJax / MathML / gambar TeX) tetap
terbaca — rumusnya diekstrak supaya LLM melihat soal utuh.

---

## Mode A — Userscript (Tampermonkey)

### Install
1. Pasang ekstensi **Tampermonkey** (Chrome/Edge/Firefox).
2. Buka dashboard Tampermonkey → **Create a new script**.
3. Hapus isi default, paste seluruh isi `lms-assistant.user.js`, **Save** (Ctrl+S).
4. Buka halaman kuis di LMS — panel "Quiz Assistant" muncul di pojok kanan atas.

### Pakai
1. Pilih **Provider**, isi **API Key** (klik "dapatkan key"), pilih **Model**.
2. Klik **Start**. Opsional: **Auto Next** (pindah halaman otomatis) &
   **Auto Start** (jalan otomatis saat load, ada countdown 3 detik).

API key & model tersimpan terpisah per provider (via `GM_setValue`), jadi ganti
provider tidak menghapus key yang sudah diisi.

---

## Mode B — SEB Proxy (v4.0)

Untuk situasi di mana Tampermonkey & DevTools (F12) diblokir, mis. di dalam
**Safe Exam Browser**. Sebuah proxy MITM lokal menyuntikkan assistant langsung ke
halaman kuis di tingkat jaringan.

**Butuh:** Node.js 18+

### Install & jalankan
```bash
npm install
node generate-ca.js        # buat root CA certificate (sekali saja)
```

Lalu **install CA certificate** ke Windows Trusted Root:
- GUI: double-click `certs/ca-cert.pem` → Install Certificate → Current User →
  "Trusted Root Certification Authorities" → Finish, atau
- CLI: `certutil -addstore -user Root "certs\ca-cert.pem"`

Set **proxy Windows** ke `127.0.0.1:8080` (Settings → Network → Proxy → Manual),
lalu:
```bash
npm start
```

### Konfigurasi sebelum masuk SEB
1. Buka **`http://127.0.0.1:8080/`** di browser biasa → dashboard konfigurasi.
2. Isi provider, API key, model (auto-save ke server, file `config.json`).
3. Masuk **SEB** → buka kuis → panel sudah terisi otomatis → klik **Start**
   (atau aktifkan Auto Start).

Karena konfigurasi disimpan di sisi proxy, di dalam SEB kamu tidak perlu lagi
mem-paste API key — berguna saat keyboard/paste dibatasi.

### Cara kerja (mode SEB)
- Proxy MITM mengintersep `lms.telkomuniversity.ac.id` (TLS pakai CA lokal).
- Pada halaman kuis, proxy menyuntik referensi **script eksternal**
  (`/__qbot__/assistant.js`) dan **menghapus header CSP** agar script jalan.
- Panggilan API LLM **direlai di sisi server** (`/__qbot__/inference`) — API key
  tidak terekspos ke halaman & lolos CORS.
- Klik jawaban pakai **Trusted Event Emulation** (anti-deteksi `isTrusted` SEB).

> ⚠️ **Jangan commit** `certs/` (private key CA) & `config.json` (API key).
> Keduanya sudah masuk `.gitignore`.

---

## Provider & Model

| Provider | Format Key | Model |
|----------|-----------|-------|
| **Groq** | `gsk_...` | **LLaMA 3.3 70B** (default), LLaMA 3.1 8B Instant, LLaMA 3 70B/8B, Gemma 2 9B |
| **Gemini** | `AIza...` | **Gemini 3.5 Flash** (default), 3.1 Flash-Lite, 2.5 Flash/Flash-Lite/Pro, Gemma 4 31B / 4 26B A4B, Gemma 3 27B/12B/4B |
| **Claude (Pro/Max)** | `sk-ant-oat01-...` | **Claude Sonnet 4.6** (default), Opus 4.8, Haiku 4.5 |
| **DeepSeek** | `sk-...` | **DeepSeek V4 Flash** (default), DeepSeek V4 Pro |
| **AI Lokal** | — (opsional) | Bebas, sesuai model di Ollama/LM Studio (mis. `llama3.1`, `qwen2.5`, `gemma2`) |

Tempat ambil key:
- Groq: https://console.groq.com/keys
- Gemini: https://aistudio.google.com/apikey
- Claude: https://console.anthropic.com/settings/keys
- DeepSeek: https://platform.deepseek.com/api_keys
- AI Lokal: jalankan Ollama (https://ollama.com) atau LM Studio — tidak perlu key

---

## Catatan Teknis

### Auth Claude (OAuth, bukan API key biasa)
Provider Claude memakai **token OAuth Pro/Max** (`sk-ant-oat01-...`) dengan
header `Authorization: Bearer <token>` — **bukan** `x-api-key`. Juga dikirim
header `anthropic-dangerous-direct-browser-access: true`.

### Gemma vs Gemini (di provider Gemini)
Model **Gemma 3** error kalau dikirim `systemInstruction`, jadi untuk model yang
ID-nya diawali `gemma`, system prompt digabung ke dalam pesan user. Model Gemini
biasa tetap pakai `systemInstruction`.

### Verifikasi model ID
Daftar model diverifikasi ke dokumentasi resmi (per Juni 2026). ID model yang
salah menyebabkan error 404 — selalu cek docs resmi sebelum menambah model baru.

### AI Lokal (Ollama / LM Studio)
- Tidak perlu API key. Jalankan lewat **Ollama** (default
  `http://localhost:11434/v1`) atau **LM Studio** (`http://localhost:1234/v1`).
- Provider "AI Lokal" memunculkan field **Base URL** & nama model diketik bebas.
- Di userscript, request ke `http://localhost` kebal mixed-content lewat
  `GM_xmlhttpRequest`. Kalau Ollama menolak, set `OLLAMA_ORIGINS=*`.

---

## Cara Kerja Singkat

1. Ambil semua elemen soal `.que`, baca teks soal (`extractQuestionText`, termasuk
   rumus matematika) dan deteksi tipe soal (`detectMode`).
2. Kirim ke LLM dengan prompt sesuai tipe (`SYS_SINGLE` / `SYS_MULTI` /
   `SYS_ESSAY` / `SYS_SHORT`).
3. **Pilihan ganda:** cocokkan jawaban 4 strategi berurutan
   **letter → exact → contains → fuzzy**, lalu klik.
   **Essay / isian singkat:** tulis jawaban ke editor/kolom teks.
4. Soal di-highlight: kuning = proses, hijau = berhasil, merah = gagal.
5. Retry otomatis 3× bila API gagal; delay acak antar soal & halaman (anti-deteksi).

## Konfigurasi di Kode

- **Provider & model:** objek `PROVIDERS` (tiap provider: `models`, `buildRequest`,
  `parse`). Sama di `lms-assistant.user.js` & `frontend/assistant.js`.
- **Prompt sistem:** `SYS_SINGLE`, `SYS_MULTI`, `SYS_ESSAY`, `SYS_SHORT`.
- **Deteksi tipe & ekstraksi:** `detectMode()`, `extractQuestionText()`.
- **Pengisian jawaban:** `fillEssay()` (essay), `fillShort()` (isian singkat).

---

## Lisensi

Dirilis di bawah **MIT License** — bebas dipakai, **dimodifikasi**, dan
disebarkan. Lihat file [`LICENSE`](LICENSE).

"Batas aman": MIT membebaskan penulis dari tanggungan (kode diberikan APA
ADANYA, tanpa garansi). Addendum di file LICENSE menegaskan penggunaan yang
bertanggung jawab — alat ini untuk belajar/pribadi, dan pemakaian harus
mematuhi Ketentuan Layanan platform serta aturan integritas akademik
institusi masing-masing. Segala konsekuensi penggunaan/modifikasi menjadi
tanggung jawab pengguna.
