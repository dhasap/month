const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

// --- PENGATURAN KURA-KURA ---
const HALAMAN_PER_JALAN = 5; // Ambil 5 halaman setiap kali jalan
const FILE_STATUS = 'data/kura_kura_status.json';
// ----------------------------

const ensureDirectoryExistence = (filePath) => {
  const dirname = require('path').dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log("KURA-KURA: Memulai pekerjaan arsip...");

  try {
    // Baca status terakhir
    let status = { lastPage: 0 };
    if (fs.existsSync(FILE_STATUS)) {
      status = JSON.parse(fs.readFileSync(FILE_STATUS, 'utf-8'));
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
    if (fs.existsSync('data/archive-list.json')) {
        allOldComics = JSON.parse(fs.readFileSync('data/archive-list.json', 'utf-8'));
    }

    for (let i = 0; i < HALAMAN_PER_JALAN; i++) {
      const currentPage = startPage + i;
      // Target halaman daftar komik utama
      const url = `https://komikcast.li/daftar-komik/page/${currentPage}/`;
      console.log(`KURA-KURA: Mengambil data dari ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      const comicsOnPage = await page.evaluate(() => {
        const results = [];
        // Selector yang berbeda untuk halaman daftar komik
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
          break;
      }
      
      allOldComics.push(...comicsOnPage);
      console.log(`KURA-KURA: Berhasil mendapatkan ${comicsOnPage.length} data dari halaman ${currentPage}.`);
    }
    
    // Hapus duplikat berdasarkan endpoint
    const uniqueComics = Array.from(new Map(allOldComics.map(item => [item['endpoint'], item])).values());

    console.log(`KURA-KURA: Total ${uniqueComics.length} komik di arsip. Menyimpan...`);
    ensureDirectoryExistence('data/archive-list.json');
    fs.writeFileSync('data/archive-list.json', JSON.stringify(uniqueComics, null, 2));

    // Simpan halaman berikutnya untuk pekerjaan selanjutnya
    status.lastPage = startPage + HALAMAN_PER_JALAN - 1;
    fs.writeFileSync(FILE_STATUS, JSON.stringify(status));
    console.log(`KURA-KURA: Pekerjaan selesai. Pekerjaan selanjutnya akan dimulai dari halaman ${status.lastPage + 1}`);

  } catch (error) {
    console.error("KURA-KURA ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
                                                 
