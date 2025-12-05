/* ==============================
  🚀 애플리케이션 진입점 - ES6 모듈
  ============================== */

console.log('📦 [app.js] ES6 모듈 로딩 시작');
const moduleLoadStart = performance.now();

// ==============================
// 📦 아이콘 시스템 Import
// ==============================
import { createIconMap, getIconPath, fallbackIcon } from './icons/index.js';

const moduleLoadEnd = performance.now();
console.log(`✅ [app.js] 모든 모듈 import 완료 (${(moduleLoadEnd - moduleLoadStart).toFixed(2)}ms)`);

// ==============================
// 🎨 SVG 로더
// ==============================

const SVGLoader = {
  cache: new Map(),
  
  get iconMap() {
    return createIconMap();
  },
  
  convertToCurrentColor(svgMarkup) {
    return svgMarkup
      .replace(/fill="(?!none|transparent)[^"]*"/gi, 'fill="currentColor"')
      .replace(/stroke="(?!none|transparent)[^"]*"/gi, 'stroke="currentColor"')
      .replace(/fill='(?!none|transparent)[^']*'/gi, "fill='currentColor'")
      .replace(/stroke='(?!none|transparent)[^']*'/gi, "stroke='currentColor'")
      .replace(/fill:\s*(?!none|transparent)[^;}\s]+/gi, 'fill: currentColor')
      .replace(/stroke:\s*(?!none|transparent)[^;}\s]+/gi, 'stroke: currentColor');
  },
  
  async preloadAllIcons() {
    const loadPromises = Object.entries(this.iconMap).map(async ([key, config]) => {
      try {
        const response = await fetch(config.path);
        if (!response.ok) throw new Error(`SVG not found: ${config.path}`);
        const svgMarkup = await response.text();
        this.cache.set(key, svgMarkup);
        console.log(`✅ Loaded ${key} icon`);
      } catch (error) {
        console.warn(`⚠️ Failed to load ${key} icon from ${config.path}, using fallback`);
        try {
          const fallbackPath = getIconPath(fallbackIcon);
          const fallback = await fetch(fallbackPath);
          if (fallback.ok) {
            this.cache.set(key, await fallback.text());
          } else {
            this.cache.set(key, '');
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed for ${key}`);
          this.cache.set(key, '');
        }
      }
    });
    
    await Promise.all(loadPromises);
  },
  
  injectAllIcons() {
    Object.entries(this.iconMap).forEach(([key, config]) => {
      // 토글 아이콘은 CSS content로 처리하므로 JavaScript 인젝션 제외
      if (key === 'toggle') {
        return;
      }
      
      const svgMarkup = this.cache.get(key);
      if (!svgMarkup) {
        console.warn(`⚠️ No cached SVG for ${key}`);
        return;
      }
      
      const processedSvg = this.convertToCurrentColor(svgMarkup);
      
      const targets = document.querySelectorAll(config.selector);
      if (targets.length === 0) {
        console.log(`ℹ️ No elements found for selector: ${config.selector}`);
      }
      
      targets.forEach(el => {
        // .toggle .icon.pressed는 CSS로 처리하므로 제외
        if (el.closest('.toggle') && el.classList.contains('pressed')) {
          return;
        }
        el.innerHTML = processedSvg;
      });
    });
    
    console.log('✅ All icons injected to DOM (converted to currentColor)');
  },
  
  async loadAndInject() {
    await this.preloadAllIcons();
    this.injectAllIcons();
  }
};

// ==============================
// 🎨 버튼 스타일 관리자
// ==============================

const StyleManager = {
  // ==============================
  // 헬퍼 함수
  // ==============================
  
  async waitForRenderCompletion() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            resolve();
          }, 16);
        });
      });
    });
  },
  
  // ==============================
  // 명도대비 계산
  // ==============================
  
  calculateContrastRGBA(r1, g1, b1, r2, g2, b2) {
    const getLuminance = (r, g, b) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };
    
    const lum1 = getLuminance(r1, g1, b1);
    const lum2 = getLuminance(r2, g2, b2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    const contrastRatio = (brightest + 0.05) / (darkest + 0.05);
    
    return contrastRatio;
  },

  calculateContrast(color1, color2) {
    const getRGB = (color) => {
      if (!color || color === 'transparent') {
        throw new Error('유효하지 않은 색상 값입니다');
      }
      
      const rgbaMatch = color.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
      if (rgbaMatch) {
        return [
          Math.round(parseFloat(rgbaMatch[1])),
          Math.round(parseFloat(rgbaMatch[2])),
          Math.round(parseFloat(rgbaMatch[3]))
        ];
      }
      
      if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        if (hex.length >= 6) {
          return [
            parseInt(hex.substr(0, 2), 16),
            parseInt(hex.substr(2, 2), 16),
            parseInt(hex.substr(4, 2), 16)
          ];
        }
      }
      
      throw new Error(`색상 파싱 실패: ${color}`);
    };
    
    const [r1, g1, b1] = getRGB(color1);
    const [r2, g2, b2] = getRGB(color2);
    
    return this.calculateContrastRGBA(r1, g1, b1, r2, g2, b2);
  },
  
  // ==============================
  // 업데이트 관리
  // ==============================
  
  scheduleUpdate() {
    this.waitForRenderCompletion().then(() => {
      this.updateButtonLabels();
    });
  },
  
  updateButtonLabels() {
    const allButtons = document.querySelectorAll('.button');
    
    allButtons.forEach(button => {
      const label = button.querySelector('.label');
      
      if (label) {
        const buttonStyle = getComputedStyle(button);
        const labelStyle = getComputedStyle(label);
        const backgroundColor = buttonStyle.backgroundColor;
        const textColor = labelStyle.color;
        
        const contrast = this.calculateContrast(textColor, backgroundColor);
        const contrastRatio = contrast.toFixed(2);
        
        let labelText = label.innerHTML.split('<br>')[0];
        label.innerHTML = `${labelText}<br>${contrastRatio}`;
      }
    });
  },
  
  setupUpdateManager() {
    const observer = new MutationObserver((mutations) => {
      let needsUpdate = false;
      
      mutations.forEach(mutation => {
        const target = mutation.target;
        
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (target.classList.contains('button')) {
            needsUpdate = true;
          }
        }
        
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          if (target === document.documentElement) {
            needsUpdate = true;
          }
        }
      });
      
      if (needsUpdate) {
        this.scheduleUpdate();
      }
    });
    
    document.querySelectorAll('.button').forEach(button => {
      observer.observe(button, {
        attributes: true,
        attributeFilter: ['class']
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });
    return observer;
  },
  
  // ==============================
  // 동적 스타일 적용
  // ==============================
  
  applyDynamicStyles() {
    const allButtons = document.querySelectorAll('.button');
    if (allButtons.length === 0) return;
    
    for (const button of allButtons) {
      const rect = button.getBoundingClientRect();
      const minSide = Math.min(rect.width, rect.height);

      const cached = ButtonSystem.state.styleCache.get(button) || {};
      const needsUpdate = (cached.minSide || 0) !== minSide;

      if (!needsUpdate) continue;

      // --min-side CSS 변수만 설정, 나머지는 CSS에서 --min-side 기반으로 계산
      button.style.setProperty('--min-side', `${minSide}px`);

      ButtonSystem.state.styleCache.set(button, {
        minSide
      });
    }
    
    this.updateButtonLabels();
  },
  
  // ==============================
  // 아이콘 인젝션 설정
  // ==============================
  
  async setupIconInjection() {
    await this.waitForRenderCompletion();
    
    const allButtons = document.querySelectorAll('.button');
    
    for (const button of allButtons) {
      const isToggleButton = button.classList.contains('toggle');
      
      if (isToggleButton) {
        // .icon.pressed 요소 생성
        let iconPressedSpan = button.querySelector('.icon.pressed');
        
        if (!iconPressedSpan) {
          iconPressedSpan = document.createElement('span');
          iconPressedSpan.className = 'icon pressed';
          
          const iconEl = button.querySelector('.icon:not(.pressed)');
          if (iconEl && iconEl.parentNode) {
            button.insertBefore(iconPressedSpan, iconEl);
          } else {
            button.insertBefore(iconPressedSpan, button.firstChild);
          }
        }
        
        // 토글 버튼 속성 설정
        const isInitiallyPressed = button.classList.contains('pressed');
        button.dataset.isToggleButton = 'true';
        button.setAttribute('aria-pressed', isInitiallyPressed ? 'true' : 'false');
      }
    }
  }
};

// ==============================
// 🔘 버튼 시스템
// ==============================

const ButtonSystem = {
  
  state: {
    styleCache: new WeakMap()
  },
  
  StyleManager,
  
  async init() {
    console.log('🔘 [ButtonSystem] 초기화 시작');
    const initStart = performance.now();
    
    // 1단계: SVG 로딩 및 DOM 주입
    console.log('  ├─ 1단계: SVG 로딩 및 DOM 주입');
    const svgStart = performance.now();
    await SVGLoader.loadAndInject();
    console.log(`  ✅ SVG 로딩 완료 (${(performance.now() - svgStart).toFixed(2)}ms)`);
    
    // 2단계: 토글 버튼 구조 준비
    console.log('  ├─ 2단계: 토글 버튼 구조 준비');
    await this.StyleManager.setupIconInjection();
    console.log('  ✅ 토글 버튼 준비 완료');
    
    // 3단계: 동적 스타일 적용
    console.log('  ├─ 3단계: 동적 스타일 적용');
    this.StyleManager.applyDynamicStyles();
    console.log('  ✅ 동적 스타일 적용 완료');
    
    // 4단계: 자동 업데이트 매니저 설정
    console.log('  ├─ 4단계: 자동 업데이트 매니저 설정');
    this.StyleManager.setupUpdateManager();
    console.log('  ✅ 업데이트 매니저 설정 완료');
    
    const initEnd = performance.now();
    console.log(`🎉 [ButtonSystem] 초기화 완료 (총 ${(initEnd - initStart).toFixed(2)}ms)`);
  }
};

// ==============================
// 📤 전역 Export (디버깅 및 하위 호환성)
// ==============================
console.log('📤 [app.js] window 객체로 export 시작...');
window.AppUtils = { SVGLoader };
window.ButtonSystem = ButtonSystem;
console.log('✅ [app.js] 전역 export 완료');

// ==============================
// 🚀 시스템 초기화 및 무결성 검증
// ==============================
const initializeApp = async () => {
  // ==============================
  // 검증
  // ==============================
  
  // HTML 구조 검증
  const requiredElements = ['header', 'main'];
  const missingElements = requiredElements.filter(selector => !document.querySelector(selector));
  if (missingElements.length > 0) {
    console.warn(`⚠️ [app.js] 필수 HTML 요소 누락: ${missingElements.join(', ')}`);
  }
  
  // CSS 변수 검증
  const testElement = document.createElement('div');
  document.body.appendChild(testElement);
  const computedStyle = getComputedStyle(testElement);
  const criticalVars = ['--primary1-background-color-default', '--color-system-01', '--font-family'];
  const missingVars = criticalVars.filter(varName => !computedStyle.getPropertyValue(varName));
  document.body.removeChild(testElement);
  if (missingVars.length > 0) {
    console.warn(`⚠️ [app.js] 필수 CSS 변수 누락: ${missingVars.join(', ')}`);
  }
  
  // ==============================
  // 시스템 초기화
  // ==============================
  
  try {
    await ButtonSystem.init();
  } catch (error) {
    console.error('❌ [app.js] 시스템 초기화 실패:', error);
    throw error;
  }

  // ==============================
  // 🎮 글로벌 이벤트 시스템
  // ==============================

  // ==============================
  // 리사이즈 이벤트
  // ==============================
  
  let resizeScheduled = false;
  window.addEventListener("resize", () => {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      ButtonSystem.StyleManager.applyDynamicStyles();
      resizeScheduled = false;
    });
  });

  // ==============================
  // 토글 버튼 이벤트
  // ==============================
  
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.button');
    if (!button || button.getAttribute('aria-disabled') === 'true' || 
        button.dataset.isToggleButton !== 'true') return;

    const wasPressed = button.classList.contains('pressed');

    if (wasPressed) {
      button.classList.remove('pressed');
      button.setAttribute('aria-pressed', 'false');
    } else {
      button.classList.add('pressed');
      button.setAttribute('aria-pressed', 'true');
    }
    
    // 상태 변경 후 명도대비 업데이트
    ButtonSystem.StyleManager.scheduleUpdate();
  }, false);

  // ==============================
  // 비활성 버튼 이벤트 차단
  // ==============================
  
  const blockDisabledButtonEvents = (event) => {
    const disabledButton = event.target?.closest?.('.button[aria-disabled="true"]');
    if (disabledButton) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      return true;
    }
    return false;
  };

  document.addEventListener('click', blockDisabledButtonEvents, true);

  // ==============================
  // 키보드 입력 처리
  // ==============================
  
  // 비활성 버튼 키보드 차단
  document.addEventListener('keydown', (event) => {
    const disabledButton = event.target?.closest?.('.button[aria-disabled="true"]');
    if (disabledButton && (event.key === ' ' || event.key === 'Enter' || event.key === 'NumpadEnter')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // 활성 버튼 키보드 입력 처리
    const enabledButton = event.target?.closest?.('.button');
    if (enabledButton && enabledButton.getAttribute('aria-disabled') !== 'true') {
      if (event.key === 'Enter' || event.key === 'NumpadEnter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        
        const isToggleButton = enabledButton.classList.contains('toggle');
        
        if (isToggleButton) {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0
          });
          enabledButton.dispatchEvent(clickEvent);
        } else {
          enabledButton.classList.add('pressed');
          setTimeout(() => {
            enabledButton.classList.remove('pressed');
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              button: 0
            });
            enabledButton.dispatchEvent(clickEvent);
          }, 100);
        }
      }
    }
  }, true);

  // 방향키 네비게이션 (초점 이동)
  document.addEventListener('keydown', (event) => {
    const focusedButton = document.activeElement;
    const isArrowKey = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key);
    
    if ((!focusedButton || !focusedButton.classList.contains('button')) && isArrowKey) {
      event.preventDefault();
      const firstButton = document.querySelector('.button');
      if (firstButton) {
        firstButton.focus();
      }
      return;
    }

    if (!focusedButton || !focusedButton.classList.contains('button')) {
      return;
    }

    let targetButton = null;
    const allButtons = Array.from(document.querySelectorAll('.button')).filter(btn => 
      btn.offsetParent !== null
    );
    
    if (allButtons.length === 0) return;
    
    const currentIndex = allButtons.indexOf(focusedButton);
    if (currentIndex === -1) return;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % allButtons.length;
        targetButton = allButtons[nextIndex];
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        const prevIndex = currentIndex === 0 ? allButtons.length - 1 : currentIndex - 1;
        targetButton = allButtons[prevIndex];
        break;

      case 'ArrowDown':
        event.preventDefault();
        const currentContainer = focusedButton.closest('.showcase');
        
        for (let i = 1; i < allButtons.length; i++) {
          const nextIndex = (currentIndex + i) % allButtons.length;
          const nextButton = allButtons[nextIndex];
          const nextContainer = nextButton.closest('.showcase');
          
          if (nextContainer !== currentContainer) {
            targetButton = nextButton;
            break;
          }
        }
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        const currentContainerUp = focusedButton.closest('.showcase');
        
        for (let i = 1; i < allButtons.length; i++) {
          const prevIndex = (currentIndex - i + allButtons.length) % allButtons.length;
          const prevButton = allButtons[prevIndex];
          const prevContainer = prevButton.closest('.showcase');
          
          if (prevContainer !== currentContainerUp) {
            const buttonsInPrevContainer = allButtons.filter(btn => btn.closest('.showcase') === prevContainer);
            targetButton = buttonsInPrevContainer[0];
            break;
          }
        }
        break;
        
      case 'Home':
        event.preventDefault();
        targetButton = allButtons[0];
        break;
        
      case 'End':
        event.preventDefault();
        targetButton = allButtons[allButtons.length - 1];
        break;
    }

    if (targetButton) {
      targetButton.focus();
    }
  }, true);

  // ==============================
  // 마우스 이벤트
  // ==============================
  
  // 마우스 다운 - pressed 상태 추가
  document.addEventListener('mousedown', (event) => {
    const button = event.target?.closest?.('.button');
    if (button && button.getAttribute('aria-disabled') !== 'true' && !button.classList.contains('toggle')) {
      button.classList.add('pressed');
    }
  }, true);

  // 마우스 업 - pressed 상태 제거 및 명도대비 업데이트
  document.addEventListener('mouseup', (event) => {
    const button = event.target?.closest?.('.button');
    if (button && button.classList.contains('pressed') && !button.classList.contains('toggle')) {
      button.classList.remove('pressed');
      
      // 상태 변경 후 명도대비 업데이트
      ButtonSystem.StyleManager.scheduleUpdate();
    }
  }, true);

  // 마우스 영역 벗어남 - pressed 상태 제거
  document.addEventListener('mouseleave', (event) => {
    if (event.target && typeof event.target.closest === 'function') {
      const button = event.target?.closest?.('.button');
      if (button && button.classList.contains('pressed') && !button.classList.contains('toggle')) {
        button.classList.remove('pressed');
        
        // 상태 변경 후 업데이트
        ButtonSystem.StyleManager.scheduleUpdate();
      }
    }
  }, true);

  // ==============================
  // 터치 이벤트
  // ==============================
  
  // 터치 시작 - pressed 상태 추가
  document.addEventListener('touchstart', (event) => {
    const button = event.target?.closest?.('.button');
    if (button && button.getAttribute('aria-disabled') !== 'true' && !button.classList.contains('toggle')) {
      button.classList.add('pressed');
    }
  }, { passive: true });

  // 터치 종료 - pressed 상태 제거
  document.addEventListener('touchend', (event) => {
    const button = event.target?.closest?.('.button');
    if (button && button.classList.contains('pressed') && !button.classList.contains('toggle')) {
      button.classList.remove('pressed');
      
      // 상태 변경 후 명도대비 업데이트
      ButtonSystem.StyleManager.scheduleUpdate();
    }
  }, { passive: true });

  // 터치 취소 - pressed 상태 제거
  document.addEventListener('touchcancel', (event) => {
    const button = event.target?.closest?.('.button');
    if (button && button.classList.contains('pressed') && !button.classList.contains('toggle')) {
      button.classList.remove('pressed');
      
      // 상태 변경 후 명도대비 업데이트
      ButtonSystem.StyleManager.scheduleUpdate();
    }
  }, { passive: true });
};

// ==============================
// 🚀 애플리케이션 초기화 실행
// ==============================

// DOM 로드 완료 후 초기화 실행
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

console.log('🎉 [app.js] 전체 시스템 로드 완료');
