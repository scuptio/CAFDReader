use crate::storage::{Result, Store};
use std::{path::PathBuf, sync::Mutex};
use tauri_plugin_fs::FilePath;

pub(crate) struct Native {
    pub(crate) store: Mutex<Store>,
    pub(crate) token: String,
    pub(crate) pending: Mutex<Vec<FilePath>>,
    pub(crate) smoke: Option<Smoke>,
}
pub(crate) struct Smoke {
    pub(crate) output: PathBuf,
    pub(crate) book: PathBuf,
}
pub(crate) fn authorize(state: &Native, token: &str) -> Result<()> {
    if state.token == token {
        Ok(())
    } else {
        Err("原生宿主权限拒绝".into())
    }
}
pub(crate) fn locked(state: &Native) -> Result<std::sync::MutexGuard<'_, Store>> {
    state.store.lock().map_err(|_| "书架忙，请重试".into())
}
