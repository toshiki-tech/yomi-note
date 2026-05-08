// Windows のリリースビルドでコンソールウィンドウを抑制する
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ライブラリの run 関数を呼び出してアプリを起動する
fn main() {
    yomi_note_lib::run()
}
