use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use serde::Serialize;
use std::time::Duration;
use tauri::{ipc::Channel, Manager, ResourceId, Webview};
#[cfg(desktop)]
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

const MANIFEST: &str = "https://github.com/luckySpro/freemind/releases/latest/download/latest.json";
const ACCELERATOR: &str = "https://gh-proxy.com/";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    id: ResourceId,
    version: String,
    current_version: String,
    notes: Option<String>,
    kind: &'static str,
    download_url: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct Progress {
    downloaded: u64,
    total: Option<u64>,
}

fn trusted_asset(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none()
        && url
            .path()
            .starts_with("/luckySpro/freemind/releases/download/")
        && url.query().is_none()
        && url.fragment().is_none()
}

fn verify_signed_payload(payload: &[u8], signature: &str, pubkey: &str) -> Result<(), String> {
    let decode = |value: &str| -> Result<String, String> {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(value.trim())
            .map_err(|e| e.to_string())?;
        String::from_utf8(bytes).map_err(|e| e.to_string())
    };
    let key = PublicKey::decode(&decode(pubkey)?).map_err(|e| e.to_string())?;
    let signature = Signature::decode(&decode(signature)?).map_err(|e| e.to_string())?;
    key.verify(payload, &signature, true)
        .map_err(|e| e.to_string())
}

async fn signed_manifest(
    webview: &Webview,
    accelerated: bool,
) -> Result<(serde_json::Value, String), String> {
    let endpoint = if accelerated {
        format!("{ACCELERATOR}{MANIFEST}")
    } else {
        MANIFEST.into()
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    let payload = client
        .get(&endpoint)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    if payload.len() > 1024 * 1024 {
        return Err("Update manifest is too large".into());
    }
    let signature = client
        .get(format!("{endpoint}.sig"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let config = &webview.app_handle().config().plugins.0;
    let pubkey = config
        .get("updater")
        .and_then(|value| value.get("pubkey"))
        .and_then(|value| value.as_str())
        .ok_or("Missing updater public key")?;
    verify_signed_payload(&payload, &signature, pubkey)?;
    let authenticated: serde_json::Value =
        serde_json::from_slice(&payload).map_err(|e| e.to_string())?;
    Ok((authenticated, endpoint))
}

#[cfg(desktop)]
async fn check_endpoint(webview: &Webview, accelerated: bool) -> Result<Option<Update>, String> {
    let (authenticated, endpoint) = signed_manifest(webview, accelerated).await?;
    let update = webview
        .updater_builder()
        .endpoints(vec![Url::parse(&endpoint).map_err(|e| e.to_string())?])
        .map_err(|e| e.to_string())?
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(ref update) = update {
        if update.raw_json != authenticated {
            return Err("Update manifest changed after signature verification".into());
        }
    }
    Ok(update)
}

#[cfg(any(target_os = "linux", test))]
fn linux_manual_target(is_appimage: bool) -> Option<&'static str> {
    if is_appimage {
        None
    } else {
        Some("linux-x86_64-deb")
    }
}

#[cfg(desktop)]
#[tauri::command]
pub async fn freemind_check_update(
    webview: Webview,
    accelerated: bool,
) -> Result<Option<UpdateInfo>, String> {
    #[cfg(target_os = "linux")]
    if let Some(target) = linux_manual_target(std::env::var_os("APPIMAGE").is_some()) {
        return check_manual_update(&webview, accelerated, target, ".deb").await;
    }
    // A stale mirror returning no update must not hide a newer official release.
    let update = if accelerated {
        match check_endpoint(&webview, true).await {
            Ok(Some(update)) => Some(update),
            _ => check_endpoint(&webview, false).await?,
        }
    } else {
        check_endpoint(&webview, false).await?
    };
    match update {
        Some(update) => {
            if !trusted_asset(&update.download_url) || update.signature.trim().is_empty() {
                return Err("Update is not a signed FreeMind release".into());
            }
            let info = UpdateInfo {
                version: update.version.clone(),
                current_version: update.current_version.clone(),
                notes: update.body.clone(),
                kind: "desktop",
                download_url: None,
                id: webview.resources_table().add(update),
            };
            Ok(Some(info))
        }
        None => Ok(None),
    }
}

#[cfg(desktop)]
async fn download(update: &Update, progress: &Channel<Progress>) -> Result<Vec<u8>, String> {
    let mut downloaded = 0;
    let _ = progress.send(Progress {
        downloaded,
        total: None,
    });
    // Tauri verifies the full downloaded payload against the bundled public key.
    update
        .download(
            |size, total| {
                downloaded += size as u64;
                let _ = progress.send(Progress { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())
}

#[cfg(desktop)]
#[tauri::command]
pub async fn freemind_install_update(
    webview: Webview,
    id: ResourceId,
    accelerated: bool,
    progress: Channel<Progress>,
) -> Result<(), String> {
    if webview.resources_table().get::<ManualUpdate>(id).is_ok() {
        return open_manual_update(&webview, id, accelerated, &progress).await;
    }
    let resource = webview
        .resources_table()
        .get::<Update>(id)
        .map_err(|e| e.to_string())?;
    let mut official = (*resource).clone();
    if !trusted_asset(&official.download_url) {
        return Err("Update URL is outside the FreeMind release repository".into());
    }
    official.timeout = Some(Duration::from_secs(300));
    let bytes = if accelerated {
        let mut mirror = official.clone();
        mirror.download_url = Url::parse(&format!("{ACCELERATOR}{}", official.download_url))
            .map_err(|e| e.to_string())?;
        mirror.timeout = Some(Duration::from_secs(90));
        match download(&mirror, &progress).await {
            Ok(bytes) => bytes,
            Err(_) => download(&official, &progress).await?,
        }
    } else {
        download(&official, &progress).await?
    };
    official.install(&bytes).map_err(|e| e.to_string())?;
    let _ = webview.resources_table().close(id);
    Ok(())
}

struct ManualUpdate {
    url: Url,
    signature: String,
    version: String,
}
impl tauri::Resource for ManualUpdate {}

#[cfg(mobile)]
#[tauri::command]
pub async fn freemind_check_update(
    webview: Webview,
    accelerated: bool,
) -> Result<Option<UpdateInfo>, String> {
    // Simulator packages have no supported installation/update channel.
    if cfg!(target_os = "ios") || !cfg!(target_arch = "aarch64") {
        return Ok(None);
    }
    check_manual_update(&webview, accelerated, "android-aarch64", ".apk").await
}

#[cfg(any(mobile, target_os = "linux"))]
async fn check_manual_update(
    webview: &Webview,
    accelerated: bool,
    target: &str,
    suffix: &str,
) -> Result<Option<UpdateInfo>, String> {
    let (mut manifest, _) = if accelerated {
        match signed_manifest(&webview, true).await {
            Ok(result) => result,
            Err(_) => signed_manifest(&webview, false).await?,
        }
    } else {
        signed_manifest(&webview, false).await?
    };
    if accelerated {
        let current = &webview.app_handle().package_info().version;
        let mirrored = manifest
            .get("version")
            .and_then(|v| v.as_str())
            .and_then(|v| semver::Version::parse(v.trim_start_matches('v')).ok());
        if mirrored.as_ref().is_some_and(|version| version <= current) {
            // Confirm a mirror's no-update response against the authoritative release.
            manifest = signed_manifest(&webview, false).await?.0;
        }
    }
    let announced = manifest
        .get("version")
        .and_then(|v| v.as_str())
        .ok_or("Missing release version")?;
    let current = webview.app_handle().package_info().version.to_string();
    let version =
        semver::Version::parse(announced.trim_start_matches('v')).map_err(|e| e.to_string())?;
    if version <= webview.app_handle().package_info().version {
        return Ok(None);
    }
    let platform = manifest
        .get("platforms")
        .and_then(|v| v.get(target))
        .ok_or("No update package for this installation")?;
    let url = Url::parse(
        platform
            .get("url")
            .and_then(|v| v.as_str())
            .ok_or("Missing package URL")?,
    )
    .map_err(|e| e.to_string())?;
    if !trusted_asset(&url) || !url.path().ends_with(suffix) {
        return Err("Invalid manual update package URL".into());
    }
    let download_url = Some(url.to_string());
    let signature = platform
        .get("signature")
        .and_then(|v| v.as_str())
        .filter(|v| !v.trim().is_empty())
        .ok_or("Missing package signature")?
        .to_owned();
    let id = webview.resources_table().add(ManualUpdate {
        url,
        signature,
        version: version.to_string(),
    });
    Ok(Some(UpdateInfo {
        id,
        version: version.to_string(),
        current_version: current,
        notes: manifest
            .get("notes")
            .and_then(|v| v.as_str())
            .map(str::to_owned),
        kind: "manual",
        download_url,
    }))
}

#[cfg(mobile)]
#[tauri::command]
pub async fn freemind_install_update(
    webview: Webview,
    id: ResourceId,
    accelerated: bool,
    progress: Channel<Progress>,
) -> Result<(), String> {
    open_manual_update(&webview, id, accelerated, &progress).await
}

async fn open_manual_update(
    webview: &Webview,
    id: ResourceId,
    accelerated: bool,
    progress: &Channel<Progress>,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let release = webview
        .resources_table()
        .get::<ManualUpdate>(id)
        .map_err(|e| e.to_string())?;
    if !trusted_asset(&release.url)
        || !(release.url.path().ends_with(".apk") || release.url.path().ends_with(".deb"))
    {
        return Err("Invalid manual update package URL".into());
    }
    if release.url.path().ends_with(".deb") {
        let config = &webview.app_handle().config().plugins.0;
        let pubkey = config
            .get("updater")
            .and_then(|v| v.get("pubkey"))
            .and_then(|v| v.as_str())
            .ok_or("Missing updater public key")?;
        let _ = progress.send(Progress {
            downloaded: 0,
            total: None,
        });
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|e| e.to_string())?;
        let bytes = if accelerated {
            let mirror = format!("{ACCELERATOR}{}", release.url);
            match download_verified_package(&client, &mirror, &release.signature, pubkey).await {
                Ok(bytes) => bytes,
                Err(_) => {
                    download_verified_package(
                        &client,
                        release.url.as_str(),
                        &release.signature,
                        pubkey,
                    )
                    .await?
                }
            }
        } else {
            download_verified_package(&client, release.url.as_str(), &release.signature, pubkey)
                .await?
        };
        let _ = progress.send(Progress {
            downloaded: bytes.len() as u64,
            total: Some(bytes.len() as u64),
        });
        let folder = webview
            .app_handle()
            .path()
            .app_cache_dir()
            .map_err(|e| e.to_string())?
            .join("updates");
        std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
        let version = semver::Version::parse(&release.version).map_err(|e| e.to_string())?;
        let path = folder.join(format!("FreeMind-{version}.deb"));
        // Only authenticated bytes reach the system package installer.
        std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
        return webview
            .app_handle()
            .opener()
            .open_path(path.to_string_lossy().to_string(), None::<&str>)
            .map_err(|e| e.to_string());
    }
    // Manual APK updates use the official HTTPS URL; Android checks the installed app's signing identity.
    let url = release.url.to_string();
    // Android's system installer verifies the APK against the installed application's keystore certificate.
    webview
        .app_handle()
        .opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

async fn download_verified_package(
    client: &reqwest::Client,
    url: &str,
    signature: &str,
    pubkey: &str,
) -> Result<Vec<u8>, String> {
    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    verify_signed_payload(&bytes, signature, pubkey)?;
    Ok(bytes.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deb_installations_use_manual_package_update_and_appimages_remain_automatic() {
        assert_eq!(linux_manual_target(false), Some("linux-x86_64-deb"));
        assert_eq!(linux_manual_target(true), None);
    }

    #[test]
    fn authenticated_manifest_rejects_tampered_payload_and_signature() {
        // Public test vector from minisign-verify; no private signing key is included.
        let public_key = "untrusted comment: minisign public key E7620F1842B4E81F\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
        let signature = "untrusted comment: signature from minisign secret key\nRWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\ntrusted comment: timestamp:1555779966\tfile:test\nQtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA==";
        let encode = |value: &str| base64::engine::general_purpose::STANDARD.encode(value);
        assert!(verify_signed_payload(b"test", &encode(signature), &encode(public_key)).is_ok());
        assert!(verify_signed_payload(b"Test", &encode(signature), &encode(public_key)).is_err());
        assert!(verify_signed_payload(b"test", "garbage", &encode(public_key)).is_err());
        assert!(verify_signed_payload(b"test", &encode(signature), "garbage").is_err());
    }

    #[test]
    fn only_own_https_release_assets_are_allowed() {
        assert!(trusted_asset(&Url::parse("https://github.com/luckySpro/freemind/releases/download/v0.1.3/FreeMind.app.tar.gz").unwrap()));
        for url in [
            "http://github.com/luckySpro/freemind/releases/download/v1/app.zip",
            "https://github.com/other/freemind/releases/download/v1/app.zip",
            "https://github.com.evil.test/luckySpro/freemind/releases/download/v1/app.zip",
            "https://github.com:444/luckySpro/freemind/releases/download/v1/app.zip",
            "https://user@github.com/luckySpro/freemind/releases/download/v1/app.zip",
            "https://github.com/luckySpro/freemind/releases/download/v1/app.zip?redirect=evil",
        ] {
            assert!(!trusted_asset(&Url::parse(url).unwrap()), "{url}");
        }
    }
}
