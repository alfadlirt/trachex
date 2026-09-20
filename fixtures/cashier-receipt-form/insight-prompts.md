# Panduan Prompt Evaluasi Lens & Observabilitas Agent
## Modul: Cashier Receipt Form (CRF) - Sistem Klinik

Panduan ini berisi kumpulan prompt evaluasi AI / Lens yang dapat digunakan untuk menguji kemampuan AI Agent dalam mendeteksi konflik requirement, membedah evolusi perubahan (chain of superseding), audit completion yang kadaluarsa (stale check), serta skenario pengujian yang hilang (missing coverage).

---

## 1. Prompt Deteksi Konflik Persyaratan (Conflict Detection)

### Prompt 1: Penelusuran Batas Waktu Koreksi Invoice
> *"Berapa hari batas waktu pengajuan koreksi invoice pasca-EOD closing yang berlaku saat ini? Apakah ada perbedaan antara dokumen FSD awal, notulensi rapat alignment, dan konfirmasi Microsoft Teams? Tolong jelaskan kronologi perubahannya dan mana yang berstatus aktif."*

**Ekspektasi Output AI:**
- AI mengidentifikasi tiga dokumen sumber:
  1. `FSD Awal (PDF)`: 7 hari kalender (di-supersede).
  2. `MoM Alignment`: 14 hari kerja (di-supersede).
  3. `Teams Confirmation`: 10 hari kalender (final / active).
- AI menjelaskan bahwa aturan 7 hari dan 14 hari telah `superseded` oleh konfirmasi resmi via Teams pada tanggal 25 Agustus 2025.

---

## 2. Prompt Evaluasi Stale Check & Completion Audits

### Prompt 2: Status Implementasi dan Stale Check
> *"Apakah ada requirement yang sudah dicentang (checked) oleh developer namun sebenarnya sudah tidak valid atau berubah aturannya? Bagaimana dampaknya terhadap progres penyelesaian tiket CRF-201?"*

**Ekspektasi Output AI:**
- AI menemukan bahwa `req-crf-correction-window-7d` sempat dicentang selesai oleh `dev-rian` pada 15 Agustus 2025 (`audit-crf-5`).
- AI memperingatkan bahwa centang tersebut berstatus **stale** karena requirement-nya telah di-supersede oleh aturan 10 hari kalender (`req-crf-correction-window-10d`) yang saat ini masih `unchecked`.
- AI merekomendasikan agar riwayat centang tetap dipertahankan pada riwayat audit, namun tidak dihitung ke dalam persentase progres aktif.

---

## 3. Prompt Audit Skenario Pengujian (Missing & Unreviewed Scenarios)

### Prompt 3: Cakupan Test Scenario dan Temuan UAT
> *"Tinjau requirement aktif pada modul CRF. Apakah ada requirement yang belum memiliki test scenario sama sekali, atau memiliki skenario yang belum direview? Hubungkan dengan temuan UAT klinik."*

**Ekspektasi Output AI:**
- **Missing Scenario:** AI menandai bahwa `req-crf-split-payment-handling` (penanganan split payment saat revisi invoice) sama sekali belum memiliki skenario pengujian (`scenarios.json`).
- **Unreviewed Scenario:** AI menemukan skenario `scenario-shift-lock-pending` untuk penguncian shift kasir saat status Under Revision masih memiliki `reviewed: false` dan memerlukan validasi dari QA.

---

## 4. Prompt Evaluasi Ekstraksi Ingestion Multi-Format (PDF & MD)

### Prompt 4: Validasi Parsing PDF FSD
> *"Apakah file dokumen FSD 01-fsd-cashier-receipt-form.pdf dapat dibaca oleh sistem ingestion? Sebutkan hak akses apa saja yang ditetapkan pada section aturan bisnis."*

**Ekspektasi Output AI:**
- AI berhasil mengekstrak teks dari binary PDF `01-fsd-cashier-receipt-form.pdf`.
- AI mengutip aturan *CRF Owner Restriction*: hanya kasir pemilik yang boleh mengubah atau menutup CRF miliknya, dan kasir lain dilarang mengintervensi (error 403).
