use crate::{
    state::{authorize, locked, Native},
    storage::{self, Result},
};
use std::fs;
use tauri::Manager;

pub(crate) fn response(
    app: &tauri::AppHandle,
    request: tauri::http::Request<Vec<u8>>,
    cover: bool,
) -> tauri::http::Response<Vec<u8>> {
    use tauri::http::{Response, StatusCode};
    let build = || -> Result<_> {
        let url = url::Url::parse(&request.uri().to_string()).map_err(|e| e.to_string())?;
        let state = app.state::<Native>();
        let token = url
            .query_pairs()
            .find(|(k, _)| k == "token")
            .map(|(_, v)| v.into_owned())
            .ok_or("缺少会话权限")?;
        authorize(&state, &token)?;
        if request.method() != "GET" && request.method() != "HEAD" && request.method() != "OPTIONS"
        {
            return Err("读取方法无效".into());
        }
        let id = url.path().trim_start_matches('/');
        let path = if cover {
            locked(&state)?.cover_path(id)?
        } else {
            locked(&state)?.book_path(id)?
        };
        let length = fs::metadata(&path).map_err(|e| e.to_string())?.len();
        let range = match storage::byte_range(
            request.headers().get("Range").and_then(|s| s.to_str().ok()),
            length,
        ) {
            Ok(range) => range,
            Err(_) => {
                return Ok(Response::builder()
                    .status(StatusCode::RANGE_NOT_SATISFIABLE)
                    .header("Content-Range", format!("bytes */{length}"))
                    .header("Access-Control-Allow-Origin", origin(&request))
                    .body(Vec::new())
                    .unwrap())
            }
        };
        let mut builder = Response::builder()
            .status(if range.is_some() { 206 } else { 200 })
            .header(
                "Content-Type",
                if cover {
                    "image/jpeg"
                } else {
                    "application/octet-stream"
                },
            )
            .header("Accept-Ranges", "bytes")
            .header("Access-Control-Allow-Origin", origin(&request))
            .header("Access-Control-Allow-Headers", "Range")
            .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
            .header(
                "Access-Control-Expose-Headers",
                "Content-Range, Content-Length, Accept-Ranges",
            )
            .header("Cache-Control", "no-store");
        if let Some((a, b)) = range {
            builder = builder
                .header("Content-Range", format!("bytes {a}-{b}/{length}"))
                .header("Content-Length", b - a + 1);
        } else {
            builder = builder.header("Content-Length", length);
        }
        let bytes = if request.method() == "HEAD" || request.method() == "OPTIONS" {
            Vec::new()
        } else {
            storage::read_bytes(&path, range)?
        };
        builder.body(bytes).map_err(|e| e.to_string())
    };
    build().unwrap_or_else(|_| {
        Response::builder()
            .status(403)
            .body(b"CAF resource denied".to_vec())
            .unwrap()
    })
}
fn origin(request: &tauri::http::Request<Vec<u8>>) -> &str {
    match request
        .headers()
        .get("Origin")
        .and_then(|v| v.to_str().ok())
    {
        Some("http://tauri.localhost") => "http://tauri.localhost",
        Some("https://tauri.localhost") => "https://tauri.localhost",
        _ => "tauri://localhost",
    }
}
