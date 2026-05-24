#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredSignature {
    id: String,
    name: String,
    mime: String,
    bytes: Vec<u8>,
    natural_w: u32,
    natural_h: u32,
}


#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadedPdf {
    bytes: Vec<u8>,
    name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenPdfPayload {
    path: String,
}

#[derive(Default)]
struct PendingOpen(Mutex<Vec<PathBuf>>);

fn signatures_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir introuvable: {e}"))?;
    Ok(dir.join("signatures.json"))
}

fn paraphs_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir introuvable: {e}"))?;
    Ok(dir.join("paraphs.json"))
}

fn templates_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir introuvable: {e}"))?;
    Ok(dir.join("templates.json"))
}

fn snippets_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir introuvable: {e}"))?;
    Ok(dir.join("snippets.json"))
}

#[tauri::command]
fn save_pdf_to_downloads(app: tauri::AppHandle, bytes: Vec<u8>, file_name: String) -> Result<String, String> {
    let downloads_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("download dir introuvable: {e}"))?;

    let base_name = sanitize_file_name(&file_name);
    let target_path = next_available_path(downloads_dir, &base_name);

    std::fs::write(&target_path, bytes)
        .map_err(|e| format!("ecriture impossible: {e}"))?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_signatures(app: tauri::AppHandle) -> Result<Vec<StoredSignature>, String> {
    let path = signatures_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("lecture impossible: {e}"))?;
    let signatures = serde_json::from_slice(&bytes).map_err(|e| format!("json invalide: {e}"))?;
    Ok(signatures)
}

#[tauri::command]
fn save_signatures(app: tauri::AppHandle, signatures: Vec<StoredSignature>) -> Result<(), String> {
    let path = signatures_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("creation dossier impossible: {e}"))?;
    }

    let bytes = serde_json::to_vec(&signatures).map_err(|e| format!("json invalide: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("ecriture impossible: {e}"))?;
    Ok(())
}

#[tauri::command]
fn load_paraphs(app: tauri::AppHandle) -> Result<Vec<StoredSignature>, String> {
    let path = paraphs_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("lecture impossible: {e}"))?;
    let paraphs = serde_json::from_slice(&bytes).map_err(|e| format!("json invalide: {e}"))?;
    Ok(paraphs)
}

#[tauri::command]
fn save_paraphs(app: tauri::AppHandle, paraphs: Vec<StoredSignature>) -> Result<(), String> {
    let path = paraphs_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("creation dossier impossible: {e}"))?;
    }

    let bytes = serde_json::to_vec(&paraphs).map_err(|e| format!("json invalide: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("ecriture impossible: {e}"))?;
    Ok(())
}

/// Templates contain nested items / paraph whose shape changes as
/// the frontend gains item types. Persisting them as opaque JSON
/// values means the Rust side never needs to mirror that schema —
/// the frontend remains the single source of truth for the contract.
#[tauri::command]
fn load_templates(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let path = templates_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("lecture impossible: {e}"))?;
    let templates = serde_json::from_slice(&bytes).map_err(|e| format!("json invalide: {e}"))?;
    Ok(templates)
}

#[tauri::command]
fn save_templates(app: tauri::AppHandle, templates: Vec<serde_json::Value>) -> Result<(), String> {
    let path = templates_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("creation dossier impossible: {e}"))?;
    }

    let bytes = serde_json::to_vec(&templates).map_err(|e| format!("json invalide: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("ecriture impossible: {e}"))?;
    Ok(())
}

#[tauri::command]
fn load_snippets(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = snippets_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("lecture impossible: {e}"))?;
    let snippets = serde_json::from_slice(&bytes).map_err(|e| format!("json invalide: {e}"))?;
    Ok(snippets)
}

#[tauri::command]
fn save_snippets(app: tauri::AppHandle, snippets: Vec<String>) -> Result<(), String> {
    let path = snippets_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("creation dossier impossible: {e}"))?;
    }

    let bytes = serde_json::to_vec(&snippets).map_err(|e| format!("json invalide: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("ecriture impossible: {e}"))?;
    Ok(())
}

#[tauri::command]
fn save_pdf_to_path(bytes: Vec<u8>, path: String) -> Result<String, String> {
    let target = PathBuf::from(path);
    // Defense in depth : the frontend always feeds this command a
    // path obtained via the OS save dialog, but we still refuse
    // anything that does not look like a PDF target so a compromised
    // renderer cannot use this command to overwrite arbitrary files.
    if !is_pdf_path(&target) {
        return Err("destination invalide: extension .pdf attendue".into());
    }
    std::fs::write(&target, bytes).map_err(|e| format!("ecriture impossible: {e}"))?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn load_pdf_from_path(path: String) -> Result<LoadedPdf, String> {
    let target = PathBuf::from(&path);
    let bytes = std::fs::read(&target).map_err(|e| format!("lecture impossible: {e}"))?;
    let name = target
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document.pdf")
        .to_string();
    Ok(LoadedPdf { bytes, name })
}

#[tauri::command]
fn take_pending_open_paths(state: tauri::State<PendingOpen>) -> Vec<String> {
    let mut guard = state.0.lock().unwrap();
    let pending = std::mem::take(&mut *guard);
    pending
        .into_iter()
        .filter(|path| is_pdf_path(path) && path.exists())
        .filter_map(|path| path.to_str().map(|value| value.to_string()))
        .collect()
}

fn sanitize_file_name(name: &str) -> String {
    let raw = Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document-signed.pdf");

    if raw.to_lowercase().ends_with(".pdf") {
        raw.to_string()
    } else {
        format!("{raw}.pdf")
    }
}

fn next_available_path(dir: PathBuf, file_name: &str) -> PathBuf {
    let initial = dir.join(file_name);
    if !initial.exists() {
        return initial;
    }

    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document-signed");
    let ext = Path::new(file_name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("pdf");

    for idx in 1..1000 {
        let candidate = dir.join(format!("{stem} ({idx}).{ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    dir.join(format!("{stem}-export.{ext}"))
}

fn is_pdf_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

fn normalize_open_path(path: PathBuf) -> PathBuf {
    if path.exists() {
        return path;
    }

    let raw = match path.to_str() {
        Some(raw) => raw,
        None => return path,
    };

    if let Ok(url) = Url::parse(raw) {
        if url.scheme() == "file" {
            if let Ok(file_path) = url.to_file_path() {
                return file_path;
            }
        }
    }

    path
}

fn emit_open_pdf(app: &tauri::AppHandle, path: PathBuf) {
    let path = normalize_open_path(path);
    if !is_pdf_path(&path) || !path.exists() {
        return;
    }

    if let Ok(mut guard) = app.state::<PendingOpen>().0.lock() {
        guard.push(path.clone());
    }

    let path = match path.to_str() {
        Some(path) => path.to_string(),
        None => return,
    };

    if let Err(err) = app.emit("open-pdf", OpenPdfPayload { path }) {
        eprintln!("emit open-pdf failed: {err}");
    }
}

/// Build the application's native menu bar. Same structure on every
/// platform (File / Edit / View / Help) ; on macOS it surfaces in the
/// system menu bar, on Windows/Linux as an in-window menu.
///
/// Menu clicks emit a single `"menu"` Tauri event whose payload is the
/// item id (e.g. "open_pdf") — the frontend listens once and dispatches.
fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Menu<R>, tauri::Error> {
    let file = Submenu::with_items(app, "File", true, &[
        &MenuItem::with_id(app, "open_pdf", "Open PDF…", true, Some("CmdOrCtrl+O"))?,
        &MenuItem::with_id(app, "export_pdf", "Export PDF…", true, Some("CmdOrCtrl+S"))?,
        &MenuItem::with_id(app, "print_pdf", "Print", true, Some("CmdOrCtrl+P"))?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "templates", "Templates…", true, Some("CmdOrCtrl+T"))?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::quit(app, None)?,
    ])?;

    let edit = Submenu::with_items(app, "Edit", true, &[
        &MenuItem::with_id(app, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?,
        &MenuItem::with_id(app, "clear_all", "Clear all annotations", true, None::<&str>)?,
    ])?;

    let view = Submenu::with_items(app, "View", true, &[
        &MenuItem::with_id(app, "zoom_in", "Zoom in", true, Some("CmdOrCtrl+Equal"))?,
        &MenuItem::with_id(app, "zoom_out", "Zoom out", true, Some("CmdOrCtrl+Minus"))?,
        &MenuItem::with_id(app, "zoom_reset", "Reset zoom", true, Some("CmdOrCtrl+0"))?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "theme_light", "Light theme", true, None::<&str>)?,
        &MenuItem::with_id(app, "theme_dark", "Dark theme", true, None::<&str>)?,
    ])?;

    let help = Submenu::with_items(app, "Help", true, &[
        &MenuItem::with_id(app, "about", "About SignStamp", true, None::<&str>)?,
        &MenuItem::with_id(app, "github", "GitHub", true, None::<&str>)?,
    ])?;

    Menu::with_items(app, &[&file, &edit, &view, &help])
}

fn main() {
    let mut initial_paths: Vec<PathBuf> = std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .collect();

    let app = tauri::Builder::default()
        .manage(PendingOpen::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .menu(|app| build_app_menu(app))
        .on_menu_event(|app, event| {
            let action = event.id().as_ref().to_string();
            if let Err(err) = app.emit("menu", action) {
                eprintln!("emit menu event failed: {err}");
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_pdf_to_downloads,
            load_signatures,
            save_signatures,
            load_paraphs,
            save_paraphs,
            load_templates,
            save_templates,
            load_snippets,
            save_snippets,
            save_pdf_to_path,
            load_pdf_from_path,
            take_pending_open_paths
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| match event {
        tauri::RunEvent::Ready => {
            for path in initial_paths.drain(..) {
                emit_open_pdf(app_handle, path);
            }
        }
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        tauri::RunEvent::Opened { urls } => {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    emit_open_pdf(app_handle, path);
                }
            }
        }
        _ => {}
    });
}
