// ネイティブメニュー (Rust 側) から発火される "menu-action" イベントを受け、
// アクション ID に応じてフロントのハンドラを実行する

import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { useAppStore } from "../store/useAppStore";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  showOpenFileDialog,
  showOpenFolderDialog,
  showSaveFileDialog,
  readFile,
  writeFile,
  buildFileTree,
  confirmDiscard,
} from "../utils/fs";
import { exportHTML, exportPDF } from "../utils/export";
import { t } from "../i18n";

export function useMenuListener(editorView: EditorView | null) {
  // EditorView は再レンダで変わるため ref で保持
  const editorRef = useRef<EditorView | null>(editorView);
  editorRef.current = editorView;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    // StrictMode で effect が二重起動した際の競合対策フラグ
    let cancelled = false;

    (async () => {
      const handle = await listen<string>("menu-action", async (e) => {
        const id = e.payload;
        const store = useAppStore.getState();
        const settingsStore = useSettingsStore.getState();

        switch (id) {
          case "new":
            store.newDocument();
            break;

          case "open_file": {
            const path = await showOpenFileDialog();
            if (!path) break;
            const content = await readFile(path);
            useAppStore.getState().openDocument(path, content);
            const name = path.split(/[\\/]/).pop() ?? "untitled.md";
            useAppStore.getState().pushRecentFile({
              path,
              name,
              openedAt: Date.now(),
            });
            await settingsStore.saveRecentFiles(useAppStore.getState().recentFiles);
            break;
          }

          case "open_folder": {
            const root = await showOpenFolderDialog();
            if (!root) break;
            const tree = await buildFileTree(root);
            useAppStore.getState().setWorkspace(root, tree);
            break;
          }

          case "save":
          case "save_as": {
            const doc = useAppStore.getState().getActive();
            if (!doc) break;
            const saveAs = id === "save_as";
            const isNewPath = !doc.path || saveAs;
            let path: string | null = doc.path;
            if (isNewPath) {
              // 保存先の既定ディレクトリ: サイドバーで選択中のフォルダ > 開いているワークスペース。
              // ダイアログ上で別の場所を選べば、もちろんそちらが優先される。
              const st = useAppStore.getState();
              const preferDir = st.selectedFolderPath ?? st.workspaceRoot;
              // 「名前を付けて保存」でフォルダが選択 (または WS が開いて) いる場合は、
              // 既存ファイルの場所より選択中フォルダを既定にしたいので currentPath は渡さない
              const currentPath = saveAs && preferDir ? null : doc.path;
              path = await showSaveFileDialog(doc.name, currentPath, preferDir);
            }
            if (!path) break;
            await writeFile(path, doc.content);
            useAppStore.getState().markSaved(doc.id, path);
            const name = path.split(/[\\/]/).pop() ?? doc.name;
            useAppStore.getState().pushRecentFile({
              path,
              name,
              openedAt: Date.now(),
            });
            await settingsStore.saveRecentFiles(useAppStore.getState().recentFiles);
            // 新規パスへ書き込んだ場合 (= ファイルが新たに出現する) はツリーを再構築
            if (isNewPath) {
              await useAppStore.getState().refreshWorkspace();
            }
            break;
          }

          case "close_tab": {
            const doc = useAppStore.getState().getActive();
            if (!doc) break;
            if (doc.dirty) {
              const ok = await confirmDiscard(
                t("app.confirmDiscardFile", { name: doc.name }),
              );
              if (!ok) break;
            }
            useAppStore.getState().closeDocument(doc.id);
            break;
          }

          case "find": {
            const view = editorRef.current;
            if (view) {
              view.focus();
              openSearchPanel(view);
            }
            break;
          }

          case "toggle_sidebar":
            store.toggleSidebar();
            break;

          case "edit_mode":
            store.setViewMode("edit");
            break;

          case "split_mode":
            store.setViewMode("split");
            break;

          case "preview_mode": {
            // Ctrl+P サイクル: edit -> split -> preview -> edit
            const cur = useAppStore.getState().viewMode;
            const next =
              cur === "edit" ? "split" : cur === "split" ? "preview" : "edit";
            useAppStore.getState().setViewMode(next);
            break;
          }

          case "preferences":
            store.setSettingsOpen(true);
            break;

          case "about":
            store.setAboutOpen(true);
            break;

          case "export_html": {
            const doc = useAppStore.getState().getActive();
            if (!doc) break;
            await exportHTML(doc.name, doc.content);
            break;
          }

          case "export_pdf": {
            const doc = useAppStore.getState().getActive();
            if (!doc) break;
            exportPDF(doc.name, doc.content);
            break;
          }
        }
      });
      // cleanup 後に listen が解決した場合は即座に解除して二重登録を防ぐ
      if (cancelled) {
        handle();
      } else {
        unlisten = handle;
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
