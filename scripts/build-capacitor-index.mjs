#!/usr/bin/env node
/**
 * Generate a static index.html shell for Capacitor (Android APK).
 *
 * TanStack Start uses SSR to render the initial HTML, which Capacitor's
 * file:// runtime cannot execute. This script writes a minimal index.html
 * into dist/client/ that loads the client bundle and lets TanStack Router
 * take over from there.
 *
 * Run AFTER `bun run build`, BEFORE `npx cap sync android`.
 */
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const assetsDir = join(clientDir, "assets");

if (!existsSync(assetsDir)) {
  console.error(`[capacitor-index] ${assetsDir} not found — run 'bun run build' first.`);
  process.exit(1);
}

const files = readdirSync(assetsDir);
const mainJs = files.find((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
const mainCss = files.find((f) => /^styles-[A-Za-z0-9_-]+\.css$/.test(f));

if (!mainJs) {
  console.error("[capacitor-index] Could not find main JS entry (index-*.js) in dist/client/assets/");
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0F172A" />
    <title>TRUST MOMOS</title>
    <link rel="icon" href="/favicon.ico" />
    <link rel="manifest" href="/manifest.webmanifest" />
${mainCss ? `    <link rel="stylesheet" href="/assets/${mainCss}" />\n` : ""}    <script type="module" src="/assets/${mainJs}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html, "utf8");
console.log(`[capacitor-index] Wrote ${clientDir}/index.html (entry: ${mainJs})`);