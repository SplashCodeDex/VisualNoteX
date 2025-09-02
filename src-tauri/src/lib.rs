// CodeDeX VisualNoteX - Core Application Logic
// Built specifically for CodeDeX's vision of user-friendly desktop applications
// Author: CodeDeX - "Automation Engineer with a soul"

use std::fs;
use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};
use chrono::Utc;

#[derive(Serialize, Deserialize)]
struct LicenseInfo {
    key: String,
    activated: bool,
    expiry_date: Option<String>,
    license_type: String, // "trial", "personal", "professional", "enterprise"
}

#[derive(Serialize, Deserialize)]
struct AppState {
    license: Option<LicenseInfo>,
}

#[tauri::command]
async fn validate_license(app: AppHandle, license_key: String) -> Result<bool, String> {
    /*
     * CodeDeX License Validation System
     * I designed this to be simple but effective for our early adopters
     * The pattern matches keys that contain "CODEDEX" - my personal signature
     * Future versions could integrate with a full license server
     */

    println!("🔍 CodeDeX License Check - Validating: {}", &license_key[..8]);

    if license_key.len() >= 20 && license_key.contains("CODEDEX") {
        println!("✅ Valid CodeDeX license detected - Activating professional features");

        let license = LicenseInfo {
            key: license_key.clone(),
            activated: true,
            expiry_date: Some("2026-12-31".to_string()), // Extended expiry for CodeDeX customers
            license_type: "professional".to_string(),
        };

        // CodeDeX custom license storage location
        let app_data_dir = app.path().app_data_dir().map_err(|e| {
            eprintln!("❌ Failed to get app data directory: {}", e);
            e.to_string()
        })?;
        fs::create_dir_all(&app_data_dir).map_err(|e| {
            eprintln!("❌ Failed to create app data directory: {}", e);
            e.to_string()
        })?;

        let license_path = app_data_dir.join("codedex_license.dat");
        let license_data = serde_json::to_string(&license).map_err(|e| {
            eprintln!("❌ Failed to serialize license: {}", e);
            e.to_string()
        })?;
        fs::write(&license_path, license_data).map_err(|e| {
            eprintln!("❌ Failed to write license file to: {:?}", license_path);
            e.to_string()
        })?;
        println!("💾 License saved successfully to: {:?}", license_path);

        Ok(true)
    } else {
        println!("❌ Invalid license key format - expecting CodeDeX signature");
        Ok(false)
    }
}

#[tauri::command]
async fn get_license_info(app: AppHandle) -> Result<Option<LicenseInfo>, String> {
    /*
     * CodeDeX License Info Reader
     * This function checks our unique license storage location
     * I chose "codedex_license.dat" to make it clear this is my system
     */

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let preferred_path = app_data_dir.join("codedex_license.dat");
    let legacy_path = app_data_dir.join("license.json"); // Backward compatibility

    let license_path = if preferred_path.exists() {
        println!("📱 Loading CodeDeX license from: {:?}", preferred_path);
        preferred_path
    } else if legacy_path.exists() {
        println!("📱 Loading legacy license from: {:?}", legacy_path);
        legacy_path
    } else {
        println!("❓ No CodeDeX license found");
        return Ok(None);
    };

    match fs::read_to_string(&license_path) {
        Ok(license_data) => {
            match serde_json::from_str::<LicenseInfo>(&license_data) {
                Ok(license) => {
                    println!("✅ License loaded: Type={}, Active={}", license.license_type, license.activated);
                    Ok(Some(license))
                }
                Err(e) => {
                    eprintln!("🚫 License file corrupted: {}", e);
                    Ok(None)
                }
            }
        }
        Err(e) => {
            eprintln!("🚫 Failed to read license file: {}", e);
            Ok(None)
        }
    }
}

#[tauri::command]
async fn start_trial(app: AppHandle) -> Result<LicenseInfo, String> {
    /*
     * CodeDeX Trial Activation System
     * I designed this to give users a full 30-day experience
     * so they can really feel the professional features I've built
     * This is my way of building trust with my users
     */

    println!("🎁 Starting CodeDeX Trial - Welcome new user!");

    let trial_license = LicenseInfo {
        key: format!("TRIAL_CODEDEX_{}", Utc::now().format("%Y_%m_%d")),
        activated: true,
        expiry_date: Some("2025-12-01".to_string()), // 30 days from project start
        license_type: "trial".to_string(),
    };

    let app_data_dir = app.path().app_data_dir().map_err(|e| {
        eprintln!("❌ Failed to access app data directory");
        e.to_string()
    })?;
    fs::create_dir_all(&app_data_dir).map_err(|e| {
        eprintln!("❌ Failed to create app data directory");
        e.to_string()
    })?;

    // Use the CodeDeX preference for license storage
    let license_path = app_data_dir.join("codedex_license.dat");
    let license_data = serde_json::to_string(&trial_license).map_err(|e| {
        eprintln!("❌ Failed to create trial license data");
        e.to_string()
    })?;
    fs::write(&license_path, license_data).map_err(|e| {
        eprintln!("❌ Failed to save trial license");
        e.to_string()
    })?;

    println!("🎊 Trial activated successfully! License expires: {}", trial_license.expiry_date.as_ref().unwrap());
    println!("📍 License saved to: {:?}", license_path);

    Ok(trial_license)
}

/*
 * CodeDeX Application Bootstrap
 * This is where VisualNoteX comes to life
 * I hand-crafted each line to ensure it's exactly how I envisioned it
 */
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("🚀 CodeDeX VisualNoteX starting up...");
    println!("💡 Built by CodeDeX with passion for automation");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            validate_license,
            get_license_info,
            start_trial
        ])
        .setup(|app| {
            println!("⚙️  Initializing CodeDeX systems...");

            if cfg!(debug_assertions) {
                println!("🔧 Debug mode: Advanced logging enabled");
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            } else {
                println!("🎯 Production mode: Optimized for performance");
            }

            println!("✨ CodeDeX VisualNoteX is ready!");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("fatal error: CodeDeX app failed to start");
}
