// Markdown レンダリング (markdown-it + highlight.js + GFM 拡張)

import MarkdownIt from "markdown-it";
// markdown-it-task-lists は型定義が同梱されていないため、ローカル宣言に依存
// @ts-expect-error - 型定義が同梱されていない
import taskLists from "markdown-it-task-lists";
import hljs from "highlight.js";

/** YomiNote で利用するレンダラインスタンス (シングルトン)
 *  html: true にしているのは、ユーザーが <ruby><rt></rt></ruby> を
 *  ソースに直接書いて編集できるようにするため (右クリックメニューから自動挿入)。
 *  ローカル編集用途のためインライン HTML は信頼するが、信頼できないソースを
 *  扱う場合はサニタイズの追加を検討する。
 */
const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight: (str, lang) => {
    // ```lang コードブロックを highlight.js で色付け
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        }).value;
        return `<pre class="hljs"><code class="language-${lang}">${highlighted}</code></pre>`;
      } catch {
        /* fall through */
      }
    }
    // 言語指定が無い (= ASCII アート / 図表として書かれていることが多い) ブロックは
    // `|` `-` `+` を Unicode 罫線文字へ変換し、さらに各行の視覚幅を揃えて
    // 右側の縦罫線が垂直方向に揃って見えるようにする。
    // 言語指定があるブロック (typescript / bash 等) は変換しない。
    const content = lang ? str : alignBoxWalls(boxifyAsciiArt(str));
    return `<pre class="hljs"><code>${md.utils.escapeHtml(content)}</code></pre>`;
  },
}).use(taskLists, { enabled: true, label: false });

/** ASCII で書かれた罫線 (`|`, `-`, `+`) を Unicode の box-drawing 文字に置換する。
 *  `+` は周囲 4 方向の罫線文字を見て、適切なコーナー / T 字 / 十字を選択する。 */
function boxifyAsciiArt(text: string): string {
  const lines = text.split("\n");
  const grid: string[][] = lines.map((l) => Array.from(l));

  const verticalChars = new Set([
    "|", "+", "│", "┼", "├", "┤", "┬", "┴", "┌", "┐", "└", "┘",
  ]);
  const horizontalChars = new Set([
    "-", "+", "─", "┼", "├", "┤", "┬", "┴", "┌", "┐", "└", "┘",
  ]);

  const hasUp = (r: number, c: number) => {
    const ch = grid[r - 1]?.[c];
    return ch !== undefined && verticalChars.has(ch);
  };
  const hasDown = (r: number, c: number) => {
    const ch = grid[r + 1]?.[c];
    return ch !== undefined && verticalChars.has(ch);
  };
  const hasLeft = (r: number, c: number) => {
    const ch = grid[r]?.[c - 1];
    return ch !== undefined && horizontalChars.has(ch);
  };
  const hasRight = (r: number, c: number) => {
    const ch = grid[r]?.[c + 1];
    return ch !== undefined && horizontalChars.has(ch);
  };

  // `+` の置換先を 4 方向の接続パターンから決定。bit 並び: 上 下 左 右
  function junctionChar(r: number, c: number): string {
    const mask =
      ((hasUp(r, c) ? 1 : 0) << 3) |
      ((hasDown(r, c) ? 1 : 0) << 2) |
      ((hasLeft(r, c) ? 1 : 0) << 1) |
      (hasRight(r, c) ? 1 : 0);
    switch (mask) {
      case 0b1111: return "┼";
      case 0b1110: return "┤";
      case 0b1101: return "├";
      case 0b1011: return "┴";
      case 0b0111: return "┬";
      case 0b1100: return "│";
      case 0b0011: return "─";
      case 0b1010: return "┘";
      case 0b1001: return "└";
      case 0b0110: return "┐";
      case 0b0101: return "┌";
      default: return "+"; // 周囲に罫線が無い (= 算術記号など) なら原文のまま
    }
  }

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c];
      if (ch === "|") grid[r][c] = "│";
      else if (ch === "-") {
        // 罫線の中なら ─ に。前後どちらも罫線で無いなら触らない (例: マイナス記号)
        if (hasLeft(r, c) || hasRight(r, c)) grid[r][c] = "─";
      } else if (ch === "+") {
        grid[r][c] = junctionChar(r, c);
      }
    }
  }

  return grid.map((row) => row.join("")).join("\n");
}

/** 連続する罫線行 (┌─┐ / │…│ / └─┘) を検出し、視覚幅 (CJK = 2 セル) を揃えるよう
 *  足りない行に空白 / `─` をパディングして右側の縦罫線が垂直方向に揃うようにする。
 *  既に揃っている場合は no-op。 */
function alignBoxWalls(text: string): string {
  const lines = text.split("\n");

  type BoxMeta = { firstWall: string; lastWall: string; pad: string };
  function classify(line: string): BoxMeta | null {
    const t = line.replace(/\s+$/, "");
    if (t.length < 2) return null;
    const first = Array.from(t)[0];
    const last = Array.from(t).slice(-1)[0];
    // 上端 / 下端 (── でパディング)
    if (first === "┌" && last === "┐") return { firstWall: first, lastWall: last, pad: "─" };
    if (first === "└" && last === "┘") return { firstWall: first, lastWall: last, pad: "─" };
    if (first === "├" && last === "┤") return { firstWall: first, lastWall: last, pad: "─" };
    // 中段 (空白でパディング)
    if (first === "│" && last === "│") return { firstWall: first, lastWall: last, pad: " " };
    return null;
  }

  // 連続する罫線行をグループにまとめる (途中に通常行が挟まれたら別グループ)
  const groups: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (classify(lines[i])) {
      current.push(i);
    } else if (current.length > 0) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  for (const group of groups) {
    if (group.length < 2) continue; // 単独行は罫線として扱わない
    const widths = group.map((i) => visualWidth(lines[i].replace(/\s+$/, "")));
    const maxW = Math.max(...widths);
    for (let k = 0; k < group.length; k++) {
      const i = group[k];
      const w = widths[k];
      if (w === maxW) continue;
      const meta = classify(lines[i])!;
      const trimmed = lines[i].replace(/\s+$/, "");
      // 最後の文字 (右壁) より前に padding を挿入する。CJK 文字を含む可能性があるため
      // 文字単位 (codepoint) で末尾を切り出す
      const arr = Array.from(trimmed);
      const lastChar = arr.pop()!;
      const padding = meta.pad.repeat(maxW - w);
      lines[i] = arr.join("") + padding + lastChar;
    }
  }

  return lines.join("\n");
}

/** 視覚幅 (East Asian Width 概算)。CJK 系を 2 セル、それ以外の印字可能 ASCII 等を 1 セルとする。 */
function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp < 0x20) continue; // 制御文字
    if (
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0x303e) ||
      (cp >= 0x3041 && cp <= 0x33ff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0xa000 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x20000 && cp <= 0x2fffd) ||
      (cp >= 0x30000 && cp <= 0x3fffd)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

/** {base|reading} 形式の振り仮名/英訳ルビ記法を <ruby> へ変換するインライン規則
 *  例:
 *    {漢字|かんじ}        → <ruby>漢字<rt>かんじ</rt></ruby>
 *    {コンピュータ|computer} → <ruby class="zen-katakana">...<rt>computer</rt></ruby>
 *  reading が ASCII のみなら zen-katakana クラスを付与 (英訳扱い)
 */
md.inline.ruler.before("emphasis", "zen_ruby", function rubyRule(state, silent) {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x7b /* { */) return false;
  const m = state.src.slice(start).match(/^\{([^|}\n\r]+)\|([^|}\n\r]+)\}/);
  if (!m) return false;
  if (silent) return true;
  const [full, base, reading] = m;
  const isEnglish = /^[\x20-\x7e]+$/.test(reading);
  const cls = isEnglish ? ' class="zen-katakana"' : "";
  // html_inline トークンとして直接 HTML を吐く (md.options.html: true 想定)
  const token = state.push("html_inline", "", 0);
  token.content =
    `<ruby${cls}>${md.utils.escapeHtml(base)}<rt>${md.utils.escapeHtml(reading)}</rt></ruby>`;
  state.pos = start + full.length;
  return true;
});

/** リンクには target="_blank" と rel を付与する */
const defaultLinkOpen = md.renderer.rules.link_open ?? function (
  tokens,
  idx,
  options,
  _env,
  self,
) {
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const targetIdx = token.attrIndex("target");
  if (targetIdx < 0) {
    token.attrPush(["target", "_blank"]);
  } else {
    token.attrs![targetIdx][1] = "_blank";
  }
  const relIdx = token.attrIndex("rel");
  if (relIdx < 0) {
    token.attrPush(["rel", "noopener noreferrer"]);
  } else {
    token.attrs![relIdx][1] = "noopener noreferrer";
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Markdown -> HTML */
export function renderMarkdown(source: string): string {
  return md.render(source);
}

/** 文字数 (空白除く) */
export function countCharacters(text: string): number {
  return text.replace(/\s/g, "").length;
}

/** 単語数 (CJK は 1 文字 = 1 単語としてカウント) */
export function countWords(text: string): number {
  if (!text) return 0;
  // CJK 文字 + 連続英数字
  const matches = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[A-Za-z0-9]+/gu);
  return matches ? matches.length : 0;
}

/** 行数 */
export function countLines(text: string): number {
  if (!text) return 1;
  return text.split(/\r?\n/).length;
}
