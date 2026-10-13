# 本机试验验证记录

日期：2026-10-13。验证使用新建 Edge 浏览器上下文与标签页。

## 范围与部署

- 新增源码均位于 `packages/copylc-ui/`，其他原有未提交修改保持原状态。
- WSL：`Ubuntu`；PM2 所属用户：`root`；Hydro：`/usr/local/bin/hydrooj`；配置：`/root/.hydro/addon.json`。
- 已启用 `@hydrooj/ui-default`、`@hydrooj/hydrojudge`、`@hydrooj/fps-importer`、`@hydrooj/a11y` 和本包；本次停用 `sixth-ui` 以避免模板覆盖冲突，其源码保留。
- 实际运行 Hydro v5.0.4 Community、默认 UI 4.58.4；仓库默认 UI 包版本为 4.58.1。运行时会构建本包前端入口，因此同时检查本地构建和部署后的页面。
- Hydro 与 sandbox 为 `online`，Hydro 监听 `0.0.0.0:8888`；Windows 本机 `http://localhost:8888/` 返回 200。监听地址沿用当前试验环境。
- 本次通过保持一个 `wsl -d Ubuntu -u root -- sleep infinity` 会话维持 WSL 试验运行。未验收退出试验会话后的长期在线能力。
- 用户明确只做本机部署试验。试验中新增的 `HydroOJ-WSL-TCP-8888` Hyper-V 防火墙规则已删除，并只读核实其不存在；有效策略与添加前一致：`Enabled=True`、`DefaultInboundAction=Block`、`LoopbackEnabled=True`。未修改 Windows 防火墙规则、端口转发、`.wslconfig`，不以外网访问为验收目标。

## 检查与构建

| 命令 | 结果 |
| --- | --- |
| `yarn eslint --flag v10_config_lookup_from_file packages/copylc-ui/index.ts packages/copylc-ui/frontend/copylc.page.ts packages/copylc-ui/locales --max-warnings=0` | 通过，0 警告 |
| `yarn tsc -p .cache/copylc-typecheck.json --pretty false` | 通过 |
| `node .cache/copylc-static.cjs` | 14 个 Nunjucks 模板编译通过 |
| `yarn build:ui` | 通过；最终 webpack 编译 8.49s |
| `wsl -d Ubuntu -u root -- pm2 restart hydrooj` | 更新试验部署成功 |
| `wsl -d Ubuntu -u root -- pm2 save` | 写入 `/root/.pm2/dump.pm2` 成功 |
| Windows `curl.exe --noproxy "*" http://localhost:8888/` | HTTP 200 |

构建提示未配置 Sentry token，未创建 release 或上传 source map，不影响构建通过。PM2 CLI 与内存 daemon 版本不同，未调整已有 PM2 安装。全仓库 lint、后端测试和 ui-next 构建跳过，原因见 README。

最终服务日志还记录了用户消息频道订阅错误 `cannot create effect on inactive context`。本次未修改该后端逻辑；四页最终 HTTP 和 JavaScript 检查通过，但不据此宣称服务日志完全无错误。

## 页面、几何与交互

四页 `/`、`/p`、`/p/P1000`、`/user/1` 均返回 HTTP 200，标题分别含首页、题库、题目详情、用户及 SixthOJ 标识。

访客和已登录状态分别检查 7 种 CSS 视口：1440×900、390×844、320×568、768×1024、1024×768、1920×1080、844×390。已登录状态的 28 组组合均未检测到文档横向溢出、正文溢出、页签或按钮文字纵向裁切；题面/工作区、个人侧栏/主体的边界矩形没有重叠。查看桌面、手机和平板截图确认布局。

连续改变宽度 320→1920→390→1440→768→1024→844→320→1440 后，等待 300ms：编辑器和外容器均为 702px 宽，文档无横向溢出。代码工作区在窄屏纵向排列。

基本检查结果：

- Tab 可到达跳转正文链接，Enter 将焦点移到 main，可见 solid 焦点轮廓。
- 原生账号菜单可用 Enter 打开、Escape 关闭并返回 summary。
- 搜索按钮移入导航，避免遮挡正文。搜索对话框可用键盘打开，焦点进入输入框；Tab 约束在对话框控件中，Escape 关闭并将焦点返回按钮。390px 视口下搜索框边界为 16–374px。
- 个人页页签具有 tablist/tab/tabpanel 语义，方向键、Home、End 可切换，`aria-selected` 与可见页同步。
- 720×450 CSS 视口（1440×900 在 200% 缩放时的等效布局尺寸）下四页没有横向溢出；这不是完整的浏览器原生缩放验收。
- 减少动画模式下采样时没有运行中的动画。
- 抽样文字对比度：个人标题 15.00:1、次要文字 7.22:1、导航 7.35:1、选中页签 10.21:1。题面语言页签原受默认样式 `!important` 覆盖，已修正；最终未选中文字 RGB(179,179,179)，选中文字 RGB(241,241,241)。这些是基础抽样检查，不宣称 WCAG 合规。
- 强制编辑器配置加载失败后，显示可读回退提示，普通 textarea 可继续输入代码，不留下遮挡它的 Monaco 容器。
- 强制头像失败后本地 SVG 可加载，尺寸不跳变；加载期间也显示本地占位背景。真实第三方头像仍可能产生网络超时。
- 最终四页新标签页验证没有 JavaScript 页面异常。默认 Monaco 对 Bash 发出未知 feature 警告，但编辑器可加载；不将第三方资源失败表述为零控制台错误。

实际入口流程：首页导航→`/p` 为 1 次点击；题目标题→`/p/P1000` 为 1 次点击。测试账号的现有偏好会将题目链接打开到新标签页，此行为保留。

## 编辑、自测与提交

使用用户授权的现有测试账号，读取页面实际语言列表后选用 `py.py3`。

- Monaco 正常加载；输入 A+B 程序后运行自测，输入 `1 2`，输出 `3`，HTTP 200，实时状态为已通过。
- 自测记录：`6acdfe639c3f35031b0f5134`。
- 普通提交 HTTP 200，实时状态已通过；打开记录详情 HTTP 200，最终 100 分、两组测试通过。
- 提交记录：`6acdfe689c3f35031b0f513c`。
- 修正了记录 URL 中编码后的 `{rid}` 占位符处理；回传在 POST 返回前到达时保留更新，连接建立后请求记录快照。
- 刷新后恢复 `py.py3` 和完整草稿代码。
- 空代码提交显示后端已有的可读错误“字段 code 验证失败。”。
- 访客题目页不出现代码工作区，权限条件有效。

测试凭据与会话文件不放入源码，验证结束后清理。

## 性能测量与边界

环境：Windows 本机，AMD Ryzen 9 9955HX，32 个逻辑处理器，系统可见内存约 61.68GiB；Edge 155.0.4283.45，Playwright headless。使用 requestAnimationFrame 帧间隔采样和 PerformanceObserver 长任务采样；CPU 节流为 1 倍、4 倍。它们是浏览器调度测量，不等于物理屏幕呈现 FPS。

用户已确认本轮验收范围：本机与 4 倍 CPU 节流下的日常滚动、编辑；窗口急速缩放允许瞬时长帧。性能结论限于这个范围，不以其他硬件或实际在线服务为本轮验收目标。

桌面 1440×900 和手机 390×844 的四页滚动，各采样约 3 秒：

| 视口/节流 | rAF 回调率范围 | P95 帧间隔 | >34ms 帧间隔 | 采样长任务 |
| --- | --- | --- | --- | --- |
| 桌面 / 1 倍 | 298.3–300.0 次/秒 | 3.4–3.5ms | 0 | 0 |
| 桌面 / 4 倍 | 282.7–300.0 次/秒 | 3.4–3.5ms | 个人页 1 次，其余 0 | 0 |
| 手机 / 1 倍 | 299.6–300.0 次/秒 | 3.4ms | 0 | 0 |
| 手机 / 4 倍 | 290.7–300.2 次/秒 | 3.4–3.5ms | 个人页 1 次，其余 0 | 0 |

桌面 1440×900 的日常编辑单独采样：输入两行 Python 代码、移动光标并等待草稿保存，不改变窗口尺寸。正常 CPU 与随后 4 倍节流的结果：

| 节流 | 采样时长 | rAF 回调率 | P95 帧间隔 | 最长帧间隔 | >34ms 帧间隔 | 采样长任务 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 倍 | 3.27s | 299.1 次/秒 | 3.5ms | 10.0ms | 0 | 0 |
| 4 倍 | 3.45s | 260.0 次/秒 | 3.5ms | 26.8ms | 0 | 0 |

两次编辑结束后页面均显示“已保存到本机”。此前独立浏览器上下文中直接进行的 4 倍节流编辑首轮也保留：采样 3.59s，P95 3.6ms，最长帧间隔 83.4ms，2 次帧间隔超过 34ms，长任务为 65ms 和 55ms。因此，不能用后续采样抹去首轮短暂停顿，也不能宣称日常编辑的每一帧都满足 16.7ms 预算；该停顿的具体原因尚未定位。

4 倍节流下，连续跨断点改变视口并输入代码的最终复测：约 3.01 秒、597 个 rAF 回调、平均约 198.1 次/秒、P95 3.5ms；11 次帧间隔超过 34ms，最长 183.3ms。编辑器布局已合并到尺寸停止变化 120ms 后执行，最终几何检查通过，但急速窗口变化仍有瞬时长帧。

本轮已按用户确认范围完成测量。滚动与编辑采样的 P95 帧间隔均低于 16.7ms，但存在上述偶发长帧；当前证据不支持“每帧稳定 60fps”的绝对保证，也不能推广到所有现役电脑或所有负载。急速窗口缩放的瞬时长帧按用户确认允许，最终布局正常。

本机采样材料位于 `.cache/copylc-matrix.json`、`.cache/copylc-functional.json`、`.cache/copylc-interaction.json`、`.cache/copylc-performance.json`、`.cache/copylc-performance-resize.json`、`.cache/copylc-editing-initial.json`、`.cache/copylc-editing.json`、`.cache/copylc-final.json`；最终截图文件名以 `copylc-final-` 开头。这些材料被忽略，不提交构建产物、缓存或机密。

本机目前只有少量题目与活动数据。未验证大量题目的压力场景、真实手机硬件、其他浏览器、比赛题目的实际提交或退出 WSL 试验会话后的长期运行。

## 站点更名：XCAOJ

2026-10-13：按用户要求，将本机 `server.name` 从 `SixthOJ` 更新为 `XCAOJ`，并将 `system` 域公告中的“欢迎来到 SixthOJ”更新为“欢迎来到 XCAOJ”。通过现有 `hydrooj cli execute` 调用 `global.Hydro.model.system.set` 和 `global.Hydro.model.domain.edit` 保存，未修改后端逻辑、路由、权限或前端模板。

- 新建浏览器上下文与标签页，检查 `/`、`/p`、`/p/P1000`、`/user/1`，视口为 1440×900 与 390×844，共 8 组。
- 各组 HTTP 200；导航名称、导航链接的无障碍名称、页面标题和 `og:site_name` 均为或包含 `XCAOJ`；首页欢迎文字同步生效。
- 无文档横向溢出，品牌链接边界在视口内，无 JavaScript 页面异常。
- `wsl -d Ubuntu -u root -- pm2 status`：Hydro 与 sandbox 仍 online，Hydro 重启次数仍为 8；`wsl -d Ubuntu -u root -- ss -ltnp`：仍监听 `0.0.0.0:8888`。
- 本次只更新已有配置、公告与说明文档，无前端源码变更，因此未重复运行 lint、构建和性能矩阵。物理机放行策略未改变。
- 本机报告为 `.cache/copylc-brand.json`，截图为 `.cache/copylc-xcaoj-1440.png` 与 `.cache/copylc-xcaoj-390.png`。
