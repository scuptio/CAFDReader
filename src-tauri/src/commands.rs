use crate::{
    state::{authorize, locked, Native},
    storage::{self, Book, Result},
};
use serde_json::{json, Value};
use std::io::Write;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

fn import_path(app: &tauri::AppHandle, path: FilePath) -> Result<Book> {
    let name = match &path {
        FilePath::Path(p) => p
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        FilePath::Url(u) => u
            .path_segments()
            .and_then(|mut parts| parts.next_back())
            .unwrap_or("文档.cafd")
            .to_string(),
    };
    let mut options = OpenOptions::new();
    options.read(true);
    let file = app
        .fs()
        .open(path.clone(), options)
        .map_err(|e| e.to_string())?;
    let result = locked(app.state::<Native>().inner())?.import(file, &name);
    #[cfg(target_os = "ios")]
    let _ = app.fs().stop_accessing_security_scoped_resource(path);
    result
}
#[tauri::command]
pub(crate) fn library_list(state: tauri::State<Native>, token: String) -> Result<Vec<Book>> {
    authorize(&state, &token)?;
    locked(&state)?.list()
}
#[tauri::command]
pub(crate) async fn library_import(app: tauri::AppHandle, token: String) -> Result<Option<Book>> {
    authorize(app.state::<Native>().inner(), &token)?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("CAFD 文档（兼容旧 CAF）", &["cafd", "caf"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    let path = rx.await.map_err(|e| e.to_string())?;
    match path {
        None => Ok(None),
        Some(path) => tauri::async_runtime::spawn_blocking(move || import_path(&app, path))
            .await
            .map_err(|e| e.to_string())?
            .map(Some),
    }
}
#[tauri::command]
pub(crate) fn library_commit(
    state: tauri::State<Native>,
    token: String,
    book: Book,
    cover: Option<Vec<u8>>,
) -> Result<Book> {
    authorize(&state, &token)?;
    locked(&state)?.commit(book, cover)
}
#[tauri::command]
pub(crate) async fn opened_files(app: tauri::AppHandle, token: String) -> Result<Vec<Book>> {
    authorize(app.state::<Native>().inner(), &token)?;
    let paths = std::mem::take(
        &mut *app
            .state::<Native>()
            .pending
            .lock()
            .map_err(|e| e.to_string())?,
    );
    tauri::async_runtime::spawn_blocking(move || {
        paths.into_iter().map(|p| import_path(&app, p)).collect()
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub(crate) fn personal_get(
    state: tauri::State<Native>,
    token: String,
    root: String,
    key: String,
) -> Result<Option<Value>> {
    authorize(&state, &token)?;
    locked(&state)?.personal_get(&root, &key)
}
#[tauri::command]
pub(crate) fn personal_set(
    state: tauri::State<Native>,
    token: String,
    root: String,
    key: String,
    value: Value,
) -> Result<()> {
    authorize(&state, &token)?;
    locked(&state)?.personal_set(&root, &key, value)
}
#[tauri::command]
pub(crate) async fn export_json(
    app: tauri::AppHandle,
    token: String,
    filename: String,
    text: String,
) -> Result<bool> {
    authorize(app.state::<Native>().inner(), &token)?;
    if filename.len() > 256
        || !filename.ends_with(".json")
        || filename
            .chars()
            .any(|c| c == '/' || c == '\\' || c.is_control())
        || text.len() > 262144
        || serde_json::from_str::<Value>(&text).is_err()
    {
        return Err("导出内容无效".into());
    }
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON 备份", &["json"])
        .set_file_name(filename)
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let Some(path) = rx.await.map_err(|e| e.to_string())? else {
        return Ok(false);
    };
    let mut options = OpenOptions::new();
    options.write(true).create(true).truncate(true);
    let mut file = app
        .fs()
        .open(path.clone(), options)
        .map_err(|e| e.to_string())?;
    let result = file
        .write_all(text.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string());
    drop(file);
    #[cfg(target_os = "ios")]
    let _ = app.fs().stop_accessing_security_scoped_resource(path);
    result.map(|_| true)
}
#[tauri::command]
pub(crate) fn smoke_config(state: tauri::State<Native>, token: String) -> Result<bool> {
    authorize(&state, &token)?;
    Ok(state.smoke.is_some())
}
#[tauri::command]
pub(crate) fn smoke_result(app: tauri::AppHandle, token: String, result: Value) -> Result<()> {
    let state = app.state::<Native>();
    authorize(&state, &token)?;
    let smoke = state.smoke.as_ref().ok_or("未处于验证模式")?;
    let report = json!({"platform":std::env::consts::OS,"webview":tauri::webview_version().unwrap_or_default(),"book":smoke.book,"result":result});
    storage::atomic_write(
        &smoke.output,
        &serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?,
    )?;
    app.exit(if result["ok"] == true { 0 } else { 1 });
    Ok(())
}
