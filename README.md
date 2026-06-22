# TelU LMS Quiz Assistant

Userscript Tampermonkey yang membaca soal kuis di Moodle LMS Telkom University,
mengirimnya ke LLM, lalu otomatis memilih jawaban yang cocok.

- **File utama:** `lms-assistant.user.js`
- **Berjalan di:** `https://lms.telkomuniversity.ac.id/mod/quiz/attempt.php*`
- **Versi:** 3.0
- **Spesifikasi teknis lengkap:** `memory/MEMORY.md`

> Catatan: alat bantu pribadi. Gunakan sesuai aturan akademik yang berlaku.

---

## Cara Install

1. Pasang ekstensi **Tampermonkey** (Chrome/Edge/Firefox).
2. Buka dashboard Tampermonkey → **Create a new script**.
3. Hapus isi default, paste seluruh isi `lms-assistant.user.js`, lalu **Save** (Ctrl+S).
4. Buka halaman kuis di LMS — panel "Quiz Assistant" muncul di pojok kanan atas.

## Cara Pakai

1. Pilih **Provider** (Groq / Gemini / Claude).
2. Isi **API Key** (klik link "dapatkan key" untuk ke halaman key masing-masing).
3. Pilih **Model**.
4. Klik **Start**. Bisa juga aktifkan **Auto Next** (pindah halaman otomatis)
   dan **Auto Start** (jalan otomatis saat halaman dimuat, ada countdown 3 detik
   yang bisa dibatalkan).

API key & pilihan model **tersimpan terpisah per provider** (via `GM_setValue`),
jadi ganti provider tidak menghapus key yang sudah diisi.

---

## Provider & Model

| Provider | Format Key | Model |
|----------|-----------|-------|
| **Groq** | `gsk_...` | **LLaMA 3.3 70B** (default), LLaMA 3.1 8B Instant, LLaMA 3 70B/8B, Gemma 2 9B |
| **Gemini** | `AIza...` | **Gemini 3.5 Flash** (default), 3.1 Flash-Lite, 2.5 Flash/Flash-Lite/Pro, Gemma 4 31B / 4 26B A4B, Gemma 3 27B/12B/4B |
| **Claude (Pro/Max)** | `sk-ant-oat01-...` | **Claude Sonnet 4.6** (default), Opus 4.8, Haiku 4.5 |
| **DeepSeek** | `sk-...` | **DeepSeek V4 Flash** (default), DeepSeek V4 Pro |
| **AI Lokal** | — (opsional) | Bebas, ketik sesuai model di Ollama/LM Studio (mis. `llama3.1`, `qwen2.5`, `gemma2`) |

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
Kalau Claude error auth, kemungkinan perlu tambah header
`anthropic-beta: oauth-2025-04-20`.

### Gemma vs Gemini (di provider Gemini)
Model **Gemma 3** error kalau dikirim `systemInstruction`, jadi untuk model yang
ID-nya diawali `gemma`, system prompt digabung ke dalam pesan user. Model Gemini
biasa tetap pakai `systemInstruction`. (Gemma 4 sebenarnya sudah mendukung
`systemInstruction`, tapi cara gabung ini aman untuk keduanya.)

### Verifikasi model ID
Daftar model diverifikasi ke dokumentasi resmi (per Juni 2026). ID model yang
salah menyebabkan error 404 — selalu cek docs resmi sebelum menambah model baru.
Belum ada "Gemini 5"; yang terbaru Gemini 3.5. DeepSeek kini pakai
`deepseek-v4-flash` / `deepseek-v4-pro` (nama lama `deepseek-chat`/`deepseek-reasoner`
pensiun 24 Jul 2026).

### AI Lokal (Ollama / LM Studio)
- Tidak perlu API key. Jalankan model lokal lewat **Ollama** (default
  `http://localhost:11434/v1`) atau **LM Studio** (`http://localhost:1234/v1`).
- Saat provider "AI Lokal" dipilih, muncul field **Base URL** dan **nama model**
  diketik bebas sesuai yang ter-install (mis. `llama3.1`, `qwen2.5`).
- Request ke `http://localhost` dari halaman HTTPS tetap jalan karena lewat
  `GM_xmlhttpRequest` (kebal mixed-content). Kalau Ollama menolak koneksi, set
  `OLLAMA_ORIGINS=*` sebelum menjalankannya.
- Header `@connect *` di script mengizinkan base URL host apa pun. Kalau mau
  lebih ketat, hapus baris itu — `localhost` & `127.0.0.1` sudah cukup untuk
  Ollama/LM Studio lokal.

---

## Cara Kerja Singkat

1. Ambil semua elemen soal `.que`, baca teks `.qtext` dan opsi jawaban.
2. Kirim ke LLM dengan instruksi menjawab **hanya huruf** (A/B/C...).
   Mendukung soal pilihan tunggal (radio) & ganda (checkbox).
3. Cocokkan jawaban dengan 4 strategi berurutan:
   **letter → exact text → contains → fuzzy** (kemiripan kata).
4. Klik input yang cocok; soal di-highlight:
   kuning = proses, hijau = berhasil, merah = gagal.
5. Retry otomatis 3x bila API gagal; delay acak antar soal & antar halaman
   (anti-deteksi).

## Konfigurasi di Kode (`lms-assistant.user.js`)

- Tambah/ubah provider & model lewat objek `PROVIDERS` (tiap provider punya
  `models`, `buildRequest`, `parse`).
- Prompt sistem: `SYS_SINGLE` (jawaban tunggal) & `SYS_MULTI` (jawaban ganda).
- Kalau model lama di config dihapus dari daftar, `syncProviderUI()` otomatis
  fallback ke model pertama (mencegah 404 dari setting lama).

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
