// ユーザー辞書管理 UI
// SettingsPanel から開閉される。エントリ一覧 + 追加/削除 + JSON インポート/エクスポート

import { useMemo, useState } from "react";
import { useUserDictStore } from "../store/useUserDictStore";
import { useT } from "../i18n";
import { showOpenFileDialog, showSaveFileDialog, readFile, writeFile } from "../utils/fs";

export function UserDictPanel({ onClose }: { onClose: () => void }) {
  const entries = useUserDictStore((s) => s.entries);
  const setEntry = useUserDictStore((s) => s.set);
  const removeEntry = useUserDictStore((s) => s.remove);
  const replaceAll = useUserDictStore((s) => s.replaceAll);
  const exportJSON = useUserDictStore((s) => s.exportJSON);
  const t = useT();

  const [newWord, setNewWord] = useState("");
  const [newEnglish, setNewEnglish] = useState("");
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const list = Object.entries(entries);
    list.sort((a, b) => a[0].localeCompare(b[0]));
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter(
      ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q),
    );
  }, [entries, filter]);

  async function handleAdd() {
    if (!newWord.trim() || !newEnglish.trim()) return;
    await setEntry(newWord, newEnglish);
    setNewWord("");
    setNewEnglish("");
  }

  async function handleExport() {
    const path = await showSaveFileDialog("user-dict.json", null);
    if (!path) return;
    await writeFile(path, exportJSON());
  }

  async function handleImport() {
    const path = await showOpenFileDialog();
    if (!path) return;
    try {
      const txt = await readFile(path);
      const parsed = JSON.parse(txt);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        window.alert(t("userDict.invalidJson"));
        return;
      }
      // 全件を文字列ペアに正規化
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && k && v) next[k] = v;
      }
      // マージ or 置き換え?: ユーザに確認
      const merge = window.confirm(t("userDict.mergeConfirm"));
      if (merge) {
        await replaceAll({ ...entries, ...next });
      } else {
        await replaceAll(next);
      }
    } catch (err) {
      window.alert(`${t("userDict.invalidJson")}\n${err}`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-[720px] max-w-[95vw] flex-col rounded-lg border border-zen-border bg-zen-surface text-sm shadow-2xl dark:border-zen-dark-border dark:bg-zen-dark-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zen-border px-6 py-4 dark:border-zen-dark-border">
          <h2 className="text-base font-semibold">{t("userDict.title")}</h2>
          <button
            onClick={onClose}
            className="text-zen-subtle hover:text-zen-text dark:text-zen-dark-subtle dark:hover:text-zen-dark-text"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-zen-border px-6 py-3 dark:border-zen-dark-border">
          <input
            type="text"
            placeholder={t("userDict.searchPlaceholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded border border-zen-border bg-zen-bg px-2 py-1 text-xs outline-none focus:border-zen-accent dark:border-zen-dark-border dark:bg-zen-dark-bg dark:focus:border-zen-dark-accent"
          />
          <button
            onClick={handleImport}
            className="rounded border border-zen-border px-3 py-1 text-xs hover:bg-black/5 dark:border-zen-dark-border dark:hover:bg-white/10"
          >
            {t("userDict.import")}
          </button>
          <button
            onClick={handleExport}
            className="rounded border border-zen-border px-3 py-1 text-xs hover:bg-black/5 dark:border-zen-dark-border dark:hover:bg-white/10"
          >
            {t("userDict.export")}
          </button>
        </div>

        {/* Add row */}
        <div className="flex items-center gap-2 border-b border-zen-border px-6 py-3 dark:border-zen-dark-border">
          <input
            type="text"
            placeholder={t("userDict.wordPlaceholder")}
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-44 rounded border border-zen-border bg-zen-bg px-2 py-1 text-xs outline-none focus:border-zen-accent dark:border-zen-dark-border dark:bg-zen-dark-bg dark:focus:border-zen-dark-accent"
          />
          <span className="text-zen-subtle dark:text-zen-dark-subtle">→</span>
          <input
            type="text"
            placeholder={t("userDict.englishPlaceholder")}
            value={newEnglish}
            onChange={(e) => setNewEnglish(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 rounded border border-zen-border bg-zen-bg px-2 py-1 text-xs outline-none focus:border-zen-accent dark:border-zen-dark-border dark:bg-zen-dark-bg dark:focus:border-zen-dark-accent"
          />
          <button
            onClick={handleAdd}
            disabled={!newWord.trim() || !newEnglish.trim()}
            className="rounded bg-zen-accent px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            {t("userDict.add")}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-zen-subtle dark:text-zen-dark-subtle">
              {t("userDict.empty")}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zen-surface dark:bg-zen-dark-surface">
                <tr className="border-b border-zen-border text-left text-zen-subtle dark:border-zen-dark-border dark:text-zen-dark-subtle">
                  <th className="px-6 py-2 font-medium">{t("userDict.word")}</th>
                  <th className="px-2 py-2 font-medium">{t("userDict.english")}</th>
                  <th className="w-12 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(([word, english]) => (
                  <tr
                    key={word}
                    className="border-b border-zen-border/50 hover:bg-black/[.02] dark:border-zen-dark-border/50 dark:hover:bg-white/[.03]"
                  >
                    <td className="px-6 py-1.5 font-medium">{word}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        defaultValue={english}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== english) void setEntry(word, v);
                        }}
                        className="w-full bg-transparent outline-none focus:bg-zen-bg dark:focus:bg-zen-dark-bg"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => removeEntry(word)}
                        className="text-zen-subtle hover:text-red-500 dark:text-zen-dark-subtle"
                        title={t("userDict.remove")}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zen-border px-6 py-3 text-xs text-zen-subtle dark:border-zen-dark-border dark:text-zen-dark-subtle">
          {t("userDict.count", { count: String(Object.keys(entries).length) })}
        </div>
      </div>
    </div>
  );
}
