const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

// --- PENGATURAN ---
// Ubah angka ini jika ingin mengambil lebih banyak halaman (Maksimal 3-4 agar aman)
const JUMLAH_HALAMAN_YANG_DIAMBIL = 3; 
// --------------------

const ensureDirectoryExistence = (filePath) => {
  const dirname = require('path').dirname(filePath);
  if (fs.existsSync(dirname)) { return true; }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

(async () => {
  let browser = null;
  console.log(`Memulai scraper produksi (target: ${JUMLAH_HALAMAN_YANG_DIAMBIL} halaman)...`);

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

    let allLatestChapters = [];

    for (let i = 1; i <= JUMLAH_HALAMAN_YANG_DIAMBIL; i++) {
      const listUrl = `https://komikcast.li/project-list/page/${i}/`;
      console.log(`Membuka halaman daftar projek: ${listUrl}`);
      await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      const chaptersOnPage = await page.evaluate(() => {
        const results = [];
        // *** INI DIA KACAMATA BARUNYA ***
        const items = document.querySelectorAll('.list-update_item');
        
        items.forEach(item => {
          const linkElement = item.querySelector('a');
          const titleElement = item.querySelector('h3.title');
          const chapterElement = item.querySelector('.chapter');
          const imageElement = item.querySelector('img');
          
          if (linkElement && titleElement && chapterElement && imageElement) {
            const chapterUrl = chapterElement.getAttribute('href'); // Ambil URL dari chapter, bukan dari item utama
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
      console.log(`Berhasil mendapatkan ${chaptersOnPage.length} data dari halaman ${i}. Total sekarang: ${allLatestChapters.length}`);
    }

    if (allLatestChapters.length === 0) {
      console.error("Tidak ada data chapter yang ditemukan. Mungkin desain website berubah. Menghentikan proses.");
      process.exit(1);
    }

    console.log(`Total ${allLatestChapters.length} chapter terbaru berhasil didapatkan. Menyimpan daftar isi...`);
    ensureDirectoryExistence('data/manga-list.json');
    fs.writeFileSync('data/manga-list.json', JSON.stringify(allLatestChapters, null, 2));

    console.log("Memulai proses pengambilan gambar untuk setiap chapter...");
    for (const chapter of allLatestChapters) {
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
          
