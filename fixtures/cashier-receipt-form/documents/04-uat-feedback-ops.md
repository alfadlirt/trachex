# Catatan Temuan UAT: Cashier Receipt Form (CRF)

**PIC Pengujian:** Nurul Anisa (Clinic Ops Lead) & Farhan Maulana (Senior QA Engineer)  
**Tanggal Uji:** 04 September 2025  
**Lokasi Uji:** Staging Environment Klinik Medika Cabang Kemang  
**Nomor Tiket Terkait:** CRF-225 (UAT Feedback atas CRF-201 & CRF-214)  

---

## 1. Temuan Lapangan & Celah Alur Transaksi

### Finding 1: Kasir Bisa Buka Shift Baru Padahal Revisi Kemarin Masih Gantung (Kritis)
- **Skenario yang Diuji:**
  Kasir Ani mengajukan koreksi invoice untuk shift kemarin sore. Pengajuan di-approve Finance, sehingga status CRF kemarin otomatis beralih jadi 'Under Revision'. Tapi ketika Ani login ke sistem kasir untuk shift hari ini, sistem masih memperbolehkan Ani klik 'Buka Shift Baru' dan melayani transaksi billing pasien hari ini. Padahal revisi kas fisik kemarin belum selesai dihitung ulang.
- **Problem di Lapangan:** Uang cash modal awal dan setoran untuk shift baru jadi tercampur aduk dengan sisa uang shift kemarin yang belum kelar direvisi.
- **Kebutuhan Baru (Requirement):**
  Sistem harus mengunci tombol buka shift (`Shift Lock on Pending Revision`). Kasir yang masih punya CRF berstatus 'Under Revision' wajib menyelesaikan revisi dan melakukan re-close lebih dulu sebelum diizinkan buka shift baru di hari berikutnya.

### Finding 2: Belum Ada Test Scenario Buat Koreksi Pembayaran Parsial (Split Payment)
- **Skenario yang Diuji:**
  Banyak pasien klinik yang melunasi billing tindakan dengan metode Split Payment. Contoh: Total tagihan lab Rp 500.000, pasien bayar Rp 200.000 Cash dan sisanya Rp 300.000 pakai QRIS.
  Ketika ada revisi biaya tindakan lab turun jadi Rp 400.000, sistem belum punya skenario uji yang jelas mengenai porsi mana yang harus disesuaikan duluan. Apakah porsi non-tunai (QRIS) yang di-void sebagian, atau porsi cash yang dikembalikan ke pasien?
- **Rekomendasi QA:** Wajib disiapkan skenario uji BDD yang spesifik untuk menangani urutan penyesuaian dana pada transaksi split payment.

### Finding 3: Audit Trail Persetujuan Selisih Kas Fisik Belum Lengkap di Struk Audit
- **Skenario yang Diuji:**
  Saat kasir menyelesaikan perbaikan transaksi pada CRF berstatus 'Under Revision', struk ringkasan closing akhir belum menampilkan nama approver yang menyetujui selisih kas fisik (cash variance) tersebut.
- **Kebutuhan Baru:** Tampilkan nama approver dan alasan revisi pada struk audit re-closing CRF.
