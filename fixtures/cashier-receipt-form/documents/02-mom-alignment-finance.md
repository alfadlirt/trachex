# Minutes of Meeting (MoM) Alignment: Kebijakan Koreksi Invoice & Fleksibilitas Approval

**Agenda:** Review Kebijakan Koreksi Invoice Pasca EOD Closing & Dinamisasi Role Approval Finance  
**Waktu:** 18 Agustus 2025 (14:00 - 15:30 WIB)  
**Nomor Tiket Terkait:** CRF-214 (Koreksi terhadap CRF-201)  
**Hadir:**
- Danang Prasetyo (Product Lead)
- Siti Rahma (Business Analyst)
- Bambang Sudjatmiko (Head of Finance & Accounting)
- Rian Hidayat (Engineering Lead)
- Nurul Anisa (Operations & Clinic Supervisor Lead)

---

## 1. Poin Diskusi & Problem Lapangan di Cabang Klinik
1. **Correction Window 7 Hari Kalender Terlalu Pendek (Bentrok dengan FSD Awal):**
   - Pak Bambang menjelaskan alur verifikasi klaim asuransi dan invoice corporate dari cabang klinik di luar Jakarta. Rekapitulasi klaim dari pihak asuransi dan penjamin corporate biasanya baru masuk ke Finance pusat setiap tanggal 10 dan 25 per bulannya.
   - Kalau sistem membatasi koreksi invoice cuma 7 hari kalender seperti rancangan awal di FSD (`CRF-201`), kasir cabang tidak sempat membetulkan invoice pasien yang salah penjamin (contoh: pasien terlanjur bayar cash, padahal seharusnya dicover asuransi corporate).
   - **Keputusan:** Tim sepakat memperpanjang correction window pengajuan koreksi invoice dari **7 hari kalender** menjadi **14 hari kerja** (exclude hari Minggu dan tanggal merah nasional). Aturan 14 hari kerja ini resmi me-replace dan men-supersede aturan 7 hari kalender di FSD awal.

2. **Dinamisasi Role Approval via General Setup:**
   - Di FSD awal, hak approval koreksi invoice terkunci hardcoded hanya untuk role "Finance Supervisor".
   - Praktik di lapangan, terutama klinik cabang satelit, mereka tidak punya staf finance tersendiri di lokasi. Yang berwenang me-review dan approve di cabang adalah Head of Cashier atau Branch Manager setempat.
   - **Keputusan:** Role approver koreksi invoice dilarang di-hardcode ke sistem. Hak approval wajib dibuat dinamis dan bisa di-setting fleksibel via modul **General Setup**, dipetakan berdasarkan role dan kebutuhan cabang klinik masing-masing.

3. **Status Dokumen & Prosedur Rekonsiliasi Kasir:**
   - Begitu approval didapatkan, sistem langsung mengubah status invoice dan dokumen CRF menjadi 'Under Revision'.
   - Kasir pemilik wajib mengisi reason koreksi dan melampirkan referensi approval sebelum dokumen CRF bisa di-reclose.

---

## 2. Action Items
- **Siti Rahma (BA):** Update acceptance criteria pada user story dan minta sign-off tertulis via Microsoft Teams sebelum sprint development jalan.
- **Rian Hidayat (Engineering):** Siapkan skema database baru di `general-setup-service` untuk menyimpan konfigurasi matriks approval rule per cabang.
