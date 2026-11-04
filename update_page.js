const fs = require('fs');

let html = fs.readFileSync('findcollege_landing_page.html', 'utf8');

// 1. Replace brand logo
const brandRegex = /<a class="brand"[\s\S]*?<\/a>/;
const newBrand = `<a class="brand" href="#home" aria-label="FindCollege.ai Home">\n        <img src="logo_header.png" alt="FindCollege.ai" width="220" height="45">\n      </a>`;
html = html.replace(brandRegex, newBrand);
console.log('1. Brand replaced');

// 2. Remove courses-bg-art from courses-section
const coursesBgArtRegex = /<div class="courses-bg-art"[\s\S]*?<\/div>\s*(?=<div class="container">)/;
if (coursesBgArtRegex.test(html)) {
  html = html.replace(coursesBgArtRegex, '');
  console.log('2. courses-bg-art removed from courses-section');
} else {
  console.log('2. courses-bg-art not found or already removed');
}

// 3. Add hero-bottom-wave inside .hero right before </section>
const bottomWaveSvg = `      <!-- Full-Width Stylized Irregular Bottom Wave (Transitions hero into white) -->
      <div class="hero-bottom-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 180" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="waveLeftLavender" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f0ecfd" />
              <stop offset="60%" stop-color="#e2d7fa" />
              <stop offset="100%" stop-color="#d9caf8" />
            </linearGradient>

            <linearGradient id="waveRightPurple" x1="10%" y1="0%" x2="90%" y2="100%">
              <stop offset="0%" stop-color="#7726e2" />
              <stop offset="50%" stop-color="#8d3bf5" />
              <stop offset="100%" stop-color="#5d16b5" />
            </linearGradient>
          </defs>

          <!-- Ambient Lavender Wave Arc across center -->
          <path d="M 370 20 C 510 60, 670 50, 810 25 C 930 45, 1030 35, 1110 15 C 970 65, 530 85, 370 20 Z" 
                fill="#8c38f4" opacity="0.1" />

          <!-- Left Side Soft Lavender Fluid Wave (behind Card 1) -->
          <path d="M 0 10 C 70 20, 160 45, 215 95 C 265 145, 255 170, 200 180 L 0 180 Z" 
                fill="url(#waveLeftLavender)" opacity="0.95" />

          <!-- Right Side Vibrant Purple Wave (behind Card 4) -->
          <path d="M 1100 15 C 1210 25, 1330 30, 1440 5 L 1440 150 C 1380 165, 1310 160, 1250 130 C 1180 95, 1140 50, 1100 15 Z" 
                fill="url(#waveRightPurple)" />

          <!-- Highlight stroke on purple wave -->
          <path d="M 1100 15 C 1140 50, 1180 95, 1250 130 C 1310 160, 1380 165, 1440 150" 
                stroke="#b883fc" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.6" />

          <!-- Right side lavender accent beneath purple wave -->
          <path d="M 1170 120 C 1250 165, 1340 180, 1440 175 L 1440 180 L 1170 180 Z" 
                fill="#eee8fc" opacity="0.9" />

          <!-- White Section Undulating Bottom Fill (seals into the white section below) -->
          <path d="M 0 70 C 100 95, 220 120, 340 110 C 470 100, 580 70, 720 85 C 840 100, 950 125, 1080 105 C 1200 85, 1320 65, 1440 85 L 1440 180 L 0 180 Z" 
                fill="#ffffff" />
        </svg>
      </div>\n    </section>`;

// Replace end of hero section
const heroEndRegex = /<\/div>\s*<\/section>\s*(?=<!-- OVERLAPPING 4 COURSE CARDS -->)/;
if (heroEndRegex.test(html)) {
  html = html.replace(heroEndRegex, `</div>\n${bottomWaveSvg}\n`);
  console.log('3. hero-bottom-wave added to hero section');
} else {
  console.log('3. hero end pattern not matched');
}

fs.writeFileSync('findcollege_landing_page.html', html, 'utf8');
console.log('Finished updating findcollege_landing_page.html');

