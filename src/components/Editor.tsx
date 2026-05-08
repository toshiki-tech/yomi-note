// CodeMirror 6 をラップした Markdown エディタコンポーネント

import { useEffect, useRef } from "react";
import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches, search } from "@codemirror/search";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { useAppStore } from "../store/useAppStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { toggleBold, toggleItalic } from "../utils/editorCommands";

interface EditorProps {
  isDark: boolean;
  /** スクロール同期コールバック (0..1 の比率) */
  onScroll?: (ratio: number) => void;
  /** 外部からエディタビューを取得するためのコールバック */
  onReady?: (view: EditorView) => void;
}

export function Editor({ isDark, onScroll, onReady }: EditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());
  const fontCompartment = useRef(new Compartment());

  const activeId = useAppStore((s) => s.activeId);
  const updateContent = useAppStore((s) => s.updateContent);
  const settings = useSettingsStore((s) => s.settings);

  // === 初回マウント: EditorView を生成 ===
  useEffect(() => {
    if (!containerRef.current) return;

    const fontTheme = makeFontTheme(settings.fontSize, settings.fontFamily);
    const startState = EditorState.create({
      doc: "",
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true }),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          addKeymap: true,
        }),
        EditorView.lineWrapping,
        keymap.of([
          // Markdown 用の編集ショートカット (ネイティブメニューと衝突しないキー)
          {
            key: "Mod-b",
            run: (view) => {
              toggleBold(view);
              return true;
            },
          },
          {
            key: "Mod-i",
            run: (view) => {
              toggleItalic(view);
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        themeCompartment.current.of(isDark ? oneDark : []),
        fontCompartment.current.of(fontTheme),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const id = useAppStore.getState().activeId;
            if (id) {
              updateContent(id, u.state.doc.toString());
            }
          }
        }),
        EditorView.domEventHandlers({
          scroll: (_e, view) => {
            const sd = view.scrollDOM;
            const max = sd.scrollHeight - sd.clientHeight;
            if (max > 0 && onScroll) {
              onScroll(sd.scrollTop / max);
            }
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });
    viewRef.current = view;
    onReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === ダークモード切替 ===
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(isDark ? oneDark : []),
    });
  }, [isDark]);

  // === フォント / フォントサイズ変更 ===
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: fontCompartment.current.reconfigure(
        makeFontTheme(settings.fontSize, settings.fontFamily),
      ),
    });
  }, [settings.fontSize, settings.fontFamily]);

  // === アクティブタブ切り替え時にドキュメント差し替え ===
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const doc = useAppStore.getState().documents.find((d) => d.id === activeId);
    const next = doc?.content ?? "";
    const current = view.state.doc.toString();
    if (next === current) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      selection: EditorSelection.cursor(0),
    });
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      data-zen-editor
    />
  );
}

/** フォント設定を CodeMirror テーマとして生成 */
function makeFontTheme(size: number, family: string) {
  return EditorView.theme({
    "&": {
      height: "100%",
      fontSize: `${size}px`,
    },
    ".cm-scroller": {
      // CJK 文字を ASCII の正確に 2 倍幅で表示する halfwidth/fullwidth 整合フォントを
      // 必ず Latin フォントの後ろに置く。Noto Sans JP はプロポーショナル
      // (アルファベットと半角の字幅が違う) のため罫線がズレる原因になり、外した。
      // MS Gothic / NSimSun は Windows 同梱、Sarasa はインストール時のみ採用。
      fontFamily: `${family}, "JetBrains Mono Variable", "JetBrains Mono", "Cascadia Code", "Consolas", "Sarasa Mono SC", "Sarasa Mono J", "Sarasa Mono TC", "MS Gothic", "ＭＳ ゴシック", "NSimSun", "Osaka-Mono", monospace`,
      lineHeight: "1.7",
      fontFeatureSettings: '"calt" 1, "liga" 1, "ss19" 1',
    },
    ".cm-content": {
      padding: "16px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
    },
  });
}
