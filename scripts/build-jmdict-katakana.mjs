#!/usr/bin/env node
// JMdict-simplified の "common" 版を取得し、漢字を持たない純カタカナ語のみを抽出して
// public/jmdict-katakana.json に書き出すビルドスクリプト。
//
// 使い方: node scripts/build-jmdict-katakana.mjs
// 生成物は片仮名→英訳の最初のグロス、約 5,000~7,000 件規模になる想定。

import { mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { extract } from "tar";

const TMP_DIR = "scripts/.jmdict-tmp";
const TMP_TGZ = path.join(TMP_DIR, "jmdict.tgz");
const OUTPUT = "public/jmdict-katakana.json";

/** GitHub API から最新リリースの jmdict-eng-common .tgz の URL を取得 */
async function findLatestTgzUrl() {
  const res = await fetch(
    "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest",
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  const asset = (data.assets ?? []).find(
    (a) => a.name.startsWith("jmdict-eng-common-") && a.name.endsWith(".json.tgz"),
  );
  if (!asset) throw new Error("jmdict-eng-common asset not found in latest release");
  return { url: asset.browser_download_url, name: asset.name };
}

/** 片假名 (+ 中点 + 長音符) のみで構成されているか */
const KATAKANA_ONLY = /^[ァ-ヺー・]+$/;

async function downloadFile(url, dest) {
  console.log(`[fetch] ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`[fetch] saved ${(buf.length / 1024 / 1024).toFixed(1)}MB to ${dest}`);
}

async function extractTgz(tgz, destDir) {
  console.log(`[extract] ${tgz} -> ${destDir}`);
  await extract({ file: tgz, cwd: destDir });
}

function pickFirstEnglishGloss(senses) {
  for (const sense of senses ?? []) {
    for (const gloss of sense.gloss ?? []) {
      if (gloss.lang === "eng") return gloss.text;
    }
  }
  return null;
}

async function main() {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir("public", { recursive: true });

  const { url, name } = await findLatestTgzUrl();
  console.log(`[release] ${name}`);

  await downloadFile(url, TMP_TGZ);
  await extractTgz(TMP_TGZ, TMP_DIR);

  // tar 内のファイル名は asset 名と一致しないことがあるので、ディレクトリから JSON を探す
  // (release asset name には +date が付くが、tar 内部はベースバージョンのみ)
  const entries = await readdir(TMP_DIR);
  const jsonName = entries.find(
    (n) => n.startsWith("jmdict-eng-common-") && n.endsWith(".json"),
  );
  if (!jsonName) {
    throw new Error(`extracted JSON not found in ${TMP_DIR}; got: ${entries.join(", ")}`);
  }
  const jsonPath = path.join(TMP_DIR, jsonName);
  console.log(`[parse] using ${jsonName}`);
  console.log("[parse] reading JSON...");
  const raw = JSON.parse(await readFile(jsonPath, "utf8"));
  console.log(`[parse] entries=${raw.words.length}`);

  const dict = {};
  let kept = 0;

  for (const word of raw.words) {
    // 漢字表記を持つ語は通常の和語/漢語のためスキップ。
    // 純粋に仮名のみで書かれる語 (= 外来語 / 擬音語 / 一部の和語) のみを採用する。
    if (Array.isArray(word.kanji) && word.kanji.length > 0) continue;

    // 純カタカナ表記の readings を抽出
    const katakanaReadings = (word.kana ?? []).filter((k) =>
      KATAKANA_ONLY.test(k.text),
    );
    if (katakanaReadings.length === 0) continue;

    const english = pickFirstEnglishGloss(word.sense);
    if (!english) continue;

    // 主要 reading は配列の先頭。複数 reading がある場合は全て同じ意味を割り当て
    for (const k of katakanaReadings) {
      if (!dict[k.text]) {
        dict[k.text] = english;
        kept++;
      }
    }
  }

  console.log(`[filter] kept ${kept} katakana-only entries`);

  await writeFile(OUTPUT, JSON.stringify(dict));
  const sizeKB = (JSON.stringify(dict).length / 1024).toFixed(0);
  console.log(`[write] ${OUTPUT} (${sizeKB} KB)`);

  // 一時ファイル削除
  await rm(TMP_DIR, { recursive: true, force: true });
  console.log("[done]");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
