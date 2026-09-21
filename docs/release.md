# 发布与回退

## 接入已有服务器
将 deploy/deployment.example.json 复制到仓库外或 .local/deployment.json，填写原有 Compose 文件、.env 文件、项目名、容器名、入口地址及独立备份目录。不要修改现有数据库卷名，不要重建正式 Teable。
生产 .env 继续放在旧部署目录，不进入 Git。TEABLE_ENTRY_URL 通过部署配置提供，不能把自己正式库 ID 写入源码。

## 发布
先审核源代码并提交，确保 git status 干净；拉取 GitHub 的明确标签。执行：

    node scripts/release.mjs --config .local/deployment.json --ref v2.0.0 --dry-run
    node scripts/release.mjs --config .local/deployment.json --ref v2.0.0

脚本校验环境、归档精确提交、构建固定基础镜像、导出旧镜像并备份本机 Compose/环境文件，再仅切换 analysis-web；检查版本健康与记录读取。失败自动切回上一镜像，不操作数据库。
备份目录含凭据，不得上传。首次生产切换前还应有数据库与附件备份；源项目已单独备份，但这不是日后的定期备份方案。
发布脚本不拉取 GitHub、不自动合并，不对数据库执行迁移。Git 和 Docker Desktop 必须可用，Windows 需系统 tar 命令。

## 回退

    node scripts/release.mjs --config .local/deployment.json --rollback

回到最近一次发布前的应用镜像。镜像导出包用于灾难恢复；如本机镜像丢失，可 docker load -i 备份路径/previous-image.tar 后再回退。
若未来版本涉及数据库结构改变，应先设计向后兼容或专门回退；不得恢复旧备份而覆盖升级后录入的数据。

发布不能只替换源码文件或执行重建整个 Teable 栈。当前协作基线没有自动数据库迁移，旧录入接口也不再由分析服务提供。
