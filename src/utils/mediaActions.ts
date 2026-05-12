// メディア (画像 / 音声 / 動画) の挿入
//
// 方式: ドキュメントと同じフォルダの assets/ にファイルをコピーし、
//       相対パス (assets/xxx.ext) で参照する。Obsidian / Typora と同じ流儀。
//   - 画像: ![alt](assets/foo.png)
//   - 音声: <audio controls src="assets/foo.mp3"></audio>
//   - 動画: <video controls src="assets/foo.mp4"></video>
//
// ドキュメントが未保存 (path === null) のときは挿入できない (assets/ の置き場所が無いため)。
// プレビュー側 (Preview.tsx) で assets/... の相対パスを convertFileSrc で asset:// に変換する。

import type { EditorView } from "@codemirror/view";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { copyFile, mkdir, exists, writeFile } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/useAppStore";
import { pathSeparator } from "./fs";
import { t } from "../i18n";

const ASSETS_DIR = "assets";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "flac", "aac", "opus"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "mkv", "m4v", "avi"];

type MediaKind = "image" | "audio" | "video";

function kindForExt(ext: string): MediaKind | null {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.includes(e)) return "image";
  if (AUDIO_EXTS.includes(e)) return "audio";
  if (VIDEO_EXTS.includes(e)) return "video";
  return null;
}

function extOf(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1] : "";
}

/** ファイル名からメディア種別 (画像 / 音声 / 動画) を判定。非メディアは null。 */
export function mediaKindOf(name: string): MediaKind | null {
  return kindForExt(extOf(name));
}

function stripExt(name: string): string {
  return name.replace(/\.[a-zA-Z0-9]+$/, "");
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.substring(0, idx) : "";
}

/** 現在アクティブなドキュメントが保存済みならそのディレクトリを返す。未保存なら null。 */
function currentNoteDir(): string | null {
  const doc = useAppStore.getState().getActive();
  if (!doc || !doc.path) return null;
  return dirname(doc.path);
}

/** ファイル名を安全化 (パス区切り・Windows 禁止文字を _ に、空白を - に、拡張子は小文字) */
function sanitizeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const stemRaw = dot > 0 ? name.substring(0, dot) : name;
  const ext = dot > 0 ? name.substring(dot).toLowerCase() : "";
  const stem = stemRaw
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .trim();
  return (stem || "media") + ext;
}

/** assets/ 内で衝突しないファイル名を決める (foo.png → foo-1.png → ...) */
async function uniqueAssetName(assetsDir: string, name: string): Promise<string> {
  const sep = pathSeparator();
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.substring(0, dot) : name;
  const ext = dot > 0 ? name.substring(dot) : "";
  let candidate = name;
  let i = 0;
  while (await exists(`${assetsDir}${sep}${candidate}`)) {
    i += 1;
    candidate = `${stem}-${i}${ext}`;
  }
  return candidate;
}

/** child が dir の配下にあるなら、dir からの相対パス (POSIX 区切り) を返す。
 *  配下でなければ null。Windows を考慮し比較は大文字小文字を無視する。 */
function relativeUnderDir(dir: string, child: string): string | null {
  const norm = (p: string) => p.replace(/[\\/]+/g, "/").replace(/\/+$/, "");
  const d = norm(dir);
  const c = norm(child);
  if (c.toLowerCase() === d.toLowerCase()) return null; // 同一 (ファイルではない)
  if (!c.toLowerCase().startsWith(d.toLowerCase() + "/")) return null;
  return c.substring(d.length + 1); // 元の大文字小文字を保った相対パス
}

/** assets/ ディレクトリを (無ければ) 作成してパスを返す */
async function ensureAssetsDir(noteDir: string): Promise<string> {
  const sep = pathSeparator();
  const assetsDir = `${noteDir}${sep}${ASSETS_DIR}`;
  if (!(await exists(assetsDir))) {
    await mkdir(assetsDir, { recursive: true });
  }
  return assetsDir;
}

/** HTML 属性値のエスケープ */
function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** markdown に挿入する参照テキストを生成。
 *  ref はローカル相対パス (assets/foo.ext, POSIX 区切り) または http(s) URL。
 *  画像・動画は HTML タグで出力し、width="auto" を最初から置いておく
 *  (ユーザーがエディタ上で "auto" を数値や % に書き換えてサイズ調整できるように)。 */
function refSyntax(kind: MediaKind, ref: string, alt: string): string {
  if (kind === "image") {
    return `<img src="${escAttr(ref)}" alt="${escAttr(alt)}" width="auto">`;
  }
  if (kind === "video") {
    return `<video controls width="auto" src="${escAttr(ref)}"></video>`;
  }
  return `<audio controls src="${escAttr(ref)}"></audio>`;
}

/** view にテキストを挿入 (選択範囲を置換、なければカーソル位置に) */
function insertText(view: EditorView, text: string): void {
  const range = view.state.selection.main;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: { anchor: range.from + text.length },
  });
  view.focus();
}

/** ローカルのメディアファイルを assets/ にコピーする。
 *  戻り値の relPath は markdown に書く相対パス (assets/foo.ext)。 */
async function copyIntoAssets(
  srcPath: string,
): Promise<{ kind: MediaKind; relPath: string; name: string } | null> {
  const noteDir = currentNoteDir();
  if (!noteDir) {
    window.alert(t("media.saveFirst"));
    return null;
  }
  const kind = kindForExt(extOf(srcPath));
  if (!kind) {
    window.alert(t("media.unsupported"));
    return null;
  }
  // 既にドキュメントのフォルダ配下にあるファイル (例: assets/ の中) は
  // コピーせず、そのまま相対パスで参照する。
  const already = relativeUnderDir(noteDir, srcPath);
  if (already) {
    return { kind, relPath: already, name: basename(srcPath) };
  }
  const sep = pathSeparator();
  const assetsDir = await ensureAssetsDir(noteDir);
  const wanted = sanitizeName(basename(srcPath));
  const finalName = await uniqueAssetName(assetsDir, wanted);
  await copyFile(srcPath, `${assetsDir}${sep}${finalName}`);
  return { kind, relPath: `${ASSETS_DIR}/${finalName}`, name: finalName };
}

/** ローカルファイルを選んで assets/ にコピー & 挿入 */
export async function insertMediaFromDialog(view: EditorView): Promise<void> {
  if (!currentNoteDir()) {
    window.alert(t("media.saveFirst"));
    return;
  }
  const selected = await openDialog({
    multiple: false,
    directory: false,
    filters: [
      {
        name: t("media.filterMedia"),
        extensions: [...IMAGE_EXTS, ...AUDIO_EXTS, ...VIDEO_EXTS],
      },
      { name: t("media.filterImage"), extensions: IMAGE_EXTS },
      { name: t("media.filterAudio"), extensions: AUDIO_EXTS },
      { name: t("media.filterVideo"), extensions: VIDEO_EXTS },
    ],
  });
  const path = typeof selected === "string" ? selected : null;
  if (!path) return;
  const res = await copyIntoAssets(path);
  if (!res) return;
  insertText(view, refSyntax(res.kind, res.relPath, stripExt(res.name)));
}

/** ネットワーク上のメディア (http(s) URL) を参照として挿入する。ファイルはコピーしない。
 *  拡張子から画像 / 音声 / 動画を推測し、不明なら画像扱い。 */
export function insertMediaUrl(view: EditorView, url: string): void {
  const trimmed = url.trim();
  if (!trimmed) return;
  const clean = trimmed.split(/[?#]/)[0];
  const kind = kindForExt(extOf(clean)) ?? "image";
  const alt = stripExt(basename(clean)) || "media";
  insertText(view, refSyntax(kind, trimmed, alt));
}

/** ドラッグ&ドロップ: ファイルパスの配列を順にコピー & 挿入 */
export async function insertDroppedFiles(
  view: EditorView,
  paths: string[],
): Promise<void> {
  if (!currentNoteDir()) {
    window.alert(t("media.saveFirst"));
    return;
  }
  const pieces: string[] = [];
  for (const p of paths) {
    if (!kindForExt(extOf(p))) continue; // 対応外はスキップ
    const res = await copyIntoAssets(p);
    if (res) pieces.push(refSyntax(res.kind, res.relPath, stripExt(res.name)));
  }
  if (pieces.length === 0) return;
  insertText(view, pieces.join("\n"));
}

/** クリップボードの画像を貼り付け: Blob を assets/ に書き出して挿入。
 *  処理できたら true (= 既定の貼り付けを抑止するため) */
export async function insertPastedImage(
  view: EditorView,
  blob: Blob,
): Promise<boolean> {
  const noteDir = currentNoteDir();
  if (!noteDir) {
    window.alert(t("media.saveFirst"));
    return false;
  }
  const ext = (blob.type.split("/")[1] ?? "png").toLowerCase();
  const sep = pathSeparator();
  const assetsDir = await ensureAssetsDir(noteDir);
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = `pasted-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(
    ts.getDate(),
  )}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.${ext}`;
  const finalName = await uniqueAssetName(assetsDir, base);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(`${assetsDir}${sep}${finalName}`, bytes);
  insertText(view, refSyntax("image", `${ASSETS_DIR}/${finalName}`, stripExt(finalName)));
  return true;
}
