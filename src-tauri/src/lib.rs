mod commands;
mod db;
mod models;
mod providers;

use models::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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

            #[cfg(target_os = "macos")]
            if let Some(ref window) = app.get_webview_window("main") {
                if let Ok(icon) = tauri::image::Image::from_bytes(
                    include_bytes!("../icons/128x128.png"),
                ) {
                    let _ = window.set_icon(icon);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::get_all_tasks,
            commands::tasks::get_tasks,
            commands::tasks::get_tasks_by_date,
            commands::tasks::get_tasks_by_date_range,
            commands::tasks::get_overdue_tasks,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::toggle_task,
            commands::tasks::delete_task,
            commands::tasks::clear_all_tasks,
            commands::tasks::clear_today_tasks,
            commands::tasks::reorder_tasks,
            commands::tasks::get_all_tags,
            commands::tasks::set_task_tags,
            commands::tasks::set_micro_steps,
            commands::tasks::toggle_micro_step,
            commands::tasks::get_streak,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::reviews::get_strategy_reviews,
            commands::reviews::get_strategy_periods,
            commands::reviews::create_strategy_period,
            commands::reviews::update_strategy_period,
            commands::reviews::close_strategy_period,
            commands::reviews::reopen_strategy_period,
            commands::reviews::upsert_period_reflection,
            commands::reviews::carry_over_goals,
            commands::reviews::get_strategy_goals,
            commands::reviews::upsert_strategy_goal,
            commands::reviews::delete_strategy_goal,
            commands::reviews::upsert_strategy,
            commands::reviews::delete_strategy,
            commands::reviews::get_goal_strategy_links,
            commands::reviews::toggle_goal_strategy_link,
            commands::reviews::upsert_tactic,
            commands::reviews::delete_tactic,
            commands::reviews::upsert_action,
            commands::reviews::delete_action,
            commands::reviews::toggle_action,
            commands::reviews::get_period_summary,
            commands::chat::get_chat_messages,
            commands::chat::clear_chat,
            commands::integrations::get_integrations,
            commands::integrations::update_integration_connection,
            commands::integrations::update_integration_context,
            commands::integrations::get_oauth_credentials,
            commands::integrations::set_oauth_credentials,
            commands::integrations::start_oauth,
            commands::integrations::disconnect_integration,
            commands::integrations::fetch_calendar_events,
            commands::integrations::fetch_emails,
            commands::profile::get_profile,
            commands::profile::update_profile,
            commands::notifications::get_notification_history,
            commands::notifications::add_notification_entry,
            commands::notifications::mark_notification_read,
            commands::notifications::mark_all_notifications_read,
            commands::notifications::set_badge_count,
            commands::notifications::send_clickable_notification,
            commands::ai::validate_api_key,
            commands::ai::send_message,
            commands::ai::decompose_task,
            commands::ai::generate_suggestions,
            commands::ai::send_daily_prep_message,
            commands::ai::send_weekly_prep_message,
            commands::ai::send_period_prep_message,
            commands::ai::send_onboarding_message,
            commands::ai::analyze_profile_url,
            commands::memory::get_memory_insights,
            commands::memory::delete_memory_insight,
            commands::memory::check_and_run_analysis,
            commands::memory::run_analysis_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
