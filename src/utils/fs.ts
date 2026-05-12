// ファイルシステム操作のラッパ
// Tauri の plugin-fs / plugin-dialog / plugin-os をフロントエンドに公開する

import {
  readTextFile,
  writeTextFile,
  readDir,
  exists,
  mkdir,
  remove,
  rename as fsRename,
  type DirEntry,
} from "@tauri-apps/plugin-fs";
import { open as openDialog, save as saveDialog, ask } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";
import { documentDir, join } from "@tauri-apps/api/path";
import { t } from "../i18n";
import type { FileTreeNode } from "../types";

/** 直近の保存ディレクトリ。一度ユーザーが選んだ場所を覚えておく */
let lastSaveDir: string | null = null;

/** Markdown 拡張子の判定 */
export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown|mdx|mkd)$/i.test(path);
}

/** 画像 / 音声 / 動画ファイルの判定 (ファイルツリーに表示し、エディタへドラッグ挿入できるようにする) */
export function isMediaPath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|mp3|wav|ogg|m4a|flac|aac|opus|mp4|webm|mov|mkv|m4v|avi)$/i.test(
    path,
  );
}

/** ファイルを開くダイアログ -> パスを返す */
export async function showOpenFileDialog(): Promise<string | null> {
  const result = await openDialog({
    multiple: false,
    directory: false,
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdx", "mkd"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (typeof result === "string") return result;
  return null;
}

/** フォルダを開くダイアログ -> パスを返す */
export async function showOpenFolderDialog(): Promise<string | null> {
  const result = await openDialog({
    multiple: false,
    directory: true,
  });
  if (typeof result === "string") return result;
  return null;
}

/** 名前を付けて保存ダイアログ -> パスを返す
 *  既存ファイルを編集中ならそのディレクトリ + 既存名を初期値とし、
 *  新規ファイルの場合は (preferDir || 前回保存ディレクトリ || ドキュメント) + ファイル名を初期値とする。
 *  preferDir はサイドバーで選択中のフォルダを優先したいケースで指定する。
 */
export async function showSaveFileDialog(
  defaultName = "untitled.md",
  currentPath: string | null = null,
  preferDir: string | null = null,
): Promise<string | null> {
  let defaultPath = defaultName;
  try {
    if (currentPath) {
      // 既存ファイルがある場合はそのフルパスを初期値に
      defaultPath = currentPath;
    } else {
      const baseDir = preferDir ?? lastSaveDir ?? (await documentDir());
      defaultPath = await join(baseDir, defaultName);
    }
  } catch {
    // 失敗したら素のファイル名のままでフォールバック
  }
  const result = await saveDialog({
    defaultPath,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (result) {
    // 次回のためにディレクトリを記憶
    const sep = pathSeparator();
    const idx = result.lastIndexOf(sep);
    if (idx > 0) lastSaveDir = result.substring(0, idx);
  }
  return result ?? null;
}

/** 確認ダイアログ (はい / いいえ)。
 *  ボタン文言は OS ロケールではなくアプリの言語設定に追従させる。
 *  okLabel を渡すと「はい」側のラベルを差し替えられる (削除確認なら "削除" など)。 */
export async function confirmDiscard(
  message: string,
  okLabel?: string,
): Promise<boolean> {
  return await ask(message, {
    title: "YomiNote",
    kind: "warning",
    okLabel: okLabel ?? t("common.confirmOk"),
    cancelLabel: t("common.cancel"),
  });
}

/** ファイルからテキストを読み込む */
export async function readFile(path: string): Promise<string> {
  return await readTextFile(path);
}

/** ファイルにテキストを書き込む。親ディレクトリが無ければ作成する */
export async function writeFile(path: string, contents: string): Promise<void> {
  const parent = path.replace(/[\\/][^\\/]*$/, "");
  if (parent && parent !== path) {
    const parentExists = await exists(parent);
    if (!parentExists) {
      await mkdir(parent, { recursive: true });
    }
  }
  await writeTextFile(path, contents);
}

/** ディレクトリを再帰的に走査してファイルツリーを構築する */
export async function buildFileTree(
  root: string,
  depth = 0,
  maxDepth = 4,
): Promise<FileTreeNode[]> {
  if (depth > maxDepth) return [];
  let entries: DirEntry[] = [];
  try {
    entries = await readDir(root);
  } catch {
    return [];
  }
  // ディレクトリ -> ファイル の順にソート
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const sep = pathSeparator();
  const nodes: FileTreeNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // 隠しファイルは除外
    const childPath = `${root}${sep}${entry.name}`;
    if (entry.isDirectory) {
      const children = await buildFileTree(childPath, depth + 1, maxDepth);
      nodes.push({
        name: entry.name,
        path: childPath,
        isDirectory: true,
        children,
      });
    } else if (isMarkdownPath(entry.name) || isMediaPath(entry.name)) {
      nodes.push({
        name: entry.name,
        path: childPath,
        isDirectory: false,
      });
    }
  }
  return nodes;
}

/** OS パス区切り文字 */
export function pathSeparator(): string {
  // ブラウザコンテキストでも安全に動くよう、同期的に判定
  if (typeof navigator !== "undefined" && /win/i.test(navigator.platform)) {
    return "\\";
  }
  return "/";
}

/** プラットフォーム判定 */
export async function isWindows(): Promise<boolean> {
  try {
    return (await platform()) === "windows";
  } catch {
    return false;
  }
}

/** ファイル/ディレクトリ名のバリデーション。
 *  許可: 任意の Unicode 文字。禁止: 空文字 / "." ".." / パス区切り / Windows 予約文字。 */
export function validateEntryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "EMPTY";
  if (trimmed === "." || trimmed === "..") return "RESERVED";
  if (/[\\/]/.test(trimmed)) return "SLASH";
  // Windows: : * ? " < > | は使えない
  if (/[<>:"|?*]/.test(trimmed)) return "INVALID_CHAR";
  return null;
}

/** 親ディレクトリ + 子名でフルパスを組み立てる */
export function joinPath(parent: string, name: string): string {
  const sep = pathSeparator();
  if (!parent) return name;
  return parent.endsWith(sep) ? `${parent}${name}` : `${parent}${sep}${name}`;
}

/** 空ファイルを作成。既存なら何もせず false を返す */
export async function createFile(parent: string, name: string): Promise<string> {
  const target = joinPath(parent, name);
  if (await exists(target)) throw new Error("EXISTS");
  await writeTextFile(target, "");
  return target;
}

/** ディレクトリを作成。既存なら EXISTS をスロー */
export async function createFolder(parent: string, name: string): Promise<string> {
  const target = joinPath(parent, name);
  if (await exists(target)) throw new Error("EXISTS");
  await mkdir(target, { recursive: false });
  return target;
}

/** リネーム。新パスが既存なら EXISTS をスロー */
export async function renamePath(oldPath: string, newName: string): Promise<string> {
  const sep = pathSeparator();
  const idx = oldPath.lastIndexOf(sep);
  const dir = idx > 0 ? oldPath.substring(0, idx) : "";
  const newPath = dir ? `${dir}${sep}${newName}` : newName;
  if (newPath === oldPath) return oldPath;
  if (await exists(newPath)) throw new Error("EXISTS");
  await fsRename(oldPath, newPath);
  return newPath;
}

/** ファイル / ディレクトリを削除。ディレクトリは再帰的に削除する */
export async function removePath(target: string, isDirectory: boolean): Promise<void> {
  await remove(target, isDirectory ? { recursive: true } : undefined);
}
