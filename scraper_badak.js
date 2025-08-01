const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

// --- PENGATURAN BADAK (Pembangun Arsip Cepat) ---
const HALAMAN_PER_JALAN = 25; // Ambil 25 halaman sekaligus, jauh lebih banyak dari Kura-kura
const FILE_STATUS = 'data/badak_status.json';
const FILE_ARSIP = 'data/archive-list.json';
// -------------------------------------------------

const ensureDirectoryExistence = (filePath) => {
  const dirname = require('path').dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log("BADAK: Memulai tugas berat membangun arsip komik...");

  try {
    // 1. Baca status untuk melanjutkan pekerjaan
    let status = { lastPage: 0 };
    ensureDirectoryExistence(FILE_STATUS);
    if (fs.existsSync(FILE_STATUS)) {
      try { status = JSON.parse(fs.readFileSync(FILE_STATUS, 'utf-8')); } catch (e) {}
    }
    const startPage = status.lastPage + 1;
    console.log(`BADAK: Menerjang mulai dari halaman ${startPage}`);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    // 2. Muat arsip yang sudah ada
    let allComics = [];
    ensureDirectoryExistence(FILE_ARSIP);
    if (fs.existsSync(FILE_ARSIP)) {
        try { allComics = JSON.parse(fs.readFileSync(FILE_ARSIP, 'utf-8')); } catch(e) {}
    }

    // 3. Loop dengan kecepatan tinggi
    let newComicsFound = 0;
    for (let i = 0; i < HALAMAN_PER_JALAN; i++) {
      const currentPage = startPage + i;
      const url = `https://komikcast.li/daftar-komik/page/${currentPage}/`;
      console.log(`BADAK: Memproses halaman ${currentPage}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

      const comicsOnPage = await page.evaluate(() => {
        const results = [];
        const items = document.querySelectorAll('.list-update_item');
        items.forEach(item => {
          const linkElement = item.querySelector('a');
          const titleElement = item.querySelector('h3.title');
          const imageElement = item.querySelector('img');
          if (linkElement && titleElement && imageElement) {
            const endpoint = linkElement.getAttribute('href').split('/').filter(Boolean).pop();
            results.push({
              title: titleElement.innerText.trim(),
              cover_image: imageElement.getAttribute('src'),
              endpoint: endpoint
            });
          }
        });
        return results;
      });

      if (comicsOnPage.length === 0) {
          console.log(`BADAK: Halaman ${currentPage} kosong. Kemungkinan besar pekerjaan telah SELESAI.`);
          status.lastPage = currentPage; // Tetap simpan halaman terakhir yang dicek
          break; // Hentikan loop jika halaman sudah kosong
      }
      
      allComics.push(...comicsOnPage);
      newComicsFound += comicsOnPage.length;
      console.log(`BADAK: Menemukan ${comicsOnPage.length} komik di halaman ${currentPage}.`);
      status.lastPage = currentPage;
    }
    
    // 4. Hapus duplikat dan simpan
    const uniqueComics = Array.from(new Map(allComics.map(item => [item['endpoint'], item])).values());
    console.log(`BADAK: Menemukan total ${newComicsFound} komik baru. Total arsip sekarang: ${uniqueComics.length} komik.`);
    
    fs.writeFileSync(FILE_ARSIP, JSON.stringify(uniqueComics, null, 2));
    fs.writeFileSync(FILE_STATUS, JSON.stringify(status));
    console.log(`BADAK: Pekerjaan selesai untuk batch ini. Posisi terakhir di halaman ${status.lastPage}.`);

  } catch (error) {
    console.error("BADAK ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
