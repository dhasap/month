const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');

(async () => {
  let browser = null;
  console.log("Memulai scraper dalam mode kamera untuk halaman DAFTAR KOMIK...");

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

    // Kita akan fokus pada halaman yang dijelajahi si Kura-kura
    const targetUrl = 'https://komikcast.li/daftar-komik/page/1/';
    console.log(`Membuka halaman target: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log("Menunggu 5 detik untuk memastikan semua konten dimuat...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // *** BAGIAN KAMERA ***
    console.log("Mengambil screenshot halaman...");
    fs.mkdirSync('debug', { recursive: true });
    await page.screenshot({ path: 'debug/screenshot_daftar_komik.png', fullPage: true });
    console.log("Screenshot disimpan ke debug/screenshot_daftar_komik.png");

    console.log("Menyimpan konten HTML halaman...");
    const htmlContent = await page.content();
    fs.writeFileSync('debug/page_daftar_komik.html', htmlContent);
    console.log("HTML disimpan ke debug/page_daftar_komik.html");
    
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
