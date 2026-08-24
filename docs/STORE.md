# Microsoft Store 上架指南

SuperMarkdown 采用「**微软商店免费上架 + 爱发电捐赠**」的收益方式。

## 上架流程总览

```
注册开发者账号 → 获取签名证书 → 安装 Windows SDK → 构建 MSIX → Partner Center 提交审核 → 上架
```

## 1. 注册微软开发者账号

- 打开 https://developer.microsoft.com/windows → 注册开发者账号
- 个人开发者：一次性 **$19**（企业 $99）
- 注册时需要微软账号 + 支付信息

## 2. 获取代码签名证书

MSIX 包必须签名。两种来源：

| 方式 | 说明 |
| --- | --- |
| Partner Center 签名证书（推荐） | 注册开发者账号后，在 Partner Center 可申请商店专用签名证书（Store-issued certificate），免费 |
| 第三方代码签名证书（EV） | 需购买（约 $200/年），可同时用于 exe 签名（消除 SmartScreen 提示） |

> 本地测试可先用 `build/certs/sm-test.pfx`（自签名测试证书，已生成）。
> 正式提交必须使用 Partner Center 证书或 EV 证书，且 **publisher 必须与证书 CN 一致**。

## 3. 安装 Windows SDK

MSIX 打包需要 `makeappx.exe / makepri.exe / signtool.exe`：

```bash
winget install Microsoft.WindowsSDK.10.0.26100
```

> 也可以直接在 GitHub Actions 的 `windows-latest` 环境打包（自带 Windows SDK）。

## 4. 构建 MSIX

```bash
npm run build        # 类型检查 + 主进程 + 渲染进程构建
npm run dist:win     # 产出 release/win-unpacked
npm run dist:msix    # 调用 electron-windows-store 打包出 release/msix/*.msix
```

> `scripts/build-msix.mjs` 会自动探测 Windows SDK 路径；正式签名时替换其中的
> `--publisher` 与 `--dev-cert` 参数为 Partner Center 证书。

## 5. Partner Center 提交

1. 登录 Partner Center → 应用和游戏 → 创建应用（填写名称，**名称需全局唯一**）
2. 上传 `release/msix/*.msix`
3. 填写商店信息：描述、截图（≥1 张）、分类、关键词、隐私政策 URL（可用 GitHub Pages 托管一份）
4. 定价选择：**免费**（配合爱发电捐赠）
5. 提交审核（通常 1~3 个工作日）

## 6. 税务与收益

- 中国开发者需在 Partner Center 填写 **W-8BEN** 表（中美税收协定，可免预扣税）
- 免费应用无收益；未来若开放 Pro 内购，微软抽成 15%（$100k 内）/ 10%（超过后）

## 7. 爱发电捐赠

- 创建爱发电主页：https://afdian.com （注册后创建"SuperMarkdown"项目）
- 将主页地址更新到 `src/main/menu.ts` 的 `donate` 菜单项 与 `README.md`
- 建议在商店描述和 README 中放上捐赠链接

## 常见问题

- **应用名称被占用**：换一个唯一名，如 "SuperMarkdown Editor"
- **MSIX 安装失败**：确认签名证书与 publisher 匹配，且系统为 Win10 1809+
- **审核被拒**：常见原因——隐私政策缺失、截图不清晰、功能与描述不符。按反馈修改后重新提交
