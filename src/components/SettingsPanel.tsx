// 設定モーダル
// テーマ・言語・フォント・自動保存・既定モードなどを編集する

import { useSettingsStore } from "../store/useSettingsStore";
import { useAppStore } from "../store/useAppStore";
import { useT } from "../i18n";
import type { Language, ThemeMode, ViewMode } from "../types";
// useAppStore is already imported above; kept side-effect-free

// エディタフォントの候補 (datalist 用)。バンドル済みフォント + よくある等幅フォント。
const EDITOR_FONT_OPTIONS = [
  "JetBrains Mono",
  "Cascadia Code",
  "Consolas",
  "Fira Code",
  "Source Code Pro",
  "Menlo",
  "Inter",
  "Noto Sans JP",
  "Noto Sans SC",
];

export function SettingsPanel() {
  const open = useAppStore((s) => s.settingsOpen);
  const setOpen = useAppStore((s) => s.setSettingsOpen);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);
  const t = useT();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[560px] max-w-[90vw] rounded-lg border border-zen-border bg-zen-surface p-6 text-sm shadow-2xl dark:border-zen-dark-border dark:bg-zen-dark-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("settings.title")}</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-zen-subtle hover:text-zen-text dark:text-zen-dark-subtle dark:hover:text-zen-dark-text"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* 言語 */}
          <Row label={t("settings.language")}>
            <select
              value={settings.language}
              onChange={(e) => update({ language: e.target.value as Language })}
              className="rounded border border-zen-border bg-zen-bg px-2 py-1 dark:border-zen-dark-border dark:bg-zen-dark-bg"
            >
              <option value="system">{t("settings.languageSystem")}</option>
              <option value="ja">{t("settings.languageJa")}</option>
              <option value="en">{t("settings.languageEn")}</option>
              <option value="zh">{t("settings.languageZh")}</option>
              <option value="zh-TW">{t("settings.languageZhTW")}</option>
            </select>
          </Row>

          {/* テーマ */}
          <Row label={t("settings.theme")}>
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value as ThemeMode })}
              className="rounded border border-zen-border bg-zen-bg px-2 py-1 dark:border-zen-dark-border dark:bg-zen-dark-bg"
            >
              <option value="system">{t("settings.themeSystem")}</option>
              <option value="light">{t("settings.themeLight")}</option>
              <option value="dark">{t("settings.themeDark")}</option>
            </select>
          </Row>

          {/* フォントサイズ */}
          <Row label={t("settings.fontSize")}>
            <input
              type="number"
              min={10}
              max={32}
              value={settings.fontSize}
              onChange={(e) =>
                update({ fontSize: Number(e.target.value) || 15 })
              }
              className="w-20 rounded border border-zen-border bg-zen-bg px-2 py-1 dark:border-zen-dark-border dark:bg-zen-dark-bg"
            />
            <span className="ml-2 text-zen-subtle dark:text-zen-dark-subtle">
              px
            </span>
          </Row>

          {/* フォント (バンドル済み + よくあるフォントから選択) */}
          <Row label={t("settings.fontFamily")}>
            <select
              value={settings.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="w-64 rounded border border-zen-border bg-zen-bg px-2 py-1 dark:border-zen-dark-border dark:bg-zen-dark-bg"
            >
              {!EDITOR_FONT_OPTIONS.includes(settings.fontFamily) && (
                <option value={settings.fontFamily}>
                  {settings.fontFamily}
                </option>
              )}
              {EDITOR_FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Row>

          {/* 既定の表示モード */}
          <Row label={t("settings.defaultViewMode")}>
            <select
              value={settings.defaultViewMode}
              onChange={(e) =>
                update({ defaultViewMode: e.target.value as ViewMode })
              }
              className="rounded border border-zen-border bg-zen-bg px-2 py-1 dark:border-zen-dark-border dark:bg-zen-dark-bg"
            >
              <option value="edit">{t("toolbar.modeEdit")}</option>
              <option value="split">{t("toolbar.modeSplit")}</option>
              <option value="preview">{t("toolbar.modePreview")}</option>
            </select>
          </Row>

          {/* 自動保存 */}
          <Row label={t("settings.autoSave")}>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => update({ autoSave: e.target.checked })}
              />
              <span>{t("common.enable")}</span>
            </label>
          </Row>

          <Row label={t("settings.autoSaveDelay")}>
            <input
              type="number"
              min={500}
              max={10000}
              step={100}
              disabled={!settings.autoSave}
              value={settings.autoSaveDelay}
              onChange={(e) =>
                update({ autoSaveDelay: Number(e.target.value) || 1500 })
              }
              className="w-24 rounded border border-zen-border bg-zen-bg px-2 py-1 disabled:opacity-50 dark:border-zen-dark-border dark:bg-zen-dark-bg"
            />
          </Row>

          {/* プレビュー Serif */}
          <Row label={t("settings.previewSerif")}>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.previewSerif}
                onChange={(e) => update({ previewSerif: e.target.checked })}
              />
              <span>{t("common.enable")}</span>
            </label>
          </Row>

          {/* ツールバー位置 */}
          <Row label={t("settings.toolbarAboveTabs")}>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.toolbarAboveTabs}
                onChange={(e) => update({ toolbarAboveTabs: e.target.checked })}
              />
              <span>{t("common.enable")}</span>
            </label>
          </Row>

          {/* ドラフト保存先 */}
          <Row label={t("settings.draftDir")}>
            <input
              type="text"
              value={settings.draftDir}
              onChange={(e) => update({ draftDir: e.target.value })}
              placeholder={t("settings.draftDirPlaceholder")}
              className="w-64 rounded border border-zen-border bg-zen-bg px-2 py-1 dark:border-zen-dark-border dark:bg-zen-dark-bg"
            />
          </Row>

          {/* 日本語アノテーションセクション */}
          <div className="border-t border-zen-border pt-4 dark:border-zen-dark-border">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zen-subtle dark:text-zen-dark-subtle">
              {t("settings.japaneseSection")}
            </div>
            <p className="mb-3 text-xs leading-relaxed text-zen-subtle dark:text-zen-dark-subtle">
              {t("settings.japaneseHint")}
            </p>
            <button
              onClick={() => {
                useAppStore.getState().setUserDictOpen(true);
                setOpen(false);
              }}
              className="rounded border border-zen-border px-3 py-1 text-xs hover:bg-black/5 dark:border-zen-dark-border dark:hover:bg-white/10"
            >
              {t("settings.openUserDict")}
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zen-border pt-4 dark:border-zen-dark-border">
          <button
            onClick={() => reset()}
            className="rounded px-3 py-1 text-zen-subtle hover:bg-black/5 dark:text-zen-dark-subtle dark:hover:bg-white/10"
          >
            {t("common.reset")}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded bg-zen-accent px-4 py-1 text-white hover:opacity-90"
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zen-subtle dark:text-zen-dark-subtle">{label}</span>
      <div>{children}</div>
    </div>
  );
}
