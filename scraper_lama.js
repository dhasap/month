const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

// --- PENGATURAN KURA-KURA ---
const HALAMAN_PER_JALAN = 5; // Ambil 5 halaman setiap kali jalan
const FILE_STATUS = 'data/kura_kura_status.json';
const FILE_ARSIP = 'data/archive-list.json';
// ----------------------------

const ensureDirectoryExistence = (filePath) => {
  const dirname = require('path').dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log("KURA-KURA: Memulai pekerjaan arsip dengan mata baru...");

  try {
    // Baca status terakhir
    let status = { lastPage: 0 };
    ensureDirectoryExistence(FILE_STATUS);
    if (fs.existsSync(FILE_STATUS)) {
      try {
        status = JSON.parse(fs.readFileSync(FILE_STATUS, 'utf-8'));
      } catch (e) {
        console.log("File status rusak atau kosong, memulai dari awal.");
      }
    }
    const startPage = status.lastPage + 1;
    console.log(`KURA-KURA: Memulai dari halaman ${startPage}`);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    let allOldComics = [];
    if (fs.existsSync(FILE_ARSIP)) {
        allOldComics = JSON.parse(fs.readFileSync(FILE_ARSIP, 'utf-8'));
    }

    for (let i = 0; i < HALAMAN_PER_JALAN; i++) {
      const currentPage = startPage + i;
      const url = `https://komikcast.li/daftar-komik/page/${currentPage}/`;
      console.log(`KURA-KURA: Mengambil data dari ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      const comicsOnPage = await page.evaluate(() => {
        const results = [];
        // *** INI KACAMATA BARUNYA ***
        // Selector ini khusus untuk halaman /daftar-komik/
        const items = document.querySelectorAll('.list-update_item-2');
        items.forEach(item => {
          const linkElement = item.querySelector('a.series');
          const titleElement = item.querySelector('h3.title');
          const imageElement = item.querySelector('img');
          if (linkElement && titleElement && imageElement) {
            results.push({
              title: titleElement.innerText.trim(),
              cover_image: imageElement.getAttribute('data-src') || imageElement.getAttribute('src'),
              endpoint: linkElement.getAttribute('href').split('/').filter(Boolean).pop()
            });
          }
        });
        return results;
      });

      if (comicsOnPage.length === 0) {
          console.log(`KURA-KURA: Halaman ${currentPage} kosong, mungkin sudah halaman terakhir. Berhenti.`);
          status.lastPage = currentPage;
          break;
      }
      
      allOldComics.push(...comicsOnPage);
      console.log(`KURA-KURA: Berhasil mendapatkan ${comicsOnPage.length} data dari halaman ${currentPage}.`);
      status.lastPage = currentPage;
    }
    
    const uniqueComics = Array.from(new Map(allOldComics.map(item => [item['endpoint'], item])).values());

    console.log(`KURA-KURA: Total ${uniqueComics.length} komik di arsip. Menyimpan...`);
    ensureDirectoryExistence(FILE_ARSIP);
    fs.writeFileSync(FILE_ARSIP, JSON.stringify(uniqueComics, null, 2));

    fs.writeFileSync(FILE_STATUS, JSON.stringify(status));
    console.log(`KURA-KURA: Pekerjaan selesai. Pekerjaan selanjutnya akan dimulai dari halaman ${status.lastPage + 1}`);

  } catch (error) {
    console.error("KURA-KURA ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
