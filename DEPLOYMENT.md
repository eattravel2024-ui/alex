# 部署準備

目前提供 Phase 3 本機會員核心，正式 runtime 需要外部 PostgreSQL／auth／SMTP 安全設定。不得將文件視為已正式部署。主機、Domain、HTTPS、Database、SMTP、備份與法律內容須確認，並取得使用者明確部署授權。不得自行 SSH 或修改正式資料。

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

這不是可直接用於正式服務的 Domain。DNS、憑證取得與自動更新、proxy headers、HTTPS cookies 及 HSTS 待驗證。Phase 3 再加入 PostgreSQL service／外部 DB、Prisma migrations、secrets 注入與 SMTP；不得使用範例帳密。

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
