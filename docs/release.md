# リリースワークフロー

YomiNote のリリースは **GitHub Releases** に macOS と Windows の
インストーラを並べて公開する。ダウンロード URL の起点はここ:

  https://github.com/toshiki-tech/yomi-note/releases

このドキュメントは「version 上げ → 各 OS でビルド → GitHub に上げる」
までを 1 つの release tag の中でやり切る手順を説明する。

macOS の署名 / Notarize の詳細は [macos-release.md](./macos-release.md) を参照。

## 0. 事前準備 (一度だけ)

各マシンで `gh` (GitHub CLI) をログイン状態にしておく:

```bash
brew install gh         # mac
winget install GitHub.cli  # windows
gh auth login --git-protocol https --web
```

`Token scopes: 'repo'` が出ていれば OK。

macOS の Notarize 用 env は別途 `~/.yominote-release-env` に保存 (macos-release.md 参照)。

## 1. version を上げる

1. `src-tauri/tauri.conf.json` の `"version"` を更新 (例: `"0.1.0"` → `"0.1.1"`)
2. `package.json` の `"version"` を同じ値に
3. commit & push

```bash
git commit -am "Bump version to 0.1.1"
git push
```

両ファイルの version は揃えること。ファイル名 (`YomiNote_<version>_*.dmg/exe/msi`) に
この値が入る。

## 2. macOS インストーラをビルド (Mac 機で)

```bash
source ~/.yominote-release-env
npm run release:mac:all
```

成果物:

```
src-tauri/target/release/bundle/dmg/YomiNote_<version>_aarch64.dmg
src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/YomiNote_<version>_x64.dmg
```

両方とも署名 + Notarize + Staple 済み。

## 3. Windows インストーラをビルド (Windows 機で)

### 一度だけの環境準備

- **Node.js** 18+ … <https://nodejs.org/> or `winget install OpenJS.NodeJS.LTS`
- **Rust** (msvc toolchain) … <https://rustup.rs/> 経由で `rustup-init`, `rustup default stable-msvc`
- **Microsoft C++ Build Tools** … Visual Studio Installer から "Desktop development with C++" workload
- **WebView2 Runtime** … Windows 11 は標準。Windows 10 は <https://developer.microsoft.com/microsoft-edge/webview2/> からインストール

### ビルド

PowerShell で:

```powershell
cd C:\path\to\yomi-note
git pull
npm install
npm run tauri:build
```

初回は Rust 依存のコンパイルで 5〜10 分。差分なら 30 秒〜2 分。

### 成果物

```
src-tauri\target\release\bundle\msi\YomiNote_<version>_x64_en-US.msi
src-tauri\target\release\bundle\nsis\YomiNote_<version>_x64-setup.exe
```

- **`.exe`** (NSIS) … 一般ユーザ向け、軽量
- **`.msi`** (WiX) … 企業 IT 部門向け、Group Policy で配布しやすい

普通は `.exe` を主要ダウンロードに、`.msi` を「企業 / サイレントインストール用」として並べる。

### コード署名 (任意)

未署名でも配布できるが、ダウンロード時に Windows SmartScreen の
「不明な発行元」警告が出る (ユーザは「詳細情報 → 実行」で回避可能)。

警告を消すには Windows Code Signing 証明書が必要 (年 $200〜700, DigiCert / Sectigo / SSL.com 等)。
取得後の組み込みは別途検討。今は未署名で OK。

## 4. GitHub Release に添付

### 4a. 初めての version → `create`

最初のインストーラ (普通は Mac 側で先に作るので Mac で) で:

```bash
gh release create v0.1.1 \
  src-tauri/target/release/bundle/dmg/YomiNote_0.1.1_aarch64.dmg \
  src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/YomiNote_0.1.1_x64.dmg \
  --repo toshiki-tech/yomi-note \
  --title "YomiNote v0.1.1" \
  --notes "$(cat release-notes.md)"
```

`release-notes.md` の中身はテンプレ (下記) を参考に書き起こす。
ファイルにせずインラインで `--notes "..."` でも可。

### 4b. 後から追加 → `upload`

Windows ビルドが終わったら同じ tag に **upload** する:

```powershell
# Windows の PowerShell でも書式は同じ
gh release upload v0.1.1 `
  src-tauri\target\release\bundle\nsis\YomiNote_0.1.1_x64-setup.exe `
  src-tauri\target\release\bundle\msi\YomiNote_0.1.1_x64_en-US.msi `
  --repo toshiki-tech/yomi-note
```

同名 asset を差し替えたいときは `--clobber` フラグを足す。

### 4c. リリースノート更新 (Windows asset 追加後)

ノートに Windows ファイル名と SHA-256 を後追いしたいとき:

```bash
gh release edit v0.1.1 --repo toshiki-tech/yomi-note --notes-file release-notes.md
```

## チェックサム

ユーザの改ざん検知用に release notes に SHA-256 を載せる。

```bash
# macOS
shasum -a 256 src-tauri/target/release/bundle/dmg/YomiNote_*.dmg \
              src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/YomiNote_*.dmg
```

```powershell
# Windows
Get-FileHash src-tauri\target\release\bundle\msi\YomiNote_*.msi -Algorithm SHA256
Get-FileHash src-tauri\target\release\bundle\nsis\YomiNote_*.exe -Algorithm SHA256
```

出力した hex をそのままノートのコードブロックに貼り付ければよい。

## リリースノートのテンプレ

```markdown
<!-- ここはユーザに向けた変更点 -->
## What's New

- (新機能 1)
- (改善 1)
- (バグ修正 1)

## Downloads

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `YomiNote_<version>_aarch64.dmg` |
| macOS (Intel) | `YomiNote_<version>_x64.dmg` |
| Windows (一般) | `YomiNote_<version>_x64-setup.exe` |
| Windows (企業/MSI) | `YomiNote_<version>_x64_en-US.msi` |

## Install

- **macOS**: `.dmg` をダブルクリック → アプリを Applications にドラッグ
- **Windows**: `.exe` をダブルクリック (SmartScreen 警告は「詳細情報 → 実行」)

## Checksums (SHA-256)

```
<arm-hash>  YomiNote_<version>_aarch64.dmg
<intel-hash>  YomiNote_<version>_x64.dmg
<exe-hash>  YomiNote_<version>_x64-setup.exe
<msi-hash>  YomiNote_<version>_x64_en-US.msi
```

`shasum -a 256` (mac) / `Get-FileHash -Algorithm SHA256` (Windows) で検証可。
```

## チェックリスト

各 release で:

- [ ] `tauri.conf.json` と `package.json` の version 一致
- [ ] commit & push 済み
- [ ] macOS aarch64 DMG: 署名 + Notarize + Staple
- [ ] macOS x64 DMG: 署名 + Notarize + Staple
- [ ] Windows `.exe` / `.msi` ビルド済み (署名するなら署名)
- [ ] 全 asset の SHA-256 を release notes に記載
- [ ] `gh release create v<X.Y.Z>` で初期 asset アップロード
- [ ] `gh release upload v<X.Y.Z>` で追加 asset アップロード
- [ ] release page でダウンロードリンクを目視確認
- [ ] (必要なら) 公式サイトの "Download" ボタンの URL を更新

## 自動化の余地

将来のため:

- `scripts/publish-release.mjs` … version 読み + SHA 計算 + `gh release` 呼び出しを一括化
- GitHub Actions で macOS と Windows の runner で並列ビルドして自動 upload
  (Notarize は Apple ID/Password を GitHub Secret に格納)

今は手動でも十分回るので未着手。
