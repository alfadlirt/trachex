# Functional Specification Document (FSD)
# Modul: Cashier Receipt Form (CRF) & Rekonsiliasi Kasir Klinik

**Nomor Dokumen:** FSD-MEDIKA-CRF-001  
**Nomor Tiket:** CRF-201  
**Author:** Danang Prasetyo (Product Lead)  
**Tanggal:** 10 Agustus 2025  
**Sistem:** Medika Core Microservices (Klinik Pratama & Spesialis)  
**Target Rilis:** Sprint 24 - Core Billing & Cashier  

---

## 1. Latar Belakang & Objective
Setiap kasir klinik yang masuk shift kerja wajib buka dan tutup pencatatan kas harian pakai dokumen digital **Cashier Receipt Form (CRF)**. CRF ini berfungsi sebagai instrumen audit internal untuk mencegah kas tekor atau selisih, sekaligus jadi acuan rekonsiliasi antara uang fisik yang dipegang kasir dengan rekaman transaksi di sistem.

Scope modul ini mencakup:
- Buka shift kasir dan pencatatan initial deposit (kas kecil untuk uang kembalian).
- Rekap transaksi dari berbagai channel pembayaran: Cash, QRIS, Kartu Debit, Kartu Kredit, Payment Gateway / Transfer (Xendit), sampai Voucher klinik.
- Tutup shift kasir dan rekonsiliasi kas harian sebelum proses End of Day (EOD) Closing klinik dijalankan.
- Alur pengajuan koreksi invoice setelah EOD closing kalau ada salah input tindakan medis/obat atau revisi payment method pasien.

---

## 2. Business Rules & Spesifikasi Fungsional

### 2.1 Buka Shift & Pembatasan Akses Kasir (CRF Owner Restriction)
1. Kasir wajib create dokumen CRF baru di sistem sebelum mulai input transaksi billing pertama di shift tersebut.
2. Kasir wajib menginput nominal **Initial Deposit** (uang modal kembalian fisik yang diterima dari bendahara klinik / head cashier).
3. **Isolasi Akses Kasir (Owner Restriction):** Dokumen CRF terkunci khusus untuk kasir yang bersangkutan. Kasir lain dilarang mengedit transaksi ataupun menutup (close) CRF milik rekan kerjanya. Sistem otomatis me-reject aksi ini dengan error code 403 Forbidden.

### 2.2 Pencatatan Transaksi Multi-Channel Pembayaran
1. Sistem wajib mencatat transaksi billing pasien secara real-time berdasarkan payment method:
   - Tunai (Cash)
   - QRIS (Dinamis / Statis)
   - Kartu Debit (Mesin EDC)
   - Kartu Kredit (Mesin EDC)
   - Payment Gateway / Virtual Account (Xendit)
   - Voucher Diskon / Treatment Internal Klinik
2. Sistem otomatis mengkalkulasi akumulasi total penerimaan per channel pembayaran langsung ke summary CRF kasir.

### 2.3 Tutup Shift Kasir & EOD Closing Klinik
1. Di akhir shift, kasir menghitung fisik uang tunai di laci, mencocokkan nilainya dengan total di sistem, klik tombol verifikasi closing, lalu mengubah status CRF menjadi **'Closed'**.
2. Supervisor klinik baru bisa me-running proses **EOD Closing** harian kalau seluruh CRF kasir pada hari berjalan sudah berstatus 'Closed'.

### 2.4 Alur Koreksi Invoice Setelah EOD Closing
1. Kalau setelah EOD Closing ada komplain pasien, salah input tindakan dokter, atau koreksi tagihan, sistem menyediakan fitur pengajuan **Koreksi Invoice**.
2. **Batas Waktu Pengajuan Awal (Correction Window):** Kasir hanya bisa mengajukan koreksi invoice paling lambat **7 hari kalender** sejak EOD closing selesai diproses. Lewat dari 7 hari kalender, sistem otomatis me-reject permohonan koreksi.
3. **Approval Flow:** Setiap pengajuan koreksi invoice wajib di-approve oleh **Finance Supervisor**.
4. **State Transition ke Under Revision:**
   - Begitu Finance Supervisor approve pengajuan koreksi, sistem otomatis meng-update status invoice pasien terkait menjadi **'Under Revision'**.
   - Sistem juga otomatis meng-update status dokumen CRF kasir terkait menjadi **'Under Revision'**.
   - Kasir pemilik membuka kembali CRF tersebut, menyesuaikan transaksi yang keliru, lalu melakukan submit dan verifikasi re-close.

---

## 3. Catatan Teknis Microservices
- `cashier-service`: Mengelola lifecycle status CRF (Open, Under Revision, Closed) dan validasi hak akses kasir.
- `billing-service`: Mengelola status invoice tagihan pasien dan validasi correction window.
- `audit-trail-service`: Mencatat event log rekonsiliasi kasir dan history approval koreksi invoice.
