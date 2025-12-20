#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::{Path, PathBuf};
use tauri::Manager;
use serde::{Deserialize, Serialize};

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

fn signatures_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir introuvable: {e}"))?;
    Ok(dir.join("signatures.json"))
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
    std::fs::write(&target, bytes).map_err(|e| format!("ecriture impossible: {e}"))?;
    Ok(target.to_string_lossy().to_string())
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_pdf_to_downloads,
            load_signatures,
            save_signatures,
            load_snippets,
            save_snippets,
            save_pdf_to_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
