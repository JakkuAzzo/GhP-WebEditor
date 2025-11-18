import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📦 Extracting sports website files...\n');

// Read the export
const exportData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'output', 'sports-website-export.json'), 'utf8')
);

// Create preview directory
const previewDir = path.join(__dirname, 'output', 'preview');
if (!fs.existsSync(previewDir)) {
  fs.mkdirSync(previewDir, { recursive: true });
}

// Extract files
exportData.files.forEach(file => {
  const filePath = path.join(previewDir, file.name);
  fs.writeFileSync(filePath, file.content, 'utf8');
  console.log('✓ Created:', file.name, `(${file.content.length} bytes)`);
});

console.log('\n✅ Files extracted to:', previewDir);
console.log('\n🌐 To view the website:');
console.log('   open', path.join(previewDir, 'index.html'));
