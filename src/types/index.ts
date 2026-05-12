// YomiNote 全体で利用する共通型定義

import type { Language } from "../i18n/translations";

/** 表示モード: 編集のみ / プレビューのみ / 並列 */
export type ViewMode = "edit" | "preview" | "split";

/** カラーテーマ: light / dark / system */
export type ThemeMode = "light" | "dark" | "system";

export type { Language };

/** 開いているドキュメント (タブ) を表す */
export interface OpenDocument {
  /** UUID。タブ識別用 */
  id: string;
  /** ローカルパス。null なら未保存の新規ファイル */
  path: string | null;
  /** ファイル名 (ベース名)。新規時は "Untitled-N" */
  name: string;
  /** エディタ上の現在のテキスト */
  content: string;
  /** ディスクと比較して変更があるか */
  dirty: boolean;
  /** 最後に保存した時刻 (Unix ms) */
  savedAt?: number;
}

/** 最近開いたファイルのエントリ */
export interface RecentFile {
  path: string;
  name: string;
  /** 最終アクセス時刻 (Unix ms) */
  openedAt: number;
}

/** 左サイドバーで表示するファイルツリーノード */
export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  /** ディレクトリの場合のみ、子ノードを含む */
  children?: FileTreeNode[];
}

/** ユーザー設定 */
export interface AppSettings {
  /** UI 言語 */
  language: Language;
  /** カラーテーマ */
  theme: ThemeMode;
  /** エディタのフォントサイズ (px) */
  fontSize: number;
  /** エディタフォント名 */
  fontFamily: string;
  /** 自動保存を有効にするか */
  autoSave: boolean;
  /** 自動保存までの待機時間 (ms) */
  autoSaveDelay: number;
  /** 起動時のデフォルト表示モード */
  defaultViewMode: ViewMode;
  /** プレビューに本文 Serif フォントを使うか */
  previewSerif: boolean;
  /** ドラフト保存先ディレクトリ (空なら APPDATA 配下) */
  draftDir: string;
  /** 分割表示時のエディタ幅の割合 (0..1)。残りはプレビュー */
  splitRatio: number;
  /** 左サイドバー (ファイルツリー) の幅 (px) */
  sidebarWidth: number;
  /** ツールバー (書式 + 表示モード行) の上にタブストリップを置くか。
   *  false = タブが上 / ツールバーが下 (旧レイアウト)
   *  true  = ツールバーが上 / タブが下 (一般的なレイアウト、既定) */
  toolbarAboveTabs: boolean;
  /** アクションツールバーを浮動 (ドックから外して任意位置に配置) するか */
  toolbarFloating: boolean;
  /** ドック状態でのアクションツールバーの X オフセット (px)。0 = 既定の左詰め位置 */
  toolbarOffsetX: number;
  /** 浮動状態の X 座標 (px、エディタ領域の左上が原点) */
  toolbarFloatX: number;
  /** 浮動状態の Y 座標 (px、エディタ領域の左上が原点) */
  toolbarFloatY: number;
}

/** 設定のデフォルト値 */
export const DEFAULT_SETTINGS: AppSettings = {
  language: "system",
  theme: "system",
  fontSize: 15,
  fontFamily: "JetBrains Mono",
  autoSave: true,
  autoSaveDelay: 1500,
  defaultViewMode: "split",
  previewSerif: false,
  draftDir: "",
  splitRatio: 0.5,
  sidebarWidth: 256,
  toolbarAboveTabs: true,
  toolbarFloating: false,
  toolbarOffsetX: 0,
  toolbarFloatX: 24,
  toolbarFloatY: 24,
};

/** splitRatio の許容範囲。極端な値で片側が消えるのを防ぐ */
export const SPLIT_RATIO_MIN = 0.15;
export const SPLIT_RATIO_MAX = 0.85;

/** サイドバー幅 (px) の許容範囲 */
export const SIDEBAR_WIDTH_MIN = 160;
export const SIDEBAR_WIDTH_MAX = 600;
