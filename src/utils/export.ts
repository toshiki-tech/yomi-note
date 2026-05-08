// HTML / PDF エクスポート
// HTML: 現在の文書を独立 HTML ファイルに保存 (CSS 埋め込み済み)
// PDF: 隠し iframe にレンダリングして印刷ダイアログを開く
//      (window.open は WebView2 のポップアップブロッカに弾かれるため)

import { renderMarkdown } from "./markdown";
import { showSaveFileDialog, writeFile } from "./fs";

/** プレビューと同等のスタイルを埋め込んだ独立 HTML を生成 */
function buildStandaloneHTML(title: string, source: string): string {
  const body = renderMarkdown(source);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/css/inter:vf@latest/wght-400-700.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/css/jetbrains-mono:vf@latest/wght-400-700.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/css/noto-sans-jp:vf@latest/wght-400-700.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/fontsource/css/noto-sans-sc:vf@latest/wght-400-700.css" />
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: "Inter Variable", "Inter", "Noto Sans JP Variable",
        "Noto Sans JP", "Noto Sans SC Variable", "Noto Sans SC",
        -apple-system, BlinkMacSystemFont, "Segoe UI",
        "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
      font-feature-settings: "cv11", "ss03", "case";
      max-width: 860px;
      margin: 2em auto;
      padding: 0 2em;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.3; margin: 1.6em 0 0.6em; }
    h1 { font-size: 2em; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin: 0.8em 0; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { list-style: disc; padding-left: 1.6em; margin: 0.6em 0; }
    ol { list-style: decimal; padding-left: 1.6em; margin: 0.6em 0; }
    ul ul { list-style: circle; }
    ul ul ul { list-style: square; }
    ul.contains-task-list, ul.contains-task-list ul { list-style: none; padding-left: 1.2em; }
    li.task-list-item { list-style: none; }
    li > input[type="checkbox"] { margin-right: 0.4em; }
    blockquote {
      margin: 1em 0; padding: 0.4em 1em;
      border-left: 3px solid rgba(0,0,0,0.15);
      color: rgba(0,0,0,0.6); background: rgba(0,0,0,0.02);
      border-radius: 4px;
    }
    code {
      font-family: "JetBrains Mono Variable", "JetBrains Mono", "Cascadia Code", Consolas, monospace;
      font-feature-settings: "calt" 1, "liga" 1;
      background: rgba(0,0,0,0.06); padding: 0.15em 0.35em;
      border-radius: 4px; font-size: 0.9em;
    }
    pre { margin: 1em 0; padding: 1em; border-radius: 6px; background: #f6f8fa; overflow-x: auto; }
    pre code { background: transparent; padding: 0; font-size: 0.85em; }
    table { border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid rgba(0,0,0,0.12); padding: 0.4em 0.8em; }
    th { background: rgba(0,0,0,0.04); font-weight: 600; }
    img { max-width: 100%; border-radius: 6px; }
    hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 2em 0; }

    ruby { ruby-position: over; }
    ruby > rt { font-size: 0.55em; color: rgba(0,0,0,0.55); }
    ruby.zen-katakana > rt { color: #2563eb; font-style: italic; }

    @media print {
      body { max-width: none; margin: 0; padding: 0 1cm; }
      a { color: inherit; }
      pre { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML エクスポート: 現在のアクティブドキュメントを HTML ファイルに保存 */
export async function exportHTML(title: string, source: string): Promise<void> {
  const html = buildStandaloneHTML(title, source);
  const baseName = title.replace(/\.[a-z0-9]+$/i, "") + ".html";
  const path = await showSaveFileDialog(baseName, null);
  if (!path) return;
  await writeFile(path, html);
}

/** PDF エクスポート: 隠し iframe で HTML をレンダリングし、印刷ダイアログを表示する。
 *  既定の OS 印刷ダイアログから "PDF として保存" を選ぶ。
 *  window.open は WebView2 のポップアップブロッカで null になるためここでは使わない。
 *
 *  実装メモ: load イベントは使わない。空の iframe を append すると about:blank の
 *  load が一度発火し、続けて document.write 後にもう一度発火する。両方で
 *  print() を呼ぶと印刷ダイアログが二重に開く (キャンセル 2 回必要) ため、
 *  doc.write が同期的に DOM を構築する性質を使い、setTimeout で 1 度だけ印刷する。 */
export function exportPDF(title: string, source: string): void {
  const html = buildStandaloneHTML(title, source);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    console.warn("PDF print: contentDocument unavailable");
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  // フォント/CSS のロードを少し待ってから印刷ダイアログを開く (1 度だけ)
  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn("PDF print failed", err);
    }
    // 印刷ダイアログを閉じてからの後始末。表示中に消すとキャンセル扱いの WebView もあるので少し待つ
    window.setTimeout(() => iframe.remove(), 1500);
  }, 300);
}
