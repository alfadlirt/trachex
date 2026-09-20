# Microsoft Teams Channel: #billing-crf-enhancement
# Thread: Keputusan Final Correction Window & Aturan Refund Voucher

**Channel:** Medika Core Product & Engineering > #billing-crf-enhancement  
**Tanggal:** 25 Agustus 2025  
**Nomor Tiket Terkait:** CRF-214 (Klarifikasi Alignment MoM)  

---

### Siti Rahma (Business Analyst) — 09:15 WIB
> Pagi Pak @Bambang Sudjatmiko dan Mas @Danang Prasetyo,
> Mau follow up hasil MoM alignment tanggal 18 Agustus kemarin terkait batas waktu koreksi invoice:
> Tim Tax & Accounting audit kasih feedback kalau rentang **14 hari kerja** itu kelamaan. Kalau lewat dari minggu kedua bulan berikutnya, pencatatan SPT Masa PPN dan closing buku kas bulanan klinik bisa berantakan.
>
> Masukan dari tim Tax: batas maksimal ditarik jadi **10 hari kalender** sejak EOD closing klinik.
> Satu hal lagi soal payment method pasien yang pakai **Voucher Diskon / Treatment**: di klinik cabang, kasir sering keliru mengembalikan selisih revisi voucher dalam bentuk uang tunai fisik (cash). Aturan tegas dari finance: kalau ada revisi atau pembatalan transaksi voucher, selisihnya dilarang keras di-refund pakai cash. Kasir wajib menerbitkan voucher pengganti atau credit note pasien.
>
> Mohon konfirmasinya ya Pak Bambang dan Mas Danang supaya tim dev bisa segera lock requirement ini. Thank you!

---

### Bambang Sudjatmiko (Head of Finance & Accounting) — 10:05 WIB
> Pagi Mbak Siti,
> Aman, sudah saya diskusikan juga sama Pak Danu (Tax Manager). Kita sepakat batas **10 hari kalender** paling pas: operasional kasir cabang tetap punya nafas, tapi tidak sampai mengganggu pelaporan pajak bulanan kita.
> 
> Poin resmi dari Finance:
> 1. Correction window pengajuan koreksi invoice final kita lock di **10 hari kalender** sejak EOD closing (menggantikan usulan 14 hari kerja kemarin).
> 2. Transaksi yang ada unsur Voucher tidak boleh di-refund cash fisik ke pasien. Selisih wajib kembali jadi voucher baru atau saldo credit note.
>
> Dari Finance sudah APPROVED ya. Silakan lanjut ke tim dev.

---

### Danang Prasetyo (Product Lead) — 10:20 WIB
> Siap, dari sisi Product juga approved.
> Mas @Rian Hidayat (Engineering Lead), requirement kita lock di **10 hari kalender** dan validasi blokir refund tunai untuk voucher ya. Tiket CRF-214 sudah saya update statusnya jadi 'Ready for Dev'.
