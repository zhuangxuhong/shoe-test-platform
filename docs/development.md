# 本地开发

需要 Node.js 24 LTS；完整联调还需要 Docker Desktop。本项目无 npm 第三方依赖，无需 npm install。

## 页面调试
运行“启动本地调试.cmd”或 npm run dev，打开 http://127.0.0.1:8091。默认 18 条虚构记录，不连接 Teable。不得使用真实记录替代 fixtures 提交。

## 完整 Teable 联调
1. 启动 Docker，运行“启动完整测试环境.cmd”。独立 shoe-team-dev 项目，只监听本机 13001，不暴露数据库端口。
2. 等待 http://127.0.0.1:13001 就绪，运行“初始化测试数据.cmd”。自动创建本机测试账号、空间、数据表、18 条样例、自动编号和 5 个视图；重复执行不清空已有数据。
3. 运行“启动Teable联调.cmd”，打开 http://127.0.0.1:8092。
4. Teable 测试账号保存在 .local/test-account.json；仅本机使用。只读接口令牌自动保存在 .env.teable-analysis，有效期 30 天；到期前重新运行初始化可更新。不要向同事发送这些私密文件，各自运行初始化。

脚本固定访问 127.0.0.1:13001；不得修改为正式地址。新测试库的编号从自己的系统序号生成，历史正式库编号不会被复制。
停止测试服务：docker compose --env-file .env.teable-dev -f deploy/compose.dev.yaml stop。不得用正式 Compose 执行清卷命令。

## 检查
npm run check：语法、核心计算、接口、安全边界与本地文件检查。测试使用临时 HTTP 服务，不写正式数据库。
修改正式代码位于 analysis-web；默认分支 main，开发用 feature/xxx 或 fix/xxx；提交前不添加 .env、.local、数据库与附件。
