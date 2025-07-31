const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

(async () => {
  let browser = null;
  console.log("Memulai scraper dalam mode kamera untuk halaman PROJEK...");

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

    // Kita akan fokus pada satu halaman saja untuk di-debug
    const targetUrl = 'https://komikcast.li/project-list/page/1/';
    console.log(`Membuka halaman target: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("Menunggu 5 detik untuk memastikan semua konten dimuat...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // *** BAGIAN KAMERA ***
    console.log("Mengambil screenshot halaman...");
    fs.mkdirSync('debug', { recursive: true }); // Membuat folder debug
    await page.screenshot({ path: 'debug/screenshot_project.png', fullPage: true });
    console.log("Screenshot disimpan ke debug/screenshot_project.png");

    console.log("Menyimpan konten HTML halaman...");
    const htmlContent = await page.content();
    fs.writeFileSync('debug/page_project.html', htmlContent);
    console.log("HTML disimpan ke debug/page_project.html");
    
    console.log("Mencoba mengevaluasi halaman...");
    const data = await page.evaluate(() => {
      // Kita tetap coba selector lama, hasilnya akan disimpan
      const items = document.querySelectorAll('.listupd.project .utao');
      return {
        jumlah_item_ditemukan: items.length
      };
    });

    console.log(`Hasil evaluasi: ${data.jumlah_item_ditemukan} item ditemukan.`);
    fs.writeFileSync('debug/hasil_data_project.json', JSON.stringify(data, null, 2));
    console.log("Hasil data disimpan ke debug/hasil_data_project.json");

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
