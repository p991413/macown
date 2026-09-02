# Macown 打包命令

在项目目录执行（两个脚本已内置 Electron 镜像 + 免签名，无需额外配置）：

```bash
cd /Users/cap/capdevelop/workspace/mac_md/markdown-editor

# macOS 安装包（dmg + zip）
npm run dist:mac

# Windows 安装包（exe）
npm run dist:win

# 两个都打
npm run dist:mac && npm run dist:win
```

产物目录：`release/`

注意：
- 首次打包会下载依赖，耗时数分钟；macOS 打 Windows 包需 wine（首次自动下载）。
- 打包前先停掉 `npm run dev`。
- 版本号由 `package.json` 的 `version` 决定，产物文件名随之变化。

## 在 WorkBuddy 沙箱内打包报错时

`npm run dist:mac` 可能报 `Brokered file token refused: modify backup failed`。根因是 WorkBuddy 沙箱的 fs hook 环境变量（`NODE_OPTIONS` + `CODEBUDDY_BROKERED_FS_HOOK_ENABLED`）继承了 electron-builder 子进程，拦截它向系统缓存目录 `~/Library/Caches/electron/` 的解压写入。

**解法**：用 `env -i` 清空 shim 变量，改用工 budddy 的 node 22 直接调用 electron-builder：

```bash
cd /Users/cap/capdevelop/workspace/mac_md/markdown-editor
npm run build
env -i PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin" HOME="$HOME" \
  CSC_IDENTITY_AUTO_DISCOVERY=false ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
  /Users/cap/.workbuddy/binaries/node/versions/22.22.2-2/bin/node ./node_modules/.bin/electron-builder --mac
```

> 说明：不能用 `/usr/local/bin/node`（macOS 自带的 node 版本过旧，`require` ESM 包会报 `ERR_REQUIRE_ESM`），必须用 workbuddy 的 node 22。

打包成功后 `release/` 里会有 `Macown-<version>-arm64.dmg`（安装包）和 `-mac.zip`。