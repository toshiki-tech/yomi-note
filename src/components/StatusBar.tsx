// 下部ステータスバー
// ファイル名 / 文字数 / 行数 / 保存状態 / 表示モードを表示する

import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { countCharacters, countLines, countWords } from "../utils/markdown";
import { useT } from "../i18n";
import { DEFAULT_SETTINGS } from "../types";

export function StatusBar() {
  const doc = useAppStore((s) =>
    s.documents.find((d) => d.id === s.activeId) ?? null,
  );
  const viewMode = useAppStore((s) => s.viewMode);
  const fontSize = useSettingsStore((s) => s.settings.fontSize);
  const t = useT();

  // 既定フォントサイズを 100% としたズーム倍率。Ctrl+ホイールで滑らかに変化する。
  const zoomPct = Math.round((fontSize / DEFAULT_SETTINGS.fontSize) * 100);

  const stats = useMemo(() => {
    const text = doc?.content ?? "";
    return {
      chars: countCharacters(text),
      words: countWords(text),
      lines: countLines(text),
    };
  }, [doc?.content]);

  const modeLabel =
    viewMode === "edit"
      ? t("toolbar.modeEdit")
      : viewMode === "split"
        ? t("toolbar.modeSplit")
        : t("toolbar.modePreview");
  const savedLabel = !doc
    ? "—"
    : doc.dirty
      ? t("status.modified")
      : doc.path
        ? t("status.saved")
        : t("status.newFile");

  return (
    <footer className="flex h-6 select-none items-center justify-between border-t border-zen-border bg-zen-surface px-3 text-[11px] text-zen-subtle dark:border-zen-dark-border dark:bg-zen-dark-surface dark:text-zen-dark-subtle">
      <div className="flex items-center gap-3">
        <span className="truncate" title={doc?.path ?? doc?.name ?? ""}>
          {doc ? doc.name : t("status.noFile")}
        </span>
        <span>{savedLabel}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>Markdown</span>
        <span>{modeLabel}</span>
        <span title={`${fontSize}px`}>
          {t("status.zoom")}: {zoomPct}%
        </span>
        <span>{t("status.lines")}: {stats.lines}</span>
        <span>{t("status.words")}: {stats.words}</span>
        <span>{t("status.chars")}: {stats.chars}</span>
      </div>
    </footer>
  );
}
