// 自動保存フック
// dirty な path 付きドキュメントを定期的にディスクへ書き込む

import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { writeFile } from "../utils/fs";

export function useAutoSave() {
  const settings = useSettingsStore((s) => s.settings);
  const documents = useAppStore((s) => s.documents);
  const markSaved = useAppStore((s) => s.markSaved);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!settings.autoSave) return;
    // 既存タイマーをクリア
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    // dirty かつ path 付き (= 既存ファイル) のみが対象
    const targets = documents.filter((d) => d.dirty && d.path);
    if (targets.length === 0) return;

    timerRef.current = window.setTimeout(async () => {
      for (const doc of targets) {
        if (!doc.path) continue;
        try {
          await writeFile(doc.path, doc.content);
          markSaved(doc.id, doc.path);
        } catch (err) {
          console.warn("自動保存に失敗", doc.path, err);
        }
      }
    }, settings.autoSaveDelay);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [documents, settings.autoSave, settings.autoSaveDelay, markSaved]);
}
