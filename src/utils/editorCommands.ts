// CodeMirror 6 用のコマンドユーティリティ
// 太字・斜体・リスト等の挿入処理を共通化する

import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { t } from "../i18n";

/** 選択範囲を `prefix` と `suffix` で囲む。空選択時はカーソルを中央に置く */
export function wrapSelection(view: EditorView, prefix: string, suffix = prefix): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - prefix.length, range.from);
    const after = state.sliceDoc(range.to, range.to + suffix.length);
    // 既に囲まれている場合はトグル解除
    if (before === prefix && after === suffix) {
      return {
        changes: [
          { from: range.from - prefix.length, to: range.from, insert: "" },
          { from: range.to, to: range.to + suffix.length, insert: "" },
        ],
        range: EditorSelection.range(
          range.anchor - prefix.length,
          range.head - prefix.length,
        ),
      };
    }
    const text = state.sliceDoc(range.from, range.to);
    return {
      changes: { from: range.from, to: range.to, insert: prefix + text + suffix },
      range: range.empty
        ? EditorSelection.cursor(range.from + prefix.length)
        : EditorSelection.range(
            range.from + prefix.length,
            range.to + prefix.length,
          ),
    };
  });
  view.dispatch(changes);
  view.focus();
}

/** 行頭にプレフィックスを挿入する (見出し・引用・リスト・番号付きリストなど)
 *  選択範囲が複数行にまたがる場合は全ての行に適用する。
 *  - 全ての行に既にプレフィックスが付いていれば解除 (トグル)
 *  - opts.numbered が true なら "1. ", "2. ", ... と振り直す。既存の "N. " は置換
 *  - それ以外は付いていない行だけに追加 (二重付与防止) */
export function prefixLine(
  view: EditorView,
  prefix: string,
  opts: { numbered?: boolean } = {},
): void {
  const { state } = view;
  const allChanges: { from: number; to: number; insert: string }[] = [];

  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    let endLine = state.doc.lineAt(range.to);
    // 選択末端が次行の先頭ちょうど (Shift+Down で 1 行選んだ等) なら最終行は含めない
    if (
      range.to === endLine.from &&
      range.from < range.to &&
      endLine.number > startLine.number
    ) {
      endLine = state.doc.line(endLine.number - 1);
    }

    const lineInfo: { from: number; existingLen: number }[] = [];
    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = state.doc.line(n);
      const existingLen = matchedPrefixLength(line.text, prefix, opts.numbered);
      lineInfo.push({ from: line.from, existingLen });
    }

    const allHavePrefix = lineInfo.every((li) => li.existingLen > 0);
    if (allHavePrefix) {
      // トグルオフ: 全行から既存プレフィックスを除去
      for (const li of lineInfo) {
        allChanges.push({
          from: li.from,
          to: li.from + li.existingLen,
          insert: "",
        });
      }
    } else if (opts.numbered) {
      // 番号付き: 既存 "N. " を置換しつつ 1 から振り直す
      let counter = 1;
      for (const li of lineInfo) {
        allChanges.push({
          from: li.from,
          to: li.from + li.existingLen,
          insert: `${counter++}. `,
        });
      }
    } else {
      // 未付与の行だけに付ける
      for (const li of lineInfo) {
        if (li.existingLen === 0) {
          allChanges.push({ from: li.from, to: li.from, insert: prefix });
        }
      }
    }
  }

  if (allChanges.length === 0) {
    view.focus();
    return;
  }
  view.dispatch({ changes: allChanges });
  view.focus();
}

/** 行頭が prefix (もしくは番号付きリストパターン) で始まっていればその長さを返す */
function matchedPrefixLength(
  text: string,
  prefix: string,
  numbered?: boolean,
): number {
  if (numbered) {
    const m = text.match(/^\d+\. /);
    return m ? m[0].length : 0;
  }
  return text.startsWith(prefix) ? prefix.length : 0;
}

/** リンクを挿入 */
export function insertLink(view: EditorView, url = "https://"): void {
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to) || t("insert.linkText");
  const insertText = `[${text}](${url})`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: insertText },
    selection: { anchor: range.from + 1, head: range.from + 1 + text.length },
  });
  view.focus();
}

/** 画像を挿入 */
export function insertImage(view: EditorView, url = "https://"): void {
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to) || t("insert.imageAlt");
  const insertText = `![${text}](${url})`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: insertText },
  });
  view.focus();
}

/** 表を挿入 (3x2 のテンプレート) — 言語別の見出し/セル */
export function insertTable(view: EditorView): void {
  const h1 = t("insert.tableHeader", { n: "1" });
  const h2 = t("insert.tableHeader", { n: "2" });
  const h3 = t("insert.tableHeader", { n: "3" });
  const c1 = t("insert.tableCell", { n: "1" });
  const c2 = t("insert.tableCell", { n: "2" });
  const c3 = t("insert.tableCell", { n: "3" });
  const tpl = `
| ${h1} | ${h2} | ${h3} |
| --- | --- | --- |
| ${c1} | ${c2} | ${c3} |
`;
  const { state } = view;
  const range = state.selection.main;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: tpl },
  });
  view.focus();
}

/** 行内コードと囲み (バッククォート) */
export const toggleInlineCode = (view: EditorView) => wrapSelection(view, "`");
export const toggleBold = (view: EditorView) => wrapSelection(view, "**");
export const toggleItalic = (view: EditorView) => wrapSelection(view, "*");
export const toggleStrike = (view: EditorView) => wrapSelection(view, "~~");

export const insertHeading = (view: EditorView, level: 1 | 2 | 3) =>
  prefixLine(view, "#".repeat(level) + " ");

export const insertQuote = (view: EditorView) => prefixLine(view, "> ");
export const insertUnordered = (view: EditorView) => prefixLine(view, "- ");
export const insertOrdered = (view: EditorView) =>
  prefixLine(view, "1. ", { numbered: true });
export const insertChecklist = (view: EditorView) => prefixLine(view, "- [ ] ");

/** コードブロックを挿入 */
export function insertCodeBlock(view: EditorView, lang = ""): void {
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to);
  const placeholder = `// ${t("insert.codePlaceholder")}`;
  const block = `\n\`\`\`${lang}\n${text || placeholder}\n\`\`\`\n`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: block },
  });
  view.focus();
}
