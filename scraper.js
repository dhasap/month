const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

// Fungsi untuk memastikan folder ada
const ensureDirectoryExistence = (filePath) => {
  const dirname = require('path').dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log("Memulai scraper produksi...");

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');

    console.log("Membuka halaman utama Komikcast...");
    await page.goto('https://komikcast.li', { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("Mengambil daftar chapter terbaru dari 'Update Projek'...");
    const latestChapters = await page.evaluate(() => {
      const results = [];
      // *** INI DIA KACAMATA BARUNYA ***
      // Kita menargetkan daftar "Update Projek" yang lebih stabil
      const items = document.querySelectorAll('.listupd.project .utao');
      
      for (let i = 0; i < Math.min(items.length, 15); i++) {
        const item = items[i];
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
      }
      return results;
    });

    if (latestChapters.length === 0) {
      console.error("Tidak ada data chapter yang ditemukan. Mungkin desain website berubah. Menghentikan proses.");
      process.exit(1);
    }

    console.log(`Berhasil mendapatkan ${latestChapters.length} chapter terbaru. Menyimpan daftar isi...`);
    ensureDirectoryExistence('data/manga-list.json');
    fs.writeFileSync('data/manga-list.json', JSON.stringify(latestChapters, null, 2));

    console.log("Memulai proses pengambilan gambar untuk setiap chapter...");
    for (const chapter of latestChapters) {
      console.log(`Mengambil data untuk: ${chapter.title} - ${chapter.latest_chapter_text}`);
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
      console.log(`Data berhasil disimpan ke ${filePath}`);
    }

  } catch (error) {
    console.error("Terjadi error:", error);
    process.exit(1);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    console.log("Scraper produksi selesai.");
  }
})();
        
