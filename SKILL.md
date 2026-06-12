---
name: security-check
description: >
  Kiểm tra bảo mật tự động NGAY TRƯỚC KHI đọc hoặc ghi bất kỳ file nào trong project.
  Nếu phát hiện file nhạy cảm (.env, *.key, *.pem, credentials, secrets...) hoặc
  .claudeignore chưa tồn tại — TỰ ĐỘNG tạo/cập nhật .claudeignore rồi tiếp tục tác vụ,
  KHÔNG hỏi lại user. Kích hoạt khi: đọc file, ghi file, list thư mục, user đề cập
  .env / api key / credentials / secrets / database config / token. Skill này là
  CLAUDE.md pattern — được nhúng trực tiếp vào CLAUDE.md của project, không phải
  skill toàn cục.
---

# Security Check — CLAUDE.md Pattern

Skill này có hai phần:

1. **Hướng dẫn cho Claude** — logic kiểm tra bảo mật (file này)
2. **Template CLAUDE.md** — nội dung anh paste vào project của mình

---

## Logic kiểm tra (Claude thực thi)

### Bước 1 — Trước khi đọc/ghi bất kỳ file nào

Kiểm tra tên file target có match pattern nhạy cảm không:

```
.env, .env.*, .env.local, .env.production, .env.staging
*.pem, *.key, *.p12, *.pfx, *.crt, *.cer
credentials/, secrets/, .secrets/
config/database.yml, config/database.yaml, config/secrets.yml
.aws/credentials, serviceAccountKey.json, *service_account*.json
firebase*.json, *.token, auth.json
id_rsa, id_ed25519
```

**Nếu match → chuyển sang Bước 2 trước, rồi bỏ qua file đó, tiếp tục tác vụ.**
**Nếu không match → tiếp tục bình thường.**

---

### Bước 2 — Auto-create/update `.claudeignore`

Kiểm tra `.claudeignore` tại root project. Nếu chưa có hoặc thiếu pattern → **tự động tạo/bổ sung**, KHÔNG hỏi user:

```bash
# Nội dung chuẩn của .claudeignore
cat > .claudeignore << 'EOF'
# === CLAUDE SECURITY IGNORE ===
# Auto-generated — không đọc các file chứa thông tin nhạy cảm

# Environment & Secrets
.env
.env.*
.env.local
.env.production
.env.staging
*.secret

# Certificates & Keys
*.pem
*.key
*.p12
*.pfx
*.crt
*.cer
id_rsa
id_rsa.pub
id_ed25519

# Credentials & Config
credentials/
secrets/
.secrets/
config/database.yml
config/database.yaml
config/secrets.yml
database.yml

# Cloud credentials
.aws/credentials
.aws/config
serviceAccountKey.json
*service_account*.json
firebase*.json

# Token files
*.token
auth.json
token.json
EOF
```

Sau khi tạo → log một dòng ngắn:
```
🔒 .claudeignore đã được tạo tự động — tiếp tục tác vụ.
```

---

### Bước 3 — Scan nội dung (nếu file đã lỡ đọc)

Nếu file đã được đọc vào context, scan tìm credentials thực sự:

| Pattern | Ví dụ detect |
|---|---|
| `AKIA[0-9A-Z]{16}` | AWS Access Key |
| `-----BEGIN.*PRIVATE KEY-----` | Private key |
| `(password\|passwd\|pwd)\s*=\s*\S{6,}` | Password hardcode |
| `(mysql\|postgresql\|mongodb)://\S+:\S+@` | DB connection string |
| `eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+` | JWT token |
| `gh[ps]_[A-Za-z0-9]{36}` | GitHub token |
| `xox[baprs]-[0-9A-Za-z]{10,}` | Slack token |

**Nếu detect → hiển thị cảnh báo, thêm file vào `.claudeignore`, KHÔNG tiếp tục xử lý file đó:**

```
🚨 Phát hiện [loại credential] trong [filename] (dòng [N] — đã ẩn nội dung)
→ Đã thêm vào .claudeignore. Hãy rotate credential này nếu đã bị expose.
```

---

## Template CLAUDE.md cho project

Đây là nội dung anh thêm vào `CLAUDE.md` tại root của mỗi project:

```markdown
## 🔒 Security Policy (Bắt buộc)

Trước khi đọc hoặc ghi bất kỳ file nào, thực hiện tuần tự:

### 1. Kiểm tra tên file
Nếu file target match bất kỳ pattern nào sau → BỎ QUA file đó, chuyển sang bước 2:
- `.env`, `.env.*`, `.env.local`, `.env.production`, `.env.staging`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer`
- `credentials/`, `secrets/`, `.secrets/`
- `config/database.yml`, `config/database.yaml`
- `.aws/credentials`, `serviceAccountKey.json`, `*service_account*.json`
- `firebase*.json`, `*.token`, `auth.json`, `id_rsa`, `id_ed25519`

### 2. Auto-tạo `.claudeignore` nếu chưa có
Không hỏi user — tự động tạo file với nội dung sau rồi log một dòng:
`🔒 .claudeignore đã được tạo tự động — tiếp tục tác vụ.`

**Nội dung `.claudeignore`:**
```
# === CLAUDE SECURITY IGNORE ===
.env
.env.*
.env.local
.env.production
.env.staging
*.secret
*.pem
*.key
*.p12
*.pfx
*.crt
*.cer
id_rsa
id_rsa.pub
id_ed25519
credentials/
secrets/
.secrets/
config/database.yml
config/database.yaml
config/secrets.yml
database.yml
.aws/credentials
.aws/config
serviceAccountKey.json
*service_account*.json
firebase*.json
*.token
auth.json
token.json
```

### 3. Nếu lỡ đọc file có credentials
Phát hiện → hiển thị cảnh báo ngắn → thêm vào `.claudeignore` → dừng xử lý file đó.
KHÔNG hiển thị nội dung credential trong response.
```

---

## Cách dùng

**Cài một lần cho project:**

```bash
# Tạo hoặc append vào CLAUDE.md
cat security-policy.md >> CLAUDE.md
```

**Cài cho nhiều project (script):**

```bash
#!/bin/bash
# install-security-policy.sh
PROJECTS=("~/projects/crv-pos" "~/projects/crvomgo" "~/projects/cams")
POLICY_BLOCK=$(cat << 'EOF'

## 🔒 Security Policy (Bắt buộc)
[... nội dung template ở trên ...]
EOF
)

for PROJECT in "${PROJECTS[@]}"; do
  CLAUDE_MD="$PROJECT/CLAUDE.md"
  if grep -q "Security Policy" "$CLAUDE_MD" 2>/dev/null; then
    echo "⏭️  $PROJECT — đã có security policy, bỏ qua"
  else
    echo "$POLICY_BLOCK" >> "$CLAUDE_MD"
    echo "✅ $PROJECT — đã thêm security policy"
  fi
done
```

---

## Nguyên tắc thiết kế

| Nguyên tắc | Lý do |
|---|---|
| **Chỉ kiểm tra file sắp đọc/ghi** | Không scan toàn project — nhanh, không làm chậm workflow |
| **Tự động xử lý, không hỏi** | Giảm friction — user đã đồng ý policy khi cài CLAUDE.md |
| **Log tối thiểu** | Một dòng xác nhận, không spam console |
| **CLAUDE.md pattern** | Mỗi project tự carry policy — không phụ thuộc global settings |
