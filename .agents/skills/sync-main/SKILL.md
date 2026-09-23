---
name: sync-main
description: 同步鞋类测试平台的上游 main，用于开始工作或 PR 合并后更新本地代码；保留本地修改，不提交、不发布。
---

# 同步鞋类测试平台

仅用于 zhuangxuhong/shoe-test-platform 及其 Fork。在当前项目根目录操作，不要在包含真实数据的外层“数据库项目”目录执行 Git。

## 先检查

读取本项目规则，检查 git status --short --branch。运行以下只读预检，它会验证项目远端和未完成的 Git 操作：

```sh
node --input-type=module -e "import {preflight} from './scripts/git-workflow.mjs'; console.log(preflight())"
```

支持 origin 指向原仓库，也支持 origin 指向同事 Fork、upstream 指向原仓库。若未找到原仓库远端，用 gh api 确认当前 origin 是该仓库的 Fork 后，添加 upstream=https://github.com/zhuangxuhong/shoe-test-platform.git；已有 upstream 指向别处时停止，不覆盖远端。不请求原仓库写权限。

## 执行

- 干净 main：运行 node scripts/sync-main.mjs。它从已验证的上游抓取精确 main 提交，只做快进；本地独有提交或分叉时拒绝更新。
- 干净功能分支：若有尚未推送的提交，先报告并保留该分支；用户要求同步 main 时可以切换现有 main，再运行脚本，不删除原分支。
- 有未提交修改、冲突或未完成 Git 操作：保留现场并说明具体阻塞。不要自动提交、stash、reset、clean 或覆盖文件。用户明确要求保留并整合未完成工作时，单独制定恢复方案；本 Skill 的快捷同步不处理脏工作区。
- 本地 main 有独有提交：保留 main，不强制重置；已完成的修改可转用 $commit-push-pr 提交。

成功后报告收到的提交、当前 main SHA 和是否仍有本地修改。同步不代表新代码已部署。通常无需因纯同步重跑测试；准备发布时按 docs/release.md 检查目标版本。任何路径都不得读取或改变 .env、.local、真实数据库、附件或备份；被忽略的本地配置留在原位。
