---
name: commit-push-pr
description: 将鞋类测试平台已完成的修改检查、提交并推送到本人分支或 Fork，向 zhuangxuhong/shoe-test-platform 创建 PR；用于提交修改，不合并、不部署。
---

# 提交鞋类测试平台 PR

目标固定为 zhuangxuhong/shoe-test-platform 的 main；不要沿用参考项目 SSRC-Monday-com 的仓库地址、测试命令或数据库规则。在本项目根目录操作。提交请求授权当前修改的 commit、push、PR，以及必要的个人 Fork 创建；只要求编辑或测试时，不推断已获上传授权。

## 1. 确定提交范围

读取项目规则和 git status --short --branch、diff、暂存差异及相关提交。运行只读预检：

```sh
node --input-type=module -e "import {preflight} from './scripts/git-workflow.mjs'; console.log(preflight())"
```

预检缺少上游远端时按下一节核验拓扑后添加，不跳过检查。未完成 merge/rebase 时先保留并处理该操作，不能重新打包。

仅提交用户要求的修改。没有差异和待提交的本地提交时直接报告无需提交。不要混入其他工作；不要 git add . 或 git add -A。排除 .env（保留 .env.example 模板）、.local、备份、真实 Excel/数据库/附件、日志、账号及令牌文件；同时检查新增文件内容和将上传的提交历史。测试只能用 fixtures 或独立测试库，不连接生产 Teable。

## 2. 核验账号和 Fork

使用 gh api user --jq .login 获取当前账号，缺少 GitHub CLI 或授权时采用官方安装/登录流程，不索取聊天中的密码或令牌。

- 当前账号是 zhuangxuhong：推送原仓库的功能分支，不能直接推送 main。
- 同事账号：核验目标上游是公开仓库；查询其同名仓库，要求 fork=true 且 source.full_name=zhuangxuhong/shoe-test-platform。只有确认 404 才视为缺少 Fork；认证、限流、网络错误不能据此创建。
- 已授权提交且 Fork 缺少时：gh repo fork zhuangxuhong/shoe-test-platform --clone=false --remote=false，然后重新验证 Fork 的 owner 和 source。
- 保留现有 origin；origin 已指向验证后的个人 Fork 时复用它。否则添加 contributor-fork 指向验证后的个人 Fork。已有同名远端不匹配时停止，不重定向。
- 如果 origin 是 Fork，添加指向原仓库的 upstream（已有但不匹配则停止）。预检必须找到正确上游。核验推送远端的 get-url --push 与已验证仓库一致，存在多条推送 URL 时停止。

## 3. 打包和验证

抓取已验证的上游 main，记录精确提交。复用明确属于当前任务且未关闭/合并的功能分支；否则创建唯一 feature/日期-摘要 或 fix/日期-摘要 分支。原来在 main 的本地提交先保留 rescue 分支，不重置 main。

显式暂存已审阅路径，检查 staged diff 后提交；无新增差异时不创建空提交。确保工作区干净，再将当前功能分支整合到抓取的上游：使用普通 merge 保留历史，避免为了更新已有 PR 强推。冲突需保留双方需求，语义不明时请求用户决策；不得整文件自动选择 ours/theirs。

运行 git diff --check 上游SHA...HEAD 和 npm run check（可复用覆盖当前内容的可信 PASS；纯说明修改审查内容，云端仍会检查）。运行失败时定位本次改动，不能为提交而修改无关功能或跳过必要检查。文件路径和提交历史审查不能由 audit.mjs 的模式扫描取代。

## 4. 推送和 PR

给出简要的变更、验证结果、当前账号和推送目标。已有上传授权时直接继续；若仅获本地编辑授权，先请求提交授权。使用验证后的远端，普通 git push -u 远端 分支，禁止 force。

先查询相同 head 的现有 PR，存在则更新当前 PR，避免重复创建。否则用正文临时文件创建：

```sh
gh pr create --repo zhuangxuhong/shoe-test-platform --base main --head 用户名:分支 --title 标题 --body-file 本地正文文件
```

正文写问题、改动、验证和数据库影响。正文文件放在被忽略的 .local 下。推送成功但 PR 创建失败时只重试 PR 步骤，不重做提交。验证 PR 的目标仓库、main、head 仓库和远端 SHA 与已检查提交一致；支持任务附件的环境还需附加该 PR 链接。

默认留在功能分支，以便后续修改；不要自动删除分支、回退 main 或部署。报告 PR 链接和检查状态，未完成云端测试不能声称通过。外部 PR 的工作流需维护者批准运行。main 要求代码所有者批准，自己不能批准自己的 PR；不得关闭分支保护来绕过审批。发布是另一个明确授权的步骤，见 docs/release.md。
