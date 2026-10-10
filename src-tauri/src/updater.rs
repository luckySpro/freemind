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

fn verify_manifest(payload: &[u8], signature: &str, pubkey: &str) -> Result<(), String> {
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
    verify_manifest(&payload, &signature, pubkey)?;
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

#[cfg(desktop)]
#[tauri::command]
pub async fn freemind_check_update(
    webview: Webview,
    accelerated: bool,
) -> Result<Option<UpdateInfo>, String> {
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

#[cfg(mobile)]
struct ManualUpdate {
    url: Url,
}
#[cfg(mobile)]
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
        .and_then(|v| v.get("android-aarch64"))
        .ok_or("No Android update package")?;
    let url = Url::parse(
        platform
            .get("url")
            .and_then(|v| v.as_str())
            .ok_or("Missing Android package URL")?,
    )
    .map_err(|e| e.to_string())?;
    if !trusted_asset(&url) || !url.path().ends_with(".apk") {
        return Err("Invalid Android release URL".into());
    }
    let download_url = Some(url.to_string());
    let id = webview.resources_table().add(ManualUpdate { url });
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
    use tauri_plugin_opener::OpenerExt;
    let release = webview
        .resources_table()
        .get::<ManualUpdate>(id)
        .map_err(|e| e.to_string())?;
    if !trusted_asset(&release.url) || !release.url.path().ends_with(".apk") {
        return Err("Invalid Android release URL".into());
    }
    let _ = progress;
    let url = if accelerated {
        format!("{ACCELERATOR}{}", release.url)
    } else {
        release.url.to_string()
    };
    // Android's system installer verifies the APK against the installed application's keystore certificate.
    webview
        .app_handle()
        .opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authenticated_manifest_rejects_tampered_payload_and_signature() {
        // Public test vector from minisign-verify; no private signing key is included.
        let public_key = "untrusted comment: minisign public key E7620F1842B4E81F\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3";
        let signature = "untrusted comment: signature from minisign secret key\nRWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\ntrusted comment: timestamp:1555779966\tfile:test\nQtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA==";
        let encode = |value: &str| base64::engine::general_purpose::STANDARD.encode(value);
        assert!(verify_manifest(b"test", &encode(signature), &encode(public_key)).is_ok());
        assert!(verify_manifest(b"Test", &encode(signature), &encode(public_key)).is_err());
        assert!(verify_manifest(b"test", "garbage", &encode(public_key)).is_err());
        assert!(verify_manifest(b"test", &encode(signature), "garbage").is_err());
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
