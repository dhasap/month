// scraper.js - Otak Si Kelinci
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

const JUMLAH_HALAMAN_BARU = 2;

const ensureDirectoryExistence = (filePath) => {
  const dirname = require('path').dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log(`KELINCI: Memulai scraper untuk ${JUMLAH_HALAMAN_BARU} halaman terbaru...`);
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    let latestChapters = [];
    for (let i = 1; i <= JUMLAH_HALAMAN_BARU; i++) {
      const url = `https://komikcast.li/project-list/page/${i}/`;
      console.log(`KELINCI: Mengambil data dari ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });
      const chaptersOnPage = await page.evaluate(() => {
        const results = [];
        const items = document.querySelectorAll('.listupd.project .utao');
        items.forEach(item => {
          const titleElement = item.querySelector('.luf > a.series > h3');
          const chapterLinkElement = item.querySelector('.luf ul li:first-child a');
          const imageElement = item.querySelector('.imgu a img');
          if (titleElement && chapterLinkElement && imageElement) {
            const chapterUrl = chapterLinkElement.getAttribute('href');
            results.push({
              title: titleElement.innerText.trim(),
              latest_chapter_text: chapterLinkElement.innerText.trim(),
              cover_image: imageElement.getAttribute('data-src') || imageElement.getAttribute('src'),
              chapter_url: chapterUrl,
              chapter_endpoint: chapterUrl.split('/').filter(Boolean).pop()
            });
          }
        });
        return results;
      });
      latestChapters.push(...chaptersOnPage);
    }

    console.log(`KELINCI: Berhasil mendapatkan ${latestChapters.length} data. Menyimpan ke manga-list.json...`);
    ensureDirectoryExistence('data/manga-list.json');
    fs.writeFileSync('data/manga-list.json', JSON.stringify(latestChapters, null, 2));

  } catch (error) {
    console.error("KELINCI ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    console.log("KELINCI: Pekerjaan selesai.");
  }
})();
  
