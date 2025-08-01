const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');

// --- PENGATURAN KURA-KURA (MODE CHAPTER) ---
const KOMIK_PER_JALAN = 5; 
const FILE_STATUS = 'data/kura_kura_chapter_status.json';
const FILE_ARSIP_KOMIK = 'data/archive-list.json';
const FOLDER_HASIL_CHAPTER = 'data/comics';
// -------------------------------------------

const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log("KURA-KURA (Mode Chapter): Memulai pekerjaan mengambil daftar chapter...");

  if (!fs.existsSync(FILE_ARSIP_KOMIK)) {
    console.error(`KURA-KURA ERROR: File arsip '${FILE_ARSIP_KOMIK}' tidak ditemukan. Jalankan scraper arsip judul komik terlebih dahulu.`);
    process.exit(1);
  }

  try {
    let status = { lastComicIndex: -1 }; 
    ensureDirectoryExistence(FILE_STATUS);
    if (fs.existsSync(FILE_STATUS)) {
      try {
        status = JSON.parse(fs.readFileSync(FILE_STATUS, 'utf-8'));
      } catch (e) {
        console.warn("KURA-KURA WARNING: Gagal membaca file status, memulai dari awal.");
      }
    }

    const allComics = JSON.parse(fs.readFileSync(FILE_ARSIP_KOMIK, 'utf-8'));
    const startIndex = status.lastComicIndex + 1;

    if (startIndex >= allComics.length) {
      console.log("KURA-KURA: Semua chapter dari semua komik di arsip sudah berhasil diambil. Pekerjaan selesai.");
      return; 
    }

    console.log(`KURA-KURA: Akan memproses dari komik index ${startIndex}`);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    let comicProcessedCount = 0;
    for (let i = startIndex; i < allComics.length && comicProcessedCount < KOMIK_PER_JALAN; i++) {
      const comic = allComics[i];
      const comicUrl = `https://komikcast.li/komik/${comic.endpoint}/`;
      const outputFilePath = path.join(FOLDER_HASIL_CHAPTER, `${comic.endpoint}.json`);
      
      console.log(`KURA-KURA: Mengambil chapter untuk '${comic.title}' dari ${comicUrl}`);
      await page.goto(comicUrl, { waitUntil: 'networkidle2', timeout: 90000 });

      const chapterList = await page.evaluate(() => {
        const chapters = [];
        
        // ==================================================================
        // INI BAGIAN YANG DIPERBAIKI
        // Selector lama yang salah: '.clstyle li'
        // Selector baru yang benar: '.eplister li'
        const chapterElements = document.querySelectorAll('.eplister li'); 
        // ==================================================================

        chapterElements.forEach(el => {
          const link = el.querySelector('a');
          const chapterText = el.querySelector('.chapternum');
          const chapterDate = el.querySelector('.chapterdate');

          if (link && chapterText && chapterDate) {
            const url = link.getAttribute('href');
            chapters.push({
              chapter_title: chapterText.innerText.trim(),
              chapter_endpoint: url.split('/').filter(Boolean).pop(),
              chapter_url: url,
              release_date: chapterDate.innerText.trim()
            });
          }
        });
        return chapters;
      });

      if (chapterList.length > 0) {
        ensureDirectoryExistence(outputFilePath);
        const comicDetail = {
          ...comic, 
          chapters: chapterList,
          last_updated: new Date().toISOString()
        };
        fs.writeFileSync(outputFilePath, JSON.stringify(comicDetail, null, 2));
        console.log(`KURA-KURA: Berhasil menyimpan ${chapterList.length} chapter untuk '${comic.title}' ke ${outputFilePath}`);
      } else {
        console.warn(`KURA-KURA WARNING: Tidak ada chapter yang ditemukan untuk '${comic.title}'.`);
      }

      status.lastComicIndex = i; 
      comicProcessedCount++;
    }

    fs.writeFileSync(FILE_STATUS, JSON.stringify(status));
    console.log(`KURA-KURA: Pekerjaan batch selesai. Posisi terakhir di index komik: ${status.lastComicIndex}`);

  } catch (error) {
    console.error("KURA-KURA (Mode Chapter) ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
