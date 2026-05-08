// ユーザー辞書ストア
// 片仮名語の英訳辞書として、ユーザーが追加・編集した項目を保持する。
// 検索順位: USER (本ストア) > BUILTIN (技術用語の組み込み辞書) > JMdict (公開辞書)
//
// データは tauri-plugin-store で yominote-settings.json に永続化する。

import { create } from "zustand";
import { load, type Store } from "@tauri-apps/plugin-store";

const STORE_FILE = "yominote-settings.json";
const KEY = "userDict";

let storePromise: Promise<Store> | null = null;
async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return storePromise;
}

interface UserDictState {
  /** 単語 -> 英訳 */
  entries: Record<string, string>;
  loaded: boolean;

  load: () => Promise<void>;
  set: (word: string, english: string) => Promise<void>;
  remove: (word: string) => Promise<void>;
  /** 全件入れ替え (インポート用) */
  replaceAll: (entries: Record<string, string>) => Promise<void>;
  /** 全件取得 (エクスポート用) */
  exportJSON: () => string;
}

export const useUserDictStore = create<UserDictState>((set, get) => ({
  entries: {},
  loaded: false,

  load: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<Record<string, string>>(KEY);
      set({ entries: saved ?? {}, loaded: true });
    } catch (err) {
      console.warn("ユーザー辞書の読み込み失敗", err);
      set({ loaded: true });
    }
  },

  set: async (word, english) => {
    const w = word.trim();
    const en = english.trim();
    if (!w || !en) return;
    const next = { ...get().entries, [w]: en };
    set({ entries: next });
    try {
      const store = await getStore();
      await store.set(KEY, next);
      await store.save();
    } catch (err) {
      console.warn("ユーザー辞書の保存失敗", err);
    }
  },

  remove: async (word) => {
    const next = { ...get().entries };
    delete next[word];
    set({ entries: next });
    try {
      const store = await getStore();
      await store.set(KEY, next);
      await store.save();
    } catch (err) {
      console.warn("ユーザー辞書の保存失敗", err);
    }
  },

  replaceAll: async (entries) => {
    set({ entries });
    try {
      const store = await getStore();
      await store.set(KEY, entries);
      await store.save();
    } catch (err) {
      console.warn("ユーザー辞書の保存失敗", err);
    }
  },

  exportJSON: () => JSON.stringify(get().entries, null, 2),
}));

/** 同期ルックアップ用 (japaneseAnnotate.ts から呼ばれる) */
export function lookupUserDict(word: string): string | undefined {
  return useUserDictStore.getState().entries[word];
}
