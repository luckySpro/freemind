mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            updater::freemind_check_update,
            updater::freemind_install_update
        ]);
    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        updater::freemind_check_update,
        updater::freemind_install_update
    ]);
    builder
        .run(tauri::generate_context!())
        .expect("Failed to start FreeMind");
}
