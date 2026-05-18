// Markdown プレビューコンポーネント
// markdown-it でレンダリングし、エディタとの双方向スクロール同期に対応する。
//
// 注釈 (furigana / カタカナ英訳) は自動的には適用しない。
// ユーザーがツールバーや右クリックメニューから明示的にソースへ <ruby> タグを
// 挿入したものだけがここで HTML として表示される (markdown-it html:true により通過)。
//
// 画像 / 音声 / 動画の参照 (assets/foo.ext のような相対パスや絶対パス) は、
// レンダリング後に convertFileSrc で asset:// URL に書き換える。WebView は
// tauri://localhost/ をルートにしているため、相対パスのままだと読み込めない。

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { renderMarkdown } from "../utils/markdown";
import { useSettingsStore } from "../store/useSettingsStore";
import { pathSeparator } from "../utils/fs";

interface PreviewProps {
  source: string;
  /** 現在開いているドキュメントのフルパス (未保存なら null)。assets/ 解決に使う */
  docPath: string | null;
  /** スクロール同期コールバック (視口最上端ブロックの 1-based ソース行番号) */
  onScroll?: (line: number) => void;
}

export interface PreviewHandle {
  /** 指定ソース行が視口の最上端に来るようスクロール (1-based) */
  scrollToLine: (line: number) => void;
}

export const Preview = forwardRef<PreviewHandle, PreviewProps>(
  ({ source, docPath, onScroll }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const settings = useSettingsStore((s) => s.settings);

    const html = useMemo(() => renderMarkdown(source), [source]);

    const suppressEmit = useRef(false);

    useImperativeHandle(ref, () => ({
      scrollToLine: (line: number) => {
        const el = containerRef.current;
        if (!el) return;
        const target = findBlockForLine(el, line);
        if (!target) return;
        suppressEmit.current = true;
        // 目標ブロックの視口内 top を取り、相対オフセットで container を動かす
        const containerTop = el.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        el.scrollTop += targetTop - containerTop;
        window.requestAnimationFrame(() => {
          suppressEmit.current = false;
        });
      },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el || !onScroll) return;
      const handler = () => {
        if (suppressEmit.current) return;
        const line = lineAtScrollTop(el);
        if (line !== null) onScroll(line);
      };
      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    }, [onScroll]);

    // ローカルメディア参照を asset:// に書き換える (markdown ソースは変更しない)
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const baseDir = docPath ? docPath.replace(/[\\/][^\\/]*$/, "") : null;
      const sep = pathSeparator();
      el.querySelectorAll<HTMLElement>("img, audio, video, source").forEach(
        (m) => {
          const rawAttr = m.getAttribute("src");
          if (!rawAttr) return;
          // markdown-it は ![](...) の src を encodeURI する。ファイルパスとして
          // 使う前にデコードして戻す (日本語/中国語などのファイル名対策)。
          let raw: string;
          try {
            raw = decodeURI(rawAttr);
          } catch {
            raw = rawAttr;
          }
          let abs: string;
          if (/^[a-zA-Z]:[\\/]/.test(raw)) {
            abs = raw; // Windows 絶対パス (C:\...)
          } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) {
            return; // http: / https: / data: / asset: / file: ... はそのまま
          } else if (raw.startsWith("/") || raw.startsWith("\\")) {
            abs = raw; // POSIX 絶対パス
          } else {
            if (!baseDir) return; // 未保存ドキュメント — 相対パスを解決できない
            abs = `${baseDir}${sep}${raw.replace(/\//g, sep)}`;
          }
          m.setAttribute("src", convertFileSrc(abs));
        },
      );
    }, [html, docPath]);

    return (
      <div
        ref={containerRef}
        // .zen-preview の既定 font-size (CSS で 15px) と max-width (860px) を
        // settings.fontSize に合わせて上書きする。max-width はフォントサイズと
        // 同比 (基準: 15px → 860px ≒ 57.33em 相当) に拡張するため、ズームすると
        // まず両側の余白を食い潰してパネル幅まで広がり、パネル幅に達した後は
        // 字号だけが大きくなる (max-width はあくまで上限なのでパネルから溢れない)。
        style={{
          fontSize: `${settings.fontSize}px`,
          maxWidth: `${(860 * settings.fontSize) / 15}px`,
        }}
        className={`zen-preview h-full overflow-y-auto px-10 py-8 ${
          settings.previewSerif ? "font-serif" : "font-sans"
        }`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

Preview.displayName = "Preview";

/** [data-line] のうち、ソース行番号が `line` を超えない最大のものを返す。
 *  ブロックは markdown-it のトークン出力順に並ぶ前提 (ネストしてても親 → 子の順) */
function findBlockForLine(container: HTMLElement, line: number): HTMLElement | null {
  const blocks = container.querySelectorAll<HTMLElement>("[data-line]");
  let best: HTMLElement | null = null;
  for (const b of blocks) {
    const n = Number(b.dataset.line);
    if (!Number.isFinite(n)) continue;
    if (n > line) break;
    best = b;
  }
  // 何も見つからなければ先頭ブロックへフォールバック
  return best ?? (blocks[0] as HTMLElement | undefined) ?? null;
}

/** スクロール容器の現在の最上端に位置する [data-line] ブロックのソース行を返す。
 *  容器最上端から下方向に最初に「container top より下にある」ブロックを探し、
 *  その 1 つ前 (= 最上端をすでに通り抜けたブロック) の行番号を採用する。 */
function lineAtScrollTop(container: HTMLElement): number | null {
  const blocks = container.querySelectorAll<HTMLElement>("[data-line]");
  if (blocks.length === 0) return null;
  const containerTop = container.getBoundingClientRect().top;
  let line: number | null = null;
  for (const b of blocks) {
    const rectTop = b.getBoundingClientRect().top;
    // 8px の余裕: ブロックの上端がほぼ container 上端と重なっている場合も「越えた」とみなす
    if (rectTop - containerTop > 8) break;
    const n = Number(b.dataset.line);
    if (Number.isFinite(n)) line = n;
  }
  // 全ブロックが視口より下にある (= まだ何も越えていない) なら先頭の行を採用
  if (line === null) {
    const n = Number((blocks[0] as HTMLElement).dataset.line);
    return Number.isFinite(n) ? n : null;
  }
  return line;
}
