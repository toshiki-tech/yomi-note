// YomiNote バックエンド本体
// プラグインの初期化と、ネイティブメニューの構築・多言語切替を担う

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, Wry,
};

#[derive(Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        name: "YomiNote",
        version: env!("CARGO_PKG_VERSION"),
    }
}

/// メニューラベルを言語別に保持する構造体
struct MenuLabels {
    file: &'static str,
    new_file: &'static str,
    open_file: &'static str,
    open_folder: &'static str,
    save: &'static str,
    save_as: &'static str,
    close_tab: &'static str,
    quit: &'static str,
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    select_all: &'static str,
    find: &'static str,
    view: &'static str,
    toggle_sidebar: &'static str,
    edit_mode: &'static str,
    split_mode: &'static str,
    preview_mode: &'static str,
    settings: &'static str,
    preferences: &'static str,
    help: &'static str,
    about: &'static str,
    export_html: &'static str,
    export_pdf: &'static str,
}

impl MenuLabels {
    fn for_lang(lang: &str) -> Self {
        match lang {
            "ja" => Self::ja(),
            "zh" => Self::zh(),
            "zh-TW" => Self::zh_tw(),
            _ => Self::en(),
        }
    }

    fn en() -> Self {
        Self {
            file: "File",
            new_file: "New",
            open_file: "Open...",
            open_folder: "Open Folder...",
            save: "Save",
            save_as: "Save As...",
            close_tab: "Close Tab",
            quit: "Quit",
            edit: "Edit",
            undo: "Undo",
            redo: "Redo",
            cut: "Cut",
            copy: "Copy",
            paste: "Paste",
            select_all: "Select All",
            find: "Find",
            view: "View",
            toggle_sidebar: "Toggle Sidebar",
            edit_mode: "Edit Mode",
            split_mode: "Split Mode",
            preview_mode: "Preview Mode",
            settings: "Settings",
            preferences: "Preferences...",
            help: "Help",
            about: "About YomiNote",
            export_html: "Export as HTML...",
            export_pdf: "Export as PDF...",
        }
    }

    fn ja() -> Self {
        Self {
            file: "ファイル",
            new_file: "新規",
            open_file: "開く...",
            open_folder: "フォルダを開く...",
            save: "保存",
            save_as: "名前を付けて保存...",
            close_tab: "タブを閉じる",
            quit: "終了",
            edit: "編集",
            undo: "元に戻す",
            redo: "やり直し",
            cut: "切り取り",
            copy: "コピー",
            paste: "貼り付け",
            select_all: "すべて選択",
            find: "検索",
            view: "表示",
            toggle_sidebar: "サイドバー切替",
            edit_mode: "編集モード",
            split_mode: "並列モード",
            preview_mode: "プレビューモード",
            settings: "設定",
            preferences: "環境設定...",
            help: "ヘルプ",
            about: "YomiNote について",
            export_html: "HTML として書き出す...",
            export_pdf: "PDF として書き出す...",
        }
    }

    fn zh() -> Self {
        Self {
            file: "文件",
            new_file: "新建",
            open_file: "打开...",
            open_folder: "打开文件夹...",
            save: "保存",
            save_as: "另存为...",
            close_tab: "关闭标签页",
            quit: "退出",
            edit: "编辑",
            undo: "撤销",
            redo: "重做",
            cut: "剪切",
            copy: "复制",
            paste: "粘贴",
            select_all: "全选",
            find: "查找",
            view: "视图",
            toggle_sidebar: "切换侧边栏",
            edit_mode: "编辑模式",
            split_mode: "分栏模式",
            preview_mode: "预览模式",
            settings: "设置",
            preferences: "偏好设置...",
            help: "帮助",
            about: "关于 YomiNote",
            export_html: "导出为 HTML...",
            export_pdf: "导出为 PDF...",
        }
    }

    fn zh_tw() -> Self {
        Self {
            file: "檔案",
            new_file: "新增",
            open_file: "開啟...",
            open_folder: "開啟資料夾...",
            save: "儲存",
            save_as: "另存新檔...",
            close_tab: "關閉分頁",
            quit: "結束",
            edit: "編輯",
            undo: "復原",
            redo: "取消復原",
            cut: "剪下",
            copy: "複製",
            paste: "貼上",
            select_all: "全選",
            find: "尋找",
            view: "檢視",
            toggle_sidebar: "切換側邊欄",
            edit_mode: "編輯模式",
            split_mode: "分割模式",
            preview_mode: "預覽模式",
            settings: "設定",
            preferences: "偏好設定...",
            help: "說明",
            about: "關於 YomiNote",
            export_html: "匯出為 HTML...",
            export_pdf: "匯出為 PDF...",
        }
    }
}

/// 言語コードを受け取って Menu を生成
fn build_app_menu(app: &AppHandle, lang: &str) -> tauri::Result<Menu<Wry>> {
    let l = MenuLabels::for_lang(lang);

    // === File メニュー ===
    let new_item = MenuItem::with_id(app, "new", l.new_file, true, Some("CmdOrCtrl+N"))?;
    let open_file = MenuItem::with_id(app, "open_file", l.open_file, true, Some("CmdOrCtrl+O"))?;
    let open_folder = MenuItem::with_id(app, "open_folder", l.open_folder, true, None::<&str>)?;
    let save = MenuItem::with_id(app, "save", l.save, true, Some("CmdOrCtrl+S"))?;
    let save_as = MenuItem::with_id(
        app,
        "save_as",
        l.save_as,
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;
    let close_tab = MenuItem::with_id(app, "close_tab", l.close_tab, true, Some("CmdOrCtrl+W"))?;
    let export_html = MenuItem::with_id(app, "export_html", l.export_html, true, None::<&str>)?;
    let export_pdf = MenuItem::with_id(app, "export_pdf", l.export_pdf, true, None::<&str>)?;
    let quit = PredefinedMenuItem::quit(app, Some(l.quit))?;

    let file_menu = Submenu::with_items(
        app,
        l.file,
        true,
        &[
            &new_item,
            &open_file,
            &open_folder,
            &PredefinedMenuItem::separator(app)?,
            &save,
            &save_as,
            &PredefinedMenuItem::separator(app)?,
            &export_html,
            &export_pdf,
            &PredefinedMenuItem::separator(app)?,
            &close_tab,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    // === Edit メニュー (PredefinedMenuItem は OS 標準動作) ===
    let undo = PredefinedMenuItem::undo(app, Some(l.undo))?;
    let redo = PredefinedMenuItem::redo(app, Some(l.redo))?;
    let cut = PredefinedMenuItem::cut(app, Some(l.cut))?;
    let copy = PredefinedMenuItem::copy(app, Some(l.copy))?;
    let paste = PredefinedMenuItem::paste(app, Some(l.paste))?;
    let select_all = PredefinedMenuItem::select_all(app, Some(l.select_all))?;
    let find = MenuItem::with_id(app, "find", l.find, true, Some("CmdOrCtrl+F"))?;

    let edit_menu = Submenu::with_items(
        app,
        l.edit,
        true,
        &[
            &undo,
            &redo,
            &PredefinedMenuItem::separator(app)?,
            &cut,
            &copy,
            &paste,
            &select_all,
            &PredefinedMenuItem::separator(app)?,
            &find,
        ],
    )?;

    // === View メニュー ===
    let toggle_sidebar =
        MenuItem::with_id(app, "toggle_sidebar", l.toggle_sidebar, true, None::<&str>)?;
    let edit_mode = MenuItem::with_id(app, "edit_mode", l.edit_mode, true, None::<&str>)?;
    let split_mode = MenuItem::with_id(app, "split_mode", l.split_mode, true, None::<&str>)?;
    let preview_mode = MenuItem::with_id(
        app,
        "preview_mode",
        l.preview_mode,
        true,
        Some("CmdOrCtrl+P"),
    )?;

    let view_menu = Submenu::with_items(
        app,
        l.view,
        true,
        &[
            &toggle_sidebar,
            &PredefinedMenuItem::separator(app)?,
            &edit_mode,
            &split_mode,
            &preview_mode,
        ],
    )?;

    // === Settings メニュー ===
    let preferences = MenuItem::with_id(
        app,
        "preferences",
        l.preferences,
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let settings_menu = Submenu::with_items(app, l.settings, true, &[&preferences])?;

    // === Help メニュー ===
    let about = MenuItem::with_id(app, "about", l.about, true, None::<&str>)?;
    let help_menu = Submenu::with_items(app, l.help, true, &[&about])?;

    Menu::with_items(
        app,
        &[
            &file_menu,
            &edit_menu,
            &view_menu,
            &settings_menu,
            &help_menu,
        ],
    )
}

/// フロントから呼び出してメニューを再構築する。言語切替時に利用
#[tauri::command]
fn set_menu_language(app: AppHandle, lang: String) -> Result<(), String> {
    let menu = build_app_menu(&app, &lang).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

/// 右クリック時にネイティブのコンテキストメニューを表示する。
/// 言語コードを引数で受け取り、トップメニューと同じラベルを使う。
#[tauri::command]
fn show_context_menu(window: tauri::WebviewWindow, lang: String) -> Result<(), String> {
    let app = window.app_handle();
    let l = MenuLabels::for_lang(&lang);

    let undo = PredefinedMenuItem::undo(app, Some(l.undo)).map_err(|e| e.to_string())?;
    let redo = PredefinedMenuItem::redo(app, Some(l.redo)).map_err(|e| e.to_string())?;
    let cut = PredefinedMenuItem::cut(app, Some(l.cut)).map_err(|e| e.to_string())?;
    let copy = PredefinedMenuItem::copy(app, Some(l.copy)).map_err(|e| e.to_string())?;
    let paste = PredefinedMenuItem::paste(app, Some(l.paste)).map_err(|e| e.to_string())?;
    let select_all =
        PredefinedMenuItem::select_all(app, Some(l.select_all)).map_err(|e| e.to_string())?;
    let sep1 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let sep2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;

    let menu = Menu::with_items(
        app,
        &[
            &undo,
            &redo,
            &sep1,
            &cut,
            &copy,
            &paste,
            &sep2,
            &select_all,
        ],
    )
    .map_err(|e| e.to_string())?;

    // カーソル位置に表示 (None で OS 既定)
    window
        .popup_menu(&menu)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// アプリを起動する
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // ウィンドウサイズ・位置の記憶
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // ローカル設定の永続化 (JSON ストア)
        .plugin(tauri_plugin_store::Builder::default().build())
        // ファイル選択ダイアログ
        .plugin(tauri_plugin_dialog::init())
        // 外部 URL をシステムの既定ブラウザで開く (About ダイアログのリンク等)
        .plugin(tauri_plugin_opener::init())
        // ファイルシステム API
        .plugin(tauri_plugin_fs::init())
        // OS 情報 (プラットフォーム判定)
        .plugin(tauri_plugin_os::init())
        // フロントから呼び出せるコマンドを登録
        .invoke_handler(tauri::generate_handler![
            app_info,
            set_menu_language,
            show_context_menu
        ])
        // 起動時にデフォルト英語メニューを構築
        .setup(|app| {
            let menu = build_app_menu(app.handle(), "en")?;
            app.set_menu(menu)?;
            Ok(())
        })
        // ネイティブメニュークリック / アクセラレータ発火時にフロントへイベント転送
        .on_menu_event(|app, event| {
            let id = event.id().0.clone();
            let _ = app.emit("menu-action", id);
        })
        .run(tauri::generate_context!())
        .expect("YomiNote の起動に失敗しました");
}
