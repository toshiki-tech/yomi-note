// i18n エントリポイント
// useT() フックは現在の言語を購読してコンポーネント再レンダを発生させる
// t() は React 外 (イベントハンドラやストア) からの直接呼び出し用

import { useCallback } from "react";
import { useSettingsStore } from "../store/useSettingsStore";
import {
  dictionaries,
  ja,
  type Language,
  type TranslationDict,
  type TranslationKey,
} from "./translations";

/** "system" を OS の言語ヒントから ja/en/zh/zh-TW のいずれかへ解決
 *  - zh-TW / zh-HK / zh-Hant — 繁體中文として扱う
 *  - その他 zh-* (zh-CN, zh-SG など) — 簡体中文 */
export function resolveLanguage(lang: Language): Exclude<Language, "system"> {
  if (lang !== "system") return lang;
  const navLang =
    typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
  if (navLang.startsWith("ja")) return "ja";
  if (
    navLang.startsWith("zh-tw") ||
    navLang.startsWith("zh-hk") ||
    navLang.startsWith("zh-mo") ||
    navLang.startsWith("zh-hant")
  ) {
    return "zh-TW";
  }
  if (navLang.startsWith("zh")) return "zh";
  return "en";
}

/** ドット区切りキーで辞書を引く。見つからない場合は ja にフォールバック */
function lookup(dict: TranslationDict, key: string): string {
  const segments = key.split(".");
  let cur: unknown = dict;
  for (const seg of segments) {
    if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      cur = undefined;
      break;
    }
  }
  if (typeof cur === "string") return cur;
  // ja からのフォールバック
  let fb: unknown = ja;
  for (const seg of segments) {
    if (fb && typeof fb === "object" && seg in (fb as Record<string, unknown>)) {
      fb = (fb as Record<string, unknown>)[seg];
    } else {
      return key;
    }
  }
  return typeof fb === "string" ? fb : key;
}

/** {param} 形式のプレースホルダを置換 */
function interpolate(str: string, params?: Record<string, string>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

/** React 外で利用する翻訳関数。最新の言語設定をストアから直接読む */
export function t(
  key: TranslationKey,
  params?: Record<string, string>,
): string {
  const lang = resolveLanguage(useSettingsStore.getState().settings.language);
  const dict = dictionaries[lang];
  return interpolate(lookup(dict, key), params);
}

/** React コンポーネント用フック。言語変更で自動再レンダする */
export function useT(): (
  key: TranslationKey,
  params?: Record<string, string>,
) => string {
  const lang = useSettingsStore((s) => resolveLanguage(s.settings.language));
  return useCallback(
    (key, params) => {
      const dict = dictionaries[lang];
      return interpolate(lookup(dict, key), params);
    },
    [lang],
  );
}

/** 起動時のサンプル文書を言語別に返す */
export function getSampleDoc(lang: Language): string {
  const resolved = resolveLanguage(lang);
  return SAMPLE_DOCS[resolved];
}

const SAMPLE_DOCS: Record<Exclude<Language, "system">, string> = {
  ja: `# YomiNote へようこそ

**日本語の読みを助ける**、*高速*、モダン Markdown エディタ。

## 日本語の読みを助ける機能 — デモ

下のテキストを **すべて選択** してツールバーの「**読**」ボタンを押すと、漢字に振り仮名が、カタカナ語に英訳が自動で付きます。

**Before** (素のテキスト):

> 今日は新しいコンピュータを買って、東京駅でコーヒーを飲みながらメールを確認した。

**After** (一度ボタンを押すとこうなります — 編集側に \`{base|reading}\` 記法が挿入され、プレビュー側で ruby として表示):

> {今日|きょう}は{新|あたら}しい{コンピュータ|computer}を{買|か}って、{東京駅|とうきょうえき}で{コーヒー|coffee}を{飲|の}みながら{メール|mail / e-mail}を{確認|かくにん}した。

ツールバーには 4 つのアノテーションボタンがあります:

- **読** ✨ — 一括 (漢字に振り仮名 + カタカナに英訳)
- **振** — 漢字のみ振り仮名
- **英訳** — カタカナのみ英訳
- **解** — 選択範囲の既存ルビを取り除く

二回目に押すと既存のルビが自動で剥がされ、付け直されるのでネストしません。読みが間違っていたら \`{base|reading}\` の reading 部分を直接書き換えれば OK。

## 機能ハイライト

- 🪶 軽量な Tauri ベース
- ✍️ CodeMirror 6 エディタ
- 🌗 ライト / ダークテーマ
- 💾 自動保存
- 🔍 ファイル検索
- 📁 ワークスペース対応
- 🌐 多言語対応 (日本語 / 英語 / 中国語)

## チェックリスト

- [x] 基本編集
- [x] リアルタイムプレビュー
- [ ] AI 機能 (今後)
- [ ] PDF エクスポート (今後)

## コードハイライト

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> 引用: 「シンプルさは究極の洗練である。」 — Leonardo da Vinci

| 項目 | 状態 |
| ---- | ---- |
| 編集 | ✅ |
| 保存 | ✅ |
| 同期 | 予定 |

[GitHub](https://github.com)
`,
  en: `# Welcome to YomiNote

**Japanese reading aids**, *fast*, modern Markdown editor.

## Japanese Reading Aid — Demo

**Select all of the text below** and press the **Yomi** ✨ toolbar button: kanji get furigana (hiragana readings) and katakana loanwords get English glosses.

**Before** (plain text):

> 今日は新しいコンピュータを買って、東京駅でコーヒーを飲みながらメールを確認した。

**After** (one click inserts \`{base|reading}\` syntax in the editor; preview renders it as ruby):

> {今日|きょう}は{新|あたら}しい{コンピュータ|computer}を{買|か}って、{東京駅|とうきょうえき}で{コーヒー|coffee}を{飲|の}みながら{メール|mail / e-mail}を{確認|かくにん}した。

Four annotation buttons:

- **Yomi** ✨ — both furigana on kanji + English on katakana
- **Furi** — kanji-only furigana
- **EN** — katakana-only English gloss
- **Plain** — strip existing ruby from the selection

Click again on the same selection: existing ruby is automatically stripped and re-applied (no nesting). To fix a wrong reading, just edit the \`reading\` part of \`{base|reading}\` directly.

## Highlights

- 🪶 Lightweight Tauri-based
- ✍️ CodeMirror 6 editor
- 🌗 Light / dark theme
- 💾 Auto save
- 🔍 File search
- 📁 Workspace support
- 🌐 Multi-language (Japanese / English / Chinese)

## Checklist

- [x] Basic editing
- [x] Live preview
- [ ] AI features (planned)
- [ ] PDF export (planned)

## Code highlight

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> "Simplicity is the ultimate sophistication." — Leonardo da Vinci

| Feature | Status |
| ------- | ------ |
| Edit    | ✅     |
| Save    | ✅     |
| Sync    | Planned |

[GitHub](https://github.com)
`,
  "zh-TW": `# 歡迎使用 YomiNote

**日語輔助閱讀**、*快速*、現代 Markdown 編輯器。

## 日語輔助閱讀 — 範例

**全選下方文字**，點擊工具列的「**読**」✨ 按鈕：日文漢字會自動加注音（平假名讀法），片假名外來語會加上英文翻譯。

**轉換前**（純日文）：

> 今日は新しいコンピュータを買って、東京駅でコーヒーを飲みながらメールを確認した。

**轉換後**（按一次按鈕後，編輯器原始碼裡會插入 \`{原文|讀音}\` 語法；預覽側自動渲染為 ruby 注音）：

> {今日|きょう}は{新|あたら}しい{コンピュータ|computer}を{買|か}って、{東京駅|とうきょうえき}で{コーヒー|coffee}を{飲|の}みながら{メール|mail / e-mail}を{確認|かくにん}した。

工具列有四個標註按鈕：

- **読** ✨ — 一鍵搞定（漢字注音 + 片假名英文）
- **振** — 僅為漢字加注音
- **EN** — 僅為片假名加英文
- **解** — 移除選取範圍內已有的注音

第二次點擊同一段：舊的 ruby 會自動被剝離再重新產生，不會巢狀。讀音不對？直接編輯 \`{原文|讀音}\` 中讀音的部分即可。

## 功能亮點

- 🪶 基於 Tauri 的輕量級實作
- ✍️ CodeMirror 6 編輯器
- 🌗 淺色 / 深色主題
- 💾 自動儲存
- 🔍 檔案搜尋
- 📁 工作區支援
- 🌐 多語言（日 / 英 / 簡中 / 繁中）

## 工作清單

- [x] 基本編輯
- [x] 即時預覽
- [ ] AI 功能（規劃中）
- [ ] PDF 匯出（規劃中）

## 程式碼高亮

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> 引用：「至繁歸於至簡。」 — Leonardo da Vinci

| 功能 | 狀態 |
| ---- | ---- |
| 編輯 | ✅   |
| 儲存 | ✅   |
| 同步 | 規劃中 |

[GitHub](https://github.com)
`,
  zh: `# 欢迎使用 YomiNote

**日语辅助阅读**、*快速*、现代 Markdown 编辑器。

## 日语辅助阅读 — 示例

**全选下方文字**，点击工具栏的「**読**」✨ 按钮：日语汉字会自动加注音（平假名读法），片假名外来词会加英文翻译。

**变换前**（纯日文）：

> 今日は新しいコンピュータを買って、東京駅でコーヒーを飲みながらメールを確認した。

**变换后**（点一次按钮后，编辑器源码里插入 \`{原文|读音}\` 语法；预览侧自动渲染成 ruby 注音）：

> {今日|きょう}は{新|あたら}しい{コンピュータ|computer}を{買|か}って、{東京駅|とうきょうえき}で{コーヒー|coffee}を{飲|の}みながら{メール|mail / e-mail}を{確認|かくにん}した。

工具栏有四个标注按钮：

- **読** ✨ — 一键搞定（汉字注音 + 片假名英文）
- **振** — 仅给汉字加注音
- **EN** — 仅给片假名加英文
- **解** — 移除选区内已有的注音

第二次点击同一段：旧的 ruby 会自动被剥掉再重新生成，不会嵌套。读音不对？直接编辑 \`{原文|读音}\` 中读音部分即可。

## 功能亮点

- 🪶 基于 Tauri 的轻量级实现
- ✍️ CodeMirror 6 编辑器
- 🌗 浅色 / 深色主题
- 💾 自动保存
- 🔍 文件搜索
- 📁 工作区支持
- 🌐 多语言（日 / 英 / 中）

## 任务清单

- [x] 基础编辑
- [x] 实时预览
- [ ] AI 功能（计划中）
- [ ] PDF 导出（计划中）

## 代码高亮

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> 引用：「至繁归于至简。」 — Leonardo da Vinci

| 功能 | 状态 |
| ---- | ---- |
| 编辑 | ✅   |
| 保存 | ✅   |
| 同步 | 计划中 |

[GitHub](https://github.com)
`,
};

export type { Language, TranslationKey };
