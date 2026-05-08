// Markdown プレビューコンポーネント
// markdown-it でレンダリングし、エディタとの双方向スクロール同期に対応する。
//
// 注釈 (furigana / カタカナ英訳) は自動的には適用しない。
// ユーザーがツールバーや右クリックメニューから明示的にソースへ <ruby> タグを
// 挿入したものだけがここで HTML として表示される (markdown-it html:true により通過)。

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { renderMarkdown } from "../utils/markdown";
import { useSettingsStore } from "../store/useSettingsStore";

interface PreviewProps {
  source: string;
  /** スクロール同期コールバック (0..1 の比率) */
  onScroll?: (ratio: number) => void;
}

export interface PreviewHandle {
  /** 外部からスクロール位置を比率で設定 */
  scrollToRatio: (ratio: number) => void;
}

export const Preview = forwardRef<PreviewHandle, PreviewProps>(
  ({ source, onScroll }, ref) => {
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
