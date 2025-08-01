const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

// --- PENGATURAN SEMUT (Pengambil Gambar) ---
const CHAPTERS_PER_RUN = 5; // Batasi jumlah chapter yang diproses per eksekusi untuk menghindari timeout
const STATUS_FILE = 'data/gambar_status.json';
const COMICS_FOLDER = 'data/comics';
// ------------------------------------------

const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log("SEMUT: Memulai pekerjaan mengambil URL gambar...");

  // Cek apakah folder data komik sudah ada
  if (!fs.existsSync(COMICS_FOLDER)) {
    console.error(`SEMUT ERROR: Folder '${COMICS_FOLDER}' tidak ditemukan. Jalankan robot Kura-kura (pengambil chapter) terlebih dahulu.`);
    process.exit(1);
  }

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    // 1. Muat status terakhir
    let status = { lastComicFile: null, lastChapterIndex: -1 };
    ensureDirectoryExistence(STATUS_FILE);
    if (fs.existsSync(STATUS_FILE)) {
      try { status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')); } catch (e) {}
    }

    // 2. Dapatkan daftar semua file komik yang sudah diarsipkan Kura-kura
    const comicFiles = fs.readdirSync(COMICS_FOLDER).filter(f => f.endsWith('.json'));
    if (comicFiles.length === 0) {
      console.log("SEMUT: Tidak ada file komik di folder 'data/comics'. Pekerjaan selesai.");
      return;
    }

    // 3. Tentukan dari mana harus memulai
    let startFileIndex = 0;
    if (status.lastComicFile) {
      startFileIndex = comicFiles.indexOf(status.lastComicFile);
      if (startFileIndex === -1) {
        console.warn(`SEMUT: File status '${status.lastComicFile}' tidak ditemukan, memulai dari awal.`);
        startFileIndex = 0; 
      }
    }
    
    let chaptersProcessed = 0;
    let newStatus = { ...status };

    // 4. Loop luar: Iterasi melalui setiap file komik
    for (let i = startFileIndex; i < comicFiles.length; i++) {
      const comicFile = comicFiles[i];
      const comicFilePath = path.join(COMICS_FOLDER, comicFile);
      let comicData;
      try {
        comicData = JSON.parse(fs.readFileSync(comicFilePath, 'utf-8'));
      } catch (e) {
        console.warn(`SEMUT: Gagal membaca ${comicFile}, melompat.`);
        continue;
      }

      if (!comicData.chapters || comicData.chapters.length === 0) {
        continue; // Lompat jika komik tidak punya chapter
      }

      let startChapterIndex = (comicFile === status.lastComicFile) ? status.lastChapterIndex + 1 : 0;

      // 5. Loop dalam: Iterasi melalui setiap chapter di dalam satu komik
      for (let j = startChapterIndex; j < comicData.chapters.length; j++) {
        if (chaptersProcessed >= CHAPTERS_PER_RUN) break;

        const chapter = comicData.chapters[j];
        if (chapter.images) { // Skip jika data gambar sudah ada
            newStatus = { lastComicFile: comicFile, lastChapterIndex: j };
            continue;
        }

        console.log(`SEMUT: Mengambil gambar untuk '${comicData.title} - ${chapter.chapter_title}'`);
        await page.goto(chapter.chapter_url, { waitUntil: 'networkidle2', timeout: 90000 });

        const imageUrls = await page.evaluate(() => {
          const images = [];
          // Selector ini krusial, cari semua gambar di dalam area baca utama
          const imageElements = document.querySelectorAll('#anjay_ini_id_khusus_buat_gambar img, .main-reading-area img');
          imageElements.forEach(img => {
            const src = img.getAttribute('src');
            if (src && src.trim() !== "") {
              images.push(src.trim());
            }
          });
          return images;
        });

        comicData.chapters[j].images = imageUrls; // Tambahkan array URL gambar ke objek chapter
        if (imageUrls.length > 0) {
            console.log(`SEMUT: Berhasil mendapatkan ${imageUrls.length} URL gambar.`);
        } else {
            console.warn(`SEMUT: Tidak ada gambar yang ditemukan di halaman.`);
        }
        
        chaptersProcessed++;
        newStatus = { lastComicFile: comicFile, lastChapterIndex: j };
      }

      // 6. Simpan kembali file komik yang sudah diperbarui dengan data gambar
      fs.writeFileSync(comicFilePath, JSON.stringify(comicData, null, 2));

      if (chaptersProcessed >= CHAPTERS_PER_RUN) break;
    }

    // 7. Simpan status akhir
    fs.writeFileSync(STATUS_FILE, JSON.stringify(newStatus));
    if (chaptersProcessed > 0) {
        console.log(`SEMUT: Pekerjaan batch selesai. Posisi terakhir di file '${newStatus.lastComicFile}', chapter index ${newStatus.lastChapterIndex}`);
    } else {
        console.log("SEMUT: Semua gambar dari semua chapter sudah berhasil diambil. Pekerjaan selesai.");
    }

  } catch (error) {
    console.error("SEMUT ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
