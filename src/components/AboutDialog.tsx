// 「YomiNote について」ダイアログ
// 単なるバージョン表示ではなく、Yomi シリーズ全体への入口として見せる。

import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppStore } from "../store/useAppStore";
import pkg from "../../package.json";

const WEBSITE_URL = "https://toshiki.tech";

const PRODUCTS: {
  name: string;
  desc: string;
  url?: string;
  current?: boolean;
}[] = [
  { name: "YomiNote", desc: "日语阅读 Markdown 编辑器", current: true },
  {
    name: "YomiPlay",
    desc: "AI 日语音视频学习播放器",
    url: "https://www.toshiki.tech/p/yomiplay",
  },
  {
    name: "YomiMark",
    desc: "浏览器日语注音插件",
    url: "https://www.toshiki.tech/p/yomimark",
  },
];

export function AboutDialog() {
  const open = useAppStore((s) => s.aboutOpen);
  const setOpen = useAppStore((s) => s.setAboutOpen);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-[420px] max-w-[90vw] rounded-lg border border-zen-border bg-zen-surface px-8 py-7 text-sm shadow-2xl dark:border-zen-dark-border dark:bg-zen-dark-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 text-zen-subtle hover:text-zen-text dark:text-zen-dark-subtle dark:hover:text-zen-dark-text"
          aria-label="閉じる"
        >
          ✕
        </button>

        {/* ヘッダー: 製品名 + slogan */}
        <div className="text-center">
          <div className="text-xl font-semibold tracking-tight">YomiNote</div>
          <div className="mt-1 text-xs italic text-zen-subtle dark:text-zen-dark-subtle">
            Read Japanese Naturally.
          </div>
        </div>

        {/* 製品定位 */}
        <div className="mt-5 text-center leading-relaxed">
          <div>面向日语学习与阅读的 Markdown 编辑器</div>
          <div className="mt-1 text-xs text-zen-subtle dark:text-zen-dark-subtle">
            汉字注音（Furigana）· 外来词英文标注 · 实时预览
          </div>
        </div>

        {/* Yomi シリーズ */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-xs text-zen-subtle dark:text-zen-dark-subtle">
            <span className="h-px flex-1 bg-zen-border dark:bg-zen-dark-border" />
            <span>Yomi 系列</span>
            <span className="h-px flex-1 bg-zen-border dark:bg-zen-dark-border" />
          </div>
          <ul className="space-y-1">
            {PRODUCTS.map((p) => (
              <li key={p.name} className="flex gap-3">
                {p.url ? (
                  <button
                    onClick={() => void openUrl(p.url!)}
                    className="w-20 shrink-0 text-left font-medium text-zen-accent hover:underline dark:text-zen-dark-accent"
                  >
                    {p.name}
                  </button>
                ) : (
                  <span
                    className={`w-20 shrink-0 font-medium ${
                      p.current ? "text-zen-accent dark:text-zen-dark-accent" : ""
                    }`}
                  >
                    {p.name}
                  </span>
                )}
                <span className="text-zen-subtle dark:text-zen-dark-subtle">
                  {p.desc}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* リンク */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => void openUrl(WEBSITE_URL)}
            className="rounded border border-zen-border px-3 py-1 text-xs hover:bg-black/5 dark:border-zen-dark-border dark:hover:bg-white/10"
          >
            Website
          </button>
          <button
            onClick={() => void openUrl(WEBSITE_URL)}
            className="text-xs text-zen-accent hover:underline dark:text-zen-dark-accent"
          >
            {WEBSITE_URL.replace(/^https?:\/\//, "")}
          </button>
        </div>

        {/* バージョン / 開発者 */}
        <div className="mt-5 text-center text-xs text-zen-subtle dark:text-zen-dark-subtle">
          Version {pkg.version} · Built by toshiki.tech
        </div>
      </div>
    </div>
  );
}
