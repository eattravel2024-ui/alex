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

## 聯絡功能版本更新（需要第四個 migration）

本節取代前一節「CSV版本不需要migration」的更新判斷。保留既有.env.production、compose.vps.yaml、資料庫volume與Nginx憑證，先pull與build，再備份、migration、設定開關、切換web。下列是供使用者在VPS執行的程序；agent未在VPS執行。

```sh
cd /opt/health-association/app
git status --short
docker image tag cchm-demo-web cchm-demo-web:previous
git pull --ff-only origin main
docker compose -p cchm-demo --env-file .env.production -f compose.yaml -f compose.vps.yaml build web
```

任一步失敗就停下，舊web仍在服務。接著用age建立加密備份；依提示設定並安全保存備份密碼，不貼聊天、不寫進Git。此為建立備份的指令，不代表已完成VPS還原演練。

```sh
apt-get install -y age
set -o pipefail
umask 077
mkdir -p /opt/health-association/backups
docker compose -p cchm-demo --env-file .env.production -f compose.yaml -f compose.vps.yaml exec -T db pg_dump -U cchm -d cchm_demo -Fc | age -p -o "/opt/health-association/backups/before-contacts-$(date +%Y%m%d-%H%M%S).dump.age"
```

確認備份指令成功後，套用migration。工具容器安裝OpenSSL以避免先前native Prisma環境偵測警告；不關閉TLS或checksum驗證。

```sh
docker run --rm --network cchm-demo_default --env-file .env.production -v "$PWD:/app" -w /app node:24-bookworm-slim sh -c 'apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && npm ci && npm run db:migrate'
```

應成功套用phase4_contacts（已套用時0 pending）；不需重新seed、不reset資料庫。CONTACT_SUBMISSIONS_ENABLED預設false；若要公開展示提交測試，在VPS.env.production加入或修改以下非機密旗標，其餘設定保留：

```dotenv
CONTACT_SUBMISSIONS_ENABLED=true
```

這仍只接受@example.test，不能作為正式個資聯絡服務。不開啟POLICIES_APPROVED／會員報名旗標，不設定SMTP。

```sh
docker compose -p cchm-demo --env-file .env.production -f compose.yaml -f compose.vps.yaml up -d --no-build web
docker compose -p cchm-demo --env-file .env.production -f compose.yaml -f compose.vps.yaml ps
curl --fail --head https://test.cchm.tw/contact
```

瀏覽/contact確認示範告知與表單，使用虛構內容取得收件編號。管理員初始化尚未完成，VPS後台不會因這次更新自動可登入。獨立示範站也需要後續監控與保留期限／備份還原演練；不要刪除volume來處理升級錯誤。

## 不使用SMTP的示範管理員初始化

`scripts/demo-admin.mjs` 是主機管理者專用的一次性CLI，不是公開API，也不能作正式帳號初始化。限定 DEVELOPMENT_MODE=false、DB=cchm_demo、HTTPS origin=test.cchm.tw，以及保留的@example.test登入識別碼。操作者需顯式傳--confirm-demo-bootstrap；任何既有管理角色（含Staff/Editor）或重複email都拒絕，不提升既有帳號、不改既有密碼。

示範帳號的emailVerified由主機管理者手動設true以允許此保留識別碼登入，沒有寄出驗證信、不代表信箱所有權已驗證。terms/privacy consent仍false，不虛構正式政策同意。建立User／Better Auth credential hash／DEMO_ADMIN_BOOTSTRAPPED audit同交易，advisory lock防重複初始化。正式管理員應另走身分確認／MFA／寄信／政策流程。

先pull最新版（初始化CLI本身不需migration；同步8字元密碼規則時需重新build web），在VPS root終端建立私密密碼檔。密碼不作命令參數、不顯示、不貼聊天；至少8字元，含英文與數字。以下互動區塊需按提示輸入兩次；既有檔案不覆寫。

```sh
cd /opt/health-association/app
git pull --ff-only origin main
python3 - <<'PYTHON'
from pathlib import Path
import getpass, os, re
p = Path('/root/.cchm-bootstrap/password')
if p.exists():
    raise SystemExit('密碼檔已存在，未覆蓋。')
p.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
password = getpass.getpass('設定示範管理員密碼：')
confirmation = getpass.getpass('再次輸入密碼：')
if password != confirmation:
    raise SystemExit('兩次密碼不同，未建立檔案。')
if not 8 <= len(password) <= 128 or not re.search('[A-Za-z]', password) or not re.search('[0-9]', password):
    raise SystemExit('密碼需8至128字元，包含英文與數字。')
with os.fdopen(os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as f:
    f.write(password + '\n')
print('私密密碼檔已建立，密碼未顯示。')
PYTHON
```

確認沒有錯誤後，初始化：

```sh
docker run --rm \
  --network cchm-demo_default \
  --env-file .env.production \
  --mount type=bind,src=/root/.cchm-bootstrap/password,dst=/run/cchm-admin-password,readonly \
  -v "$PWD:/app" -w /app \
  node:24-bookworm-slim \
  node scripts/demo-admin.mjs \
  --email admin@example.test \
  --name '示範管理員' \
  --password-file /run/cchm-admin-password \
  --confirm-demo-bootstrap
```

成功顯示Demo administrator created，開https://test.cchm.tw/auth/login，以admin@example.test與自行設定密碼登入，接著進/admin。不改SMTP、DEVELOPMENT_MODE、政策、註冊／入會／報名開關。確認登入成功後刪除此次明文密碼檔（一般刪除不宣稱安全抹除儲存媒體）：

```sh
rm /root/.cchm-bootstrap/password
```

私密檔必須是目前使用者擁有的regular file，拒絕symlink及group/other權限；工具不輸出密碼與hash。若已有管理角色，停止並使用既有帳號流程，不能reset DB或刪帳號來繞過。若需修改密碼，登入後使用既有密碼修改功能；忘記密碼在未設定SMTP時沒有公開重設捷徑。
