import { build, serve } from "bun";
import { watch, existsSync, cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "fs";
import { z } from "zod";

// ============================================================================
// 환경 설정
// ============================================================================
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ENTRY_FILE: z.string().default("./src/app.js"),
  BUNDLE_OUTPUT_DIR: z.string().default("./dist"),
  ICONS_DIR: z.string().default("./src/icons"),
  BUILD_MINIFY: z.coerce.boolean().default(true),
  BUILD_SOURCEMAP: z.string().default("external"),
});

const env = envSchema.parse(process.env);

const config = {
  port: env.PORT,
  entry: env.ENTRY_FILE,
  outdir: env.BUNDLE_OUTPUT_DIR,
  htmlEntry: `${env.BUNDLE_OUTPUT_DIR}/index.html`,
  iconsDir: env.ICONS_DIR,
  watchExtensions: [".js", ".jsx", ".ts", ".tsx", ".css", ".html"],
  buildOptions: {
    target: "browser",
    format: "esm",
    minify: env.BUILD_MINIFY,
    sourcemap: env.BUILD_SOURCEMAP,
    define: { "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV) },
  },
};

// ============================================================================
// 유틸리티
// ============================================================================
const copyStatic = () => {
  mkdirSync(config.outdir, { recursive: true });
  
  // 정적 파일 복사
  const copyTasks = [
    { src: './src/fonts', dest: './dist/fonts', label: 'fonts' },
    { src: './src/icons', dest: './dist/assets/icons', label: 'icons' },
    { src: './src/app.css', dest: './dist/app.css', label: 'app.css' },
  ];
  
  copyTasks.forEach(({ src, dest, label }) => {
    if (existsSync(src)) {
      mkdirSync(dest.split('/').slice(0, -1).join('/'), { recursive: true });
      cpSync(src, dest, { recursive: true, force: true });
    }
  });
  
  // index.html 처리 (개발 모드 경로를 빌드 모드 경로로 변경)
  if (existsSync("./src/index.html")) {
    let html = readFileSync("./src/index.html", "utf8");
    html = html.replace(/src="\/dist\/app\.js"/g, 'src="app.js');
    writeFileSync(config.htmlEntry, html);
    // 404.html도 생성 (GitHub Pages SPA 라우팅용)
    writeFileSync(`${config.outdir}/404.html`, html);
    // .nojekyll 파일 생성
    writeFileSync(`${config.outdir}/.nojekyll`, '');
  }
};

const waitDelete = async (path, retries = 10) => {
  for (let i = 0; i < retries && existsSync(path); i++) {
    await Bun.sleep(100);
  }
};

// ============================================================================
// 번들러 (scripts/build.js 사용)
// ============================================================================
let building = false;

const bundle = async (tag = "manual") => {
  if (building) return;
  building = true;
  console.log(`📦 Building (${tag})...`);

  try {
    // scripts/build.js 실행
    const proc = Bun.spawn(["bun", "run", "scripts/build.js"], { 
      stdout: "inherit", 
      stderr: "inherit",
      env: { ...process.env, NODE_ENV: env.NODE_ENV }
    });
    const code = await proc.exited;
    
    if (code === 0) {
      console.log("✅ Build successful!");
    } else {
      console.error(`❌ Build failed with exit code ${code}`);
    }
  } catch (e) {
    console.error("❌ Build error:", e);
  } finally {
    building = false;
  }
};

// ============================================================================
// 아이콘 인덱스 업데이트
// ============================================================================
let updatingIcons = false;

const updateIconIndex = async () => {
  if (updatingIcons) return;
  updatingIcons = true;
  console.log("🎨 Updating icon index...");

  try {
    const proc = Bun.spawn(["bun", "run", "scripts/update-icons.js"], { stdout: "inherit", stderr: "inherit" });
    const code = await proc.exited;
    console.log(code === 0 ? "✅ Icon index updated!" : `❌ Icon index update failed (${code})`);
  } catch (e) {
    console.error("❌ Icon error:", e);
  } finally {
    updatingIcons = false;
  }
};

// ============================================================================
// 파일 감시
// ============================================================================
const startWatchers = () => {
  // 소스 파일 감시
  watch("./src", { recursive: true }, async (_, file) => {
    if (file && config.watchExtensions.some((ext) => file.endsWith(ext))) {
      console.log(`🔄 Changed: ${file}`);
      await bundle("watch");
    }
  });

  // 아이콘 감시
  if (existsSync(config.iconsDir)) {
    watch(config.iconsDir, { recursive: true }, async (_, file) => {
      if (file?.endsWith(".svg")) {
        console.log(`🎨 Icon changed: ${file}`);
        await updateIconIndex();
        await bundle("icon-change");
      }
    });
  }

  console.log("👀 Watching for changes...");
};

// ============================================================================
// HTTP 서버 (GitHub Pages 방식과 동일)
// ============================================================================
const serveStatic = async (pathname) => {
  // dist 폴더 기준으로 파일 서빙 (GitHub Pages와 동일)
  const file = Bun.file(`${config.outdir}${pathname}`);
  if (await file.exists()) {
    return new Response(file);
  }
  return null;
};

const startServer = () => {
  const server = serve({
    port: config.port,
    async fetch(req) {
      const { pathname } = new URL(req.url);

      // 루트 경로는 index.html
      if (pathname === "/" || pathname === "/index.html") {
        const html = Bun.file(config.htmlEntry);
        if (await html.exists()) {
          return new Response(html, { 
            headers: { "Content-Type": "text/html; charset=utf-8" } 
          });
        }
        return new Response("index.html not found", { status: 500 });
      }

      // 정적 파일 서빙 (dist 폴더 기준)
      const staticRes = await serveStatic(pathname);
      if (staticRes) return staticRes;

      // SPA fallback (404.html로 리다이렉트 - GitHub Pages 방식)
      const fallback = Bun.file(`${config.outdir}/404.html`);
      if (await fallback.exists()) {
        return new Response(fallback, { 
          headers: { "Content-Type": "text/html; charset=utf-8" } 
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`🌐 Server running at http://localhost:${server.port}`);
  console.log(`📦 Serving from: ${config.outdir} (GitHub Pages compatible)`);
};

// ============================================================================
// 시작
// ============================================================================
const main = async () => {
  const isBuildOnly = process.argv.includes("--build-only");
  
  if (isBuildOnly) {
    // 빌드만 수행 (프로덕션 빌드) - scripts/build.js 직접 실행
    console.log(`🏗️  Building for production...`);
    await updateIconIndex();
    const proc = Bun.spawn(["bun", "run", "scripts/build.js"], { 
      stdout: "inherit", 
      stderr: "inherit",
      env: { ...process.env, NODE_ENV: "production" }
    });
    const code = await proc.exited;
    console.log(code === 0 ? `✅ Build complete! Output: ${config.outdir}` : `❌ Build failed`);
    process.exit(code);
  }

  // 개발 서버 모드
  console.log(`🚀 Bun Dev Server (port ${config.port})`);
  console.log(`📦 Serving from: ${config.outdir} (GitHub Pages compatible)`);

  // 의존성 확인
  if (!existsSync("./node_modules")) {
    console.log("📦 Installing dependencies...");
    await Bun.spawn(["bun", "install"], { stdout: "inherit", stderr: "inherit" }).exited;
  }

  await updateIconIndex();
  await bundle("initial");
  startWatchers();
  startServer();
};

main();
