// 上部ツールバー
// タブ表示 + 表示モード切替 + 書式挿入 + 設定ボタン

import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { rename as fsRename, exists as fsExists } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/useAppStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { ActionToolbarLeft, ActionToolbarRight } from "./ActionToolbar";
import { useT } from "../i18n";

interface ToolbarProps {
  editorView: EditorView | null;
}

export function Toolbar({ editorView }: ToolbarProps) {
  const {
    documents,
    activeId,
    setActive,
    closeDocument,
    renameDocument,
    newDocument,
    toggleSidebar,
  } = useAppStore();
  const toolbarAboveTabs = useSettingsStore((s) => s.settings.toolbarAboveTabs);
  const toolbarFloating = useSettingsStore((s) => s.settings.toolbarFloating);
  const t = useT();

  // インライン名前変更の状態
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 編集モードに入るときにフォーカス + 拡張子を除いた部分を選択
  useEffect(() => {
    if (renamingId && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      // .md 拡張子を除いた部分のみ選択
      const dot = renameValue.lastIndexOf(".");
      const end = dot > 0 ? dot : renameValue.length;
      el.setSelectionRange(0, end);
    }
  }, [renamingId]);

  function startRename(docId: string, currentName: string) {
    setRenamingId(docId);
    setRenameValue(currentName);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  // 名前変更を確定: ディスク上のファイルがあれば fs.rename も実行
  async function commitRename(docId: string) {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) {
      cancelRename();
      return;
    }
    let next = renameValue.trim();
    if (!next) {
      cancelRename();
      return;
    }
    // 拡張子がなければ .md を補う
    if (!/\.[a-zA-Z0-9]+$/.test(next)) next += ".md";
    if (next === doc.name) {
      cancelRename();
      return;
    }
    if (doc.path) {
      // ディスク上のファイルもリネーム
      const sep = doc.path.includes("\\") ? "\\" : "/";
      const idx = doc.path.lastIndexOf(sep);
      const dir = idx > 0 ? doc.path.substring(0, idx) : "";
      const newPath = dir ? `${dir}${sep}${next}` : next;
      try {
        const conflict = await fsExists(newPath);
        if (conflict) {
          window.alert(t("sidebar.errorExists", { name: next }));
          return;
        }
        await fsRename(doc.path, newPath);
        renameDocument(doc.id, next, newPath);
        // ワークスペースツリーが古い名前のままにならないよう再構築
        await useAppStore.getState().refreshWorkspace();
      } catch (err) {
        console.warn("ファイルのリネームに失敗しました", err);
        window.alert(String(err));
        return;
      }
    } else {
      // 未保存ファイルはタブ名のみ更新 (次回保存ダイアログの初期値に反映)
      renameDocument(doc.id, next);
    }
    cancelRename();
  }

  return (
    <div
      className="flex select-none flex-col border-b border-zen-border bg-zen-surface text-xs dark:border-zen-dark-border dark:bg-zen-dark-surface"
      data-tauri-drag-region
    >
      {/* === タブストリップ行 ===
          toolbarAboveTabs に応じて action 行と上下を入れ替える。
          下段になった行に border-t を付ける。 */}
      <div
        className={`flex h-9 items-center gap-1 px-2 ${
          toolbarAboveTabs ? "border-t border-zen-border dark:border-zen-dark-border" : ""
        }`}
        style={{ order: toolbarAboveTabs ? 2 : 1 }}
        data-tauri-drag-region
      >
      {/* サイドバー切替 */}
      <IconBtn onClick={toggleSidebar} title={t("toolbar.toggleSidebar")}>
        <SidebarIcon />
      </IconBtn>

      <div className="mx-1 h-5 w-px bg-zen-border dark:bg-zen-dark-border" />

      {/* タブ */}
      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {documents.length === 0 && (
          <span className="px-2 text-zen-subtle dark:text-zen-dark-subtle">
            {t("app.title")}
          </span>
        )}
        {documents.map((doc) => {
          const isActive = doc.id === activeId;
          const isRenaming = doc.id === renamingId;
          return (
            <div
              key={doc.id}
              onClick={() => !isRenaming && setActive(doc.id)}
              onDoubleClick={(e) => {
                // 子要素 (×ボタン等) で発火させない
                if ((e.target as HTMLElement).tagName === "INPUT") return;
                startRename(doc.id, doc.name);
              }}
              className={`group flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 ${
                isActive
                  ? "bg-zen-bg text-zen-text dark:bg-zen-dark-bg dark:text-zen-dark-text"
                  : "text-zen-subtle hover:bg-black/5 dark:text-zen-dark-subtle dark:hover:bg-white/10"
              }`}
              title={doc.path ?? doc.name}
            >
              {isRenaming ? (
                <input
                  ref={inputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(doc.id);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={() => commitRename(doc.id)}
                  className="w-40 rounded bg-white px-1 text-zen-text outline-none ring-1 ring-zen-accent dark:bg-zen-dark-bg dark:text-zen-dark-text dark:ring-zen-dark-accent"
                />
              ) : (
                <span className="max-w-[160px] truncate select-none">
                  {doc.dirty ? "● " : ""}
                  {doc.name}
                </span>
              )}
              {!isRenaming && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDocument(doc.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500"
                  title={t("toolbar.closeTab")}
                >
                  ✕
                </span>
              )}
            </div>
          );
        })}
        {/* 新規タブを追加 */}
        <button
          onClick={() => newDocument()}
          title={t("toolbar.newTab")}
          className="ml-1 shrink-0 rounded px-2 py-1 text-zen-subtle hover:bg-black/5 hover:text-zen-text dark:text-zen-dark-subtle dark:hover:bg-white/10 dark:hover:text-zen-dark-text"
        >
          +
        </button>
      </div>
      </div>

      {/* === アクションツールバー行 ===
          - 左半 (書式 + 注釈) は浮動可能。toolbarFloating 時はここに描画せず App.tsx 直下に出す。
          - 右半 (モード切替 + 設定) は常にこの行の右端に固定。 */}
      <div
        className={`flex h-9 items-center gap-1 px-2 ${
          toolbarAboveTabs
            ? ""
            : "border-t border-zen-border dark:border-zen-dark-border"
        }`}
        style={{ order: toolbarAboveTabs ? 1 : 2 }}
        data-tauri-drag-region
      >
        {!toolbarFloating && (
          <ActionToolbarLeft editorView={editorView} mode="docked" />
        )}
        <div className="flex-1" />
        <ActionToolbarRight />
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded px-2 py-1 text-zen-subtle hover:bg-black/5 hover:text-zen-text dark:text-zen-dark-subtle dark:hover:bg-white/10 dark:hover:text-zen-dark-text"
    >
      {children}
    </button>
  );
}

/** サイドバー切替アイコン */
function SidebarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}
