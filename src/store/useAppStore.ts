// アプリ全体の状態管理 (Zustand)
// 開いているドキュメント・現在アクティブなタブ・最近開いたファイルなどを保持する

import { create } from "zustand";
import type {
  OpenDocument,
  RecentFile,
  ViewMode,
  FileTreeNode,
} from "../types";
import { buildFileTree } from "../utils/fs";

/** ID 生成 (簡易 UUID) */
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AppState {
  // === ドキュメント関連 ===
  documents: OpenDocument[];
  activeId: string | null;

  // === UI 関連 ===
  viewMode: ViewMode;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  userDictOpen: boolean;

  // === ファイルツリー / 最近のファイル ===
  workspaceRoot: string | null;
  fileTree: FileTreeNode[] | null;
  /** ツリー上で選択中のフォルダ。新規作成・保存ダイアログの既定先として使う */
  selectedFolderPath: string | null;
  recentFiles: RecentFile[];

  // === アクション: ドキュメント ===
  newDocument: () => string;
  openDocument: (path: string, content: string) => void;
  closeDocument: (id: string) => void;
  setActive: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, path: string) => void;
  /** タブ名 (および対応する path) をリネームする。
   *  newPath を渡すと既存ファイルもディスク上は別途リネーム済みとして扱う */
  renameDocument: (id: string, newName: string, newPath?: string | null) => void;

  // === アクション: UI ===
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setSettingsOpen: (open: boolean) => void;
  setUserDictOpen: (open: boolean) => void;

  // === アクション: ワークスペース ===
  setWorkspace: (root: string | null, tree: FileTreeNode[] | null) => void;
  refreshWorkspace: () => Promise<void>;
  setSelectedFolderPath: (path: string | null) => void;
  setRecentFiles: (files: RecentFile[]) => void;
  pushRecentFile: (file: RecentFile) => void;
  /** 指定パス (またはそれ以下の子) を path とするタブを全て閉じる */
  closeDocumentsUnderPath: (path: string) => void;
  /** 指定パスのタブが開いていれば、そのパスを新パスに更新する (リネーム時) */
  remapDocumentPath: (oldPath: string, newPath: string) => void;

  // === セレクタ ===
  getActive: () => OpenDocument | null;
  hasUnsaved: () => boolean;
}

/** 新規 Untitled ドキュメントの番号を採番 */
function nextUntitledName(docs: OpenDocument[]): string {
  const used = docs
    .map((d) => d.name)
    .filter((n) => /^Untitled-\d+\.md$/.test(n))
    .map((n) => Number(n.match(/\d+/)?.[0] ?? 0));
  const next = used.length === 0 ? 1 : Math.max(...used) + 1;
  return `Untitled-${next}.md`;
}

export const useAppStore = create<AppState>((set, get) => ({
  documents: [],
  activeId: null,

  viewMode: "split",
  sidebarOpen: true,
  settingsOpen: false,
  userDictOpen: false,

  workspaceRoot: null,
  fileTree: null,
  selectedFolderPath: null,
  recentFiles: [],

  // 新規ドキュメントを作成
  newDocument: () => {
    const id = genId();
    set((s) => {
      const name = nextUntitledName(s.documents);
      const doc: OpenDocument = {
        id,
        path: null,
        name,
        content: "",
        dirty: false,
      };
      return { documents: [...s.documents, doc], activeId: id };
    });
    return id;
  },

  // ローカルファイルから開く (既に開いていればそのタブをアクティブに)
  openDocument: (path, content) => {
    const existing = get().documents.find((d) => d.path === path);
    if (existing) {
      set({ activeId: existing.id });
      return;
    }
    const id = genId();
    const name = path.split(/[\\/]/).pop() ?? "untitled.md";
    const doc: OpenDocument = {
      id,
      path,
      name,
      content,
      dirty: false,
      savedAt: Date.now(),
    };
    set((s) => ({ documents: [...s.documents, doc], activeId: id }));
  },

  // タブを閉じる
  closeDocument: (id) => {
    set((s) => {
      const remaining = s.documents.filter((d) => d.id !== id);
      const nextActive =
        s.activeId === id ? remaining[remaining.length - 1]?.id ?? null : s.activeId;
      return { documents: remaining, activeId: nextActive };
    });
  },

  setActive: (id) => set({ activeId: id }),

  // エディタ内容の更新 (dirty フラグ更新)
  updateContent: (id, content) => {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, content, dirty: true } : d,
      ),
    }));
  },

  // 保存完了時に呼ぶ。dirty を false に戻し、path を更新する
  markSaved: (id, path) => {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id
          ? {
              ...d,
              path,
              name: path.split(/[\\/]/).pop() ?? d.name,
              dirty: false,
              savedAt: Date.now(),
            }
          : d,
      ),
    }));
  },

  // タブのリネーム。dirty フラグは保持する (内容変更とは独立)
  renameDocument: (id, newName, newPath) => {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id
          ? {
              ...d,
              name: newName,
              path: newPath !== undefined ? newPath : d.path,
            }
          : d,
      ),
    }));
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setUserDictOpen: (open) => set({ userDictOpen: open }),

  setWorkspace: (root, tree) =>
    set({ workspaceRoot: root, fileTree: tree, selectedFolderPath: null }),

  setSelectedFolderPath: (path) => set({ selectedFolderPath: path }),

  refreshWorkspace: async () => {
    const root = get().workspaceRoot;
    if (!root) return;
    try {
      const tree = await buildFileTree(root);
      set({ fileTree: tree });
    } catch (err) {
      console.warn("ファイルツリーの再構築に失敗", err);
    }
  },

  setRecentFiles: (files) => set({ recentFiles: files }),

  // 指定パス、または指定パス配下のタブを全て閉じる (フォルダ削除時など)
  // 選択中のフォルダがその配下にあればクリアする
  closeDocumentsUnderPath: (path) => {
    set((s) => {
      const sep = path.includes("\\") ? "\\" : "/";
      const prefix = path.endsWith(sep) ? path : path + sep;
      const remaining = s.documents.filter(
        (d) => d.path !== path && !(d.path && d.path.startsWith(prefix)),
      );
      const stillActive = remaining.find((d) => d.id === s.activeId);
      const nextActive = stillActive
        ? s.activeId
        : remaining[remaining.length - 1]?.id ?? null;
      const selected = s.selectedFolderPath;
      const clearSelected =
        selected !== null &&
        (selected === path || selected.startsWith(prefix));
      return {
        documents: remaining,
        activeId: nextActive,
        ...(clearSelected ? { selectedFolderPath: null } : null),
      };
    });
  },

  // 開いているタブのパスをリネーム後のパスへ更新する (子要素も含む)
  // 選択中フォルダがリネーム対象 (またはその配下) なら追従させる
  remapDocumentPath: (oldPath, newPath) => {
    set((s) => {
      const sep = oldPath.includes("\\") ? "\\" : "/";
      const oldPrefix = oldPath.endsWith(sep) ? oldPath : oldPath + sep;
      const newPrefix = newPath.endsWith(sep) ? newPath : newPath + sep;
      const selected = s.selectedFolderPath;
      let nextSelected = selected;
      if (selected !== null) {
        if (selected === oldPath) nextSelected = newPath;
        else if (selected.startsWith(oldPrefix)) {
          nextSelected = newPrefix + selected.substring(oldPrefix.length);
        }
      }
      return {
        documents: s.documents.map((d) => {
          if (!d.path) return d;
          if (d.path === oldPath) {
            const name = newPath.split(/[\\/]/).pop() ?? d.name;
            return { ...d, path: newPath, name };
          }
          if (d.path.startsWith(oldPrefix)) {
            const remapped = newPrefix + d.path.substring(oldPrefix.length);
            return { ...d, path: remapped };
          }
          return d;
        }),
        ...(nextSelected !== selected ? { selectedFolderPath: nextSelected } : null),
      };
    });
  },

  // 最近開いたファイル一覧へ追加 (重複は削除して先頭に挿入、最大 20 件)
  pushRecentFile: (file) => {
    set((s) => {
      const filtered = s.recentFiles.filter((f) => f.path !== file.path);
      const next = [file, ...filtered].slice(0, 20);
      return { recentFiles: next };
    });
  },

  getActive: () => {
    const s = get();
    return s.documents.find((d) => d.id === s.activeId) ?? null;
  },

  hasUnsaved: () => get().documents.some((d) => d.dirty),
}));
