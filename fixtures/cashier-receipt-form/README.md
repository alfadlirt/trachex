# Cashier Receipt Form (CRF) Fixture with Conflict Chain (Bahasa Indonesia)

Fixture ini merupakan pemodelan dataset deterministik untuk modul **Cashier Receipt Form (CRF) / Formulir Penerimaan Kasir** pada sistem microservices klinik kesehatan (`project-medika-core`).

Fixture ini dirancang secara khusus untuk:
1. **Demonstrasi Mentor:** Memperlihatkan kemampuan end-to-end Trachex: ingestion dokumen PDF & Markdown, ekstraksi checklist otomatis, deteksi konflik kebutuhan antar-dokumen, superseding bertingkat (*chain of superseding*), hingga pelacakan *stale checks*.
2. **Evaluasi Agent & Observabilitas Lens:** Menyediakan ground-truth dataset yang kaya akan skenario riil lapangan, gap pengujian, serta resolusi konflik bisnis.

---

## 1. Alur Cerita & Timeline Kronologis

```
[10-08-2025] Initial FSD (PDF & MD)
  │  - Fitur CRF awal: Modal awal, multi-payment, penutupan shift.
  │  - Hak akses: Hanya pemilik yang dapat ubah/tutup CRF (Owner Restriction).
  │  - Koreksi invoice: Maksimal 7 hari kalender (di-approve Finance Supervisor).
  │
[15-08-2025] Developer Check
  │  - Developer menguji dan mencentang (checked) requirement batas 7 hari kalender.
  │
[18-08-2025] MoM Alignment Meeting (MD) [Konflik 1]
  │  - Kendala klaim asuransi cabang: Batas waktu 7 hari tidak cukup.
  │  - Keputusan: Diubah menjadi 14 hari kerja (SUPERSEDES 7 hari kalender).
  │  - Approval dibuat dinamis via modul General Setup.
  │
[25-08-2025] Microsoft Teams BA Confirmation (MD) [Konflik 2]
  │  - Tim Audit Pajak menolak 14 hari kerja karena melewati batas SPT Masa bulanan.
  │  - Finance Lead & PM setuju resmi mengunci batas maksimal menjadi 10 hari kalender.
  │  - Aturan: Voucher dilarang diuangkan kembali ke kas tunai fisik.
  │  - Status: 10 hari kalender SUPERSEDES 14 hari kerja (Final Active).
  │
[04-09-2025] UAT Feedback Lapangan Klinik (MD)
     - Celah kritis: Kasir membuka shift baru saat ada CRF Under Revision menggantung.
     - Dibuat requirement penguncian shift (Shift Lock on Revision).
     - Missing coverage: Penanganan split payment saat terjadi revisi pembayaran.
```

---

## 2. Struktur Dokumen & File Fixture

| File | Keterangan |
|---|---|
| `documents/01-fsd-cashier-receipt-form.pdf` | Dokumen FSD binary PDF asli (tervalidasi dengan `pdf-parse`) |
| `documents/01-fsd-cashier-receipt-form.md` | Sumber raw Markdown dokumen FSD awal |
| `documents/02-mom-alignment-finance.md` | Notulensi rapat penyelarasan finance |
| `documents/03-teams-ba-confirmation.md` | Transkrip konfirmasi chat resmi Microsoft Teams |
| `documents/04-uat-feedback-ops.md` | Catatan temuan UAT lapangan klinik & QA |
| `project.json` | Master project Medika Core & 3 tiket (`CRF-201`, `CRF-214`, `CRF-225`) |
| `sources.json` | Entitas metadata sumber dokumen |
| `requirements.json` | Daftar requirement, status aktif vs superseded, dan status centang |
| `impacts.json` | Pemetaan dampak ke microservices dan modul API/Halaman |
| `scenarios.json` | Test scenario BDD dalam Bahasa Indonesia |
| `completion-audits.json` | Riwayat centang audit developer (termasuk *stale check*) |
| `proposals.json` | Contoh payload proposal ekstraksi dan rekonsiliasi bertingkat |
| `expected-findings.json` | Target temuan Lens (Severity: High & Medium) |
| `reconciliation-mom.json` | Proposal rekonsiliasi MoM alignment |
| `reconciliation-teams.json` | Proposal rekonsiliasi Teams confirmation |
| `fixture.json` | Bundle manifest ringkas gabungan |
| `generate-pdf.mjs` | Generator PDF deterministik standar PDF-1.4 tanpa dependensi |
| `validate.mjs` | Script validasi integritas fixture |
| `insight-prompts.md` | Rubrik pertanyaan uji evaluasi AI / Lens untuk demonstrasi |

---

## 3. Cara Menjalankan Validasi

Jalankan perintah berikut di terminal:

```bash
node fixtures/cashier-receipt-form/validate.mjs
```

Jika berhasil, skrip akan menampilkan ringkasan tiket, relasi requirement, riwayat superseding, serta status validitas referensi dokumen.
