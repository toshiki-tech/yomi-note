// アクションツールバー (書式 + 表示モード + 設定)
// ユーザの要望: 「前段 (書式+標注) は移動可能 / 後段 (モード+設定) は固定」
//
// 構成:
// - ActionToolbarLeft  : ドラッグ可能。書式ボタン + 注釈ボタン + ドラッグハンドル + 浮動切替
// - ActionToolbarRight : 固定。表示モード + 設定 (常にアクション行の右端に出る)
//
// docked 時は両方ともアクション行 (Toolbar.tsx 内) に並ぶ。
// floating 時は Left のみ position: fixed で App.tsx 直下にレンダされ、
// アクション行内では Right だけが残る。

import { useState } from "react";
import type { EditorView } from "@codemirror/view";
import { useAppStore } from "../store/useAppStore";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  toggleBold,
  toggleItalic,
  toggleStrike,
  toggleInlineCode,
  insertHeading,
  insertQuote,
  insertUnordered,
  insertOrdered,
  insertChecklist,
  insertLink,
  insertImage,
  insertTable,
  insertCodeBlock,
} from "../utils/editorCommands";
import {
  annotateFurigana,
  annotateEnglish,
  annotateAuto,
  stripAnnotationsFromSelection,
} from "../utils/annotateActions";
import { useT } from "../i18n";
import type { ViewMode } from "../types";

const FLOAT_DEFAULT_X = 24;
const FLOAT_DEFAULT_Y = 60;

// === Left segment: 書式 + 注釈 + ドラッグハンドル + 浮動切替 ===

interface ActionToolbarLeftProps {
  editorView: EditorView | null;
  mode: "docked" | "floating";
}

export function ActionToolbarLeft({
  editorView,
  mode,
}: ActionToolbarLeftProps) {
  const t = useT();
  const activeId = useAppStore((s) => s.activeId);
  const settings = useSettingsStore((s) => s.settings);
  const isFloating = mode === "floating";

  const [annotating, setAnnotating] = useState(false);

  function run(cmd: (v: EditorView) => void) {
    if (editorView) cmd(editorView);
  }

  async function runAnnotate(
    cmd: (v: EditorView) => Promise<void>,
  ): Promise<void> {
    if (!editorView || annotating) return;
    setAnnotating(true);
    try {
      await cmd(editorView);
    } finally {
      setAnnotating(false);
    }
  }

  // === ドラッグ ===
  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const cur = useSettingsStore.getState().settings;
    const baseX = isFloating ? cur.toolbarFloatX : cur.toolbarOffsetX;
    const baseY = isFloating ? cur.toolbarFloatY : 0;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startMouseX;
      const dy = ev.clientY - startMouseY;
      if (isFloating) {
        const nx = Math.max(0, Math.min(window.innerWidth - 80, baseX + dx));
        const ny = Math.max(0, Math.min(window.innerHeight - 40, baseY + dy));
        useSettingsStore.setState((s) => ({
          settings: { ...s.settings, toolbarFloatX: nx, toolbarFloatY: ny },
        }));
      } else {
        // ドック時は X のみ。負方向 (左) には行けない、右は ~半画面まで
        const nx = Math.max(0, Math.min(window.innerWidth - 200, baseX + dx));
        useSettingsStore.setState((s) => ({
          settings: { ...s.settings, toolbarOffsetX: nx },
        }));
      }
    }
    function onUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const final = useSettingsStore.getState().settings;
      if (isFloating) {
        void useSettingsStore.getState().update({
          toolbarFloatX: final.toolbarFloatX,
          toolbarFloatY: final.toolbarFloatY,
        });
      } else {
        void useSettingsStore.getState().update({
          toolbarOffsetX: final.toolbarOffsetX,
        });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function resetPosition() {
    if (isFloating) {
      void useSettingsStore.getState().update({
        toolbarFloatX: FLOAT_DEFAULT_X,
        toolbarFloatY: FLOAT_DEFAULT_Y,
      });
    } else {
      void useSettingsStore.getState().update({ toolbarOffsetX: 0 });
    }
  }

  function toggleFloat() {
    if (!isFloating) {
      void useSettingsStore.getState().update({
        toolbarFloating: true,
        toolbarOffsetX: 0,
      });
    } else {
      void useSettingsStore.getState().update({ toolbarFloating: false });
    }
  }

  const containerStyle: React.CSSProperties = isFloating
    ? {
        position: "fixed",
        left: settings.toolbarFloatX,
        top: settings.toolbarFloatY,
        zIndex: 40,
      }
    : { transform: `translateX(${settings.toolbarOffsetX}px)` };

  const containerClass = isFloating
    ? "flex items-center gap-1 rounded-lg border border-zen-border bg-zen-surface/95 px-2 py-1 text-xs shadow-lg backdrop-blur dark:border-zen-dark-border dark:bg-zen-dark-surface/95"
    : "flex items-center gap-1";

  return (
    <div className={containerClass} style={containerStyle}>
      <DragHandle
        title={t("toolbar.dragHandle")}
        onMouseDown={onHandleMouseDown}
        onDoubleClick={resetPosition}
      />
      <FloatToggle
        floating={isFloating}
        title={isFloating ? t("toolbar.dockToolbar") : t("toolbar.floatToolbar")}
        onClick={toggleFloat}
      />

      {activeId && (
        <>
          <div className="mx-1 h-4 w-px bg-zen-border dark:bg-zen-dark-border" />
          <div className="flex items-center gap-0.5">
            <ToolBtn onClick={() => run((v) => insertHeading(v, 1))} title={t("toolbar.heading1")}>
              H1
            </ToolBtn>
            <ToolBtn onClick={() => run((v) => insertHeading(v, 2))} title={t("toolbar.heading2")}>
              H2
            </ToolBtn>
            <ToolBtn onClick={() => run(toggleBold)} title={t("toolbar.bold")}>
              <b>B</b>
            </ToolBtn>
            <ToolBtn onClick={() => run(toggleItalic)} title={t("toolbar.italic")}>
              <i>I</i>
            </ToolBtn>
            <ToolBtn onClick={() => run(toggleStrike)} title={t("toolbar.strikethrough")}>
              <s>S</s>
            </ToolBtn>
            <ToolBtn onClick={() => run(toggleInlineCode)} title={t("toolbar.inlineCode")}>
              {`<>`}
            </ToolBtn>
            <ToolBtn onClick={() => run(insertQuote)} title={t("toolbar.quote")}>
              ”
            </ToolBtn>
            <ToolBtn onClick={() => run(insertUnordered)} title={t("toolbar.bulletList")}>
              •
            </ToolBtn>
            <ToolBtn onClick={() => run(insertOrdered)} title={t("toolbar.orderedList")}>
              1.
            </ToolBtn>
            <ToolBtn onClick={() => run(insertChecklist)} title={t("toolbar.checklist")}>
              ☐
            </ToolBtn>
            <ToolBtn onClick={() => run((v) => insertLink(v))} title={t("toolbar.link")}>
              <LinkIcon />
            </ToolBtn>
            <ToolBtn onClick={() => run((v) => insertImage(v))} title={t("toolbar.image")}>
              <ImageIcon />
            </ToolBtn>
            <ToolBtn onClick={() => run((v) => insertTable(v))} title={t("toolbar.table")}>
              <TableIcon />
            </ToolBtn>
            <ToolBtn onClick={() => run((v) => insertCodeBlock(v, ""))} title={t("toolbar.codeBlock")}>
              {`{ }`}
            </ToolBtn>
            <div className="mx-1 h-4 w-px bg-zen-border dark:bg-zen-dark-border" />
            <ToolBtn
              onClick={() => void runAnnotate(annotateAuto)}
              disabled={annotating}
              title={t("annotate.btnAuto")}
            >
              {annotating ? (
                <Spinner />
              ) : (
                <span className="inline-flex items-center gap-1">
                  <span className="text-[10px] font-medium">{t("annotate.labelAuto")}</span>
                  <span
                    className="text-[12px] leading-none"
                    style={{
                      fontFamily:
                        '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif',
                    }}
                  >
                    ✨
                  </span>
                </span>
              )}
            </ToolBtn>
            <ToolBtn
              onClick={() => void runAnnotate(annotateFurigana)}
              disabled={annotating}
              title={t("annotate.btnFurigana")}
            >
              {annotating ? <Spinner /> : <span className="text-[10px] font-medium">{t("annotate.labelFurigana")}</span>}
            </ToolBtn>
            <ToolBtn
              onClick={() => void runAnnotate(annotateEnglish)}
              disabled={annotating}
              title={t("annotate.btnEnglish")}
            >
              {annotating ? <Spinner /> : <span className="text-[10px] font-medium">{t("annotate.labelEnglish")}</span>}
            </ToolBtn>
            <ToolBtn onClick={() => run(stripAnnotationsFromSelection)} title={t("annotate.btnStrip")}>
              <span className="text-[10px] font-medium">{t("annotate.labelStrip")}</span>
            </ToolBtn>
          </div>
        </>
      )}
    </div>
  );
}

// === Right segment: モード切替 + 設定 (固定。アクション行右端に常駐) ===

export function ActionToolbarRight() {
  const t = useT();
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  return (
    <div className="flex items-center gap-1">
      <ModeBtn current={viewMode} mode="edit" onClick={setViewMode} label={t("toolbar.modeEdit")} />
      <ModeBtn current={viewMode} mode="split" onClick={setViewMode} label={t("toolbar.modeSplit")} />
      <ModeBtn current={viewMode} mode="preview" onClick={setViewMode} label={t("toolbar.modePreview")} />
      <div className="mx-1 h-4 w-px bg-zen-border dark:bg-zen-dark-border" />
      <button
        onClick={() => setSettingsOpen(true)}
        title={t("toolbar.settings")}
        className="rounded px-2 py-1 text-zen-subtle hover:bg-black/5 hover:text-zen-text dark:text-zen-dark-subtle dark:hover:bg-white/10 dark:hover:text-zen-dark-text"
      >
        ⚙
      </button>
    </div>
  );
}

// === ローカルヘルパ ===

function DragHandle({
  title,
  onMouseDown,
  onDoubleClick,
}: {
  title: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title={title}
      onClick={(e) => e.preventDefault()}
      className="flex h-7 w-5 cursor-grab items-center justify-center rounded text-zen-subtle hover:bg-black/5 active:cursor-grabbing dark:text-zen-dark-subtle dark:hover:bg-white/10"
    >
      <Svg>
        <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
      </Svg>
    </button>
  );
}

function FloatToggle({
  floating,
  title,
  onClick,
}: {
  floating: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded p-1 text-zen-subtle hover:bg-black/5 hover:text-zen-text dark:text-zen-dark-subtle dark:hover:bg-white/10 dark:hover:text-zen-dark-text"
    >
      <Svg>
        {floating ? (
          <>
            <path d="M3 3h7v7" />
            <path d="M14 14l-4-4" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
          </>
        ) : (
          <>
            <rect x="3" y="3" width="14" height="14" rx="1" />
            <path d="M14 7h7v7" />
            <path d="M14 14l7-7" />
          </>
        )}
      </Svg>
    </button>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="rounded px-1.5 py-1 text-zen-subtle hover:bg-black/5 hover:text-zen-text disabled:cursor-wait disabled:opacity-60 dark:text-zen-dark-subtle dark:hover:bg-white/10 dark:hover:text-zen-dark-text"
    >
      {children}
    </button>
  );
}

function ModeBtn({
  current,
  mode,
  onClick,
  label,
}: {
  current: ViewMode;
  mode: ViewMode;
  onClick: (mode: ViewMode) => void;
  label: string;
}) {
  const active = current === mode;
  return (
    <button
      onClick={() => onClick(mode)}
      className={`rounded px-2 py-1 ${
        active
          ? "bg-zen-bg text-zen-text dark:bg-zen-dark-bg dark:text-zen-dark-text"
          : "text-zen-subtle hover:bg-black/5 dark:text-zen-dark-subtle dark:hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-zen-subtle border-t-transparent dark:border-zen-dark-subtle dark:border-t-transparent"
      aria-hidden
    />
  );
}

function Svg({ children }: { children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}

function LinkIcon() {
  return (
    <Svg>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </Svg>
  );
}

function ImageIcon() {
  return (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </Svg>
  );
}

function TableIcon() {
  return (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </Svg>
  );
}
