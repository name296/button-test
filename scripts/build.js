// ==============================
// 빌드 스크립트
// ==============================

import { build } from 'bun';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';

const nodeEnv = process.env.NODE_ENV || 'production';

console.log('🏗️  Building...');
console.log(`   NODE_ENV: ${nodeEnv}`);

// dist 폴더 초기화
try {
  rmSync('./dist', { recursive: true, force: true });
  console.log('🗑️  Cleaned dist folder');
} catch (error) {
  // 폴더가 없는 경우 무시
}

mkdirSync('./dist', { recursive: true });

// JavaScript 빌드
console.log('📦 Building JavaScript...');
await build({
  entrypoints: ['src/app.js'],
  outdir: 'dist',
  target: 'browser',
  format: 'esm',
  minify: true,
  sourcemap: 'external',
  define: {
    'process.env.NODE_ENV': JSON.stringify(nodeEnv)
  }
});

// 정적 파일 복사
const copyTasks = [
  { src: './src/fonts', dest: './dist/fonts', recursive: true, label: 'fonts folder' },
  { src: './src/icons', dest: './dist/assets/icons', recursive: true, label: 'icons folder' },
  { src: './src/app.css', dest: './dist/app.css', recursive: false, label: 'app.css' },
];

// public 폴더가 있으면 복사
if (existsSync('./public')) {
  copyTasks.push({ src: './public', dest: './dist/public', recursive: true, label: 'public folder' });
}

console.log('📁 Copying static files...');
copyTasks.forEach(({ src, dest, recursive, label }) => {
  try {
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: !!recursive, force: true });
      console.log(`   ✅ ${label}`);
    }
  } catch (error) {
    console.warn(`   ⚠️  ${label} copy failed:`, error.message);
  }
});

// index.html 처리
console.log('📄 Processing index.html...');
let html = readFileSync('./src/index.html', 'utf8');
html = html.replace(/src="\/dist\/app\.js"/g, 'src="app.js"');

writeFileSync('./dist/index.html', html);
writeFileSync('./dist/404.html', html);

// .nojekyll 파일 생성 (GitHub Pages에서 Jekyll 처리 방지)
writeFileSync('./dist/.nojekyll', '');

console.log('✅ Build complete!');
console.log('📦 Output directory: ./dist');
console.log('🚀 Deploy the ./dist folder to GitHub Pages');

