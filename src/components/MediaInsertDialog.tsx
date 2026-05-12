// 「メディアを挿入」ダイアログ
// - ローカルファイルを選ぶ → assets/ にコピー (既にフォルダ配下なら相対参照のみ) して挿入
// - ネット上の URL を入力 → そのまま参照を挿入 (コピーしない)
// 画像/動画は width="auto" 付きで挿入されるので、エディタ上で "auto" を数値や % に
// 書き換えてサイズ調整できる (= 先にファイルを選び、後から幅を調整できる)。

import { useState } from "react";
import type { EditorView } from "@codemirror/view";
import { useAppStore } from "../store/useAppStore";
import { useT } from "../i18n";
import { insertMediaFromDialog, insertMediaUrl } from "../utils/mediaActions";

export function MediaInsertDialog({
  editorView,
}: {
  editorView: EditorView | null;
}) {
  const open = useAppStore((s) => s.mediaDialogOpen);
  const setOpen = useAppStore((s) => s.setMediaDialogOpen);
  const t = useT();
  const [url, setUrl] = useState("");

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setUrl("");
  };

  const pickLocal = async () => {
    if (!editorView) return;
    close();
    await insertMediaFromDialog(editorView);
  };

  const submitUrl = () => {
    if (!editorView || !url.trim()) return;
    insertMediaUrl(editorView, url.trim());
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
      onClick={close}
    >
      <div
        className="w-[420px] max-w-[90vw] rounded-lg border border-zen-border bg-zen-surface p-6 text-sm shadow-2xl dark:border-zen-dark-border dark:bg-zen-dark-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("mediaDialog.title")}</h2>
          <button
            onClick={close}
            className="text-zen-subtle hover:text-zen-text dark:text-zen-dark-subtle dark:hover:text-zen-dark-text"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* ローカルファイル */}
          <button
            onClick={() => void pickLocal()}
            className="w-full rounded border border-zen-border px-3 py-2 text-left hover:bg-black/5 dark:border-zen-dark-border dark:hover:bg-white/10"
          >
            {t("mediaDialog.chooseLocal")}
          </button>

          {/* 区切り */}
          <div className="flex items-center gap-2 text-xs text-zen-subtle dark:text-zen-dark-subtle">
            <span className="h-px flex-1 bg-zen-border dark:bg-zen-dark-border" />
            <span>{t("mediaDialog.or")}</span>
            <span className="h-px flex-1 bg-zen-border dark:bg-zen-dark-border" />
          </div>

          {/* URL */}
          <div>
            <label className="mb-1 block text-xs text-zen-subtle dark:text-zen-dark-subtle">
              {t("mediaDialog.urlLabel")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitUrl();
                }}
                placeholder="https://..."
                className="flex-1 rounded border border-zen-border bg-zen-bg px-2 py-1 dark:border-zen-dark-border dark:bg-zen-dark-bg"
              />
              <button
                onClick={submitUrl}
                disabled={!url.trim()}
                className="rounded bg-zen-accent px-3 py-1 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("mediaDialog.insert")}
              </button>
            </div>
          </div>

          {/* サイズ調整のヒント */}
          <p className="text-xs text-zen-subtle dark:text-zen-dark-subtle">
            {t("mediaDialog.widthHint")}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={close}
            className="rounded px-3 py-1 text-zen-subtle hover:bg-black/5 dark:text-zen-dark-subtle dark:hover:bg-white/10"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
