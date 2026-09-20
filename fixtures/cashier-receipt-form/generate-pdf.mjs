import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Script untuk membuat PDF valid standard PDF-1.4 tanpa dependensi pihak ketiga
// Menggunakan Type 1 font (Helvetica), object cross-reference table, dan layout teks rapi.

function generatePdfBuffer(pages) {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length; // 1-based object number
  };

  const catalogObjNum = 1;
  const outlinesObjNum = 2;
  const pagesObjNum = 3;
  const fontRegularObjNum = 4;
  const fontBoldObjNum = 5;

  const fontRegular = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  const fontBold = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  const pageObjNums = [];
  const contentStreams = [];

  for (let i = 0; i < pages.length; i++) {
    const pageNum = 6 + i * 2;
    const contentNum = pageNum + 1;
    pageObjNums.push(pageNum);

    const streamText = pages[i];
    const streamLen = Buffer.byteLength(streamText, 'latin1');
    const contentObj = `<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream`;
    contentStreams.push({ pageNum, contentNum, contentObj });
  }

  const catalog = `<< /Type /Catalog /Pages ${pagesObjNum} 0 R /Outlines ${outlinesObjNum} 0 R >>`;
  const outlines = `<< /Type /Outlines /Count 0 >>`;
  const pagesDict = `<< /Type /Pages /Kids [ ${pageObjNums.map(n => `${n} 0 R`).join(' ')} ] /Count ${pages.length} >>`;

  const finalObjs = [
    catalog,
    outlines,
    pagesDict,
    fontRegular,
    fontBold
  ];

  for (const cs of contentStreams) {
    const pageDict = `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [ 0 0 612 792 ] /Contents ${cs.contentNum} 0 R /Resources << /Font << /F1 ${fontRegularObjNum} 0 R /F2 ${fontBoldObjNum} 0 R >> >> >>`;
    finalObjs.push(pageDict);
    finalObjs.push(cs.contentObj);
  }

  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 0; i < finalObjs.length; i++) {
    const objNum = i + 1;
    offsets.push(Buffer.byteLength(output, 'latin1'));
    output += `${objNum} 0 obj\n${finalObjs[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += `xref\n0 ${finalObjs.length + 1}\n`;
  output += `0000000000 65535 f \n`;
  for (let i = 1; i <= finalObjs.length; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    output += `${offStr} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${finalObjs.length + 1} /Root ${catalogObjNum} 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(output, 'latin1');
}

function escapePdf(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPage1() {
  const lines = [
    'BT',
    '/F2 18 Tf',
    '50 740 Td',
    `(${escapePdf('FUNCTIONAL SPECIFICATION DOCUMENT (FSD)')}) Tj`,
    '/F2 13 Tf',
    '0 -24 Td',
    `(${escapePdf('Modul: Cashier Receipt Form (CRF) & Rekonsiliasi Kasir')}) Tj`,
    '/F1 10 Tf',
    '0 -18 Td',
    `(${escapePdf('Nomor Dokumen: FSD-MEDIKA-CRF-001 | Tiket: CRF-201')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('Author: Danang Prasetyo (Product Lead) | Tanggal: 10 Agustus 2025')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('Target: Sprint 24 - Core Billing & Cashier Microservices')}) Tj`,
    '/F2 12 Tf',
    '0 -28 Td',
    `(${escapePdf('1. LATAR BELAKANG & OBJECTIVE')}) Tj`,
    '/F1 10 Tf',
    '0 -18 Td',
    `(${escapePdf('Setiap kasir klinik yang masuk shift kerja wajib buka dan tutup kasir pakai Cashier Receipt Form (CRF).')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('CRF berfungsi sebagai kontrol internal agar kas tidak tekor dan rekonsiliasi pembayaran fisik vs sistem klop.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('Sistem otomatis mengkalkulasi dan merekonsiliasi pembayaran tunai (cash) maupun non-tunai.')}) Tj`,
    '/F2 12 Tf',
    '0 -24 Td',
    `(${escapePdf('2. BUSINESS RULES & INITIAL REQUIREMENTS')}) Tj`,
    '/F2 10 Tf',
    '0 -18 Td',
    `(${escapePdf('2.1 Buka Shift & CRF Owner Restriction')}) Tj`,
    '/F1 10 Tf',
    '0 -14 Td',
    `(${escapePdf('- Kasir wajib input nominal Initial Deposit (modal awal kembalian) saat membuka shift.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('- Isolasi akses: Hanya kasir pemilik yang boleh ubah data dan close CRF miliknya (Owner Restriction).')}) Tj`,
    '/F2 10 Tf',
    '0 -18 Td',
    `(${escapePdf('2.2 Pencatatan Transaksi Multi-Channel')}) Tj`,
    '/F1 10 Tf',
    '0 -14 Td',
    `(${escapePdf('- Support payment method: Cash, QRIS, Kartu Debit, Kartu Kredit, Xendit, dan Voucher klinik.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('- Sistem otomatis menghitung total akumulasi penerimaan per payment method ke summary CRF.')}) Tj`,
    '/F2 10 Tf',
    '0 -18 Td',
    `(${escapePdf('2.3 Tutup Shift & Alur Koreksi Invoice Pasca EOD Closing')}) Tj`,
    '/F1 10 Tf',
    '0 -14 Td',
    `(${escapePdf('- Kasir melakukan closing CRF di akhir shift, dilanjutkan proses EOD Closing harian klinik.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('- Koreksi invoice setelah EOD closing dapat diajukan kasir maksimal 7 hari kalender (Correction Window).')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('- Pengajuan koreksi invoice wajib di-approve oleh Finance Supervisor.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('- Jika di-approve, invoice dan CRF beralih status ke Under Revision untuk rekonsiliasi ulang kasir.')}) Tj`,
    '/F2 11 Tf',
    '0 -26 Td',
    `(${escapePdf('3. ACCEPTANCE CRITERIA')}) Tj`,
    '/F1 10 Tf',
    '0 -16 Td',
    `(${escapePdf('AC-1: Validasi initial deposit wajib diisi dan bernilai positif sebelum shift dibuka.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('AC-2: Percobaan akses edit/tutup CRF oleh kasir lain di-reject dengan error 403 Forbidden.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('AC-3: Pengajuan koreksi invoice lewat dari 7 hari kalender di-reject sistem secara otomatis.')}) Tj`,
    '0 -14 Td',
    `(${escapePdf('AC-4: Invoice dan CRF berstatus Under Revision sebelum kasir menyelesaikan verifikasi re-close.')}) Tj`,
    'ET'
  ];
  return lines.join('\n');
}

const page1Text = buildPage1();
const pdfBuffer = generatePdfBuffer([page1Text]);

const targetPdfPath = join(process.cwd(), 'fixtures/cashier-receipt-form/documents/01-fsd-cashier-receipt-form.pdf');
writeFileSync(targetPdfPath, pdfBuffer);
console.log('Regenerated natural PDF successfully at:', targetPdfPath, 'size:', pdfBuffer.length, 'bytes');
