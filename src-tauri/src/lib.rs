mod commands;
mod db;
mod models;

use models::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let db_path = data_dir.join("focal.db");
            let mut conn = rusqlite::Connection::open(&db_path)?;
            conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
            db::create_schema(&conn)?;
            db::seed_if_empty(&mut conn)?;
            app.manage(AppState {
                db: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::get_tasks,
            commands::tasks::get_tasks_by_date,
            commands::tasks::get_tasks_by_date_range,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::toggle_task,
            commands::tasks::delete_task,
            commands::tasks::reorder_tasks,
            commands::tasks::set_micro_steps,
            commands::tasks::toggle_micro_step,
            commands::todos::get_todos,
            commands::todos::create_todo,
            commands::todos::update_todo,
            commands::todos::toggle_todo,
            commands::todos::delete_todo,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::reviews::get_strategy_reviews,
            commands::chat::get_chat_messages,
            commands::chat::add_chat_message,
            commands::integrations::get_integrations,
            commands::integrations::update_integration_connection,
            commands::integrations::update_integration_context,
            commands::profile::get_profile,
            commands::profile::update_profile,
            commands::notifications::get_notification_history,
            commands::notifications::add_notification_entry,
            commands::notifications::mark_notification_read,
            commands::notifications::mark_all_notifications_read,
            commands::ai::send_message,
            commands::ai::decompose_task,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
