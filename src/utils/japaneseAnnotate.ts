// 日本語自動アノテーション
// 1. 漢字に furigana (kuroshiro による形態素解析 + ひらがな読み)
// 2. カタカナ語に英訳 (内蔵辞書からの最長一致)
//
// kuroshiro / kuromoji の辞書 (~12MB, gzip 圧縮済み) はサイズが大きいため、
// 機能が有効化されたタイミングで遅延ロードする。
//
// 辞書 (.dat.gz) の解凍は kuromoji 側 (BrowserDictionaryLoader) を patch-package で
// pako に差し替えて行う (patches/kuromoji+0.1.2.patch)。元の zlibjs は UMD のため
// Rollup/minify されたプロダクションビルドで壊れていた。

// @ts-expect-error - kuroshiro に型定義が同梱されていない
import Kuroshiro from "kuroshiro";
// @ts-expect-error - 同上
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import { ensureKatakanaDictLoaded, lookupKatakana } from "./katakanaDict";

interface AnnotateOptions {
  furigana: boolean;
  katakanaEnglish: boolean;
}

/** 初期化済みの kuroshiro インスタンス (シングルトン) */
let kuroshiro: any = null;
/** 初期化中の Promise (重複初期化防止) */
let initPromise: Promise<void> | null = null;

/** 遅延初期化: 辞書を読み込む */
async function ensureInit(): Promise<void> {
  if (kuroshiro) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const instance = new Kuroshiro();
    // public/kuromoji/dict/ 以下に配置済みの辞書を利用
    const analyzer = new KuromojiAnalyzer({ dictPath: "/kuromoji/dict" });
    try {
      // 辞書ロードが何らかの理由で完了しない場合に備えてタイムアウトを設ける
      await Promise.race([
        instance.init(analyzer),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("KUROMOJI_INIT_TIMEOUT")), 60_000),
        ),
      ]);
    } catch (err) {
      // 失敗したら次回再試行できるようにリセット
      initPromise = null;
      throw err;
    }
    kuroshiro = instance;
  })();
  return initPromise;
}

/** 漢字を含むかどうかを判定 (CJK 統合漢字 + 拡張 A) */
function containsKanji(text: string): boolean {
  return /[一-鿿㐀-䶿]/.test(text);
}

/** 漢字またはカタカナを含むかどうか */
function hasJapaneseTarget(text: string): boolean {
  return /[一-鿿㐀-䶿ァ-ヺー]/.test(text);
}

/** kuroshiro でテキストを furigana 付き HTML に変換 */
async function applyFuriganaToText(text: string): Promise<string> {
  if (!containsKanji(text)) return text;
  await ensureInit();
  return await kuroshiro.convert(text, {
    mode: "furigana",
    to: "hiragana",
  });
}

/** 既存の {base|reading} 注釈を全て剥がす (二重ネスト防止) */
export function stripAnnotations(text: string): string {
  return text.replace(/\{([^|}\n\r]+)\|[^|}\n\r]+\}/g, "$1");
}

/** kuroshiro の <ruby>...<rt>...</rt></ruby> 出力を {base|reading} 記法へ変換
 *  kuroshiro は <rp>(</rp><rt>...</rt><rp>)</rp> という形で
 *  ruby parentheses (rp) を挟むため、それを取り除いてから抽出する */
function rubyHtmlToBraceSyntax(html: string): string {
  return html.replace(
    /<ruby(?:\s[^>]*)?>([\s\S]*?)<\/ruby>/g,
    (whole, inner) => {
      // <rp>...</rp> を除去
      const stripped = inner.replace(/<rp>[^<]*<\/rp>/g, "");
      const m = stripped.match(/^([^<]+)<rt>([^<]+)<\/rt>$/);
      if (!m) return whole;
      return `{${m[1]}|${m[2]}}`;
    },
  );
}

/** 選択テキストを {kanji|reading} 注釈付きへ変換 (漢字を含む部分のみ)
 *  入力に既存の注釈があれば先に剥がしてから処理する */
export async function annotateFuriganaSyntax(text: string): Promise<string> {
  if (!text.trim()) throw new Error("EMPTY");
  const clean = stripAnnotations(text);
  if (!containsKanji(clean)) throw new Error("NO_KANJI");
  await ensureInit();
  const html = await kuroshiro.convert(clean, {
    mode: "furigana",
    to: "hiragana",
  });
  if (typeof html !== "string") throw new Error("CONVERT_FAILED");
  const annotated = rubyHtmlToBraceSyntax(html);
  if (annotated === clean) throw new Error("NO_CHANGE");
  return annotated;
}

/** カタカナ語英訳を {word|english} 記法で全置換
 *  applyKatakanaToText の <ruby> 出力を {|} に再変換 */
export function annotateKatakanaSyntax(text: string): string {
  const clean = stripAnnotations(text);
  const withRuby = applyKatakanaToText(clean);
  return rubyHtmlToBraceSyntax(withRuby);
}

/** 右クリック/ツールバーから呼ばれる: 後方互換として残す */
export async function getFuriganaHTML(text: string): Promise<string> {
  return annotateFuriganaSyntax(text);
}

/** カタカナ最長一致英訳を HTML 文字列として適用 (公開 API、内部用) */
export function applyKatakanaAnnotations(text: string): string {
  return applyKatakanaToText(text);
}

/** 形態素解析結果を返す (annotateAuto 等で利用) */
export async function tokenize(
  text: string,
): Promise<Array<{ surface: string; reading?: string }>> {
  await ensureInit();
  // kuroshiro 内部の analyzer に直接アクセスする
  const analyzer = (kuroshiro as { _analyzer: { parse: (t: string) => Promise<unknown[]> } })
    ._analyzer;
  const tokens = await analyzer.parse(text);
  return tokens.map((t: unknown) => {
    const tok = t as { surface_form: string; reading?: string };
    return {
      surface: tok.surface_form,
      reading: tok.reading,
    };
  });
}

/** 右クリックメニュー用: テキスト全体の漢字読みを 1 つのまとまりとして取得
 *  (kuroshiro の "normal" モードでひらがな化) */
export async function getKanjiReading(text: string): Promise<string | null> {
  if (!text.trim()) return null;
  if (!containsKanji(text)) return null;
  try {
    await ensureInit();
    const reading = await kuroshiro.convert(text, {
      mode: "normal",
      to: "hiragana",
    });
    return typeof reading === "string" && reading !== text ? reading : null;
  } catch (err) {
    console.warn("読み取得失敗", err);
    return null;
  }
}

/** カタカナ語の最長一致による英訳ルビ付加
 *  各 run 内を左から右へ、貪欲な最長一致でトークナイズする。
 *  例: "デジタルカメラ" -> "デジタル" (digital) + "カメラ" (camera)
 */
function applyKatakanaToText(text: string): string {
  return text.replace(/[ァ-ヺー・]+/g, (run) => annotateKatakanaRun(run));
}

function annotateKatakanaRun(run: string): string {
  let out = "";
  let pos = 0;
  while (pos < run.length) {
    // 残りの中で最長の辞書エントリを探す (>= 2 文字のみ採用)
    let matchedLen = 0;
    let matchedEn: string | null = null;
    const maxLen = run.length - pos;
    for (let len = maxLen; len >= 2; len--) {
      const slice = run.substring(pos, pos + len);
      const en = lookupKatakana(slice);
      if (en) {
        matchedLen = len;
        matchedEn = en;
        break;
      }
    }
    if (matchedLen > 0 && matchedEn) {
      const slice = run.substring(pos, pos + matchedLen);
      out += `<ruby class="zen-katakana">${slice}<rt>${escapeHtml(matchedEn)}</rt></ruby>`;
      pos += matchedLen;
    } else {
      // 1 文字進めて再試行
      out += run[pos];
      pos += 1;
    }
  }
  return out;
}

/** HTML を再帰走査し、code/pre/ruby を除いた text node にアノテーションを適用 */
async function walkAndAnnotate(
  node: Node,
  doc: Document,
  options: AnnotateOptions,
): Promise<void> {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  // コードブロック・既存 ruby 内はスキップ
  if (tag === "code" || tag === "pre" || tag === "ruby" || tag === "rt") return;

  // 子ノードのスナップショットを取ってから書き換える (ライブ DOM 走査回避)
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      const original = child.textContent ?? "";
      if (!hasJapaneseTarget(original)) continue;
      let annotated = original;
      // 1. furigana を漢字に
      if (options.furigana) {
        try {
          annotated = await applyFuriganaToText(annotated);
        } catch (err) {
          console.warn("furigana 変換失敗", err);
        }
      }
      // 2. カタカナ英訳を適用 (furigana の <ruby> を壊さないように、ruby ブロック外のみ処理)
      if (options.katakanaEnglish) {
        annotated = applyKatakanaOutsideRuby(annotated);
      }
      // テキストノードを HTML に置き換え
      if (annotated !== original) {
        const wrapper = doc.createElement("span");
        wrapper.innerHTML = annotated;
        child.parentNode?.replaceChild(...moveChildren(wrapper, child));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      await walkAndAnnotate(child, doc, options);
    }
  }
}

/** wrapper の子要素をすべて取り出して target を置換するためのヘルパ */
function moveChildren(wrapper: HTMLElement, target: Node): [Node, Node] {
  // DocumentFragment にまとめて 1 度の置換にする
  const frag = wrapper.ownerDocument.createDocumentFragment();
  while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
  return [frag, target];
}

/** ruby ブロックの外側だけにカタカナ変換を適用 */
function applyKatakanaOutsideRuby(html: string): string {
  // <ruby>...</ruby> を保護してから変換
  const placeholders: string[] = [];
  const masked = html.replace(/<ruby[\s\S]*?<\/ruby>/g, (match) => {
    placeholders.push(match);
    return `RUBY${placeholders.length - 1}`;
  });
  const converted = applyKatakanaToText(masked);
  return converted.replace(/RUBY(\d+)/g, (_, idx) => placeholders[Number(idx)]);
}

/** HTML 文字列を受け取り、注釈付きの HTML 文字列を返す */
export async function annotateJapaneseHTML(
  html: string,
  options: AnnotateOptions,
): Promise<string> {
  if (!options.furigana && !options.katakanaEnglish) return html;
  if (!hasJapaneseTarget(html)) return html;
  // カタカナ英訳辞書を先に読み込む (~133KB JSON, 一度だけ)
  if (options.katakanaEnglish) {
    await ensureKatakanaDictLoaded();
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;
  await walkAndAnnotate(root, doc, options);
  return root.innerHTML;
}

/** HTML エスケープ (Quote 含む) */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}
