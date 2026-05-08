// 片假名 → 英文 注釈用辞書
// 2 段構成:
//   1. 手で集めた "BUILTIN" 辞書 (技術用語向けに簡潔な訳を採用)
//   2. JMdict-simplified から自動生成した "EXTENDED" 辞書 (~6000 語)
//      ビルド時に scripts/build-jmdict-katakana.mjs で生成し、
//      ランタイムでは fetch で遅延読み込みする
// 同じキーがあれば BUILTIN を優先 (技術文脈の訳が壊れないように)

/** 手で整備した小辞書 (技術用語中心、簡潔な訳) */
export const BUILTIN_KATAKANA: Record<string, string> = {
  // === Tech / Office ===
  コンピュータ: "computer",
  コンピューター: "computer",
  パソコン: "personal computer",
  ソフトウェア: "software",
  ハードウェア: "hardware",
  プログラム: "program",
  プログラミング: "programming",
  アプリ: "app",
  アプリケーション: "application",
  システム: "system",
  ネットワーク: "network",
  インターネット: "internet",
  ウェブ: "web",
  ウェブサイト: "website",
  サイト: "site",
  ブラウザ: "browser",
  サーバー: "server",
  クライアント: "client",
  データ: "data",
  データベース: "database",
  ファイル: "file",
  フォルダ: "folder",
  フォルダー: "folder",
  ディレクトリ: "directory",
  パス: "path",
  ダウンロード: "download",
  アップロード: "upload",
  インストール: "install",
  アンインストール: "uninstall",
  アップデート: "update",
  アップグレード: "upgrade",
  ログイン: "login",
  ログアウト: "logout",
  パスワード: "password",
  アカウント: "account",
  ユーザー: "user",
  メール: "mail / e-mail",
  アドレス: "address",
  リンク: "link",
  クリック: "click",
  ドラッグ: "drag",
  ドロップ: "drop",
  コピー: "copy",
  ペースト: "paste",
  スクロール: "scroll",
  メニュー: "menu",
  ウィンドウ: "window",
  タブ: "tab",
  ボタン: "button",
  アイコン: "icon",
  カーソル: "cursor",
  マウス: "mouse",
  キーボード: "keyboard",
  ディスプレイ: "display",
  モニター: "monitor",
  スクリーン: "screen",
  タッチパネル: "touch panel",
  プリンター: "printer",
  スキャナー: "scanner",
  メモリ: "memory",
  ストレージ: "storage",
  クラウド: "cloud",
  バックアップ: "backup",
  キャッシュ: "cache",
  バグ: "bug",
  デバッグ: "debug",
  エラー: "error",
  クラッシュ: "crash",
  セキュリティ: "security",
  ウイルス: "virus",
  ハッカー: "hacker",
  コード: "code",
  バージョン: "version",
  リリース: "release",
  ライセンス: "license",
  オープンソース: "open source",
  プラグイン: "plugin",
  ライブラリ: "library",
  フレームワーク: "framework",
  プロジェクト: "project",
  リポジトリ: "repository",
  コミット: "commit",
  プッシュ: "push",
  プル: "pull",
  マージ: "merge",
  ブランチ: "branch",
  デプロイ: "deploy",
  ビルド: "build",
  テスト: "test",
  テキスト: "text",
  エディタ: "editor",
  エディター: "editor",
  ターミナル: "terminal",
  コマンド: "command",
  シェル: "shell",
  スクリプト: "script",

  // === AI / Modern ===
  アルゴリズム: "algorithm",
  モデル: "model",
  データセット: "dataset",
  ニューラル: "neural",
  マシンラーニング: "machine learning",
  ディープラーニング: "deep learning",
  チャット: "chat",
  チャットボット: "chatbot",
  プロンプト: "prompt",
  トークン: "token",

  // === Food / Drink ===
  コーヒー: "coffee",
  カフェ: "cafe",
  ティー: "tea",
  ジュース: "juice",
  ビール: "beer",
  ワイン: "wine",
  ウィスキー: "whisky",
  ミルク: "milk",
  チーズ: "cheese",
  バター: "butter",
  ヨーグルト: "yogurt",
  ケーキ: "cake",
  クッキー: "cookie",
  チョコレート: "chocolate",
  キャンディ: "candy",
  パン: "bread",
  サンドイッチ: "sandwich",
  ハンバーガー: "hamburger",
  ピザ: "pizza",
  パスタ: "pasta",
  サラダ: "salad",
  スープ: "soup",
  ステーキ: "steak",
  カレー: "curry",
  ラーメン: "ramen",
  デザート: "dessert",
  アイスクリーム: "ice cream",
  フルーツ: "fruit",
  オレンジ: "orange",
  バナナ: "banana",
  トマト: "tomato",
  レストラン: "restaurant",
  メニュ: "menu",
  オーダー: "order",
  テーブル: "table",
  カウンター: "counter",
  バー: "bar",

  // === Daily life / Things ===
  ドア: "door",
  ベッド: "bed",
  ソファ: "sofa",
  カーテン: "curtain",
  カーペット: "carpet",
  ライト: "light",
  ランプ: "lamp",
  キッチン: "kitchen",
  バスルーム: "bathroom",
  トイレ: "toilet",
  シャワー: "shower",
  タオル: "towel",
  シャンプー: "shampoo",
  カバン: "bag",
  バッグ: "bag",
  シャツ: "shirt",
  Tシャツ: "T-shirt",
  パンツ: "pants",
  スカート: "skirt",
  ドレス: "dress",
  ジャケット: "jacket",
  コート: "coat",
  セーター: "sweater",
  シューズ: "shoes",
  ブーツ: "boots",
  サンダル: "sandal",
  メガネ: "glasses",
  サングラス: "sunglasses",
  ハンカチ: "handkerchief",
  ハンドバッグ: "handbag",

  // === Transport ===
  バス: "bus",
  タクシー: "taxi",
  トラック: "truck",
  バイク: "bike / motorcycle",
  オートバイ: "motorcycle",
  サイクル: "cycle",
  ロケット: "rocket",
  ドライブ: "drive",
  ガソリン: "gasoline",
  パーキング: "parking",

  // === Sports / Hobbies ===
  サッカー: "soccer",
  テニス: "tennis",
  ゴルフ: "golf",
  バスケットボール: "basketball",
  バスケ: "basketball",
  ボウリング: "bowling",
  スキー: "ski",
  スケート: "skate",
  サーフィン: "surfing",
  ヨガ: "yoga",
  フィットネス: "fitness",
  ジム: "gym",
  ゲーム: "game",
  ビデオゲーム: "video game",
  カラオケ: "karaoke",
  ダンス: "dance",
  ピアノ: "piano",
  ギター: "guitar",
  ドラム: "drum",
  バンド: "band",
  コンサート: "concert",
  ライブ: "live",

  // === Media ===
  テレビ: "television",
  ラジオ: "radio",
  ニュース: "news",
  ドラマ: "drama",
  アニメ: "anime / animation",
  マンガ: "manga / comic",
  ムービー: "movie",
  ビデオ: "video",
  オーディオ: "audio",
  カメラ: "camera",
  ビジュアル: "visual",
  デザイン: "design",
  グラフィック: "graphic",
  アート: "art",
  ストーリー: "story",
  キャラクター: "character",

  // === Abstract / Common ===
  アイデア: "idea",
  プラン: "plan",
  チーム: "team",
  ビジネス: "business",
  サービス: "service",
  プロダクト: "product",
  マーケット: "market",
  マーケティング: "marketing",
  セール: "sale",
  ショップ: "shop",
  スタッフ: "staff",
  パートナー: "partner",
  リーダー: "leader",
  マネージャー: "manager",
  ミーティング: "meeting",
  プレゼン: "presentation",
  プレゼンテーション: "presentation",
  スケジュール: "schedule",
  タスク: "task",
  プロセス: "process",
  リスク: "risk",
  チャンス: "chance",
  チャレンジ: "challenge",
  ゴール: "goal",
  スタート: "start",
  エンド: "end",
  スピード: "speed",
  スマート: "smart",
  シンプル: "simple",
  モダン: "modern",
  クラシック: "classic",
  スタイル: "style",
  カラー: "color",
  サイズ: "size",
  タイプ: "type",
  パターン: "pattern",
  レベル: "level",
  ポイント: "point",
  ステップ: "step",
  ルール: "rule",
  ポリシー: "policy",
  メリット: "merit / advantage",
  デメリット: "demerit / disadvantage",

  // === Place / Travel ===
  ホテル: "hotel",
  チェックイン: "check-in",
  チェックアウト: "check-out",
  ルーム: "room",
  ロビー: "lobby",
  プール: "pool",
  ビーチ: "beach",
  パーク: "park",
  ガーデン: "garden",
  ホーム: "home",
  オフィス: "office",
  ストリート: "street",
  シティ: "city",
  カントリー: "country",
  ワールド: "world",

  // === People / Roles ===
  ファミリー: "family",
  パパ: "papa / dad",
  ママ: "mama / mom",
  ベビー: "baby",
  ボーイ: "boy",
  ガール: "girl",
  フレンド: "friend",
  カップル: "couple",
};

/** ランタイムでマージ済みの辞書 (BUILTIN + JMdict)。 ensureKatakanaDictLoaded 後に有効 */
let mergedDict: Map<string, string> | null = null;
let loadPromise: Promise<Map<string, string>> | null = null;

/** JMdict 由来の辞書 JSON を fetch で読み込み、内蔵辞書とマージする */
async function loadAndMerge(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch("/jmdict-katakana.json");
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>;
      for (const [k, v] of Object.entries(data)) {
        map.set(k, v);
      }
    } else {
      console.warn("JMdict 辞書の HTTP ステータス", res.status);
    }
  } catch (err) {
    console.warn("JMdict 辞書の読み込みに失敗", err);
  }
  // BUILTIN を後から書き込むことで、技術用語訳が JMdict より優先される
  for (const [k, v] of Object.entries(BUILTIN_KATAKANA)) {
    map.set(k, v);
  }
  return map;
}

/** 辞書が未読込なら読み込んでマージする (1 度だけ実行) */
export async function ensureKatakanaDictLoaded(): Promise<void> {
  if (mergedDict) return;
  if (!loadPromise) {
    loadPromise = loadAndMerge().then((m) => {
      mergedDict = m;
      return m;
    });
  }
  await loadPromise;
}

/** ユーザー辞書ルックアップを差し込むためのフック (循環依存を避けるため遅延設定) */
let userDictLookup: ((word: string) => string | undefined) | null = null;
export function setUserDictLookup(fn: (w: string) => string | undefined): void {
  userDictLookup = fn;
}

/** 同期ルックアップ。優先順位: USER > BUILTIN > JMdict */
export function lookupKatakana(word: string): string | undefined {
  if (userDictLookup) {
    const hit = userDictLookup(word);
    if (hit) return hit;
  }
  if (mergedDict) return mergedDict.get(word);
  return BUILTIN_KATAKANA[word];
}

/** 互換用エクスポート (旧 API)。BUILTIN のみが含まれることに注意 */
export const KATAKANA_DICT = BUILTIN_KATAKANA;
