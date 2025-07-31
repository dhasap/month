const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

// --- PENGATURAN KELINCI ---
const JUMLAH_HALAMAN_BARU = 3; 
// -------------------------

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

    let allLatestChapters = [];
    for (let i = 1; i <= JUMLAH_HALAMAN_BARU; i++) {
      const listUrl = `https://komikcast.li/project-list/page/${i}/`;
      console.log(`KELINCI: Membuka halaman: ${listUrl}`);
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      const chaptersOnPage = await page.evaluate(() => {
        const results = [];
        const items = document.querySelectorAll('.list-update_item');
        
        items.forEach(item => {
          const titleElement = item.querySelector('h3.title');
          const chapterElement = item.querySelector('.chapter');
          const imageElement = item.querySelector('img');
          
          if (titleElement && chapterElement && imageElement) {
            const chapterUrl = chapterElement.getAttribute('href');
            if (chapterUrl) {
              results.push({
                title: titleElement.innerText.trim(),
                latest_chapter_text: chapterElement.innerText.trim(),
                cover_image: imageElement.getAttribute('src'),
                chapter_url: chapterUrl,
                chapter_endpoint: chapterUrl.split('/').filter(Boolean).pop()
              });
            }
          }
        });
        return results;
      });
      
      allLatestChapters.push(...chaptersOnPage);
      console.log(`KELINCI: Berhasil mendapatkan ${chaptersOnPage.length} data dari halaman ${i}.`);
    }

    if (allLatestChapters.length === 0) {
      console.error("KELINCI: Tidak ada data chapter yang ditemukan. Mungkin desain website berubah.");
      process.exit(1);
    }

    console.log(`KELINCI: Total ${allLatestChapters.length} chapter terbaru didapatkan. Menyimpan ke manga-list.json...`);
    ensureDirectoryExistence('data/manga-list.json');
    fs.writeFileSync('data/manga-list.json', JSON.stringify(allLatestChapters, null, 2));

    console.log("KELINCI: Memulai pengambilan detail chapter...");
    for (const chapter of allLatestChapters) {
      console.log(`KELINCI: Mengambil detail untuk: ${chapter.chapter_endpoint}`);
      await page.goto(chapter.chapter_url, { waitUntil: 'networkidle2' });

      const chapterData = await page.evaluate(() => {
        const chapterTitle = document.querySelector('.chapter_headpost h1')?.innerText.trim() || 'Judul tidak ditemukan';
        const images = Array.from(document.querySelectorAll('#chapter_body .main-reading-area img')).map(el => {
            let src = el.getAttribute('data-src') || el.getAttribute('src');
            if (src) {
                src = src.trim();
                if (src.startsWith('//')) src = 'https:' + src;
                return src.split('?')[0];
            }
            return null;
        }).filter(Boolean);
        const prev = document.querySelector('.nextprev a[rel="prev"]')?.getAttribute('href')?.split('/').filter(Boolean).pop() || null;
        const next = document.querySelector('.nextprev a[rel="next"]')?.getAttribute('href')?.split('/').filter(Boolean).pop() || null;
        return { title: chapterTitle, images, navigation: { prev, next } };
      });

      const filePath = `data/chapters/${chapter.chapter_endpoint}.json`;
      ensureDirectoryExistence(filePath);
      fs.writeFileSync(filePath, JSON.stringify(chapterData, null, 2));
      console.log(`KELINCI: Detail untuk ${chapter.chapter_endpoint} berhasil disimpan.`);
    }

  } catch (error) {
    console.error("KELINCI ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    console.log("KELINCI: Pekerjaan selesai.");
  }
})();
                                              
