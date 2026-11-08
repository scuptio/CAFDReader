mod commands;
mod lifecycle;
mod protocol;
mod state;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    lifecycle::run();
}
