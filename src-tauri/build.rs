fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "library_list",
            "library_remove",
            "library_import",
            "library_commit",
            "opened_files",
            "personal_get",
            "personal_set",
            "export_json",
            "smoke_config",
            "smoke_result",
        ]),
    ))
    .expect("Invalid cross-platform host build configuration");
}
