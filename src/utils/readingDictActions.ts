// 選択範囲の注音 (ruby) をユーザー辞書へ保存 / 辞書から復元するアクション。
// 浮動 popup から呼ばれる。kuroshiro/kuromoji を一切触らない、純粋な文字列操作。

import type { EditorView } from "@codemirror/view";
import { useDictStore, type EntryType } from "../store/useDictStore";

/** reading の文字種から type を自動判定。markdown.ts の zen-katakana
 *  判定 (可視 ASCII のみなら英訳) と同じ基準を使う。 */
function inferEntryType(reading: string): EntryType {
  return /^[\x20-\x7e]+$/.test(reading) ? "english" : "reading";
}

/** 選択テキストから {base|reading} を全て取り出す */
export interface ParsedAnnotation {
  base: string;
  reading: string;
}

const ANN_RE = /\{([^|}\n\r]+)\|([^|}\n\r]+)\}/g;

export function extractAnnotations(text: string): ParsedAnnotation[] {
  const out: ParsedAnnotation[] = [];
  let m: RegExpExecArray | null;
  ANN_RE.lastIndex = 0;
  while ((m = ANN_RE.exec(text)) !== null) {
    out.push({ base: m[1], reading: m[2] });
  }
  return out;
}

/** 選択範囲に含まれる注音をすべて辞書へ保存する。
 *  戻り値: 新規追加された件数 (重複でスキップされたものは除く) */
export async function saveSelectionToReadingDict(
  view: EditorView,
): Promise<{ added: number; total: number }> {
  const range = view.state.selection.main;
  if (range.empty) return { added: 0, total: 0 };
  const text = view.state.sliceDoc(range.from, range.to);
  const parsed = extractAnnotations(text);
  if (parsed.length === 0) return { added: 0, total: 0 };
  const store = useDictStore.getState();
  let added = 0;
  for (const p of parsed) {
    const ok = await store.add(p.base, inferEntryType(p.reading), p.reading);
    if (ok) added += 1;
  }
  return { added, total: parsed.length };
}

/** 選択範囲のテキストを {base|reading} で書き換える。
 *  選択 = base, reading は呼び出し側で確定したもの。 */
export function applyReadingToSelection(
  view: EditorView,
  reading: string,
): void {
  const range = view.state.selection.main;
  if (range.empty) return;
  const base = view.state.sliceDoc(range.from, range.to);
  if (!base) return;
  // 既存の {} を含む選択には適用しない (二重ラップ防止)
  if (/[{}|]/.test(base)) return;
  const insert = `{${base}|${reading}}`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: range.from + insert.length },
  });
  view.focus();
}
