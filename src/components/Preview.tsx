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
  /** スクロール同期コールバック (0..1 の比率) */
  onScroll?: (ratio: number) => void;
}

export interface PreviewHandle {
  /** 外部からスクロール位置を比率で設定 */
  scrollToRatio: (ratio: number) => void;
}

export const Preview = forwardRef<PreviewHandle, PreviewProps>(
  ({ source, docPath, onScroll }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const settings = useSettingsStore((s) => s.settings);

    const html = useMemo(() => renderMarkdown(source), [source]);

    useImperativeHandle(ref, () => ({
      scrollToRatio: (ratio: number) => {
        const el = containerRef.current;
        if (!el) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max <= 0) return;
        suppressEmit.current = true;
        el.scrollTop = max * ratio;
        window.requestAnimationFrame(() => {
          suppressEmit.current = false;
        });
      },
    }));

    const suppressEmit = useRef(false);

    useEffect(() => {
      const el = containerRef.current;
      if (!el || !onScroll) return;
      const handler = () => {
        if (suppressEmit.current) return;
        const max = el.scrollHeight - el.clientHeight;
        if (max <= 0) return;
        onScroll(el.scrollTop / max);
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
        className={`zen-preview h-full overflow-y-auto px-10 py-8 ${
          settings.previewSerif ? "font-serif" : "font-sans"
        }`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

Preview.displayName = "Preview";
