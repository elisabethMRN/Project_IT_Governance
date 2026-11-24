// =====================================================
// SAPA BPOM - Sistem Asisten Pendampingan UMKM
// WhatsApp Chatbot + Gemini AI + MySQL
// =====================================================

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const mysql = require('mysql2/promise');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// =====================================================
// KONFIGURASI — edit sesuai kebutuhan
// =====================================================

// Nomor WA pegawai BPOM yang terima notifikasi eskalasi
// Format: 628xxxxxxxxxx@s.whatsapp.net
const NOMOR_PEGAWAI_BPOM = '628xxxxxxxxxx@s.whatsapp.net';

// Kata kunci yang langsung trigger eskalasi ke pegawai
const TRIGGER_ESKALASI = [
    'konsultasi langsung',
    'minta bantuan petugas',
    'hubungi petugas',
    'bicara dengan petugas',
    'tanya petugas',
    'operator',
    'cs',
    'customer service',
];

// =====================================================
// KONEKSI MYSQL
// =====================================================
let db;

async function koneksiMySQL() {
    try {
        db = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'bpom_chatbot',
            waitForConnections: true,
            connectionLimit: 10,
        });

        // Buat tabel jika belum ada
        await db.query(`
            CREATE TABLE IF NOT EXISTS pengetahuan_bpom (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kategori VARCHAR(100) NOT NULL,
                pertanyaan TEXT NOT NULL,
                jawaban TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS riwayat_chat (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nomor_wa VARCHAR(30) NOT NULL,
                nama_usaha VARCHAR(100),
                pesan_masuk TEXT NOT NULL,
                pesan_keluar TEXT NOT NULL,
                status ENUM('ai','eskalasi','menu','sapaan') DEFAULT 'ai',
                waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS data_umkm (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nomor_wa VARCHAR(30) UNIQUE NOT NULL,
                nama_usaha VARCHAR(100),
                jenis_produk VARCHAR(100),
                pertama_konsultasi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                terakhir_konsultasi TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Insert data pengetahuan BPOM jika tabel masih kosong
        const [rows] = await db.query('SELECT COUNT(*) as total FROM pengetahuan_bpom');
        if (rows[0].total === 0) {
            await insertDataBPOM();
        }

        console.log('✓ Terhubung ke MySQL!');
    } catch (err) {
        console.error('✗ Gagal koneksi MySQL:', err.message);
        console.error('Pastikan XAMPP MySQL sudah Running dan file .env sudah diisi!');
        process.exit(1);
    }
}

// Insert data pengetahuan BPOM ke database
async function insertDataBPOM() {
    const data = [
        ['SPP-IRT', 'Apa itu SPP-IRT?', 'SPP-IRT adalah Sertifikat Produksi Pangan Industri Rumah Tangga. Izin ini diberikan kepada usaha rumahan yang memproduksi pangan olahan agar produk yang dijual aman dan memenuhi standar pemerintah.'],
        ['SPP-IRT', 'Siapa yang wajib memiliki SPP-IRT?', 'SPP-IRT wajib dimiliki pelaku usaha pangan skala rumah tangga yang memproduksi pangan olahan, dipasarkan di wilayah Indonesia, dan tidak termasuk kategori wajib MD/ML. Contoh: keripik, kue kering, sambal kemasan, minuman herbal.'],
        ['SPP-IRT', 'Apa perbedaan SPP-IRT dengan MD dan ML?', 'SPP-IRT untuk usaha rumahan/skala kecil diurus ke Dinas Kesehatan. MD untuk produk dalam negeri skala menengah-besar diurus ke BPOM. ML untuk produk impor diurus ke BPOM. Usaha skala rumahan cukup SPP-IRT dulu.'],
        ['SPP-IRT', 'Apa persyaratan verifikasi produk SPP-IRT?', 'Persyaratan verifikasi produk SPP-IRT: sampel produk yang akan didaftarkan, keterangan bahan baku dan komposisi, cara pengolahan/proses produksi, dan kemasan produk yang sudah berlabel. Verifikasi dilakukan petugas Dinas Kesehatan.'],
        ['Label Produk', 'Apa saja yang wajib ada di label produk pangan IRT?', 'Label produk pangan IRT wajib memuat: nama produk, daftar komposisi/bahan, berat/isi bersih, nama dan alamat produsen, tanggal kedaluwarsa, dan nomor SPP-IRT setelah izin terbit. Label harus dicetak, tidak boleh tulisan tangan.'],
        ['CPPOB', 'Apa itu CPPOB dan persyaratannya?', 'CPPOB adalah Cara Produksi Pangan Olahan yang Baik. Persyaratannya: lokasi dan bangunan produksi bersih, peralatan higienis dan terawat, pengendalian hama, kesehatan dan kebersihan pekerja, penyimpanan bahan baku yang tepat, dan air yang digunakan harus bersih. Petugas Dinas Kesehatan akan cek langsung ke lokasi.'],
        ['SPP-IRT', 'Kemana mengurus SPP-IRT dan dokumen apa saja?', 'Pengurusan SPP-IRT di Dinas Kesehatan Kabupaten/Kota setempat. Dokumen yang disiapkan: KTP pemilik usaha, surat keterangan domisili usaha, denah lokasi produksi, data produk (nama, komposisi, proses), contoh label produk, dan foto sarana produksi.'],
        ['SPP-IRT', 'Bagaimana alur pengajuan SPP-IRT?', 'Alur pengajuan SPP-IRT: (1) Daftar usaha di OSS (oss.go.id) dan dapatkan NIB, (2) Ajukan permohonan ke Dinas Kesehatan, (3) Verifikasi dokumen oleh petugas, (4) Kunjungan petugas ke lokasi produksi, (5) Ikuti PKP jika diminta, (6) SPP-IRT diterbitkan. Estimasi 7-14 hari kerja.'],
        ['Pengujian', 'Berapa biaya pengujian sampel di laboratorium BPOM?', 'Biaya uji sampel di laboratorium BPOM: uji mikrobiologi Rp150.000-Rp500.000/parameter, uji kimia Rp200.000-Rp800.000/parameter. Untuk UMKM tersedia program subsidi/keringanan biaya. Hubungi laboratorium BPOM terdekat untuk info terkini.'],
        ['Pengujian', 'Berapa lama proses pengujian sampel?', 'Lama waktu pengujian: uji mikrobiologi 5-14 hari kerja, uji kimia 7-21 hari kerja, uji lengkap 21-30 hari kerja. Bisa lebih lama jika antrean banyak atau perlu uji ulang. Disarankan kirim sampel lebih awal.'],
        ['Pengujian', 'Bagaimana cara pengiriman sampel ke laboratorium BPOM?', 'Persyaratan pengiriman sampel: kemasan asli dan tersegel, belum melewati tanggal kedaluwarsa, minimal 3-5 unit, disertai formulir permohonan pengujian. Cara kirim: antar langsung ke Balai POM terdekat atau via jasa pengiriman untuk produk tidak mudah rusak. Hubungi lab BPOM setempat sebelum mengirim.'],
        ['Pengaduan', 'Bagaimana cara menyampaikan pengaduan ke BPOM?', 'Saluran pengaduan BPOM: HALOBPOM 1500533, Email halobpom@pom.go.id, WhatsApp 08121989900, Website www.pom.go.id, Aplikasi BPOM Mobile. Jam Operasional Senin-Jumat 08.00-18.00 WIB. Di luar jam kerja gunakan email atau aplikasi.'],
        ['Pengaduan', 'Apa saja jenis pengaduan yang bisa disampaikan ke BPOM?', 'Jenis pengaduan yang bisa disampaikan: produk pangan/obat/kosmetik yang diduga tidak aman, produk tanpa izin edar yang beredar, pemalsuan produk, iklan produk yang menyesatkan, kendala proses pengurusan izin, dan pelayanan petugas yang kurang memuaskan.'],
        ['Umum', 'Produk pangan rumahan termasuk kategori apa?', 'Produk pangan skala rumahan umumnya masuk kategori PIRT (Pangan Industri Rumah Tangga). Contoh: keripik, kue kering, sirup, jamu, sambal kemasan. Produk yang TIDAK bisa pakai SPP-IRT (wajib MD): susu, daging, produk kaleng, minuman beralkohol.'],
        ['Umum', 'Apakah produk rumahan wajib didaftarkan?', 'Ya, produk pangan rumahan yang dijual wajib memiliki izin edar! Alasannya: menjamin keamanan produk untuk konsumen, melindungi produsen secara hukum, meningkatkan kepercayaan konsumen, dan memungkinkan produk masuk toko/supermarket modern. Produk tanpa izin dapat dikenakan sanksi.'],
        ['Umum', 'Produk sudah beredar tapi belum berizin, bagaimana solusinya?', 'Masih bisa diurus sekarang! Langkahnya: (1) Hentikan penjualan sementara selama proses izin, (2) Daftar usaha di OSS (oss.go.id) untuk dapat NIB, (3) Ajukan SPP-IRT ke Dinas Kesehatan setempat, (4) Setelah izin terbit, cantumkan nomor SPP-IRT di label. Semakin cepat diurus semakin baik.'],
        ['Izin Edar', 'Bagaimana cara mendaftar izin edar BPOM secara online?', 'Pendaftaran izin edar online melalui: buka website e-reg.pom.go.id, daftar akun perusahaan, lengkapi data perusahaan dan produk, upload dokumen persyaratan, bayar PNBP sesuai jenis produk, tunggu proses verifikasi BPOM.'],
        ['Izin Edar', 'Berapa biaya mengurus izin edar BPOM?', 'Biaya izin edar (PNBP) bervariasi tergantung jenis produk. Untuk pangan olahan UMKM berkisar Rp100.000-Rp500.000. SPP-IRT melalui Dinkes umumnya gratis atau biaya administrasi kecil. Informasi biaya terbaru bisa cek di e-reg.pom.go.id.'],
    ];

    for (const [kategori, pertanyaan, jawaban] of data) {
        await db.query(
            'INSERT INTO pengetahuan_bpom (kategori, pertanyaan, jawaban) VALUES (?, ?, ?)',
            [kategori, pertanyaan, jawaban]
        );
    }
    console.log('✓ Data pengetahuan BPOM berhasil dimasukkan ke database!');
}

// Ambil semua data BPOM dari database untuk konteks AI
async function ambilDataBPOM() {
    const [rows] = await db.query('SELECT kategori, pertanyaan, jawaban FROM pengetahuan_bpom');
    let konteks = '';
    rows.forEach(row => {
        konteks += `Kategori: ${row.kategori}\n`;
        konteks += `Q: ${row.pertanyaan}\n`;
        konteks += `A: ${row.jawaban}\n\n`;
    });
    return konteks;
}

// Simpan riwayat chat ke MySQL
async function simpanRiwayat(nomorWA, pesanMasuk, pesanKeluar, status = 'ai') {
    try {
        // Ambil nama usaha jika ada
        const [umkm] = await db.query(
            'SELECT nama_usaha FROM data_umkm WHERE nomor_wa = ?', [nomorWA]
        );
        const namaUsaha = umkm.length > 0 ? umkm[0].nama_usaha : null;

        await db.query(
            'INSERT INTO riwayat_chat (nomor_wa, nama_usaha, pesan_masuk, pesan_keluar, status) VALUES (?, ?, ?, ?, ?)',
            [nomorWA, namaUsaha, pesanMasuk, pesanKeluar, status]
        );
    } catch (err) {
        console.error('Gagal simpan riwayat:', err.message);
    }
}

// Cek dan simpan data UMKM
async function cekAtauSimpanUMKM(nomorWA) {
    const [rows] = await db.query(
        'SELECT * FROM data_umkm WHERE nomor_wa = ?', [nomorWA]
    );
    return rows.length > 0 ? rows[0] : null;
}

async function simpanUMKM(nomorWA, namaUsaha, jenisProduk) {
    await db.query(
        `INSERT INTO data_umkm (nomor_wa, nama_usaha, jenis_produk)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
         nama_usaha = VALUES(nama_usaha),
         jenis_produk = VALUES(jenis_produk),
         terakhir_konsultasi = CURRENT_TIMESTAMP`,
        [nomorWA, namaUsaha, jenisProduk]
    );
}

// =====================================================
// GEMINI AI
// =====================================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.7,
    },
});

async function tanyaGemini(pesanUMKM, namaUsaha = 'Kakak') {
    try {
        const dataBPOM = await ambilDataBPOM();

        const prompt = `
Kamu adalah "SAPA" - Asisten Virtual resmi BPOM (Badan Pengawas Obat dan Makanan) 
untuk membantu pendampingan UMKM.

KEPRIBADIAN:
- Ramah, sopan, dan sabar
- Gunakan bahasa Indonesia yang mudah dipahami UMKM
- Sapa pengguna dengan "Kakak" atau nama usahanya jika diketahui
- Gunakan emoji yang sesuai agar tidak kaku
- Jawab ringkas tapi lengkap
- Selalu akhiri dengan tawaran bantuan lanjutan

DATA PENGETAHUAN BPOM:
${dataBPOM}

ATURAN PENTING:
- Jawab HANYA berdasarkan data pengetahuan BPOM di atas
- Jika pertanyaan di luar data yang ada, katakan dengan jujur bahwa kamu belum punya informasinya
- Jika pertanyaan butuh konsultasi lebih dalam, sarankan ketik "konsultasi langsung"
- Jangan mengarang informasi yang tidak ada di data
- Nama UMKM yang sedang konsultasi: ${namaUsaha}

Pertanyaan UMKM: ${pesanUMKM}
`;

        const result = await model.generateContent(prompt);
        return result.response.text();

    } catch (err) {
        console.error('Error Gemini:', err.message);
        return `Maaf kak, sistem AI sedang gangguan sementara 🙏\n\nUntuk pertanyaan mendesak, silakan hubungi BPOM langsung:\n📞 HALOBPOM: 1500533\n⏰ Senin-Jumat: 08.00-18.00 WIB`;
    }
}

// =====================================================
// SESI REGISTRASI UMKM (simpan sementara di memori)
// =====================================================
const sesiRegistrasi = {};

// =====================================================
// BOT WHATSAPP
// =====================================================
async function startBot() {
    console.log('Menginisialisasi auth...');
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    console.log('Mengambil versi Baileys...');
    let version;
    try {
        const result = await fetchLatestBaileysVersion();
        version = result.version;
        console.log(`Versi Baileys: ${version}`);
    } catch (e) {
        version = [2, 3000, 1015901307];
        console.log('Pakai versi fallback:', version);
    }

    console.log('Membuat koneksi WhatsApp...');
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['SAPA BPOM', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        getMessage: async () => undefined,
    });

    // ─── Handle koneksi ───────────────────────────────────────────────────────
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('\n=== Scan QR Code berikut dengan WhatsApp Anda ===\n');
            qrcode.generate(qr, { small: true });
            console.log('\n=================================================\n');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Koneksi terputus (kode: ${statusCode}). Reconnect: ${shouldReconnect}`);
            if (shouldReconnect) {
                console.log('Mencoba reconnect dalam 3 detik...');
                setTimeout(() => startBot(), 3000);
            } else {
                console.log('Sesi logout. Hapus folder auth_info dan jalankan ulang.');
            }
        } else if (connection === 'open') {
            console.log('✓ SAPA BPOM terhubung dan siap menerima pesan!\n');
        } else if (connection === 'connecting') {
            console.log('Menghubungkan ke WhatsApp...');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ─── Handle pesan masuk ───────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (msg.key.fromMe || !msg.message) return;

        // Abaikan pesan dari grup
        const from = msg.key.remoteJid;
        if (from.endsWith('@g.us')) return;

        const teks = (
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text || ''
        ).trim();

        if (!teks) return;

        console.log(`\n[PESAN] dari ${from}: "${teks}"`);

        try {
            // ─── CEK TRIGGER ESKALASI ─────────────────────────────────────────
            const teksLower = teks.toLowerCase();
            const butuhEskalasi = TRIGGER_ESKALASI.some(t => teksLower.includes(t));

            if (butuhEskalasi) {
                await prosesEskalasi(sock, from, teks, msg);
                return;
            }

            // ─── CEK SESI REGISTRASI ──────────────────────────────────────────
            if (sesiRegistrasi[from]) {
                await prosesRegistrasi(sock, from, teks);
                return;
            }

            // ─── CEK APAKAH UMKM SUDAH TERDAFTAR ─────────────────────────────
            const dataUMKM = await cekAtauSimpanUMKM(from);

            if (!dataUMKM) {
                // UMKM baru - mulai registrasi
                sesiRegistrasi[from] = { step: 1 };

                const pesanSambut = `Halo! Selamat datang di *SAPA BPOM* 🌟\n\n` +
                    `Saya adalah asisten virtual untuk membantu pendampingan UMKM seputar perizinan dan informasi BPOM.\n\n` +
                    `Sebelum mulai, boleh kenalan dulu ya kak 😊\n` +
                    `*Apa nama usaha Kakak?*`;

                await kirimPesan(sock, from, pesanSambut, msg);
                await simpanRiwayat(from, teks, pesanSambut, 'sapaan');
                return;
            }

            // ─── SAPAAN → TAMPIL MENU ─────────────────────────────────────────
            const GREETINGS = ['halo', 'hai', 'hello', 'hi', 'hei', 'pagi', 'siang',
                'sore', 'malam', 'selamat', 'assalamu', 'permisi', 'mulai',
                'start', 'menu', 'hallo', 'hy'];
            const isSapaan = GREETINGS.some(g =>
                teksLower === g ||
                teksLower.startsWith(g + ' ') ||
                teksLower.startsWith(g + ',')
            );

            if (isSapaan) {
                const pesanMenu = `Halo kak *${dataUMKM.nama_usaha}*! 👋\n\n` +
                    `Saya SAPA, asisten virtual BPOM siap membantu kamu 😊\n\n` +
                    `Silakan tanyakan apa saja seputar:\n` +
                    `• SPP-IRT & perizinan\n` +
                    `• Label & kemasan produk\n` +
                    `• Pengujian sampel\n` +
                    `• Pengaduan\n` +
                    `• Dan informasi BPOM lainnya\n\n` +
                    `Ketik pertanyaan kamu langsung ya kak! 🙏\n` +
                    `_(Ketik *konsultasi langsung* jika ingin dihubungkan ke petugas BPOM)_`;

                await kirimPesan(sock, from, pesanMenu, msg);
                await simpanRiwayat(from, teks, pesanMenu, 'sapaan');
                return;
            }

            // ─── SEMUA PESAN → GEMINI AI (OPSI B) ────────────────────────────
            console.log(`[AI] Memproses pertanyaan dari ${dataUMKM.nama_usaha}...`);
            const jawaban = await tanyaGemini(teks, dataUMKM.nama_usaha);

            await kirimPesan(sock, from, jawaban, msg);
            await simpanRiwayat(from, teks, jawaban, 'ai');
            console.log(`[AI] Selesai menjawab.`);

        } catch (err) {
            console.error('Error memproses pesan:', err.message);
        }
    });

    return sock;
}

// ─── PROSES REGISTRASI UMKM BARU ─────────────────────────────────────────────
async function prosesRegistrasi(sock, from, teks) {
    const sesi = sesiRegistrasi[from];

    if (sesi.step === 1) {
        sesiRegistrasi[from].namaUsaha = teks;
        sesiRegistrasi[from].step = 2;

        const balas = `Wah, usaha *${teks}* ya kak! 😊\n\n*Produk apa yang Kakak produksi atau jual?*\n_(contoh: keripik singkong, sambal, kosmetik, dll)_`;
        await kirimPesan(sock, from, balas);
        await simpanRiwayat(from, teks, balas, 'sapaan');

    } else if (sesi.step === 2) {
        const namaUsaha = sesiRegistrasi[from].namaUsaha;
        const jenisProduk = teks;

        await simpanUMKM(from, namaUsaha, jenisProduk);
        delete sesiRegistrasi[from];

        const balas = `Terima kasih kak! Data usaha sudah tersimpan ✅\n\n` +
            `*Nama Usaha:* ${namaUsaha}\n` +
            `*Jenis Produk:* ${jenisProduk}\n\n` +
            `Sekarang Kakak bisa langsung tanya apa saja seputar BPOM ya! 🎉\n\n` +
            `Contoh pertanyaan:\n` +
            `• _"Bagaimana cara urus SPP-IRT?"_\n` +
            `• _"Apa saja syarat label produk?"_\n` +
            `• _"Berapa biaya pengujian sampel?"_\n\n` +
            `_(Ketik *konsultasi langsung* jika ingin dihubungkan ke petugas BPOM)_ 😊`;

        await kirimPesan(sock, from, balas);
        await simpanRiwayat(from, teks, balas, 'sapaan');
    }
}

// ─── PROSES ESKALASI KE PEGAWAI BPOM ─────────────────────────────────────────
async function prosesEskalasi(sock, from, teks, msg) {
    try {
        // Ambil data UMKM
        const dataUMKM = await cekAtauSimpanUMKM(from);
        const namaUsaha = dataUMKM?.nama_usaha || 'Tidak diketahui';
        const jenisProduk = dataUMKM?.jenis_produk || 'Tidak diketahui';
        const nomorBersih = from.replace('@s.whatsapp.net', '');

        // Pesan ke UMKM
        const pesanKeUMKM = `Baik kak! Pertanyaan Kakak akan diteruskan ke petugas BPOM yang berwenang 🙏\n\n` +
            `Petugas kami akan segera menghubungi Kakak. Mohon ditunggu ya!\n\n` +
            `_Jam layanan petugas: Senin-Jumat 08.00-16.00 WIB_`;

        // Pesan notifikasi ke pegawai BPOM
        const pesanKePegawai = `🔔 *NOTIFIKASI KONSULTASI UMKM*\n\n` +
            `Ada UMKM yang membutuhkan konsultasi langsung:\n\n` +
            `👤 *Nama Usaha:* ${namaUsaha}\n` +
            `📦 *Jenis Produk:* ${jenisProduk}\n` +
            `📱 *Nomor WA:* +${nomorBersih}\n\n` +
            `💬 *Pesan UMKM:*\n"${teks}"\n\n` +
            `_Silakan hubungi UMKM tersebut untuk konsultasi lebih lanjut._`;

        // Kirim ke UMKM
        await kirimPesan(sock, from, pesanKeUMKM, msg);

        // Kirim notifikasi ke pegawai BPOM
        if (NOMOR_PEGAWAI_BPOM !== '628xxxxxxxxxx@s.whatsapp.net') {
            await sock.sendMessage(NOMOR_PEGAWAI_BPOM, { text: pesanKePegawai });
            console.log(`[ESKALASI] Notifikasi terkirim ke pegawai BPOM`);
        } else {
            console.log(`[ESKALASI] Nomor pegawai belum diisi! Edit NOMOR_PEGAWAI_BPOM di kode.`);
        }

        // Simpan riwayat
        await simpanRiwayat(from, teks, pesanKeUMKM, 'eskalasi');
        console.log(`[ESKALASI] dari ${namaUsaha} (${nomorBersih}): "${teks}"`);

    } catch (err) {
        console.error('Error proses eskalasi:', err.message);
    }
}

// ─── FUNGSI KIRIM PESAN ───────────────────────────────────────────────────────
async function kirimPesan(sock, to, teks, quotedMsg = null) {
    const options = quotedMsg ? { quoted: quotedMsg } : {};
    await sock.sendMessage(to, { text: teks }, options);
}

// ─── SUPPRESS KNOWN BAILEYS DECRYPT ERRORS ───────────────────────────────────
function isMacError(err) {
    const msg = err?.message || '';
    return (
        msg.includes('Bad MAC') ||
        msg.includes('Failed to decrypt') ||
        msg.includes('Bad session') ||
        msg.includes('bad mac')
    );
}

process.on('uncaughtException', (err) => {
    if (isMacError(err)) return;
    console.error('uncaughtException:', err);
});

process.on('unhandledRejection', (err) => {
    if (isMacError(err)) return;
    console.error('unhandledRejection:', err);
});

// =====================================================
// JALANKAN SEMUA
// =====================================================
async function main() {
    console.log('🚀 Memulai SAPA BPOM Chatbot...\n');
    await koneksiMySQL();
    await startBot();
}

main().catch(err => {
    console.error('\n❌ ERROR saat startup:', err.message);
    process.exit(1);
});