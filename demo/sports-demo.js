import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sports website content
const SPORTS_SITE = {
  html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sports Central - Your Ultimate Sports Hub</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header class="hero">
        <nav class="navbar">
            <div class="logo">⚽ Sports Central</div>
            <ul class="nav-links">
                <li><a href="#football">Football</a></li>
                <li><a href="#basketball">Basketball</a></li>
                <li><a href="#tennis">Tennis</a></li>
                <li><a href="#news">News</a></li>
            </ul>
        </nav>
        <div class="hero-content">
            <h1>Welcome to Sports Central</h1>
            <p>Your ultimate destination for live scores, news, and highlights</p>
            <button class="cta-btn">Watch Live Now</button>
        </div>
    </header>

    <section id="featured" class="featured-section">
        <h2>Featured Matches</h2>
        <div class="featured-grid">
            <div class="match-card">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Stadium_of_light.jpg/800px-Stadium_of_light.jpg" alt="Stadium">
                <div class="match-info">
                    <h3>Premier League</h3>
                    <p class="teams">Manchester United vs Liverpool</p>
                    <p class="score">2 - 1</p>
                    <span class="live-badge">LIVE</span>
                </div>
            </div>
            <div class="match-card">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Basketball_arena.jpg/800px-Basketball_arena.jpg" alt="Basketball Court">
                <div class="match-info">
                    <h3>NBA Finals</h3>
                    <p class="teams">Lakers vs Celtics</p>
                    <p class="score">98 - 95</p>
                    <span class="live-badge">LIVE</span>
                </div>
            </div>
            <div class="match-card">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Tennis_Racket_and_Balls.jpg/800px-Tennis_Racket_and_Balls.jpg" alt="Tennis">
                <div class="match-info">
                    <h3>Wimbledon</h3>
                    <p class="teams">Djokovic vs Nadal</p>
                    <p class="score">6-4, 3-2</p>
                    <span class="upcoming-badge">IN PROGRESS</span>
                </div>
            </div>
        </div>
    </section>

    <section id="news" class="news-section">
        <h2>Latest Sports News</h2>
        <div class="news-grid">
            <article class="news-card">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Football_iu_1996.jpg/800px-Football_iu_1996.jpg" alt="Football">
                <div class="news-content">
                    <span class="category">Football</span>
                    <h3>Historic Transfer Deadline Day</h3>
                    <p>Record-breaking transfers shake up European football as clubs compete for top talent.</p>
                    <a href="#" class="read-more">Read More →</a>
                </div>
            </article>
            <article class="news-card">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Basketball.png/800px-Basketball.png" alt="Basketball">
                <div class="news-content">
                    <span class="category">Basketball</span>
                    <h3>MVP Race Heats Up</h3>
                    <p>Three players emerge as frontrunners in the most competitive MVP race in years.</p>
                    <a href="#" class="read-more">Read More →</a>
                </div>
            </article>
            <article class="news-card">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Olympic_flame.jpg/800px-Olympic_flame.jpg" alt="Olympics">
                <div class="news-content">
                    <span class="category">Olympics</span>
                    <h3>Road to Paris 2024</h3>
                    <p>Athletes from around the world prepare for the upcoming Summer Olympics.</p>
                    <a href="#" class="read-more">Read More →</a>
                </div>
            </article>
        </div>
    </section>

    <section class="stats-section">
        <h2>Quick Stats</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">127</div>
                <div class="stat-label">Live Matches</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">1.5M+</div>
                <div class="stat-label">Active Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">50+</div>
                <div class="stat-label">Sports Covered</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">24/7</div>
                <div class="stat-label">Live Coverage</div>
            </div>
        </div>
    </section>

    <footer class="footer">
        <div class="footer-content">
            <div class="footer-section">
                <h4>Sports Central</h4>
                <p>Your trusted source for sports news and live scores.</p>
            </div>
            <div class="footer-section">
                <h4>Quick Links</h4>
                <ul>
                    <li><a href="#about">About Us</a></li>
                    <li><a href="#contact">Contact</a></li>
                    <li><a href="#privacy">Privacy Policy</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h4>Follow Us</h4>
                <div class="social-links">
                    <a href="#">Twitter</a>
                    <a href="#">Facebook</a>
                    <a href="#">Instagram</a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2025 Sports Central. Built with Buildy.</p>
        </div>
    </footer>
</body>
</html>`,

  css: `:root {
    --primary: #ff4444;
    --secondary: #2c3e50;
    --accent: #00d4ff;
    --success: #00c851;
    --dark: #1a1a1a;
    --light: #f8f9fa;
    --shadow: rgba(0, 0, 0, 0.1);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: var(--secondary);
    background: var(--light);
}

/* Hero Section */
.hero {
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: white;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
}

.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 5%;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
}

.logo {
    font-size: 1.8rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-links a {
    color: white;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.3s;
}

.nav-links a:hover {
    color: var(--accent);
}

.hero-content {
    text-align: center;
    padding: 10rem 2rem 5rem;
}

.hero-content h1 {
    font-size: 4rem;
    margin-bottom: 1rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.hero-content p {
    font-size: 1.5rem;
    margin-bottom: 2rem;
    opacity: 0.9;
}

.cta-btn {
    padding: 1rem 2.5rem;
    font-size: 1.2rem;
    border: none;
    border-radius: 50px;
    background: var(--accent);
    color: var(--dark);
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.3s, box-shadow 0.3s;
}

.cta-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 212, 255, 0.3);
}

/* Featured Section */
.featured-section {
    padding: 5rem 5%;
    background: white;
}

.featured-section h2 {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 3rem;
    color: var(--secondary);
}

.featured-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.match-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 5px 15px var(--shadow);
    transition: transform 0.3s;
}

.match-card:hover {
    transform: translateY(-5px);
}

.match-card img {
    width: 100%;
    height: 200px;
    object-fit: cover;
}

.match-info {
    padding: 1.5rem;
}

.match-info h3 {
    color: var(--primary);
    margin-bottom: 0.5rem;
}

.teams {
    font-size: 1.2rem;
    font-weight: bold;
    margin: 0.5rem 0;
}

.score {
    font-size: 2rem;
    font-weight: bold;
    color: var(--success);
    margin: 0.5rem 0;
}

.live-badge {
    display: inline-block;
    background: var(--primary);
    color: white;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

.upcoming-badge {
    display: inline-block;
    background: var(--accent);
    color: var(--dark);
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
}

/* News Section */
.news-section {
    padding: 5rem 5%;
    background: var(--light);
}

.news-section h2 {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 3rem;
    color: var(--secondary);
}

.news-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.news-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 5px 15px var(--shadow);
    transition: transform 0.3s;
}

.news-card:hover {
    transform: translateY(-5px);
}

.news-card img {
    width: 100%;
    height: 200px;
    object-fit: cover;
}

.news-content {
    padding: 1.5rem;
}

.category {
    display: inline-block;
    background: var(--primary);
    color: white;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
}

.news-content h3 {
    font-size: 1.3rem;
    margin: 0.5rem 0;
}

.news-content p {
    color: #666;
    margin: 0.5rem 0 1rem;
}

.read-more {
    color: var(--primary);
    text-decoration: none;
    font-weight: bold;
    transition: color 0.3s;
}

.read-more:hover {
    color: var(--accent);
}

/* Stats Section */
.stats-section {
    padding: 5rem 5%;
    background: var(--secondary);
    color: white;
}

.stats-section h2 {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 3rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 2rem;
}

.stat-card {
    text-align: center;
    padding: 2rem;
}

.stat-number {
    font-size: 3rem;
    font-weight: bold;
    color: var(--accent);
    margin-bottom: 0.5rem;
}

.stat-label {
    font-size: 1.1rem;
    opacity: 0.9;
}

/* Footer */
.footer {
    background: var(--dark);
    color: white;
    padding: 3rem 5% 1rem;
}

.footer-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    margin-bottom: 2rem;
}

.footer-section h4 {
    margin-bottom: 1rem;
    color: var(--accent);
}

.footer-section ul {
    list-style: none;
}

.footer-section a {
    color: #ccc;
    text-decoration: none;
    transition: color 0.3s;
}

.footer-section a:hover {
    color: var(--accent);
}

.social-links {
    display: flex;
    gap: 1rem;
}

.footer-bottom {
    text-align: center;
    padding-top: 2rem;
    border-top: 1px solid #333;
    opacity: 0.7;
}

/* Responsive */
@media (max-width: 768px) {
    .hero-content h1 {
        font-size: 2.5rem;
    }
    
    .hero-content p {
        font-size: 1.2rem;
    }
    
    .nav-links {
        gap: 1rem;
    }
}`,

  js: `// Sports Central Interactive Features
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sports Central Loaded! ⚽🏀🎾');
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Live score updates (demo)
    const scores = document.querySelectorAll('.score');
    setInterval(() => {
        scores.forEach(score => {
            if (score.closest('.match-card').querySelector('.live-badge')) {
                // Randomly update scores for live matches
                if (Math.random() > 0.95) {
                    const currentScore = score.textContent.split(' - ');
                    const team1Score = parseInt(currentScore[0]);
                    const team2Score = parseInt(currentScore[2]);
                    if (Math.random() > 0.5) {
                        score.textContent = \`\${team1Score + 1} - \${team2Score}\`;
                    } else {
                        score.textContent = \`\${team1Score} - \${team2Score + 1}\`;
                    }
                }
            }
        });
    }, 5000);
    
    // CTA button interaction
    const ctaBtn = document.querySelector('.cta-btn');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', () => {
            alert('🎉 Live streaming feature coming soon! Stay tuned for real-time sports action.');
        });
    }
    
    // Animate stats on scroll
    const observerOptions = {
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumbers = entry.target.querySelectorAll('.stat-number');
                statNumbers.forEach(stat => {
                    stat.style.animation = 'countUp 1s ease-out';
                });
            }
        });
    }, observerOptions);
    
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        observer.observe(statsSection);
    }
});

// Add count-up animation
const style = document.createElement('style');
style.textContent = \`
    @keyframes countUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
\`;
document.head.appendChild(style);`
};

async function runDemo() {
  console.log('🚀 Starting Buildy Sports Demo...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📱 Opening Buildy...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Wait for CodeMirror to be initialized
    await page.waitForFunction(() => document.querySelector('.CodeMirror') !== null);
    console.log('⏳ Waiting for app to initialize...');
    await page.waitForTimeout(1000);
    
    // Take initial screenshot
    await page.screenshot({ path: join(__dirname, 'screenshots', '01-initial-load.png'), fullPage: true });
    console.log('✅ App loaded successfully\n');
    
    // Create index.html file
    console.log('📝 Creating index.html...');
    await page.click('#newFileBtn');
    await page.waitForSelector('#newFileModal.active');
    await page.fill('#newFileName', 'index.html');
    await page.selectOption('#fileTemplate', 'blank');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(1000);
    
    // Wait for editor to be ready
    await page.waitForSelector('.CodeMirror', { state: 'visible' });
    await page.waitForTimeout(500);
    
    // Insert HTML content
    console.log('✏️  Writing HTML content...');
    await page.evaluate((html) => {
      const cm = document.querySelector('.CodeMirror').CodeMirror;
      cm.setValue(html);
    }, SPORTS_SITE.html);
    await page.waitForTimeout(1000);
    
    // Save the file
    console.log('💾 Saving index.html...');
    await page.click('#saveFileBtn');
    await page.waitForTimeout(1500);
    
    // Take screenshot after HTML
    await page.screenshot({ path: join(__dirname, 'screenshots', '02-html-created.png'), fullPage: true });
    console.log('✅ index.html created and saved\n');
    
    // Create styles.css file
    console.log('📝 Creating styles.css...');
    await page.click('#newFileBtn');
    await page.waitForSelector('#newFileModal.active');
    await page.fill('#newFileName', 'styles.css');
    await page.selectOption('#fileTemplate', 'blank');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(1000);
    
    // Insert CSS content
    console.log('🎨 Writing CSS styles...');
    await page.evaluate((css) => {
      const cm = document.querySelector('.CodeMirror').CodeMirror;
      cm.setValue(css);
    }, SPORTS_SITE.css);
    await page.waitForTimeout(1000);
    
    // Save CSS
    console.log('💾 Saving styles.css...');
    await page.click('#saveFileBtn');
    await page.waitForTimeout(1500);
    
    await page.screenshot({ path: join(__dirname, 'screenshots', '03-css-created.png'), fullPage: true });
    console.log('✅ styles.css created and saved\n');
    
    // Create script.js file
    console.log('📝 Creating script.js...');
    await page.click('#newFileBtn');
    await page.waitForSelector('#newFileModal.active');
    await page.fill('#newFileName', 'script.js');
    await page.selectOption('#fileTemplate', 'blank');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(1000);
    
    // Insert JS content
    console.log('⚙️  Writing JavaScript...');
    await page.evaluate((js) => {
      const cm = document.querySelector('.CodeMirror').CodeMirror;
      cm.setValue(js);
    }, SPORTS_SITE.js);
    await page.waitForTimeout(1000);
    
    // Save JS
    console.log('💾 Saving script.js...');
    await page.click('#saveFileBtn');
    await page.waitForTimeout(1500);
    
    await page.screenshot({ path: join(__dirname, 'screenshots', '04-js-created.png'), fullPage: true });
    console.log('✅ script.js created and saved\n');
    
    // Switch back to index.html to preview
    console.log('🔄 Switching to index.html for preview...');
    const tabs = await page.$$('.editor-tab');
    if (tabs.length > 0) {
      await tabs[0].click();
      await page.waitForTimeout(1000);
    }
    
    // Open preview
    console.log('👁️  Opening preview...');
    await page.click('#previewBtn');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: join(__dirname, 'screenshots', '05-preview-opened.png'), fullPage: true });
    console.log('✅ Preview opened\n');
    
    // Test file tree navigation
    console.log('📂 Testing file tree navigation...');
    await page.screenshot({ path: join(__dirname, 'screenshots', '06-file-tree.png'), fullPage: true });
    
    // Export project
    console.log('📦 Exporting project...');
    const downloadPromise = page.waitForEvent('download');
    await page.click('#downloadBtn');
    const download = await downloadPromise;
    const downloadPath = join(__dirname, 'output', 'sports-website-export.json');
    await download.saveAs(downloadPath);
    console.log(`✅ Project exported to ${downloadPath}\n`);
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      success: true,
      filesCreated: ['index.html', 'styles.css', 'script.js'],
      screenshots: [
        '01-initial-load.png',
        '02-html-created.png',
        '03-css-created.png',
        '04-js-created.png',
        '05-preview-opened.png',
        '06-file-tree.png'
      ],
      websiteType: 'Sports Website',
      features: [
        'Responsive navigation',
        'Hero section with CTA',
        'Featured matches grid',
        'News articles',
        'Statistics dashboard',
        'Footer with links',
        'Live score updates',
        'Smooth scrolling',
        'Animated stats'
      ],
      linesOfCode: {
        html: SPORTS_SITE.html.split('\n').length,
        css: SPORTS_SITE.css.split('\n').length,
        js: SPORTS_SITE.js.split('\n').length
      }
    };
    
    fs.writeFileSync(
      join(__dirname, 'output', 'demo-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✨ DEMO COMPLETED SUCCESSFULLY! ✨');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    console.log(`   • Files created: ${report.filesCreated.join(', ')}`);
    console.log(`   • Total lines: ${report.linesOfCode.html + report.linesOfCode.css + report.linesOfCode.js}`);
    console.log(`   • Screenshots: ${report.screenshots.length}`);
    console.log(`   • Features: ${report.features.length}`);
    console.log('\n📁 Output:');
    console.log(`   • Screenshots: ./demo/screenshots/`);
    console.log(`   • Export: ./demo/output/sports-website-export.json`);
    console.log(`   • Report: ./demo/output/demo-report.json`);
    console.log('\n🌐 To view the sports website:');
    console.log('   1. Extract files from the export');
    console.log('   2. Open index.html in a browser');
    console.log('   3. Or use the preview in the editor!');
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    await page.screenshot({ path: join(__dirname, 'screenshots', 'error.png'), fullPage: true });
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

// Create output directories
const outputDir = join(__dirname, 'output');
const screenshotsDir = join(__dirname, 'screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Extract preview files from export
function extractPreview() {
  console.log('\n📦 Extracting preview files...');
  
  const exportPath = join(outputDir, 'sports-website-export.json');
  const previewDir = join(outputDir, 'preview');
  
  if (!fs.existsSync(exportPath)) {
    console.log('⚠️  Export file not found, skipping preview extraction');
    return;
  }
  
  const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }
  
  exportData.files.forEach(file => {
    const filePath = join(previewDir, file.name);
    fs.writeFileSync(filePath, file.content, 'utf8');
  });
  
  console.log('✅ Preview files extracted to:', previewDir);
  console.log('🌐 Open in browser: file://' + join(previewDir, 'index.html'));
}

// Run the demo
runDemo()
  .then(() => {
    extractPreview();
  })
  .catch(console.error);
