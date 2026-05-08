// ユーザー設定の状態管理
// Tauri Store プラグイン経由でローカル JSON に永続化する

import { create } from "zustand";
import { load, type Store } from "@tauri-apps/plugin-store";
import { DEFAULT_SETTINGS, type AppSettings, type RecentFile } from "../types";

const STORE_FILE = "yominote-settings.json";
const KEY_SETTINGS = "settings";
const KEY_RECENT = "recent";

/** Store ハンドルのキャッシュ (シングルトン) */
let storePromise: Promise<Store> | null = null;
async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
  }
  return storePromise;
}

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;

  /** 永続化された値を読み込む */
  loadFromDisk: () => Promise<RecentFile[]>;
  /** 部分更新 + 永続化 */
  update: (patch: Partial<AppSettings>) => Promise<void>;
  /** リセット */
  reset: () => Promise<void>;
  /** 最近のファイルを永続化 */
  saveRecentFiles: (files: RecentFile[]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  loadFromDisk: async () => {
    try {
      const store = await getStore();
      const saved = await store.get<AppSettings>(KEY_SETTINGS);
      const recent = await store.get<RecentFile[]>(KEY_RECENT);
      set({
        settings: { ...DEFAULT_SETTINGS, ...(saved ?? {}) },
        loaded: true,
      });
      return recent ?? [];
    } catch (err) {
      console.warn("設定の読み込みに失敗しました", err);
      set({ loaded: true });
      return [];
    }
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    try {
      const store = await getStore();
      await store.set(KEY_SETTINGS, next);
      await store.save();
    } catch (err) {
      console.warn("設定の保存に失敗しました", err);
    }
  },

  reset: async () => {
    set({ settings: DEFAULT_SETTINGS });
    try {
      const store = await getStore();
      await store.set(KEY_SETTINGS, DEFAULT_SETTINGS);
      await store.save();
    } catch (err) {
      console.warn("設定のリセットに失敗しました", err);
    }
  },

  saveRecentFiles: async (files) => {
    try {
      const store = await getStore();
      await store.set(KEY_RECENT, files);
      await store.save();
    } catch (err) {
      console.warn("最近のファイルの保存に失敗しました", err);
    }
  },
}));
