# copylc-ui

独立的 Hydro 前端包，包名 `@hydrooj/copylc-ui`。以 LeetCode 国际站的四张桌面深色截图为参考，覆盖首页、题库、题目详情和个人主页。参考描述保存在 `../sixth-ui/leetcode-ui-reference.txt`。

本机站点名称现为 `XCAOJ`，通过 Hydro 现有 `server.name` 配置保存；首页公告中的欢迎名称同步更新。该名称属于部署配置，不在模板中写死。

## 页面与数据

| 页面 | 本机验证路径 | 实现 |
| --- | --- | --- |
| 首页 | `/` | 内容流、右侧入口卡片，使用当前域首页内容和讨论数据 |
| 题库 | `/p` | 左侧导航、入口卡片、分类胶囊、搜索排序、题目表格、日历 |
| 题目详情 | `/p/P1000` | 题面与代码工作区双栏，自测、提交、实时状态、记录入口 |
| 个人主页 | `/user/1` | 资料侧栏、真实统计、简介、已有活动与通过题目页签 |

保留 Hydro 已有业务路由、权限检查、提交参数、记录接口和多语言机制。新增服务入口 `/copylc-ui.css` 只返回本包的静态样式，不提供业务接口。

题库通过率由真实 `nAccept / nSubmit` 计算；难度仍显示 Hydro 的数值，配色分段为 1–3 青绿、7–10 红色、其他黄色。日历只标记今天。个人页没有年度每日提交数据，因此显示已有活动，不绘制虚构热力图。统计圆环是装饰，不表示难度占比。

新工作区仅用于有提交权限、非比赛、类型为 `default` 或 `remote_judge` 的题目；比赛和其他题型保留原有 Hydro 提交入口。题解入口使用与默认侧栏相同的权限条件。

## 文件职责

- `index.ts`：读取样式并注册静态资源路由。
- `frontend/copylc-ui.css`：深色主题、页面布局、响应式断点、焦点与减少动画样式。
- `frontend/copylc.page.ts`：日历、菜单、页签键盘操作、搜索对话框、头像回退、Monaco、草稿和判题连接。
- `templates/`：14 个 Nunjucks 模板，复用默认 UI 的数据、题面渲染、分页、侧栏和扩展区域。
- `locales/en.yaml`、`locales/zh.yaml`：新增文案。
- `VALIDATION.md`：本机验证结果、环境和限制。

## 布局与性能

使用 Grid/Flex 和 `minmax(0, 1fr)` 适应可用空间。题库宽屏三栏，1150px 以下转两栏，800px 以下转单栏；题面和编辑区在 800px 以下上下排列。480px 以下收紧间距，1800px 以上增加宽屏空间。导航和卡片条使用局部横向滚动。

本包没有常驻背景动画或业务轮询。Monaco 只在具备工作区的题目页加载，关闭缩略图；ResizeObserver 在尺寸停止变化 120ms 后通过 requestAnimationFrame 更新编辑器，减少连续缩放中的布局次数。草稿在输入停止 300ms 后保存。WebSocket 在运行或提交时建立，复用 Hydro 的心跳与重连实现；页面离开时释放编辑器、模型、观察器、连接和计时器。浏览器恢复页面缓存时重新初始化页面。

外部头像加载期间使用本地占位图，失败后切换到本地 SVG。第三方头像请求本身仍会受网络影响。

本轮性能范围已由用户确认：本机及 4 倍 CPU 节流下的日常滚动、编辑，允许急速窗口缩放瞬时长帧。采样 P95 帧间隔为 3.4–3.6ms；编辑首轮仍有最长 83.4ms 的偶发间隔，不宣称每帧稳定 60fps。完整测量及限制见 `VALIDATION.md`。

## 本机试验部署

本次已核实运行环境为 WSL `Ubuntu`，Hydro 可执行文件 `/usr/local/bin/hydrooj`，PM2 服务用户 `root`，实际配置 `/root/.hydro/addon.json`。这些值是本机记录；在其他环境先核实服务所属用户与路径。

```powershell
wsl -d Ubuntu -u root -- hydrooj addon add /mnt/c/Users/Collinor/Desktop/Hydro-testoj/packages/copylc-ui
wsl -d Ubuntu -u root -- hydrooj addon remove /mnt/c/Users/Collinor/Desktop/Hydro-testoj/packages/sixth-ui
wsl -d Ubuntu -u root -- pm2 restart hydrooj
wsl -d Ubuntu -u root -- pm2 save
curl.exe --noproxy "*" http://localhost:8888/
```

`@hydrooj/ui-default` 必须保留，为本包提供底层 UI 能力。`sixth-ui` 与本包覆盖同名模板，试验时启用其中一个。停用不会删除其源码。回退本机 SixthUI：

```powershell
wsl -d Ubuntu -u root -- hydrooj addon remove /mnt/c/Users/Collinor/Desktop/Hydro-testoj/packages/copylc-ui
wsl -d Ubuntu -u root -- hydrooj addon add /mnt/c/Users/Collinor/Desktop/Hydro-testoj/packages/sixth-ui
wsl -d Ubuntu -u root -- pm2 restart hydrooj
wsl -d Ubuntu -u root -- pm2 save
```

本机只用于部署试验，浏览地址为 `http://localhost:8888/`。物理机放行策略保持原状态：试验中新增的 `HydroOJ-WSL-TCP-8888` Hyper-V 入站规则已撤销，未修改 Windows 防火墙规则、端口转发或 `.wslconfig`。不包含对外服务部署步骤。

## 验证命令

```powershell
yarn eslint --flag v10_config_lookup_from_file packages/copylc-ui/index.ts packages/copylc-ui/frontend/copylc.page.ts packages/copylc-ui/locales --max-warnings=0
yarn build:ui
```

本次还用工作区临时 tsconfig 执行 `yarn tsc -p .cache/copylc-typecheck.json --pretty false`，并编译全部 14 个模板。临时配置、浏览器脚本、截图和采样报告位于 `.cache`，不属于交付源码；登录凭据和会话文件在验证结束后清理。

`yarn build:ui-next`、全仓库 `yarn lint:ci` 和后端 `yarn test` 未执行：本次没有修改 ui-next 或后端，采用定向检查、默认 UI 构建及真实浏览器验证。仓库原有未提交修改保持不变。
