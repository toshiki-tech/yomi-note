#!/usr/bin/env node
// JMdict 由来の片假名辞書と最長一致アルゴリズムの動作確認テスト
// (フロントエンドでの実際の lookupKatakana / applyKatakanaToText と同じロジックを再実装)

import { readFile } from "node:fs/promises";

const JMDICT_PATH = "public/jmdict-katakana.json";
const BUILTIN_TS = "src/utils/katakanaDict.ts";

/** TS ソースから BUILTIN_KATAKANA エントリを抽出 */
async function loadBuiltin() {
  const src = await readFile(BUILTIN_TS, "utf8");
  // BUILTIN_KATAKANA: Record<string, string> = { ... };
  const m = src.match(/BUILTIN_KATAKANA[^=]+=\s*\{([\s\S]*?)\n\};/);
  if (!m) throw new Error("BUILTIN_KATAKANA literal not found");
  const body = m[1];
  const entries = {};
  // ${key}: "${value}", 形式の行を拾う (key はバッククォート無し)
  const re = /([゠-ヿa-zA-Z]+):\s*"([^"]+)"/g;
  let mm;
  while ((mm = re.exec(body)) !== null) {
    entries[mm[1]] = mm[2];
  }
  return entries;
}

/** ランタイムと同じ合成: JMdict をベースに BUILTIN で上書き */
async function loadMerged() {
  const builtin = await loadBuiltin();
  const jmdict = JSON.parse(await readFile(JMDICT_PATH, "utf8"));
  const merged = new Map(Object.entries(jmdict));
  for (const [k, v] of Object.entries(builtin)) merged.set(k, v);
  return { merged, builtinSize: Object.keys(builtin).length, jmdictSize: Object.keys(jmdict).length };
}

function lookup(merged, word) {
  return merged.get(word);
}

/** applyKatakanaToText と同じ最長一致 (左から右への貪欲トークナイズ) */
function annotateRun(merged, run) {
  let out = "";
  let pos = 0;
  while (pos < run.length) {
    let matchedLen = 0;
    let matchedEn = null;
    const maxLen = run.length - pos;
    for (let len = maxLen; len >= 2; len--) {
      const slice = run.substring(pos, pos + len);
      const en = lookup(merged, slice);
      if (en) {
        matchedLen = len;
        matchedEn = en;
        break;
      }
    }
    if (matchedLen > 0 && matchedEn) {
      const slice = run.substring(pos, pos + matchedLen);
      out += `<${slice}=${matchedEn}>`;
      pos += matchedLen;
    } else {
      out += run[pos];
      pos += 1;
    }
  }
  return out;
}

function annotateText(merged, text) {
  return text.replace(/[ァ-ヺー・]+/g, (run) => annotateRun(merged, run));
}

const TEST_CASES = [
  // === BUILTIN にあるはず (技術用語) ===
  { word: "コンピュータ", expectMatch: true, expectSource: "builtin", note: "技術術語" },
  { word: "プログラミング", expectMatch: true, expectSource: "builtin" },
  { word: "アルゴリズム", expectMatch: true, expectSource: "builtin" },
  { word: "コミット", expectMatch: true, expectSource: "builtin" },

  // === JMdict のみ (内蔵辞書には無い、より珍しい外来語) ===
  { word: "アンサンブル", expectMatch: true, expectSource: "jmdict", note: "ensemble" },
  { word: "ノスタルジア", expectMatch: true, expectSource: "jmdict" },
  { word: "パラドックス", expectMatch: true, expectSource: "jmdict" },
  { word: "シリンダー", expectMatch: true, expectSource: "jmdict" },
  // common 版 JMdict には収録されていない (full 版なら有る) 例
  { word: "ヒエラルキー", expectMatch: false, note: "common 版に不在" },
  { word: "メトロポリス", expectMatch: false, note: "common 版に不在" },

  // === 食べ物 ===
  { word: "コーヒー", expectMatch: true },
  { word: "ハンバーガー", expectMatch: true },
  { word: "ピザ", expectMatch: true },

  // === 普通には収録されないであろう造語/誤字 ===
  { word: "ホゲホゲフガフガ", expectMatch: false, note: "存在しない造語" },
  { word: "ヒノヒノキコノキ", expectMatch: false },

  // === 最長一致テスト (連続するカタカナ列) ===
  {
    sentence: "マシンラーニングを学ぶ",
    expectIncludes: ["マシンラーニング=machine learning", "を学ぶ"],
    note: "最長一致: 単一トークン",
  },
  {
    sentence: "コーヒーとケーキ",
    expectIncludes: ["コーヒー=", "ケーキ="],
    note: "並列カタカナ語",
  },
  {
    sentence: "デジタルカメラを買う",
    expectIncludes: ["<デジタル=digital>", "<カメラ=camera>", "を買う"],
    note: "複合語の左→右貪欲分割",
  },
  {
    sentence: "ソフトウェアエンジニア",
    expectIncludes: ["<ソフトウェア=software>", "<エンジニア="],
    note: "辞書にない複合は分解",
  },
  {
    sentence: "ホテルのロビーでコーヒー",
    expectIncludes: ["<ホテル=hotel>", "<ロビー=lobby>", "<コーヒー=coffee>"],
    note: "通常文の中の複数語",
  },
  {
    sentence: "ABCXYZ", // ASCII は対象外
    expectIncludes: ["ABCXYZ"],
    note: "非カタカナは無変更",
  },
];

async function main() {
  const { merged, builtinSize, jmdictSize } = await loadMerged();
  console.log(`builtin: ${builtinSize} 語`);
  console.log(`jmdict:  ${jmdictSize} 語`);
  console.log(`merged:  ${merged.size} 語 (重複統合後)`);
  console.log();

  let pass = 0;
  let fail = 0;
  const failures = [];

  for (const tc of TEST_CASES) {
    if (tc.word !== undefined) {
      // 単語ルックアップテスト
      const result = lookup(merged, tc.word);
      const matched = !!result;
      const ok = matched === tc.expectMatch;
      const status = ok ? "PASS" : "FAIL";
      const detail = matched
        ? `→ "${result}"`
        : "→ (no match)";
      const sourceTag = tc.expectSource ? ` [${tc.expectSource}]` : "";
      const noteTag = tc.note ? ` # ${tc.note}` : "";
      console.log(`[${status}] ${tc.word}${sourceTag} ${detail}${noteTag}`);
      if (ok) pass++;
      else {
        fail++;
        failures.push({ tc, actual: result });
      }
    } else if (tc.sentence !== undefined) {
      // 文中の最長一致テスト
      const annotated = annotateText(merged, tc.sentence);
      const allIncluded = tc.expectIncludes.every((needle) =>
        annotated.includes(needle),
      );
      const status = allIncluded ? "PASS" : "FAIL";
      const noteTag = tc.note ? ` # ${tc.note}` : "";
      console.log(`[${status}] "${tc.sentence}"${noteTag}`);
      console.log(`        → ${annotated}`);
      if (allIncluded) pass++;
      else {
        fail++;
        failures.push({ tc, annotated });
      }
    }
  }

  console.log();
  console.log(`Result: ${pass} pass, ${fail} fail`);

  if (fail > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(JSON.stringify(f, null, 2));
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
