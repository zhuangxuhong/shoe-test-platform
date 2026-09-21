# 鞋类测试分析平台

团队协作基线 v2.0.0。分析页面只读；数据录入和权限由 Teable 管理。

## 最快启动
安装 Node.js 24 LTS，双击“启动本地调试.cmd”，打开 http://127.0.0.1:8091。自带 18 条虚构示例，无需生产账号或数据库。

完整测试环境和测试账号自动初始化见 [开发说明](docs/development.md)。代码检查：npm run check。

## 协作流程
下载 → 功能分支修改 → 本地测试 → 推送分支 → Pull Request → 负责人审核 → 合并 main → 标记版本 → 正式电脑执行发布。
同步 main 不会自动发布；发布仅替换分析服务，数据库迁移需单独审核。

- [协作与 GitHub 设置](docs/collaboration.md)
- [发布、回退与现有服务器接入](docs/release.md)
- [数据库迁移规则](migrations/README.md)
- [第三方资源](docs/third-party.md)

目录：analysis-web 正式代码；fixtures 虚构记录；tests 自动测试；scripts 工具；deploy 部署模板；migrations 数据库策略；.github CI 与 PR 模板。

禁止上传真实测试记录、Excel、.env、账号、附件和备份。本仓库应先创建为私有；开源前单独审查品牌图标与依赖许可。
