# macOS リリースビルド (署名 + Notarize + Staple)

ユーザの Mac で **警告なしで開ける** 配布用 `.app` / `.dmg` を作るための手順。
Apple Developer Program (有料) の所属が必須。

## 全体フロー

```
npm run release:mac
  ↓
tauri build
  ├─ vite build              (フロントエンド)
  ├─ cargo build --release   (Rust)
  ├─ codesign  (Developer ID Application で .app に署名)
  ├─ notarize  (.app を Apple notary に送って受理待ち)
  └─ staple    (.app にチケットを貼る)
  ↓
scripts/notarize-dmg.mjs
  ├─ notarize  (.dmg を Apple notary に送って受理待ち)
  └─ staple    (.dmg にチケットを貼る)
  ↓
配布可能な YomiNote_<version>_aarch64.dmg
```

なぜ 2 段階か: Tauri 2 は `.app` までしか自動で notarize/staple しない。
`.dmg` だけが staple されていないとダウンロード経由でマウントしたとき
Gatekeeper がオンライン検証にフォールバックして遅くなる/不安定になるので、
配布用は DMG にも staple を貼る。

## 一回だけの準備

### 1. Developer ID Application 証明書を Keychain に入れる

Xcode → Settings → Accounts → 該当 Team を選択 → "Manage Certificates" →
左下 "+" → **Developer ID Application** を作成。
作成すると自動的に Keychain にインストールされる。

確認:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

`Developer ID Application: <名前> (<TEAM_ID>)` が出れば OK。

### 2. App-Specific Password を取得

1. ブラウザで https://account.apple.com にログイン (Team の owner/admin の Apple ID で)
2. 左カラム「登录和安全 / Sign-In and Security」
3. 「App 专用密码 / App-Specific Passwords」カードに入る
4. 「+」ボタンで新規生成、名前は何でも (例: `Tauri Notarization`)
5. `xxxx-xxxx-xxxx-xxxx` 形式のパスワードが **1 回だけ** 表示される → どこかに保存

このパスワードはコミットしないこと。失くしたら再生成すればよい。

### 3. ビルド用 env を用意

`~/.zshrc` などに直接書くか、ホームディレクトリに非公開ファイルを作って
ビルド前に `source` する。下記は後者の例。

```bash
# ~/.yominote-release-env  (chmod 600, リポジトリに置かない)
export APPLE_SIGNING_IDENTITY="Developer ID Application: BIAOQI DU (R2WXVAJJQR)"
export APPLE_ID="dogiant@hotmail.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="R2WXVAJJQR"
```

実値は自分のものに置き換える。`APPLE_TEAM_ID` は証明書名の括弧内の文字列。
`APPLE_ID` は **Team の owner/admin** であるアカウント。違うアカウントだと
notarize が `Unauthorized` で蹴られる。

## 毎回のビルド

3 つの選択肢:

```bash
source ~/.yominote-release-env

# Apple Silicon (aarch64) のみ
npm run release:mac

# Intel (x86_64) のみ
npm run release:mac:intel

# 両方 (アーキ別 DMG が 2 つできる)
npm run release:mac:all
```

成果物:

| ターゲット | DMG パス |
|---|---|
| Apple Silicon | `src-tauri/target/release/bundle/dmg/YomiNote_<version>_aarch64.dmg` |
| Intel | `src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/YomiNote_<version>_x64.dmg` |

`<version>` は `src-tauri/tauri.conf.json` の `version` フィールド。
配布サイトでは「Apple Silicon 用」「Intel 用」と明示して 2 ファイルを並べて
ダウンロードリンクを作るのが普通。

Universal binary (1 ファイルで両 arch をカバー) は Tauri 経由でも可能だが、
Rust 依存に純粋 C/Obj-C ライブラリがあるとリンクで詰まりやすいので、
本プロジェクトでは別 DMG 配布を採用している。

所要時間の目安 (M シリーズ Mac, 差分ビルド時):

- vite build: ~3s
- cargo build (差分): ~30s / (初回): ~3min
- .app 署名: ~5s
- .app notarize: 1〜5min (Apple 側で variable)
- .app staple: ~3s
- DMG 作成 + 署名: ~5s
- DMG notarize: 1〜5min
- DMG staple: ~3s

合計: 差分で大体 5〜10 分。

## 検証

ビルド後、両方が以下を満たしていることを確認:

```bash
APP="src-tauri/target/release/bundle/macos/YomiNote.app"
DMG="src-tauri/target/release/bundle/dmg/YomiNote_0.1.0_aarch64.dmg"

# 署名情報 (Developer ID + Apple Root CA まで chain している)
codesign -dv --verbose=2 "$APP"

# Gatekeeper 判定 (期待: "source=Notarized Developer ID")
spctl -a -t exec -vv "$APP"
spctl -a -t open --context context:primary-signature -vv "$DMG"

# Staple チケットの存在
xcrun stapler validate "$APP"
xcrun stapler validate "$DMG"
```

`spctl` の出力に **`source=Notarized Developer ID`** と
**`accepted`** が両方出ていれば配布 OK。

## 配布 (公式サイトでの公開)

### アップロードするファイル

ビルドした `.dmg` がそのまま最終ファイル。**追加のラップ/zip/インストーラ作成は不要**。
HTTPS で配信できる場所 (S3 / CloudFront / GitHub Releases / 自前 CDN) に
そのままアップロードする。

現バージョン (v0.1.0) の絶対パス:

```
src-tauri/target/release/bundle/dmg/YomiNote_0.1.0_aarch64.dmg
src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/YomiNote_0.1.0_x64.dmg
```

両方 32 MB 程度。

### ダウンロードページの UX

ユーザのチップを Web 側で自動判別して片方だけ提示するのが親切:

```js
// JS で大雑把に判別 (UA だけでは限界があるので両方リンクは残す)
const isAppleSilicon = navigator.userAgent.includes("Mac") &&
  !navigator.userAgent.includes("Intel");
```

判別不能なら **"Apple Silicon (M1/M2/M3/M4)" / "Intel"** の 2 ボタンを並べる。
2020 年以降の Mac はほぼ Apple Silicon。Intel 版はレガシー需要として残す。

### インストール手順 (ユーザ視点)

ダウンロードページに書いておくと親切:

1. `.dmg` をダブルクリック → 「Applications にドラッグ」のウィンドウが開く
2. アイコンを Applications フォルダにドラッグ
3. Launchpad または Applications から **YomiNote** を起動
4. (初回のみ) macOS が「Apple がチェック済み」ダイアログを出すので **「開く」**

notarize 済みなので「未確認の開発元」「マルウェアの可能性」系の
警告は出ない (出る場合は notarize/staple が壊れているので再確認)。

### バージョン更新時

1. `src-tauri/tauri.conf.json` の `version` を上げる
2. `package.json` の `version` も合わせる
3. `npm run release:mac:all` で両 arch ビルド
4. 新ファイル名 (`YomiNote_<new-version>_aarch64.dmg` 等) で再アップロード
5. 旧版へのリンクは残しておくとロールバック用に便利

### (任意) チェックサム

改ざん検知用に SHA-256 を一緒に置くと良い:

```bash
shasum -a 256 \
  src-tauri/target/release/bundle/dmg/YomiNote_0.1.0_aarch64.dmg \
  src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/YomiNote_0.1.0_x64.dmg
```

### (任意) 自動アップデート

Tauri 公式 plugin `tauri-plugin-updater` を組み込むと、
アプリ内で「新版あります」通知 → ワンクリック更新ができる。
更新元として manifest.json を CDN に置く。
今は未組み込み。需要が出たら検討。

## トラブルシューティング

### `Unauthorized` で notarize が失敗

- `APPLE_ID` が Team の owner/admin ではない
- App-Specific Password がそのアカウントで生成されていない (別 ID で作ったものを流用しても通らない)
- Apple Developer Program の支払い期限切れ

### `Invalid` ステータスで返ってくる

詳細を取得:

```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

よくある原因:
- Hardened Runtime が無効 (Tauri 2 はデフォルト有効なので普通ハマらない)
- entitlements の指定ミス
- 中身に署名されていないバイナリが混じっている

### `The staple and validate action failed`

- そもそも notarize されていないファイルに staple しようとしている
- ネット未接続 (staple はオンラインでチケットをダウンロードする)

### `errSecInternalComponent` で署名が失敗

Keychain がロックされている。
```bash
security unlock-keychain login.keychain
```
で解除してリトライ。

## Rust toolchain について

クロスコンパイル (Apple Silicon マシンで Intel 用バイナリを作る等) には
**rustup** が必要。Homebrew の `rust` パッケージは host 用 libstd しか
持たないため `rustup target add` ができない。

セットアップ:

```bash
brew uninstall rust         # brew 版が入っている場合は外す
brew install rustup-init
rustup-init -y --default-toolchain stable --profile minimal
. "$HOME/.cargo/env"        # 現在のシェルに反映 (新規シェルでは自動)
rustup target add x86_64-apple-darwin   # Intel target
```

確認:

```bash
rustup target list --installed
# aarch64-apple-darwin
# x86_64-apple-darwin
```

両方出ていれば `release:mac:all` が通る。

## 参考

- Apple: [Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
- Apple: `xcrun notarytool --help`, `xcrun stapler --help`
- Tauri: [Distributing macOS Applications](https://v2.tauri.app/distribute/sign/macos/)
