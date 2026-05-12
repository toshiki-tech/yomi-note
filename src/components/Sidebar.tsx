// 左サイドバー
// ワークスペースのファイルツリー、最近開いたファイル、検索を表示する。
// ツリー上で新規作成 / 名前変更 / 削除をホバーボタンと右クリックメニューから操作する。

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  buildFileTree,
  readFile,
  showOpenFolderDialog,
  createFile,
  createFolder,
  renamePath,
  removePath,
  validateEntryName,
  confirmDiscard,
  isMarkdownPath,
} from "../utils/fs";
import { useT, t as tNow } from "../i18n";
import { mediaKindOf } from "../utils/mediaActions";
import type { FileTreeNode } from "../types";

/** 右クリックメニューの状態 */
interface CtxMenu {
  x: number;
  y: number;
  /** node が null のときは「ワークスペースルート」を意味する */
  node: FileTreeNode | null;
}

interface SidebarProps {
  /** ファイルツリー上のメディアファイルをクリックしたとき、エディタへ参照を挿入する */
  onInsertMedia: (path: string) => void;
  /** サイドバーの幅 (px)。可変ハンドルで変更される */
  width: number;
}

export function Sidebar({ onInsertMedia, width }: SidebarProps) {
  const {
    fileTree,
    workspaceRoot,
    setWorkspace,
    refreshWorkspace,
    openDocument,
    pushRecentFile,
    recentFiles,
    closeDocumentsUnderPath,
    remapDocumentPath,
    selectedFolderPath,
    setSelectedFolderPath,
  } = useAppStore();
  const { saveRecentFiles } = useSettingsStore();
  const [query, setQuery] = useState("");
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const t = useT();
  // 新規作成時の既定親ディレクトリ: ツリーで選択中のフォルダ > workspaceRoot
  const defaultParentDir = selectedFolderPath ?? workspaceRoot ?? "";

  // フォルダを開く -> ツリー構築
  async function handleOpenFolder() {
    const root = await showOpenFolderDialog();
    if (!root) return;
    const tree = await buildFileTree(root);
    setWorkspace(root, tree);
  }

  // ファイルを開く -> エディタへ反映 + 最近のファイルへ追加
  async function handleOpenFile(path: string, name: string) {
    try {
      const content = await readFile(path);
      openDocument(path, content);
      pushRecentFile({ path, name, openedAt: Date.now() });
      const list = useAppStore.getState().recentFiles;
      await saveRecentFiles(list);
    } catch (err) {
      console.warn("ファイルが開けません", path, err);
    }
  }

  // ツリー検索: クエリで部分一致するパスのみフィルタ
  const filteredTree = useMemo(() => {
    if (!fileTree || !query.trim()) return fileTree;
    return filterTree(fileTree, query.toLowerCase());
  }, [fileTree, query]);

  // ESC キーまたはどこかをクリックしたらコンテキストメニューを閉じる
  useEffect(() => {
    if (!ctxMenu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCtxMenu(null);
    }
    function onClick() {
      setCtxMenu(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [ctxMenu]);

  // 右クリックハンドラ: グローバルの contextmenu に伝播させない
  function openContextMenu(e: React.MouseEvent, node: FileTreeNode | null) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, node });
  }

  // === 操作: 新規作成 ===
  async function handleCreate(parentDir: string, kind: "file" | "folder") {
    setCtxMenu(null);
    const promptKey =
      kind === "file" ? "sidebar.promptNewFileName" : "sidebar.promptNewFolderName";
    const raw = window.prompt(t(promptKey), "");
    if (raw === null) return;
    let name = raw.trim();
    if (!name) {
      window.alert(t("sidebar.errorEmptyName"));
      return;
    }
    // ファイル作成時に拡張子が無ければ .md を自動付加
    if (kind === "file" && !/\.[a-zA-Z0-9]+$/.test(name)) name += ".md";
    const err = validateEntryName(name);
    if (err) {
      window.alert(t("sidebar.errorInvalidName"));
      return;
    }
    try {
      if (kind === "file") await createFile(parentDir, name);
      else await createFolder(parentDir, name);
      await refreshWorkspace();
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === "EXISTS") {
        window.alert(t("sidebar.errorExists", { name }));
      } else {
        window.alert(t("sidebar.errorOperationFailed", { error: String(e) }));
      }
    }
  }

  // === 操作: 名前変更 ===
  async function handleRename(node: FileTreeNode) {
    setCtxMenu(null);
    const key = node.isDirectory ? "sidebar.promptRenameFolder" : "sidebar.promptRenameFile";
    const raw = window.prompt(t(key), node.name);
    if (raw === null) return;
    const next = raw.trim();
    if (!next || next === node.name) return;
    const err = validateEntryName(next);
    if (err) {
      window.alert(t("sidebar.errorInvalidName"));
      return;
    }
    try {
      const newPath = await renamePath(node.path, next);
      // 開いているタブのパスを追従
      remapDocumentPath(node.path, newPath);
      await refreshWorkspace();
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === "EXISTS") {
        window.alert(t("sidebar.errorExists", { name: next }));
      } else {
        window.alert(t("sidebar.errorOperationFailed", { error: String(e) }));
      }
    }
  }

  // === 操作: 削除 ===
  async function handleDelete(node: FileTreeNode) {
    setCtxMenu(null);
    const msgKey = node.isDirectory
      ? "sidebar.confirmDeleteFolder"
      : "sidebar.confirmDeleteFile";
    const ok = await confirmDiscard(t(msgKey, { name: node.name }), t("sidebar.delete"));
    if (!ok) return;
    try {
      await removePath(node.path, node.isDirectory);
      // 削除されたファイル/配下のファイルがタブで開いていれば閉じる
      closeDocumentsUnderPath(node.path);
      await refreshWorkspace();
    } catch (e: unknown) {
      window.alert(t("sidebar.errorOperationFailed", { error: String(e) }));
    }
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-zen-border bg-zen-surface text-sm dark:border-zen-dark-border dark:bg-zen-dark-surface"
      style={{ width }}
      // サイドバー余白の右クリックでもワークスペース対象のメニューが開くように
      onContextMenu={(e) => {
        if (!workspaceRoot) return;
        openContextMenu(e, null);
      }}
    >
      {/* ヘッダ: ワークスペース選択 */}
      <div className="flex items-center justify-between gap-1 border-b border-zen-border px-3 py-2 dark:border-zen-dark-border">
        <button
          onClick={() => setSelectedFolderPath(null)}
          className="truncate text-left text-xs font-semibold uppercase tracking-wider text-zen-subtle hover:text-zen-text dark:text-zen-dark-subtle dark:hover:text-zen-dark-text"
          title={
            selectedFolderPath
              ? selectedFolderPath
              : workspaceRoot ?? "YomiNote"
          }
        >
          {workspaceRoot ? workspaceRoot.split(/[\\/]/).pop() : "YomiNote"}
        </button>
        <div className="flex items-center gap-0.5">
          {workspaceRoot && (
            <>
              {/* ヘッダ行のボタンは「ワークスペース名の隣」という視覚的対応から、
                  常にワークスペース直下に作成する。ツリーの選択状態は無視。 */}
              <HeaderIconBtn
                onClick={() => handleCreate(workspaceRoot, "file")}
                title={t("sidebar.newFile")}
              >
                <NewFileIcon />
              </HeaderIconBtn>
              <HeaderIconBtn
                onClick={() => handleCreate(workspaceRoot, "folder")}
                title={t("sidebar.newFolder")}
              >
                <NewFolderIcon />
              </HeaderIconBtn>
            </>
          )}
          <button
            onClick={handleOpenFolder}
            className="rounded px-2 py-0.5 text-xs hover:bg-black/5 dark:hover:bg-white/10"
            title={t("common.open")}
          >
            {t("common.open")}
          </button>
        </div>
      </div>

      {/* 検索ボックス */}
      <div className="border-b border-zen-border px-3 py-2 dark:border-zen-dark-border">
        <input
          type="text"
          placeholder={t("sidebar.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded border border-zen-border bg-zen-bg px-2 py-1 text-xs outline-none focus:border-zen-accent dark:border-zen-dark-border dark:bg-zen-dark-bg dark:focus:border-zen-dark-accent"
        />
      </div>

      {/* スクロール領域 */}
      <div className="flex-1 overflow-y-auto">
        {/* ファイルツリー */}
        {filteredTree && filteredTree.length > 0 ? (
          <div className="py-2">
            <SectionLabel>{t("sidebar.files")}</SectionLabel>
            {filteredTree.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedFolderPath={selectedFolderPath}
                onOpen={handleOpenFile}
                onSelectFolder={setSelectedFolderPath}
                onCreate={handleCreate}
                onRename={handleRename}
                onDelete={handleDelete}
                onContextMenu={openContextMenu}
                onInsertMedia={onInsertMedia}
              />
            ))}
          </div>
        ) : (
          !workspaceRoot && (
            <div className="px-4 py-6 text-xs text-zen-subtle dark:text-zen-dark-subtle">
              {t("sidebar.empty")}
            </div>
          )
        )}

        {/* 最近のファイル */}
        {recentFiles.length > 0 && (
          <div className="mt-2 pb-4">
            <SectionLabel>{t("sidebar.recentFiles")}</SectionLabel>
            <ul>
              {recentFiles.slice(0, 10).map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => handleOpenFile(f.path, f.name)}
                    className="block w-full truncate px-4 py-1 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"
                    title={f.path}
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* コンテキストメニュー */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxMenu.node}
          fallbackParentDir={defaultParentDir}
          onCreate={handleCreate}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zen-subtle dark:text-zen-dark-subtle">
      {children}
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  selectedFolderPath: string | null;
  onOpen: (path: string, name: string) => void;
  onSelectFolder: (path: string | null) => void;
  onCreate: (parentDir: string, kind: "file" | "folder") => void;
  onRename: (node: FileTreeNode) => void;
  onDelete: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  onInsertMedia: (path: string) => void;
}

/** 折りたたみ可能なツリーノード */
function TreeNode({
  node,
  depth,
  selectedFolderPath,
  onOpen,
  onSelectFolder,
  onCreate,
  onRename,
  onDelete,
  onContextMenu,
  onInsertMedia,
}: TreeNodeProps) {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = node.isDirectory && node.path === selectedFolderPath;

  if (node.isDirectory) {
    return (
      <div>
        <div
          className={`group flex w-full items-center pr-1 ${
            isSelected
              ? "bg-zen-accent/15 dark:bg-zen-dark-accent/25"
              : "hover:bg-black/5 dark:hover:bg-white/10"
          }`}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          <button
            onClick={() => {
              setOpen((v) => !v);
              onSelectFolder(node.path);
            }}
            className="flex flex-1 items-center px-3 py-1 text-left text-xs"
            style={{ paddingLeft: 12 + depth * 12 }}
          >
            <span className="mr-1 text-zen-subtle dark:text-zen-dark-subtle">
              {open ? "▾" : "▸"}
            </span>
            <span className="truncate font-medium">{node.name}</span>
          </button>
          {/* 折り畳んだ状態でも子要素を作れるよう、開閉に依らずホバーで表示 */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <NodeIconBtn
              onClick={(e) => {
                e.stopPropagation();
                if (!open) setOpen(true);
                onCreate(node.path, "file");
              }}
              title={tNow("sidebar.newFile")}
            >
              <NewFileIcon />
            </NodeIconBtn>
            <NodeIconBtn
              onClick={(e) => {
                e.stopPropagation();
                if (!open) setOpen(true);
                onCreate(node.path, "folder");
              }}
              title={tNow("sidebar.newFolder")}
            >
              <NewFolderIcon />
            </NodeIconBtn>
            <NodeIconBtn
              onClick={(e) => {
                e.stopPropagation();
                onRename(node);
              }}
              title={tNow("sidebar.rename")}
            >
              <RenameIcon />
            </NodeIconBtn>
            <NodeIconBtn
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node);
              }}
              title={tNow("sidebar.delete")}
              danger
            >
              <DeleteIcon />
            </NodeIconBtn>
          </div>
        </div>
        {open && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFolderPath={selectedFolderPath}
                onOpen={onOpen}
                onSelectFolder={onSelectFolder}
                onCreate={onCreate}
                onRename={onRename}
                onDelete={onDelete}
                onContextMenu={onContextMenu}
                onInsertMedia={onInsertMedia}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const mediaKind = mediaKindOf(node.name);
  const isMedia = !isMarkdownPath(node.name);
  return (
    <div
      className="group flex w-full items-center pr-1 hover:bg-black/5 dark:hover:bg-white/10"
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <button
        onClick={() => {
          if (isMedia) {
            onInsertMedia(node.path); // メディアファイル: クリックでエディタに挿入
            return;
          }
          onOpen(node.path, node.name);
        }}
        className="flex flex-1 items-center px-3 py-1 text-left text-xs"
        style={{ paddingLeft: 12 + depth * 12 }}
        title={isMedia ? `${node.path}\n${tNow("sidebar.clickToInsert")}` : node.path}
      >
        <span className="mr-1 inline-flex items-center text-zen-subtle dark:text-zen-dark-subtle">
          {mediaKind === "image" ? (
            <ImageFileIcon />
          ) : mediaKind === "audio" ? (
            <AudioFileIcon />
          ) : mediaKind === "video" ? (
            <VideoFileIcon />
          ) : isMedia ? (
            <MediaFileIcon />
          ) : (
            <span>◦</span>
          )}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        <NodeIconBtn
          onClick={(e) => {
            e.stopPropagation();
            onRename(node);
          }}
          title={tNow("sidebar.rename")}
        >
          <RenameIcon />
        </NodeIconBtn>
        <NodeIconBtn
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node);
          }}
          title={tNow("sidebar.delete")}
          danger
        >
          <DeleteIcon />
        </NodeIconBtn>
      </div>
    </div>
  );
}

/** クエリに一致しないノードをツリーから除外 */
function filterTree(nodes: FileTreeNode[], q: string): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      const children = filterTree(node.children ?? [], q);
      if (children.length > 0 || node.name.toLowerCase().includes(q)) {
        result.push({ ...node, children });
      }
    } else if (node.name.toLowerCase().includes(q)) {
      result.push(node);
    }
  }
  return result;
}

// === コンテキストメニュー ===

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileTreeNode | null;
  /** node が null のとき (空白領域での右クリック) に使う親ディレクトリ。
   *  選択中フォルダがあればそれ、無ければ workspaceRoot が呼び出し側で渡される。 */
  fallbackParentDir: string;
  onCreate: (parentDir: string, kind: "file" | "folder") => void;
  onRename: (node: FileTreeNode) => void;
  onDelete: (node: FileTreeNode) => void;
}

function ContextMenu({
  x,
  y,
  node,
  fallbackParentDir,
  onCreate,
  onRename,
  onDelete,
}: ContextMenuProps) {
  const t = useT();

  // 親ディレクトリ: ファイルなら所属ディレクトリ、フォルダならそのパス、null なら fallback
  const parentDir = node
    ? node.isDirectory
      ? node.path
      : node.path.replace(/[\\/][^\\/]*$/, "") || fallbackParentDir
    : fallbackParentDir;

  return (
    <div
      // 子ボタンの click でメニューが閉じないように、capture を使うために stopPropagation
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ left: x, top: y }}
      className="fixed z-50 min-w-[160px] rounded border border-zen-border bg-zen-surface py-1 text-xs shadow-lg dark:border-zen-dark-border dark:bg-zen-dark-surface"
    >
      {(node === null || node.isDirectory) && parentDir && (
        <>
          <MenuItem onClick={() => onCreate(parentDir, "file")}>
            {t("sidebar.newFile")}
          </MenuItem>
          <MenuItem onClick={() => onCreate(parentDir, "folder")}>
            {t("sidebar.newFolder")}
          </MenuItem>
        </>
      )}
      {node && (
        <>
          {(node.isDirectory) && <MenuSeparator />}
          <MenuItem onClick={() => onRename(node)}>{t("sidebar.rename")}</MenuItem>
          <MenuItem onClick={() => onDelete(node)} danger>
            {t("sidebar.delete")}
          </MenuItem>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10 ${
        danger ? "text-red-500" : ""
      }`}
    >
      {children}
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-1 h-px bg-zen-border dark:bg-zen-dark-border" />;
}

// === 共通ボタン / アイコン ===

function HeaderIconBtn({
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
      className="rounded p-1 text-zen-subtle hover:bg-black/5 hover:text-zen-text dark:text-zen-dark-subtle dark:hover:bg-white/10 dark:hover:text-zen-dark-text"
    >
      {children}
    </button>
  );
}

function NodeIconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded p-0.5 text-zen-subtle hover:bg-black/10 dark:text-zen-dark-subtle dark:hover:bg-white/15 ${
        danger ? "hover:text-red-500" : "hover:text-zen-text dark:hover:text-zen-dark-text"
      }`}
    >
      {children}
    </button>
  );
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function NewFileIcon() {
  return (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="13" x2="12" y2="19" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </Svg>
  );
}

function MediaFileIcon() {
  // 画像 / 音声 / 動画のいずれにも当てはまらない非 Markdown ファイル用の汎用アイコン
  return (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </Svg>
  );
}

function ImageFileIcon() {
  return (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </Svg>
  );
}

function AudioFileIcon() {
  return (
    <Svg>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </Svg>
  );
}

function VideoFileIcon() {
  return (
    <Svg>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </Svg>
  );
}

function NewFolderIcon() {
  return (
    <Svg>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </Svg>
  );
}

function RenameIcon() {
  return (
    <Svg>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  );
}

function DeleteIcon() {
  return (
    <Svg>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}
