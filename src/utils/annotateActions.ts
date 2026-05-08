// 選択範囲に furigana / 英訳ルビを {base|reading} 記法で挿入するアクション
// ツールバーボタン (ふ / EN / 自動) と右クリックメニューから共通利用される

import type { EditorView } from "@codemirror/view";
import {
  annotateFuriganaSyntax,
  annotateKatakanaSyntax,
  stripAnnotations,
} from "./japaneseAnnotate";
import { ensureKatakanaDictLoaded, lookupKatakana } from "./katakanaDict";
import { t } from "../i18n";

const KANA_RE = /[ぁ-ゖァ-ヺー]/;
const KATAKANA_RE = /[ァ-ヺー・]/;
const KANJI_RE = /[一-鿿㐀-䶿]/;

/** 選択範囲または前後 200 文字に かな が含まれるか (日本語判定) */
function looksJapanese(view: EditorView, from: number, to: number): boolean {
  if (KANA_RE.test(view.state.sliceDoc(from, to))) return true;
  const docLen = view.state.doc.length;
  const ctxFrom = Math.max(0, from - 200);
  const ctxTo = Math.min(docLen, to + 200);
  return KANA_RE.test(view.state.sliceDoc(ctxFrom, ctxTo));
}

/** 選択範囲のうち漢字を含む部分にだけ {kanji|reading} 注釈を付ける */
export async function annotateFurigana(view: EditorView): Promise<void> {
  const range = view.state.selection.main;
  if (range.empty) {
    window.alert(t("annotate.selectFirst"));
    return;
  }
  if (!looksJapanese(view, range.from, range.to)) {
    window.alert(t("annotate.notJapanese"));
    return;
  }
  const text = view.state.sliceDoc(range.from, range.to);
  let result: string;
  try {
    result = await annotateFuriganaSyntax(text);
  } catch (err: unknown) {
    handleAnnotateError(err);
    return;
  }
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: result },
  });
  view.focus();
}

/** 選択範囲のカタカナ語を {word|english} 注釈付きに置換 */
export async function annotateEnglish(view: EditorView): Promise<void> {
  const range = view.state.selection.main;
  if (range.empty) {
    window.alert(t("annotate.selectFirst"));
    return;
  }
  const raw = view.state.sliceDoc(range.from, range.to);
  if (!KATAKANA_RE.test(raw)) {
    window.alert(t("annotate.noKatakana"));
    return;
  }
  await ensureKatakanaDictLoaded();
  const cleanText = stripAnnotations(raw);
  const trimmed = cleanText.trim();
  const isSingleWord = /^[ァ-ヺー・]+$/.test(trimmed);
  const replacement = annotateKatakanaSyntax(cleanText);

  if (replacement === cleanText) {
    if (isSingleWord) {
      const custom = window.prompt(
        t("annotate.notFoundPrompt", { word: trimmed }),
        "",
      );
      if (!custom) return;
      const en = custom.trim();
      if (!en) return;
      view.dispatch({
        changes: {
          from: range.from,
          to: range.to,
          insert: "{" + trimmed + "|" + en + "}",
        },
      });
      view.focus();
      return;
    }
    window.alert(t("annotate.noMatchedKatakana"));
    return;
  }
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
  });
  view.focus();
}

/** 選択範囲の {base|reading} 注釈を全て剥がす。注釈が無ければ何もしない */
export function stripAnnotationsFromSelection(view: EditorView): void {
  const range = view.state.selection.main;
  if (range.empty) {
    window.alert(t("annotate.selectFirst"));
    return;
  }
  const raw = view.state.sliceDoc(range.from, range.to);
  const stripped = stripAnnotations(raw);
  if (stripped === raw) {
    window.alert(t("annotate.nothingToStrip"));
    return;
  }
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: stripped },
  });
  view.focus();
}

/** 統合アクション: 選択範囲に対し、漢字塊→ふりがな、カタカナ語→英訳 を一括適用
 *  既存の注釈は事前に剥がしてから処理する */
export async function annotateAuto(view: EditorView): Promise<void> {
  const range = view.state.selection.main;
  if (range.empty) {
    window.alert(t("annotate.selectFirst"));
    return;
  }
  if (!looksJapanese(view, range.from, range.to)) {
    window.alert(t("annotate.notJapanese"));
    return;
  }
  const raw = view.state.sliceDoc(range.from, range.to);
  const cleaned = stripAnnotations(raw);

  let result = cleaned;
  if (KANJI_RE.test(cleaned)) {
    try {
      result = await annotateFuriganaSyntax(cleaned);
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message === "NO_KANJI")) {
        handleAnnotateError(err);
        return;
      }
    }
  }
  if (KATAKANA_RE.test(result)) {
    await ensureKatakanaDictLoaded();
    result = applyKatakanaOutsideBraces(result);
  }
  if (result === raw) {
    window.alert(t("annotate.nothingToAnnotate"));
    return;
  }
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: result },
  });
  view.focus();
}

/** {} の外側にあるカタカナ語のみ英訳ルビ ({|} 記法) で置換 */
function applyKatakanaOutsideBraces(text: string): string {
  // U+E000 (PUA) でプレースホルダを囲み本文の数字と衝突しないようにする
  const PLACEHOLDER = "";
  const placeholders: string[] = [];
  const masked = text.replace(/\{[^}\n]+\}/g, (m) => {
    const idx = placeholders.length;
    placeholders.push(m);
    return PLACEHOLDER + idx + PLACEHOLDER;
  });
  const converted = masked.replace(/[ァ-ヺー・]+/g, (run) =>
    annotateKatakanaRun(run),
  );
  const phRe = new RegExp(PLACEHOLDER + "(\\d+)" + PLACEHOLDER, "g");
  return converted.replace(phRe, (_, idx) => placeholders[Number(idx)]);
}

/** 1 つのカタカナ run を左→右の貪欲最長一致で {|} 記法に変換 */
function annotateKatakanaRun(run: string): string {
  let out = "";
  let pos = 0;
  while (pos < run.length) {
    let matchedLen = 0;
    let matchedEn: string | null = null;
    const max = run.length - pos;
    for (let len = max; len >= 2; len--) {
      const slice = run.substring(pos, pos + len);
      const en = lookupKatakana(slice);
      if (en) {
        matchedLen = len;
        matchedEn = en;
        break;
      }
    }
    if (matchedLen > 0 && matchedEn) {
      out += "{" + run.substring(pos, pos + matchedLen) + "|" + matchedEn + "}";
      pos += matchedLen;
    } else {
      out += run[pos];
      pos += 1;
    }
  }
  return out;
}

function handleAnnotateError(err: unknown): void {
  const code = err instanceof Error ? err.message : String(err);
  if (
    code === "NO_KANJI" ||
    code === "NO_CHANGE" ||
    code === "CONVERT_FAILED" ||
    code === "EMPTY"
  ) {
    window.alert(t("annotate.noKanji"));
  } else {
    console.error("Annotation error:", err);
    window.alert(t("annotate.dictLoadFailed", { error: String(err) }));
  }
}
