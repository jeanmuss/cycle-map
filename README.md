# Risk Asset Cycle Map

一个静态部署的风险资产观察面板，用矩阵、周历、市场时钟和产业链表格追踪加密资产、宏观流动性、美股大盘、全球开市轮动、AI 芯片链和机器人链。

## 当前页面

- 加密周期地图：展示 BTC、ETH、SOL、HYPE 的月度收益、相对 BTC 表现、四年周期分组、月内高低点顺序和移动端固定详情卡。
- 宏观流动性：展示通胀、就业增长、利率美元、波动信用、流动性和人工事件标注；周历和月历会自动定位到当前本地日期。
- 美股大盘：展示 QQQ、SPY、DIA 代理、FRED 宏观数据、CMC 加密市值和 FRED 黄金代理指标，用于观察美股风险偏好。
- 开市轮动：展示加密、美股、韩股、A 股等市场的开闭市状态、样例行情、来源质量和当前轮动位置。
- AI 芯片产业链：按晶圆设备、材料基板、制造 IDM、存储 HBM、AI 芯片 IP、光模块互联、服务器、数据中心基础设施、软件终端应用等细分类目展示板块轮动。
- 机器人链：按算力、感知、芯片、运动控制、自动驾驶、仓储服务机器人、医疗机器人、防务无人系统和 ETF 展示标的表格。

## 数据原则

前端只读取 `app/public/data/*.json` 静态缓存，不直接连接行情源、宏观源或任何需要密钥的服务。

- 加密月度数据：`app/scripts/update-market-data.mjs` 生成 `market-monthly.json`。
- 市场时钟：`app/scripts/update-market-session-data.mjs` 生成 `market-session.json`。
- 美股大盘：`app/scripts/update-equity-data.py` 生成 `equity-weekly.json`。
- 美股大盘快缓存：`app/scripts/update-equity-fast-data.py` 生成 `equity-fast.json`，用于 15 分钟目标刷新频率的 BTC 市值、加密资产总市值和黄金代理指标。
- 宏观流动性：`app/scripts/update-macro-calendar.py` 生成 `macro-calendar.json`。
- AI 芯片链：`app/scripts/update-chip-chain-data.mjs chip` 生成 `chip-chain-hotspots.json`。
- 机器人链：`app/scripts/update-chip-chain-data.mjs robot` 生成 `robot-chain-watchlist.json`。

行情密钥只放在本地忽略的 env 文件或 GitHub Actions Secrets 中。不要把 API key、cookie、会话、原始 tick 数据或私人导出写入前端、日志、截图或提交文件。

## 本地开发

```bash
cd app
npm ci
npm run dev
npm run build
```

常用数据刷新命令：

```bash
npm run update-data
npm run update-market-session
npm run update-chip-chain
npm run update-robot-chain
npm run update-equity-data
npm run update-equity-fast-data
npm run update-macro-calendar
```

Python 数据脚本需要先安装依赖：

```bash
python -m pip install -r app/requirements-equity.txt
```

## GitHub Actions Secrets

推荐使用 Repository secrets，除非 workflow job 显式配置了对应 environment。

- `CMC_PRO_API_KEY`：市场时钟和美股大盘快缓存中的 CoinMarketCap 市值数据。
- `FRED_API_KEY`：美股大盘和宏观流动性页面的 FRED 数据。
- `APCA_API_KEY_ID`：AI 芯片链和机器人链的 Alpaca 行情缓存。
- `APCA_API_SECRET_KEY`：AI 芯片链和机器人链的 Alpaca 行情缓存。

`CHIP_CHAIN_US_FEED` 可以配置为 repository variable。默认使用 `iex`；只有在账户订阅和再分发条款允许时，才应改为 `delayed_sip` 或 `sip`。

## 部署

GitHub Pages workflow 会在推送到 `main`、手动触发和定时任务中构建静态站点；`deploy-fast-equity-data.yml` 会按 15 分钟目标频率刷新美股大盘快缓存并重新部署 Pages。

如果中国大陆访问 GitHub Pages 不稳定，可以把同一个 `app/dist` 镜像到更稳定的静态托管服务；只要浏览器继续读取静态 JSON，就不需要把 provider 密钥暴露给前端。
