// scraper_lama.js - Otak Si Kura-kura
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

const HALAMAN_PER_JALAN = 6;
const STATE_FILE = 'data/last_page.txt';

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
    // Baca halaman terakhir yang dikerjakan
    let startPage = 1;
    if (fs.existsSync(STATE_FILE)) {
      startPage = parseInt(fs.readFileSync(STATE_FILE, 'utf-8'), 10);
    }
    console.log(`KURA-KURA: Memulai dari halaman ${startPage}`);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    for (let i = 0; i < HALAMAN_PER_JALAN; i++) {
      const currentPage = startPage + i;
      const url = `https://komikcast.li/daftar-komik/page/${currentPage}/`;
      console.log(`KURA-KURA: Mengambil data dari ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      const chapterLinks = await page.evaluate(() => 
        Array.from(document.querySelectorAll('.list-update_item-2 a.series'))
             .map(a => a.getAttribute('href'))
      );

      for (const link of chapterLinks) {
        try {
          await page.goto(link, { waitUntil: 'networkidle2' });
          const chapterData = await page.evaluate(() => {
            const chapterTitle = document.querySelector('.komik_info-content-body h1')?.innerText.trim() || 'Judul tidak ditemukan';
            const images = Array.from(document.querySelectorAll('#chapter_body .main-reading-area img')).map(el => {
                let src = el.getAttribute('data-src') || el.getAttribute('src');
                if (src) {
                    src = src.trim();
                    if (src.startsWith('//')) src = 'https:' + src;
                    return src.split('?')[0];
                }
                return null;
            }).filter(Boolean);
            const endpoint = window.location.href.split('/').filter(Boolean).pop();
            return { title: chapterTitle, images, endpoint };
          });

          if (chapterData.images.length > 0) {
             const filePath = `data/chapters/${chapterData.endpoint}.json`;
             ensureDirectoryExistence(filePath);
             fs.writeFileSync(filePath, JSON.stringify(chapterData, null, 2));
             console.log(`KURA-KURA: Data untuk ${chapterData.endpoint} berhasil disimpan.`);
          }
        } catch (e) {
          console.log(`KURA-KURA: Gagal mengambil detail untuk ${link}, melompati.`);
        }
      }
    }

    // Simpan halaman berikutnya untuk pekerjaan selanjutnya
    const nextPage = startPage + HALAMAN_PER_JALAN;
    fs.writeFileSync(STATE_FILE, nextPage.toString());
    console.log(`KURA-KURA: Pekerjaan selesai. Pekerjaan selanjutnya akan dimulai dari halaman ${nextPage}`);

  } catch (error) {
    console.error("KURA-KURA ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
                                      
