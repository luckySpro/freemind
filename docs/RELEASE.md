# 桌面发布与升级

组织：**M&J Group** · mail:473276@qq.com

`.github/workflows/release.yml` 在版本标签 `vX.Y.Z` 或手动运行时执行完整质量门禁，随后构建 macOS Apple Silicon、macOS Intel、Windows x64 和 Linux x64。所有桌面、Android 和 iOS 模拟器构建均成功、对应签名齐全后才发布 GitHub Release；失败时保留草稿，当前正式版本继续可用。

安装文件包括 macOS DMG、Windows EXE / MSI、Linux AppImage / DEB。macOS `.app.tar.gz`、Windows EXE、Linux AppImage 用作自动升级包。Linux DEB 的升级应通过系统包管理器重新安装，自动替换只适用于 AppImage 安装。

## 一次性配置

1. 使用 `pnpm tauri signer generate -w <仓库外的安全路径>` 生成签名密钥。私钥不要提交，丢失后旧客户端将无法验证新更新。
2. 将公钥内容填入 Tauri 配置 `plugins.updater.pubkey`。
3. 将私钥内容保存在 GitHub 仓库 Actions secret `TAURI_SIGNING_PRIVATE_KEY`；有密码时同时设置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
4. `bundle.createUpdaterArtifacts` 必须为 `true`。Actions 的工作流令牌需要 `contents: write` 权限。

升级签名与 Apple Developer / Windows Authenticode 的操作系统发行证书不同。本工作流签署更新包，但未配置系统发行证书，首次安装可能出现系统安全提示。

## 发布新版

同步修改 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 中的版本及 Cargo lock；运行 `pnpm gate`，提交并推送对应 `vX.Y.Z` 标签。不要覆盖已发布版本，修复应增加版本号。手动运行工作流也会使用当前应用版本，并拒绝覆盖正式 Release。

最终 `latest.json` 由同一个升级私钥生成 `latest.json.sig`，客户端在实施强制升级前验证目录签名。`SHA256SUMS` 为所有发行文件提供校验值。

`latest.json` 包含全部桌面平台、固定版本下载链接、签名及 `minSupportedVersion`（当前发布版本）。最新正式 Release 是统一升级入口。所有平台完成后一次生成目录，避免并行构建覆盖目录而丢失其他平台。

## 手机构建与签名

Android ARM64 APK 在 Actions 中初始化原生工程并构建，用固定发行密钥签署，方便以后直接覆盖安装。额外设置 `ANDROID_KEYSTORE_BASE64`（仓库外 keystore 的 base64 内容）、`ANDROID_KEYSTORE_PASSWORD`（store / key 同密码）及 `ANDROID_KEY_ALIAS`。私钥必须长期保存，更换密钥将无法直接更新旧安装。自动升级插件仅用于桌面；Android 通过新 APK 安装更新。

iOS 在完整 Xcode runner 中生成 ARM64 模拟器 `.app` ZIP，适合开发测试，无法在 iPhone 真机安装。发布流程不会把这个文件标成 IPA。要发行真机版仍需 Apple Developer 身份、证书及 provisioning profile，以及 App Store / TestFlight 或明确的设备分发范围。

## 手机版本边界

Android / iOS 原生工程由 CI 通过 Tauri CLI 初始化，生成目录不提交。手机触屏和文件导出需要真机验证；编译成功与桌面功能完全一致不是同一结论。当前 iOS 交付只包括模拟器测试包，真机发行在获得 Apple 开发者签名后才能完成。

参考：[Tauri Action](https://github.com/tauri-apps/tauri-action)、[Tauri Updater](https://v2.tauri.app/plugin/updater/)。
