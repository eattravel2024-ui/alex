# 部署準備

目前提供前台、會員核心與部分後台。使用者已自行部署 VPS 示範站 https://test.cchm.tw，並提供 HTTPS 200／HTTP 301、Web／PostgreSQL healthy、Certbot dry-run 成功證據。這些是使用者回報，並非雲端 agent 直接登入 VPS 驗證。正式 SMTP、政策、會員規則、備份與正式營運驗收仍未完成。不得自行取得未提供的 SSH 憑證或修改其他網站。

## 本機 Docker

```sh
docker compose config --quiet
docker compose build
docker compose up -d
curl --fail http://127.0.0.1:3000/
docker compose logs web
```

採 Node 24、多階段 standalone、non-root。開發環境可 npm run dev。容器只發布 loopback 3000，正式對外需 Caddy/Nginx proxy。Caddy 範例（替换協會確認 Domain）：

```caddy
YOUR_CONFIRMED_DOMAIN {
 reverse_proxy 127.0.0.1:3000
}
```

這不是可直接用於正式服務的 Domain。DNS、憑證取得與自動更新、proxy headers、HTTPS cookies 及 HSTS 待驗證。PostgreSQL／Prisma migration 已實作；compose.yaml 僅含 web，資料庫須另設。VPS 使用本機 compose.vps.yaml 提供獨立 PostgreSQL，不發布資料庫埠。SMTP 尚需實際設定，不得使用範例帳密。

## 後續正式發布流程

CI typecheck/lint/tests/build → dependency/security scan → DB 備份及 restore 演練 → migration staging 測試 → staging smoke/E2E → 取得授權 → 部署版本與健康檢查 → 監控。保留前版 image，schema 使用 expand-contract 策略，rollback 不任意反向破壞 migration。

## 本雲端環境的代理 CA

容器不自動繼承 host CA。此環境需以 BuildKit 暫時掛載平台提供的 CA，保留 TLS 驗證，不可設定 strict-ssl=false。CA 只於 deps build 階段使用，不進 runtime image：

```sh
DOCKER_CONFIG=/workspace/.docker docker build --network host \
  --secret id=https_proxy,env=HTTPS_PROXY \
  --secret id=proxy_ca,src=/usr/local/share/ca-certificates/environment-proxy-ca.crt \
  -t alex-web .
```

一般不使用攔截代理的 VPS 可直接 docker compose build；其他環境請使用其管理者提供的可信 CA，不能盲目下載或信任任意憑證。

## 使用已驗證的 CI 產物建置執行映像

BuildKit 的網路安裝尚未在本雲端環境完成；可分離編譯與映像封裝：

```sh
npm ci
npm run build
cp -R public .next/standalone/public
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
docker build -f Dockerfile.runtime -t alex-web-runtime .next/standalone
docker run --rm -p 127.0.0.1:3000:3000 alex-web-runtime
```

產物必須由可信 CI 建置，與 Node/Linux/CPU 平台相符；不得攜帶 .env、真實秘密或未審核檔案。runtime image 以 node 非 root 帳號執行。此路徑不代表多階段 Dockerfile 的 npm 安裝管線已验证。

## Phase 3 本機會員服務與正式配置界限

開發使用 compose.dev.yaml；執行 `npm run dev:setup`、`db:restore:local`、`db:migrate:local`、`db:seed`。服務只發布 loopback PostgreSQL 5433、SMTP 1025、Mailpit 8025。本機 migration helper 使用 Node 24 + version-pinned official WASM internal APIs，無 native engine 下載或 checksum bypass。正式 Prisma CLI仍需 binaries.prisma.sh 的已校驗引擎；未聲稱完整 Docker multi-stage/正式 migration 已驗證。

runtime image 不包含 .env.local，必須由安全的 runtime env 注入 DATABASE_URL、BETTER_AUTH_URL（正式 HTTPS origin）、BETTER_AUTH_SECRET、SMTP 設定。DEVELOPMENT_MODE 必須 false。先經法律與協會確認後，才可設定 POLICIES_APPROVED=true、正式 POLICY_VERSION 與 MEMBERSHIP_APPLICATIONS_ENABLED=true。不能啟用 seed demo types 作正式資格，也不能把開發密鑰當正式密鑰。

Native production migration（只在獲明確授權後）：使用 lockfile 安裝，執行 `npm run db:migrate`，僅部署已審核 migration，之前先備份／staging 驗證。標準 CLI 不支援時不得以未驗證手工修改 `_prisma_migrations` 替代。本機替代 runner 由 Prisma engine 自行管理 migration history，僅可指向 development loopback DB。

開發 snapshot：`db:backup` 加密保存資料，保留原始 .env.local backup key；`db:backup:verify` 建立並刪除其自身的暫存驗證 DB，不刪既有資料庫。新 cloud task 若 Docker volume 為空，startup 先 `db:restore:local`，再執行 migration；現有 schema 時跳過 restore。新 cloud task 還原未獨立驗證，不假定 Docker volumes 或 live processes 會保存。

## 已發布 VPS 的更新流程

目錄 `/opt/health-association/app`；Compose project `cchm-demo`，檔案 `compose.yaml` + VPS 本地 `compose.vps.yaml`，runtime 讀 `.env.production`。Nginx 在 `/etc/nginx/conf.d/test.cchm.tw.conf`，網站容器僅發布 127.0.0.1:3000。秘密、憑證私鑰、DB volume 與 VPS 本地設定不屬於 Git。

本次 CSV 功能不新增 migration，不需重新 seed。更新前確認沒有尚未處理的 tracked 修改，並保留目前 image 供故障回復；不要 force pull、刪除 volumes 或覆寫 .env.production。

```sh
cd /opt/health-association/app
git status --short
docker image tag cchm-demo-web cchm-demo-web:previous
git pull --ff-only origin main
docker compose -p cchm-demo --env-file .env.production -f compose.yaml -f compose.vps.yaml build web
docker compose -p cchm-demo --env-file .env.production -f compose.yaml -f compose.vps.yaml up -d --no-build web
docker compose -p cchm-demo --env-file .env.production -f compose.yaml -f compose.vps.yaml ps
curl --fail --head https://test.cchm.tw/
```

Build 失敗時不要執行 up；舊容器會繼續服務。更新會短暫重啟 web，此流程不宣稱零停機。之後有 schema 變動時需另審查 migration、備份及 restore 驗證，不能沿用「本次無 migration」判斷。

目前註冊／入會／報名 flags=false；沒有預設管理員。dev:admin 只適用本機開發，不能直接當作 VPS 管理員建立程序。正式 SMTP／經核准政策與安全管理員初始化待完成。

VPS 已用標準 Prisma CLI 成功套用三個 migrations；雲端環境曾有 native engine 網路限制，兩者的驗證範圍不同。示範 seed 在一次性工具容器共享獨立 DB 網路命名空間，僅對自己的 cchm_demo 使用 loopback 開發匯入；網站 runtime 始終 DEVELOPMENT_MODE=false。不對既有正式資料庫使用此流程，也不匯入開發帳號與 Session。
