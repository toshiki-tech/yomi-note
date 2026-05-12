// 「YomiNote について」ダイアログ
// 単なるバージョン表示ではなく、Yomi シリーズ全体への入口として見せる。

import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppStore } from "../store/useAppStore";
import { useT } from "../i18n";
import pkg from "../../package.json";

const WEBSITE_URL = "https://toshiki.tech";

export function AboutDialog() {
  const open = useAppStore((s) => s.aboutOpen);
  const setOpen = useAppStore((s) => s.setAboutOpen);
  const t = useT();

  if (!open) return null;

  const products: {
    name: string;
    desc: string;
    url: string;
    current?: boolean;
  }[] = [
    {
      name: "YomiNote",
      desc: t("about.noteDesc"),
      url: "https://www.toshiki.tech/p/yominote",
      current: true,
    },
    {
      name: "YomiPlay",
      desc: t("about.playDesc"),
      url: "https://www.toshiki.tech/p/yomiplay",
    },
    {
      name: "YomiMark",
      desc: t("about.markDesc"),
      url: "https://www.toshiki.tech/p/yomimark",
    },
  ];

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
          aria-label={t("common.close")}
        >
          ✕
        </button>

        {/* ヘッダー: 製品名 + slogan */}
        <div className="text-center">
          <div className="text-xl font-semibold tracking-tight">YomiNote</div>
          <div className="mt-1 text-xs italic text-zen-subtle dark:text-zen-dark-subtle">
            {t("about.slogan")}
          </div>
        </div>

        {/* 製品定位 */}
        <div className="mt-5 text-center leading-relaxed">
          <div>{t("about.tagline")}</div>
          <div className="mt-1 text-xs text-zen-subtle dark:text-zen-dark-subtle">
            {t("about.features")}
          </div>
        </div>

        {/* Yomi シリーズ */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-xs text-zen-subtle dark:text-zen-dark-subtle">
            <span className="h-px flex-1 bg-zen-border dark:bg-zen-dark-border" />
            <span>{t("about.series")}</span>
            <span className="h-px flex-1 bg-zen-border dark:bg-zen-dark-border" />
          </div>
          <ul className="space-y-1">
            {products.map((p) => (
              <li key={p.name} className="flex gap-3">
                <button
                  onClick={() => void openUrl(p.url)}
                  className={`w-20 shrink-0 text-left text-zen-accent hover:underline dark:text-zen-dark-accent ${
                    p.current ? "font-semibold" : "font-medium"
                  }`}
                >
                  {p.name}
                </button>
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
            {t("about.website")}
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
          {t("about.version")} {pkg.version} · {t("about.builtBy")}
        </div>
      </div>
    </div>
  );
}
