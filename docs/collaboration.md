# GitHub 协作

仓库：https://github.com/zhuangxuhong/shoe-test-platform 。负责人：@zhuangxuhong。

## 同事首次使用：Fork 后本地调试

1. 登录 GitHub，在仓库右上角点击 Fork，复制到自己的账号；无需原仓库写权限。
2. 安装 GitHub Desktop 和 Node.js 24。通过 GitHub Desktop 克隆自己 Fork 的仓库。
3. 双击“启动本地调试.cmd”，打开 http://127.0.0.1:8091 。默认使用 18 条虚构数据，不需要生产账号。
4. 完整 Teable 联调参见 development.md；生产数据库和密钥不会随代码下载。

## 修改与提交

1. 在自己 Fork 的网页点击 Sync fork，更新 main；在 GitHub Desktop 拉取更新。
2. 从 main 新建 feature/功能名 或 fix/问题名 分支。
3. 修改和试用后双击“检查项目.cmd”，确认检查通过。
4. 使用 GitHub Desktop 提交并推送该分支。
5. 在 GitHub 点击 Contribute → Open pull request，目标选择 zhuangxuhong/shoe-test-platform 的 main。
6. 在 PR 中说明改动、验证结果和数据库影响；界面修改附截图。

## 负责人审阅

查看 PR 的 Files changed、运行效果和 checks 测试结果，同意后提交 Approve 并合并。新提交会使旧审批失效，需要重新审阅。外部贡献者首次提交的工作流可能需要负责人在 GitHub 批准运行，应先检查工作流和脚本。

main 分支配置要求 PR、至少一位批准者、代码所有者批准及 checks 成功，并禁止强推和删除，规则包含管理员。CODEOWNERS 指向 @zhuangxuhong。同账号不能批准自己的 PR；负责人自己的修改如需走相同审批流程，应另设可信维护者，不能把自己批准自己作为测试结果。

Codex 不会在后台自动接收或合并 PR。需要协助审查时，在对话中提供 PR 链接；未配置自动审阅、自动合并或服务器自动更新。

## 服务器本地发布

1. 在服务器电脑的 team-workspace/shoe-test-platform 目录双击“同步主分支.cmd”。该操作只允许干净的 main 快进同步，不会强制覆盖本地修改。
2. 在 GitHub 的 main 查看已审核的合并提交 SHA，或使用指向它的版本标签。
3. 双击“发布指定版本.cmd”，输入该 SHA 或版本标签。不要输入 HEAD；发布的是指定版本，不是自动取所有本地改动。
4. 发布脚本备份旧镜像和配置、替换分析服务并检查健康状态；必要时双击“回退上一版.cmd”。

本机部署配置位于被忽略的 .local/deployment.json。合并和同步不会自动上线。涉及数据库结构变化时，先按 docs/release.md 单独备份并审核迁移；应用回退不等于数据库回退。

## 公开范围

任何人都可以查看和下载仓库及提交历史，但 Fork 和 PR 不会赋予原仓库写权限。正式 Teable、测试数据、密钥和本地备份不在仓库中。第三方素材权利说明见 third-party.md；公开可见不等于授予通用开源许可。
