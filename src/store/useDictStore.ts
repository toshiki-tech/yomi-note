// 統合ユーザー辞書ストア
// 「base 文字列 → 複数エントリ」を 1 つの表で扱う。
//   - エントリは type で区別: "english" (片仮名→英訳) / "reading" (任意語→読み)
//   - 同じ base に対して複数エントリを保持できる。配列順がそのまま優先順位
//     (先頭が最高権重)。自動注釈は先頭を採用、ユーザー手動操作 (浮動 popup) は
//     一覧から選ばせる。
//
// 永続化先: yominote-settings.json の KEY = "dictEntries"
// 旧 KEY: "userDict" (片仮名英訳 1:1) と "userReadings" (注音 1:N) — 起動時に
// 新 KEY が空なら自動マージして移行する。旧 KEY はバックアップとして残す。

import { create } from "zustand";
import { load, type Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "yominote-settings.json";
const KEY_NEW = "dictEntries";
const KEY_OLD_ENGLISH = "userDict";
const KEY_OLD_READING = "userReadings";

let storePromise: Promise<Store> | null = null;
async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return storePromise;
}

export type EntryType = "reading" | "english";

export interface DictEntry {
  type: EntryType;
  value: string;
  addedAt: number;
}

interface DictState {
  /** base → エントリ一覧 (配列順 = 優先順位、先頭が最強) */
  entries: Record<string, DictEntry[]>;
  loaded: boolean;

  load: () => Promise<void>;
  /** 新規追加。同じ (base, type, value) の重複は無視。新規なら true */
  add: (base: string, type: EntryType, value: string) => Promise<boolean>;
  /** (base, type, value) を 1 件削除。base が空になったら key も削除 */
  removeOne: (base: string, type: EntryType, value: string) => Promise<void>;
  /** base ごと全消し */
  removeAll: (base: string) => Promise<void>;
  /** base 内のエントリ並べ替え (権重調整)。idx を 1 つ上に動かす */
  moveUp: (base: string, idx: number) => Promise<void>;
  /** 1 つ下に動かす */
  moveDown: (base: string, idx: number) => Promise<void>;
  /** インラインで value を書き換える */
  updateValue: (
    base: string,
    type: EntryType,
    oldValue: string,
    newValue: string,
  ) => Promise<void>;
  /** 全件入れ替え (インポート用) */
  replaceAll: (entries: Record<string, DictEntry[]>) => Promise<void>;
}

/** ディスクへ書き込むヘルパ */
async function persist(entries: Record<string, DictEntry[]>): Promise<void> {
  try {
    const store = await getStore();
    await store.set(KEY_NEW, entries);
    await store.save();
  } catch (err) {
    console.warn("辞書の保存失敗", err);
  }
}

/** 旧 KEY を新フォーマットへ畳み込む */
function mergeLegacy(
  legacyEnglish: Record<string, string> | null,
  legacyReading: Record<string, Array<{ reading: string; addedAt?: number }>> | null,
): Record<string, DictEntry[]> {
  const out: Record<string, DictEntry[]> = {};
  const push = (base: string, entry: DictEntry) => {
    if (!out[base]) out[base] = [];
    // 二重移行で重複しないよう (type, value) で確認
    if (!out[base].some((e) => e.type === entry.type && e.value === entry.value)) {
      out[base].push(entry);
    }
  };
  if (legacyEnglish) {
    for (const [base, value] of Object.entries(legacyEnglish)) {
      if (typeof value !== "string" || !value) continue;
      push(base, { type: "english", value, addedAt: Date.now() });
    }
  }
  if (legacyReading) {
    for (const [base, list] of Object.entries(legacyReading)) {
      if (!Array.isArray(list)) continue;
      for (const r of list) {
        if (!r || typeof r.reading !== "string" || !r.reading) continue;
        push(base, {
          type: "reading",
          value: r.reading,
          addedAt: typeof r.addedAt === "number" ? r.addedAt : Date.now(),
        });
      }
    }
  }
  return out;
}

export const useDictStore = create<DictState>((set, get) => ({
  entries: {},
  loaded: false,

  load: async () => {
    try {
      const store = await getStore();
      const fresh = await store.get<Record<string, DictEntry[]>>(KEY_NEW);
      if (fresh && Object.keys(fresh).length > 0) {
        set({ entries: fresh, loaded: true });
        return;
      }
      // 新 KEY が空 — 旧 KEY からの初回移行を試みる
      const legacyEn = await store.get<Record<string, string>>(KEY_OLD_ENGLISH);
      const legacyRd = await store.get<
        Record<string, Array<{ reading: string; addedAt?: number }>>
      >(KEY_OLD_READING);
      const merged = mergeLegacy(legacyEn ?? null, legacyRd ?? null);
      set({ entries: merged, loaded: true });
      if (Object.keys(merged).length > 0) {
        await persist(merged); // 移行結果を新 KEY へ書き戻す (旧 KEY はバックアップとして残す)
      }
    } catch (err) {
      console.warn("辞書の読み込み失敗", err);
      set({ loaded: true });
    }
  },

  add: async (base, type, value) => {
    const b = base.trim();
    const v = value.trim();
    if (!b || !v) return false;
    const list = get().entries[b] ?? [];
    if (list.some((e) => e.type === type && e.value === v)) return false;
    const entry: DictEntry = { type, value: v, addedAt: Date.now() };
    const next = { ...get().entries, [b]: [...list, entry] };
    set({ entries: next });
    await persist(next);
    return true;
  },

  removeOne: async (base, type, value) => {
    const list = get().entries[base];
    if (!list) return;
    const filtered = list.filter((e) => !(e.type === type && e.value === value));
    const next = { ...get().entries };
    if (filtered.length === 0) delete next[base];
    else next[base] = filtered;
    set({ entries: next });
    await persist(next);
  },

  removeAll: async (base) => {
    const next = { ...get().entries };
    delete next[base];
    set({ entries: next });
    await persist(next);
  },

  moveUp: async (base, idx) => {
    const list = get().entries[base];
    if (!list || idx <= 0 || idx >= list.length) return;
    const copy = list.slice();
    [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
    const next = { ...get().entries, [base]: copy };
    set({ entries: next });
    await persist(next);
  },

  moveDown: async (base, idx) => {
    const list = get().entries[base];
    if (!list || idx < 0 || idx >= list.length - 1) return;
    const copy = list.slice();
    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
    const next = { ...get().entries, [base]: copy };
    set({ entries: next });
    await persist(next);
  },

  updateValue: async (base, type, oldValue, newValue) => {
    const v = newValue.trim();
    if (!v || v === oldValue) return;
    const list = get().entries[base];
    if (!list) return;
    // 別エントリと衝突する場合は単に旧を削除して終わり (重複作らない)
    const wouldConflict = list.some(
      (e) => e.type === type && e.value === v && e.value !== oldValue,
    );
    let updated: DictEntry[];
    if (wouldConflict) {
      updated = list.filter((e) => !(e.type === type && e.value === oldValue));
    } else {
      updated = list.map((e) =>
        e.type === type && e.value === oldValue ? { ...e, value: v } : e,
      );
    }
    const next = { ...get().entries, [base]: updated };
    set({ entries: next });
    await persist(next);
  },

  replaceAll: async (entries) => {
    set({ entries });
    await persist(entries);
  },
}));

// === 同期ルックアップ (非 React コンテキストから利用) ===

/** base に紐付く全エントリ (型問わず、権重順) を返す */
export function lookupAll(base: string): DictEntry[] {
  return useDictStore.getState().entries[base] ?? [];
}

/** base に対する reading エントリ (権重順) を返す */
export function lookupReadings(base: string): DictEntry[] {
  const list = useDictStore.getState().entries[base];
  if (!list) return [];
  return list.filter((e) => e.type === "reading");
}

/** base に対する english エントリ (権重順) を返す */
export function lookupEnglishEntries(base: string): DictEntry[] {
  const list = useDictStore.getState().entries[base];
  if (!list) return [];
  return list.filter((e) => e.type === "english");
}

/** 自動注釈用: 最高権重 (= 先頭) のエントリの value を返す */
export function lookupTop(base: string, type: EntryType): string | undefined {
  const list = useDictStore.getState().entries[base];
  if (!list) return undefined;
  const found = list.find((e) => e.type === type);
  return found?.value;
}
