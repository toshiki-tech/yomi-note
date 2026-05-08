import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Vite の設定: Tauri 用に固定ポートと HMR を構成
// Tauri が起動するときに dev server をこのポートで開く
var host = process.env.TAURI_DEV_HOST;
export default defineConfig({
    plugins: [react()],
    // Tauri から見える dev server の設定
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host: host,
                port: 1421,
            }
            : undefined,
        watch: {
            // src-tauri ディレクトリ配下の変更は無視
            ignored: ["**/src-tauri/**"],
        },
    },
    // 環境変数のプレフィックス
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    build: {
        // Tauri がサポートするブラウザに合わせる
        target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
        minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
});
