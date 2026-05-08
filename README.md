# YomiNote

> 日本語の読みを助ける、モダン Markdown デスクトップエディタ
> (Furigana on kanji + JMdict-powered English glosses for katakana loanwords)

Tauri 2 + React 18 + TypeScript + Tailwind + CodeMirror 6 で実装。

## 必要環境

- **Node.js** 18 以上
- **Rust** stable (rustup から `stable-msvc` を推奨)
- **Windows**: Microsoft C++ Build Tools / Visual Studio 2022, WebView2 Runtime
- **macOS**: Xcode Command Line Tools
- **Linux**: `webkit2gtk-4.1`, `libssl-dev`, `libgtk-3-dev` 等

詳しくは公式: <https://v2.tauri.app/start/prerequisites/>

## 初期化

```powershell
cd C:\toshiki-tech-lab\yomi-note

# 依存関係インストール
npm install

# Tauri CLI を初回利用するときは Rust toolchain も必要
# rustup default stable-msvc
```

## 開発実行

```powershell
npm run tauri:dev
```

> 初回ビルドは Rust のクレートをコンパイルするため数分かかります。

## 本番ビルド

```powershell
npm run tauri:build
```

ビルド成果物は `src-tauri/target/release/bundle/` に出力されます。

## ショートカット

| キー | 動作 |
| ---- | ---- |
| Ctrl/Cmd + N | 新規ドキュメント |
| Ctrl/Cmd + O | ファイルを開く |
| Ctrl/Cmd + S | 保存 |
| Ctrl/Cmd + Shift + S | 名前を付けて保存 |
| Ctrl/Cmd + W | タブを閉じる |
| Ctrl/Cmd + F | エディタ内検索 |
| Ctrl/Cmd + B | 太字 |
| Ctrl/Cmd + I | 斜体 |
| Ctrl/Cmd + P | 表示モード切替 |
| Ctrl/Cmd + , | 設定 |

## アーキテクチャ

```
src/
├── components/   UI コンポーネント
├── store/        Zustand ストア (アプリ状態 / 設定)
├── hooks/        ショートカット / 自動保存
├── utils/        FS / Markdown / エディタコマンド
├── types/        共通型定義
└── styles/       グローバル CSS
```

### 拡張ポイント

- **AI 機能** : `src/utils/` に `ai.ts` を追加し、ツールバーに専用ボタンを配置
- **PDF / HTML エクスポート** : Tauri の `command` を Rust 側で追加
- **プラグインシステム** : `src/plugins/` の動的ロードを検討
- **クラウド同期 (Git/WebDAV)** : `src/sync/` ディレクトリに同期アダプタを実装

## アイコンについて

Tauri 標準のテンプレートでは `src-tauri/icons/` にアイコンを配置します。
本リポジトリには未含のため、初回 `tauri:build` 前に下記コマンドでデフォルトを生成してください:

```powershell
# 任意の 1024x1024 PNG をルートに置いてから
npx @tauri-apps/cli icon ./icon.png
```

開発中 (`tauri:dev`) はアイコン無しでも起動します。

## ライセンス

MIT
