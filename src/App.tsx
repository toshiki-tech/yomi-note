// YomiNote ルートコンポーネント
// 三カラムレイアウト + ツールバー + ステータスバー + 設定モーダル

import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { Editor } from "./components/Editor";
import { Preview, type PreviewHandle } from "./components/Preview";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { ActionToolbarLeft } from "./components/ActionToolbar";
import { StatusBar } from "./components/StatusBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { AboutDialog } from "./components/AboutDialog";
import { MediaInsertDialog } from "./components/MediaInsertDialog";
import { UserDictPanel } from "./components/UserDictPanel";
import { useAppStore } from "./store/useAppStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useMenuListener } from "./hooks/useMenuListener";
import { useAutoSave } from "./hooks/useAutoSave";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { insertDroppedFiles } from "./utils/mediaActions";
import { readFile } from "./utils/fs";
import { confirmDiscard } from "./utils/fs";
import { getSampleDoc, resolveLanguage, useT, t as tNow } from "./i18n";
import { useUserDictStore, lookupUserDict } from "./store/useUserDictStore";
import { setUserDictLookup } from "./utils/katakanaDict";
import {
  SPLIT_RATIO_MIN,
  SPLIT_RATIO_MAX,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from "./types";

/** OS から渡された絶対パスを開いて最近のファイルにも積む。
 *  メニュー経由の "Open..." と同じ後処理を行う (タブ追加 + recent files 永続化)。 */
async function openFromPath(path: string) {
  try {
    const content = await readFile(path);
    const store = useAppStore.getState();
    store.openDocument(path, content);
    const name = path.split(/[\\/]/).pop() ?? "untitled.md";
    store.pushRecentFile({ path, name, openedAt: Date.now() });
    await useSettingsStore
      .getState()
      .saveRecentFiles(useAppStore.getState().recentFiles);
  } catch (err) {
    console.warn("OS から渡されたファイルが開けません", path, err);
  }
}

export default function App() {
  const viewMode = useAppStore((s) => s.viewMode);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const userDictOpen = useAppStore((s) => s.userDictOpen);
  const docs = useAppStore((s) => s.documents);
  const activeId = useAppStore((s) => s.activeId);
  const newDocument = useAppStore((s) => s.newDocument);
  const setRecentFiles = useAppStore((s) => s.setRecentFiles);
  const openDocument = useAppStore((s) => s.openDocument);
  const setViewMode = useAppStore((s) => s.setViewMode);

  const settings = useSettingsStore((s) => s.settings);
  const loadFromDisk = useSettingsStore((s) => s.loadFromDisk);
  const settingsLoaded = useSettingsStore((s) => s.loaded);

  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const isDark = useDarkMode(settings.theme);

  const activeDoc = docs.find((d) => d.id === activeId) ?? null;

  // ネイティブメニュー (Rust 側) のイベントを監視
  useMenuListener(editorView);
  // 自動保存
  useAutoSave();

  // 言語設定が変わるたびにネイティブメニューを再構築
  useEffect(() => {
    const resolved = resolveLanguage(settings.language);
    invoke("set_menu_language", { lang: resolved }).catch((err) => {
      console.warn("メニュー言語の更新に失敗", err);
    });
  }, [settings.language]);

  // テーマ設定をネイティブのウィンドウテーマ (タイトルバー / メニューバー) に伝播。
  // null を渡すと OS 設定に追従、"light"/"dark" で上書き。
  useEffect(() => {
    const target =
      settings.theme === "system" ? null : settings.theme;
    getCurrentWindow()
      .setTheme(target)
      .catch((err) => console.warn("setTheme 失敗", err));
  }, [settings.theme]);

  // ファイルをウィンドウにドラッグ&ドロップしたら、対応形式のものを
  // ドキュメント直下の assets/ にコピーしてエディタへ参照を挿入する。
  useEffect(() => {
    if (!editorView) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const paths = event.payload.paths;
        if (!paths || paths.length === 0) return;
        void insertDroppedFiles(editorView, paths);
      })
      .then((un) => {
        if (cancelled) un();
        else unlisten = un;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [editorView]);

  // Ctrl+S / Ctrl+Shift+S は WebView2 のページ保存に横取りされネイティブメニューの
  // アクセラレータが発火しないことがある。フロント側で先に捕捉し、
  // 既存の "menu-action" リスナへイベントを emit して同じ保存処理を流す。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      e.stopPropagation();
      void emit("menu-action", e.shiftKey ? "save_as" : "save");
    }
    // capture フェーズで処理することで CodeMirror / WebView2 より先に取れる
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // 右クリック時に WebView2 の既定メニューを抑制し、Rust 側のローカライズ済み
  // ネイティブコンテキストメニューを表示する
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // リンクや画像の上では既定メニュー (リンク先コピー等) を残す
      if (target?.closest("a") || target?.tagName === "IMG") return;
      e.preventDefault();
      const resolved = resolveLanguage(
        useSettingsStore.getState().settings.language,
      );
      invoke("show_context_menu", { lang: resolved }).catch((err) => {
        console.warn("コンテキストメニュー表示失敗", err);
      });
    }
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // 起動時: 設定の読み込み + 既定モード反映 + ウェルカム文書 + ドラッグ&ドロップ
  useEffect(() => {
    // カタカナ辞書 lookup にユーザー辞書を差し込む
    setUserDictLookup(lookupUserDict);
    // ユーザー辞書をディスクからロード
    void useUserDictStore.getState().load();
    (async () => {
      const recents = await loadFromDisk();
      setRecentFiles(recents);
      // デフォルト表示モード
      const loadedSettings = useSettingsStore.getState().settings;
      setViewMode(loadedSettings.defaultViewMode);
      // Windows のファイル関連付け / CLI 引数で渡されたファイルを開く。
      // ウェルカム文書の生成より先に行うことで、引数経由で開いたファイルだけが表示される。
      try {
        const pending = await invoke<string[]>("consume_pending_open_paths");
        for (const p of pending) {
          await openFromPath(p);
        }
      } catch (err) {
        console.warn("起動引数の取得失敗", err);
      }
      // 初回起動時 (かつ引数で開いたものがない時) はウェルカム文書を言語に合わせて表示
      if (useAppStore.getState().documents.length === 0) {
        const id = newDocument();
        useAppStore.getState().updateContent(id, getSampleDoc(loadedSettings.language));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 起動済みの状態で関連付け経由のダブルクリックがあった場合、Rust 側の
  // single-instance プラグインがここへイベントを飛ばす。
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const handle = await listen<string>("open-file-from-os", async (e) => {
        await openFromPath(e.payload);
      });
      if (cancelled) handle();
      else unlisten = handle;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Tauri ファイルドロップイベント
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const win = getCurrentWindow();
      const handle = await win.onDragDropEvent(async (event) => {
        if (event.payload.type === "drop") {
          for (const path of event.payload.paths) {
            if (/\.(md|markdown|mdx|mkd|txt)$/i.test(path)) {
              try {
                const content = await readFile(path);
                openDocument(path, content);
              } catch (err) {
                console.warn("ドロップしたファイルが読めません", err);
              }
            }
          }
        }
      });
      if (cancelled) handle();
      else unlisten = handle;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [openDocument]);

  // 終了前の未保存確認
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const win = getCurrentWindow();
      const handle = await listen("tauri://close-requested", async () => {
        const hasUnsaved = useAppStore.getState().hasUnsaved();
        if (hasUnsaved) {
          const ok = await confirmDiscard(tNow("app.confirmDiscardAll"));
          if (!ok) return;
        }
        await win.destroy();
      });
      if (cancelled) handle();
      else unlisten = handle;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // === スクロール同期 ===
  const syncSource = useRef<"editor" | "preview" | null>(null);
  const handleEditorScroll = (ratio: number) => {
    if (syncSource.current === "preview") return;
    syncSource.current = "editor";
    previewRef.current?.scrollToRatio(ratio);
    window.setTimeout(() => {
      if (syncSource.current === "editor") syncSource.current = null;
    }, 50);
  };

  if (!settingsLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-zen-bg text-zen-subtle dark:bg-zen-dark-bg dark:text-zen-dark-subtle">
        {tNow("app.loading")}
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen w-screen flex-col overflow-hidden bg-zen-bg text-zen-text antialiased dark:bg-zen-dark-bg dark:text-zen-dark-text ${
        isDark ? "dark" : ""
      }`}
    >
      <Toolbar editorView={editorView} />
      <div className="flex min-w-0 flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            <Sidebar
              width={settings.sidebarWidth}
              onInsertMedia={(path) => {
                if (editorView) void insertDroppedFiles(editorView, [path]);
              }}
            />
            <SidebarDragger />
          </>
        )}
        <main className="flex min-w-0 flex-1 overflow-hidden">
          {/* エディタ */}
          {(viewMode === "edit" || viewMode === "split") && (
            <div
              className={
                viewMode === "split"
                  ? "h-full min-w-0 overflow-hidden"
                  : "h-full w-full min-w-0 overflow-hidden"
              }
              style={
                viewMode === "split"
                  ? { width: `${settings.splitRatio * 100}%` }
                  : undefined
              }
            >
              {activeDoc ? (
                <Editor
                  isDark={isDark}
                  onScroll={handleEditorScroll}
                  onReady={setEditorView}
                />
              ) : (
                <EmptyState />
              )}
            </div>
          )}

          {/* スプリッタ: 分割モード時のみ表示。ドラッグで比率変更、ダブルクリックで 50/50 にリセット */}
          {viewMode === "split" && <SplitDragger />}

          {/* プレビュー */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div
              className={
                viewMode === "split"
                  ? "h-full min-w-0 flex-1 overflow-hidden bg-zen-bg dark:bg-zen-dark-bg"
                  : "h-full w-full min-w-0 overflow-hidden bg-zen-bg dark:bg-zen-dark-bg"
              }
            >
              {activeDoc ? (
                <Preview
                  ref={previewRef}
                  source={activeDoc.content}
                  docPath={activeDoc.path}
                />
              ) : (
                <EmptyState />
              )}
            </div>
          )}
        </main>
      </div>
      <StatusBar />
      <SettingsPanel />
      <AboutDialog />
      <MediaInsertDialog editorView={editorView} />
      {/* 浮動モード時の前半ツールバー (書式 + 注釈 + ハンドル)。
          後半 (モード切替 + 設定) は Toolbar.tsx 内に常に固定で残る。 */}
      {settings.toolbarFloating && (
        <ActionToolbarLeft editorView={editorView} mode="floating" />
      )}
      {userDictOpen && (
        <UserDictPanel
          onClose={() => useAppStore.getState().setUserDictOpen(false)}
        />
      )}
    </div>
  );
}

/** 編集 / プレビュー間の幅可変ハンドル
 *  - ドラッグで splitRatio を更新
 *  - ダブルクリックで 50/50 にリセット
 *  ドラッグ中は WebView 全体に col-resize カーソルを当てる + テキスト選択を抑止 */
function SplitDragger() {
  const t = useT();
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    // mousedown 時の <main> (エディタ + スプリッタ + プレビューを含む) を基準に算出する
    const main = (e.currentTarget as HTMLElement).parentElement;
    if (!main) return;
    const rect = main.getBoundingClientRect();
    // ドラッグ中は全要素に col-resize を強制する (子要素が独自 cursor を
    // 持っているとマウスがその上に来た瞬間 I-beam / pointer に切り替わってしまうため)
    document.body.classList.add("is-col-resizing");
    document.body.style.userSelect = "none";

    let lastRatio = useSettingsStore.getState().settings.splitRatio;
    function onMove(ev: MouseEvent) {
      const x = ev.clientX - rect.left;
      let ratio = x / rect.width;
      if (ratio < SPLIT_RATIO_MIN) ratio = SPLIT_RATIO_MIN;
      if (ratio > SPLIT_RATIO_MAX) ratio = SPLIT_RATIO_MAX;
      lastRatio = ratio;
      // ドラッグ中は in-memory のみ更新 (60Hz の disk 書込みを避ける)
      useSettingsStore.setState((s) => ({
        settings: { ...s.settings, splitRatio: ratio },
      }));
    }
    function onUp() {
      document.body.classList.remove("is-col-resizing");
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // 最終値だけ disk へ persist
      void useSettingsStore.getState().update({ splitRatio: lastRatio });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleDoubleClick = () => {
    void useSettingsStore.getState().update({ splitRatio: 0.5 });
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title={t("toolbar.splitDragger")}
      className="group relative h-full w-1 shrink-0 cursor-col-resize bg-zen-border hover:bg-zen-accent/60 dark:bg-zen-dark-border dark:hover:bg-zen-dark-accent/60"
    >
      {/* ヒットエリアを実際の枠より広く取る (掴みやすさ向上) */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

/** 左サイドバーの幅可変ハンドル
 *  - ドラッグで settings.sidebarWidth を更新
 *  - ダブルクリックで既定幅 (256px) にリセット */
function SidebarDragger() {
  const t = useT();
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    // ドラッグ中は全要素に col-resize を強制する (子要素が独自 cursor を
    // 持っているとマウスがその上に来た瞬間 I-beam / pointer に切り替わってしまうため)
    document.body.classList.add("is-col-resizing");
    document.body.style.userSelect = "none";

    let lastWidth = useSettingsStore.getState().settings.sidebarWidth;
    function onMove(ev: MouseEvent) {
      // サイドバーは画面左端から始まるので、幅 = カーソルの X 座標
      let w = ev.clientX;
      if (w < SIDEBAR_WIDTH_MIN) w = SIDEBAR_WIDTH_MIN;
      if (w > SIDEBAR_WIDTH_MAX) w = SIDEBAR_WIDTH_MAX;
      lastWidth = w;
      // ドラッグ中は in-memory のみ更新 (60Hz の disk 書込みを避ける)
      useSettingsStore.setState((s) => ({
        settings: { ...s.settings, sidebarWidth: w },
      }));
    }
    function onUp() {
      document.body.classList.remove("is-col-resizing");
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      void useSettingsStore.getState().update({ sidebarWidth: lastWidth });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleDoubleClick = () => {
    void useSettingsStore.getState().update({ sidebarWidth: 256 });
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title={t("sidebar.resizeHandle")}
      className="group relative h-full w-1 shrink-0 cursor-col-resize bg-zen-border hover:bg-zen-accent/60 dark:bg-zen-dark-border dark:hover:bg-zen-dark-accent/60"
    >
      {/* ヒットエリアを実際の枠より広く取る (掴みやすさ向上) */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

/** 何も開いていないときに表示する案内 */
function EmptyState() {
  const t = useT();
  return (
    <div className="flex h-full items-center justify-center text-sm text-zen-subtle dark:text-zen-dark-subtle">
      <div className="text-center">
        <div className="mb-2 text-3xl">✨</div>
        <p>{t("app.emptyHint")}</p>
      </div>
    </div>
  );
}

/** カラーテーマを system / light / dark から判定する */
function useDarkMode(mode: "light" | "dark" | "system"): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (mode === "dark") {
      setIsDark(true);
      return;
    }
    if (mode === "light") {
      setIsDark(false);
      return;
    }
    // system 時は OS 側のメディアクエリに従う
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  // Tailwind の dark クラスを html に付与し、color-scheme も明示する。
  // color-scheme を inline style で立てておかないと、WebView2 が <select> の
  // ドロップダウンなど native フォームコントロールを OS テーマ側で描画してしまい、
  // ライトテーマでもプルダウンだけ黒くなる。
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  return isDark;
}
