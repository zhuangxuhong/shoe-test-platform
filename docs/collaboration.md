# GitHub 协作

团队私有仓库：https://github.com/zhuangxuhong/shoe-test-platform 。负责人：@zhuangxuhong。

## 同事首次使用

获得仓库访问权限后，使用 GitHub Desktop 克隆仓库，或执行：

```sh
git clone https://github.com/zhuangxuhong/shoe-test-platform.git
cd shoe-test-platform
npm run check
npm run dev
```

需要 Node.js 24；示例模式无需安装依赖，打开 http://127.0.0.1:8091 即可使用虚构数据调试。真实数据库、账号和密钥不在仓库中。完整 Teable 联调参见 development.md。

## 日常提交与发布

从最新 main 创建自己的功能分支，完成修改并通过 npm run check 后推送该分支，向 main 提交 Pull Request。负责人查看差异及自动测试结果后合并；合并不会自动更新办公室的服务器，仍需在服务器电脑同步并执行发布流程。

CODEOWNERS 指定默认审阅人，但它本身不能禁止直接推送。必须根据账户套餐能力设置 main 分支保护。同一个账号不能批准自己提交的 PR；验证双人审批时，需要另一位真实团队成员提交修改。

## 管理员配置清单

1. 在负责人账号或组织创建新的私有仓库，不选择自动生成 README（本地已有）。
2. GitHub Desktop 添加本地仓库，Publish repository 时保留 Private；或配置 origin 后 git push -u origin main。目标必须是自己的新仓库，不能推到参考同事的仓库。
3. 邀请团队成员为协作者。将 .github/CODEOWNERS 中示例改为真实负责人的 @用户名。
4. 根据 GitHub 套餐支持设置 main 的分支规则：必须 PR、至少一位批准者、必要时要求代码所有者批准、要求 project-check / checks 通过、禁止强推。仓库权限规则必须在 GitHub 设置，源码不能自动开启。
5. 开发者从 main 建 feature/xxx 或 fix/xxx。修改、测试、提交和推送该分支，在 GitHub 建 PR。可用 GitHub Desktop 完成，不必使用 AI 专用技能。
6. 负责人审阅功能和截图，CI 通过后合并。打 v2.0.1 等标签并创建 Release，记录改动和数据库影响。
7. 正式电脑同步主分支或标签后，执行已审阅的发布脚本。同步主分支.cmd 遇到本地修改即停止，不会强制覆盖。

每个 PR 描述变更、验证结果、数据库影响。开发者令牌仅用于其本机测试库。CI 不保存生产凭据、不连正式数据库、不自动控制本地服务器。
