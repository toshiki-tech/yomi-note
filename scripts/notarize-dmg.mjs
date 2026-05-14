#!/usr/bin/env node
// tauri build が生成した macOS .dmg を Apple notary service に提出し、
// 受理されたチケットを DMG に staple する後処理スクリプト。
//
// 背景: Tauri 2 はビルド時に .app は notarize + staple するが、
// それを包む .dmg コンテナは署名のみで notarize/staple しない。
// 配布先 (ダウンロード) でのオフライン Gatekeeper 検証を成立させるため
// DMG にも staple が必要。
//
// 使い方: APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID を env に入れて
//   node scripts/notarize-dmg.mjs [dmg-dir-or-path]
// 引数なし → src-tauri/target/release/bundle/dmg (host target ビルド) を見る
// 引数あり → そのディレクトリ or .dmg ファイルを直接対象にする
// 通常は package.json の `release:mac` / `release:mac:intel` 経由で呼ばれる。

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

if (process.platform !== "darwin") {
  console.log("[notarize-dmg] not on macOS, skipping");
  process.exit(0);
}

const required = ["APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[notarize-dmg] missing env: ${missing.join(", ")}`);
  console.error("  see docs/macos-release.md for setup");
  process.exit(1);
}

// 引数で .dmg 直指定された場合はそれを使う。
// それ以外はディレクトリを走査して最新の .dmg を選ぶ。
const arg = process.argv[2];
let dmgPath;
if (arg && arg.endsWith(".dmg")) {
  dmgPath = arg;
} else {
  const dmgDir = arg || "src-tauri/target/release/bundle/dmg";
  let dmgs;
  try {
    dmgs = readdirSync(dmgDir).filter((f) => f.endsWith(".dmg"));
  } catch (e) {
    console.error(`[notarize-dmg] cannot read ${dmgDir}: ${e.message}`);
    process.exit(1);
  }
  if (dmgs.length === 0) {
    console.error(`[notarize-dmg] no .dmg found in ${dmgDir}`);
    process.exit(1);
  }
  // 複数あれば最新を選ぶ (差分ビルドや version 変更後の取り違え防止)
  const dmg = dmgs
    .map((f) => ({ f, t: statSync(join(dmgDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0].f;
  dmgPath = join(dmgDir, dmg);
}

console.log(`[notarize-dmg] submitting ${dmgPath} to Apple`);
const submit = spawnSync(
  "xcrun",
  [
    "notarytool",
    "submit",
    dmgPath,
    "--apple-id",
    process.env.APPLE_ID,
    "--password",
    process.env.APPLE_PASSWORD,
    "--team-id",
    process.env.APPLE_TEAM_ID,
    "--wait",
  ],
  { stdio: "inherit" },
);
if (submit.status !== 0) {
  console.error("[notarize-dmg] notarization failed");
  process.exit(submit.status ?? 1);
}

console.log(`[notarize-dmg] stapling ${dmgPath}`);
const staple = spawnSync("xcrun", ["stapler", "staple", dmgPath], {
  stdio: "inherit",
});
if (staple.status !== 0) {
  console.error("[notarize-dmg] stapling failed");
  process.exit(staple.status ?? 1);
}

console.log(`[notarize-dmg] done -> ${dmgPath}`);
