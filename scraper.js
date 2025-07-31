const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

(async () => {
  let browser = null;
  console.log("Memulai scraper dalam mode kamera...");

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

    console.log("Membuka halaman Komikcast...");
    await page.goto('https://komikcast.li', { waitUntil: 'networkidle2', timeout: 60000 }); // Timeout diperpanjang

    console.log("Menunggu 5 detik untuk memastikan semua konten dimuat...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // *** INI DIA BAGIAN KAMERANYA ***
    console.log("Mengambil screenshot halaman...");
    fs.mkdirSync('debug', { recursive: true }); // Membuat folder debug
    await page.screenshot({ path: 'debug/screenshot.png', fullPage: true });
    console.log("Screenshot disimpan ke debug/screenshot.png");

    console.log("Menyimpan konten HTML halaman...");
    const htmlContent = await page.content();
    fs.writeFileSync('debug/page.html', htmlContent);
    console.log("HTML disimpan ke debug/page.html");
    
    console.log("Mengevaluasi halaman untuk mengambil data...");
    const data = await page.evaluate(() => {
      // Kita coba beberapa selector sebagai cadangan
      const selectors = ['.list-update_item', '.utao .uta .luf']; 
      let items = [];
      for (const selector of selectors) {
        items = document.querySelectorAll(selector);
        if (items.length > 0) break; // Jika ditemukan, berhenti mencari
      }

      const results = [];
      items.forEach(item => {
        const titleElement = item.querySelector('.title');
        const chapterElement = item.querySelector('.chapter');
        const imageElement = item.querySelector('img');
        const linkElement = item.querySelector('a');

        if (titleElement && chapterElement && imageElement && linkElement) {
          results.push({
            title: titleElement.innerText.trim(),
            latest_chapter: chapterElement.innerText.trim(),
            cover_image: imageElement.getAttribute('src'),
            endpoint: linkElement.getAttribute('href').replace('https://komikcast.li/komik/', '').replace('/', '')
          });
        }
      });
      return results;
    });

    console.log(`Berhasil mendapatkan ${data.length} data komik.`);
    fs.writeFileSync('debug/hasil_data.json', JSON.stringify(data, null, 2));
    console.log("Hasil data disimpan ke debug/hasil_data.json");

  } catch (error) {
    console.error("Terjadi error:", error);
    process.exit(1);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    console.log("Scraper mode kamera selesai.");
  }
})();
  
