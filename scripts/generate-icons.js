const fs = require('fs');
const path = require('path');

// Simple SVG icon generator for the application
function generateIcon(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#gradient)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="white">N</text>
</svg>`;
}

// Generate icons for different sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svg = generateIcon(size);
  const filename = `public/icons/icon-${size}x${size}.png`;
  
  // For now, we'll create SVG files and let the user convert them to PNG
  const svgFilename = `public/icons/icon-${size}x${size}.svg`;
  fs.writeFileSync(svgFilename, svg);
  console.log(`Generated ${svgFilename}`);
});

// Generate shortcut icons
const shortcutIcons = [
  { name: 'search', size: 96 },
  { name: 'analytics', size: 96 },
  { name: 'favorites', size: 96 },
  { name: 'ai', size: 96 }
];

shortcutIcons.forEach(icon => {
  const svg = generateIcon(icon.size);
  const filename = `public/icons/${icon.name}-${icon.size}x${icon.size}.svg`;
  fs.writeFileSync(filename, svg);
  console.log(`Generated ${filename}`);
});

console.log('\nIcon generation complete!');
