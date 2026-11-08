use crate::{
    commands,
    state::{Native, Smoke},
    storage::Store,
};
use std::{path::PathBuf, sync::Mutex};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_fs::FilePath;

#[cfg(desktop)]
fn incoming_file(value: &str) -> Option<FilePath> {
    if value.starts_with("file://") {
        let url = url::Url::parse(value).ok()?;
        let path = url.to_file_path().ok()?;
        return path
            .extension()
            .and_then(|e| e.to_str())
            .filter(|e| e.eq_ignore_ascii_case("cafd") || e.eq_ignore_ascii_case("caf"))
            .map(|_| FilePath::Url(url));
    }
    if value.contains("://") {
        return None;
    }
    let path = PathBuf::from(value);
    path.extension()
        .and_then(|e| e.to_str())
        .filter(|e| e.eq_ignore_ascii_case("cafd") || e.eq_ignore_ascii_case("caf"))
        .map(|_| FilePath::Path(path.clone()))
}
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = if std::env::args_os().any(|a| a == "--smoke") {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, args, _| {
            let state = app.state::<Native>();
            if let Ok(mut pending) = state.pending.lock() {
                pending.extend(
                    args.into_iter()
                        .skip(1)
                        .filter_map(|arg| incoming_file(&arg)),
                );
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("window.dispatchEvent(new Event('caf-native-open'))");
                let _ = window.set_focus();
            }
        }))
    };
    let builder=builder.plugin(tauri_plugin_fs::init()).plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("cafbook",|ctx,request|crate::protocol::response(ctx.app_handle(),request,false))
        .register_uri_scheme_protocol("cafcover",|ctx,request|crate::protocol::response(ctx.app_handle(),request,true))
        .invoke_handler(tauri::generate_handler![commands::library_list,commands::library_remove,commands::library_import,commands::library_commit,commands::opened_files,commands::personal_get,commands::personal_set,commands::export_json,commands::smoke_config,commands::smoke_result])
        .setup(|app|{
            let mut pending=Vec::new();let mut smoke=None;let mut data=None;
            #[cfg(desktop)]
            {
                let args:Vec<_>=std::env::args_os().skip(1).collect();
                if let Some(index)=args.iter().position(|a|a=="--smoke") {
                    let book=PathBuf::from(args.get(index+1).ok_or("缺少验证 CAF 路径")?);
                    let output=std::env::var_os("CAF_SMOKE_OUTPUT").ok_or("验证模式需要 CAF_SMOKE_OUTPUT")?;
                    data=Some(PathBuf::from(std::env::var_os("CAF_SMOKE_DATA").ok_or("验证模式需要 CAF_SMOKE_DATA")?));
                    pending.push(FilePath::Path(book.clone()));smoke=Some(Smoke{output:output.into(),book});
                }else{for arg in args {if let Some(file)=incoming_file(&arg.to_string_lossy()){pending.push(file);}}}
            }
            let store=Store::new(data.unwrap_or(app.path().app_data_dir()?)).map_err(std::io::Error::other)?;
            let token=uuid::Uuid::new_v4().to_string();
            app.manage(Native{store:Mutex::new(store),token:token.clone(),pending:Mutex::new(pending),smoke});
            // 令牌只注入可信顶层；书内 iframe 即便看到原生 IPC 也不能调用命令。
            let init=format!("Object.defineProperty(window,'__CAF_NATIVE_SESSION__',{{value:{},writable:false}});",serde_json::to_string(&token)?);
            let window=WebviewWindowBuilder::new(app,"main",WebviewUrl::App("index.html".into()));
            let window=if app.state::<Native>().smoke.is_some(){window.initialization_script_for_all_frames(include_str!("../smoke-probe.js"))}else{window};
            window
                .title("CAFD 阅读器").inner_size(1200.,850.).min_inner_size(320.,480.)
                .disable_drag_drop_handler().initialization_script(init)
                .on_navigation(|url|matches!(url.scheme(),"tauri"|"about") || (matches!(url.scheme(),"http"|"https") && url.host_str()==Some("tauri.localhost")))
                .build()?;
            #[cfg(target_os="linux")]
            if app.state::<Native>().smoke.is_some() {
                use webkit2gtk::{SettingsExt,WebViewExt};
                app.get_webview_window("main").unwrap().with_webview(|w|{if let Some(settings)=w.inner().settings(){settings.set_enable_write_console_messages_to_stdout(true);}})?;
            }
            Ok(())
        });
    let app = builder
        .build(tauri::generate_context!())
        .expect("无法启动 CAFD 阅读器");
    app.run(|app, event| {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = event {
            let state = app.state::<Native>();
            if let Ok(mut pending) = state.pending.lock() {
                pending.extend(
                    urls.into_iter()
                        .filter(|u| matches!(u.scheme(), "file" | "content"))
                        .map(FilePath::Url),
                );
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("window.dispatchEvent(new Event('caf-native-open'))");
            }
        }
        #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
        let _ = (app, event);
    });
}

#[cfg(all(test, desktop))]
mod native_tests {
    use super::*;
    #[test]
    fn launcher_paths_and_file_urls_are_supported() {
        assert!(matches!(incoming_file("/tmp/文档.CAFD"),Some(FilePath::Path(_))));
        assert!(matches!(
            incoming_file("/tmp/电子书.CAF"),
            Some(FilePath::Path(_))
        ));
        assert!(matches!(
            incoming_file(
                url::Url::from_file_path(std::env::temp_dir().join("book one.cafd"))
                    .unwrap()
                    .as_str()
            ),
            Some(FilePath::Url(_))
        ));
        assert!(incoming_file("https://example.com/book.cafd").is_none());
        assert!(incoming_file("--other").is_none());
    }
}
