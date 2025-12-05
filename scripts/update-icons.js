/* ==============================
  🎨 아이콘 인덱스 자동 생성 스크립트
  ============================== */

import { readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const iconDir = join(__dirname, '../src/icons/');
const outputFile = join(iconDir, 'index.js');

console.log('🔍 아이콘 디렉토리 스캔 중:', iconDir);

// svg 파일 목록 가져오기
const files = readdirSync(iconDir)
  .filter(f => f.endsWith('.svg'))
  .sort();

console.log(`📦 발견된 아이콘: ${files.length}개`);

// iconPaths 객체 생성
const iconPaths = {};
files.forEach(file => {
  const key = file.replace('.svg', '');
  iconPaths[key] = file;
  console.log(`  ✅ ${key}`);
});

// index.js 내용 생성
const content = `/* ==============================
  🎨 아이콘 중앙 관리 시스템
  자동 생성됨 - 직접 수정하지 마세요!
  스크립트: npm run update-icons
  ============================== */

// 아이콘 경로 정의 (자동 생성됨)
export const iconPaths = ${JSON.stringify(iconPaths, null, 2)};

// 선택자 맵핑 (특수한 경우만 정의, 나머지는 기본 선택자 사용)
export const iconSelectors = {
  default: '.content.icon:not(.pressed)',
  toggle: '.content.icon.pressed',
  contrast: '[data-icon="contrast"]',
  large: '[data-icon="large"]'
};

// 기본 선택자 생성 함수
export function getSelector(iconKey) {
  return iconSelectors[iconKey] || \`[data-icon="\${iconKey}"]\`;
}

// 전체 경로 생성 함수
export function getIconPath(iconKey) {
  const filename = iconPaths[iconKey];
  if (!filename) {
    console.warn(\`⚠️ Icon "\${iconKey}" not found in iconPaths, using placeholder\`);
    return 'src/assets/icons/placeholder.svg';
  }
  return \`src/assets/icons/\${filename}\`;
}

// iconMap 생성 함수
export function createIconMap() {
  const map = {};
  
  for (const [key, filename] of Object.entries(iconPaths)) {
    // default와 placeholder는 중복되므로 placeholder 제외
    if (key === 'placeholder' && map['default']) continue;
    
    map[key] = {
      path: getIconPath(key),
      selector: getSelector(key)
    };
  }
  
  return map;
}

// 폴백 아이콘
export const fallbackIcon = 'placeholder';

/* ==============================
  📊 메타데이터
  ============================== */
// 총 아이콘 개수: ${files.length}
// 생성 일시: ${new Date().toISOString()}



// 아이콘 목록: ${Object.keys(iconPaths).join(', ')}
`;

// 파일 쓰기
writeFileSync(outputFile, content, 'utf8');

console.log('\n✅ icon/index.js 생성 완료!');
console.log(`📊 총 ${files.length}개 아이콘 등록됨`);
console.log(`📝 파일 위치: ${outputFile}`);
console.log('\n🎉 완료! 이제 아이콘을 사용할 수 있습니다.');