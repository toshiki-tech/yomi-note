// エディタ上で文字を選択した時に出る小さな浮動パネル。
// - 選択範囲が {base|reading} を含む  → [辞書に保存] ボタン (ユーザー注音辞書へ登録)
// - 選択範囲がプレーンな単語で辞書命中 → [辞書から適用] ボタン (1 件なら直接挿入、
//   複数なら読みを選ぶドロップダウン)
// どちらでもない場合は表示しない。

import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  useDictStore,
  lookupAll,
  type DictEntry,
} from "../store/useDictStore";
import {
  applyReadingToSelection,
  extractAnnotations,
  saveSelectionToReadingDict,
} from "../utils/readingDictActions";
import { useT } from "../i18n";

interface Props {
  view: EditorView | null;
}

interface PopupPos {
  visible: boolean;
  /** viewport 座標 (px)。fixed 配置の left/top に直接渡す */
  left: number;
  top: number;
}

const ANN_TOKEN = /\{[^|}\n\r]+\|[^|}\n\r]+\}/;

export function SelectionAnnotatePopup({ view }: Props) {
  const t = useT();
  // entries 自体は読まないが、変更を購読して再レンダリングする
  // (新しく追加した直後に「保存済み」へ表示が切り替わる)
  useDictStore((s) => s.entries);

  const [pos, setPos] = useState<PopupPos>({ visible: false, left: 0, top: 0 });
  const [selText, setSelText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // === 選択変化を監視して popup の表示・位置を更新 ===
  useEffect(() => {
    if (!view) return;
    const dom = view.dom;

    const update = () => {
      const range = view.state.selection.main;
      if (range.empty) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        setPickerOpen(false);
        return;
      }
      const text = view.state.sliceDoc(range.from, range.to);
      // 長すぎる / 改行を含む選択は popup の対象外 (普段の段落操作を邪魔しない)
      if (text.length > 80 || /[\r\n]/.test(text)) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        setPickerOpen(false);
        return;
      }
      const coordFrom = view.coordsAtPos(range.from);
      const coordTo = view.coordsAtPos(range.to);
      if (!coordFrom || !coordTo) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        return;
      }
      // 選択範囲の上端に表示。CSS 側で transform で実際の位置を微調整する。
      const centerX = (coordFrom.left + coordTo.right) / 2;
      const topY = Math.min(coordFrom.top, coordTo.top);
      setSelText(text);
      setPos({ visible: true, left: centerX, top: topY });
    };

    // 選択完了タイミングを捕捉: マウス離した時 / 矢印キー離した時
    const onPointerUp = () => window.setTimeout(update, 0);
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === "Shift" ||
        e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown" ||
        (e.ctrlKey && e.key.toLowerCase() === "a")
      ) {
        update();
      }
    };
    // スクロール中は popup の位置が古くなるので一旦隠す
    const onScroll = () => {
      setPos((p) => (p.visible ? { ...p, visible: false } : p));
      setPickerOpen(false);
    };
    // 入力 (文字打ち込み) で選択が崩れた場合に追従
    const onInput = () => update();

    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("keyup", onKeyUp);
    dom.addEventListener("input", onInput);
    // CodeMirror の scroller は dom 内の .cm-scroller。queryで取って scroll を捕捉
    const scroller = dom.querySelector(".cm-scroller");
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("input", onInput);
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [view]);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  if (!view || !pos.visible) return null;

  const hasAnnotation = ANN_TOKEN.test(selText);
  // 前後の空白を許容して辞書を引く (ダブルクリック選択や Shift+矢印で余分な空白が
  // 入ることがある)。type は問わない: 注音 (読み) と英訳のどちらも候補に出す。
  const candidates: DictEntry[] = hasAnnotation
    ? []
    : lookupAll(selText.trim());

  // どちらの操作も提供できない場合は popup 自体を出さない
  if (!hasAnnotation && candidates.length === 0) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  const handleSave = async () => {
    const parsed = extractAnnotations(selText);
    if (parsed.length === 0) return;
    const { added, total } = await saveSelectionToReadingDict(view);
    if (added > 0) {
      showToast(t("annotate.popupSaved", { n: String(added) }));
    } else if (total > 0) {
      showToast(t("annotate.popupAlreadyExists"));
    }
  };

  const handleApply = (reading: string) => {
    applyReadingToSelection(view, reading);
    setPickerOpen(false);
    // 選択が消えるので popup も閉じる
    setPos((p) => ({ ...p, visible: false }));
  };

  // popup 上の mousedown で CodeMirror のフォーカスが外れて選択が解除されるのを防ぐ
  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  // 選択が画面上端付近にある時は popup を選択の下側に出す (画面外に逃げないように)
  const topThreshold = 60;
  const placeBelow = pos.top < topThreshold;

  return (
    <div
      onMouseDown={preventBlur}
      className={`fixed z-50 -translate-x-1/2 select-none ${
        placeBelow ? "" : "-translate-y-full"
      }`}
      style={{
        left: `${pos.left}px`,
        // 選択上に出す時は 8px の隙間、下に出す時は 22px (行の高さ分を逃がす)
        top: `${placeBelow ? pos.top + 22 : pos.top - 8}px`,
      }}
    >
      <div className="flex items-center gap-1 rounded-md border border-zen-border bg-zen-surface px-1 py-1 text-xs shadow-lg dark:border-zen-dark-border dark:bg-zen-dark-surface">
        {toast ? (
          <span className="px-2 py-1 text-zen-subtle dark:text-zen-dark-subtle">
            {toast}
          </span>
        ) : hasAnnotation ? (
          <button
            type="button"
            onClick={handleSave}
            title={t("annotate.popupSaveTooltip")}
            className="rounded px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span aria-hidden className="mr-1">💾</span>
            {t("annotate.popupSave")}
          </button>
        ) : candidates.length === 1 ? (
          <button
            type="button"
            onClick={() => handleApply(candidates[0].value)}
            title={t("annotate.popupApplyTooltip")}
            className="rounded px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="font-medium">{t("annotate.popupApply")}</span>
            <TypeTag type={candidates[0].type} />
            <span className="ml-1 text-zen-subtle dark:text-zen-dark-subtle">
              {candidates[0].value}
            </span>
          </button>
        ) : (
          // 複数候補: ボタン押下でリスト展開
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title={t("annotate.popupApplyTooltip")}
              className="rounded px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="font-medium">{t("annotate.popupApply")}</span>
              <span className="ml-1 text-zen-subtle dark:text-zen-dark-subtle">
                ({candidates.length}) ▾
              </span>
            </button>
            {pickerOpen && (
              <ul className="absolute left-0 top-full mt-1 min-w-[10rem] overflow-hidden rounded-md border border-zen-border bg-zen-surface shadow-lg dark:border-zen-dark-border dark:bg-zen-dark-surface">
                <li className="border-b border-zen-border px-2 py-1 text-[10px] text-zen-subtle dark:border-zen-dark-border dark:text-zen-dark-subtle">
                  {t("annotate.popupPickReading")}
                </li>
                {candidates.map((r) => (
                  <li key={`${r.type}-${r.value}`}>
                    <button
                      type="button"
                      onClick={() => handleApply(r.value)}
                      className="flex w-full items-center gap-1 px-2 py-1 text-left hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <TypeTag type={r.type} />
                      <span>{r.value}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** エントリ種別の小タグ。注音 / 英訳の見分けに使う */
function TypeTag({ type }: { type: DictEntry["type"] }) {
  const t = useT();
  const label =
    type === "english" ? t("userDict.tabEnglish") : t("userDict.tabReading");
  return (
    <span className="ml-1 rounded bg-zen-border/60 px-1 text-[10px] text-zen-subtle dark:bg-zen-dark-border/60 dark:text-zen-dark-subtle">
      {label}
    </span>
  );
}
