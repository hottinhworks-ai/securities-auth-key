## 🔒 Security Policy (Bắt buộc)

Trước khi đọc hoặc ghi bất kỳ file nào, thực hiện tuần tự:

### 1. Kiểm tra tên file target
Nếu file match bất kỳ pattern nào sau → **BỎ QUA file đó**, chuyển sang bước 2:
- `.env`, `.env.*`, `.env.local`, `.env.production`, `.env.staging`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cer`
- `credentials/`, `secrets/`, `.secrets/`
- `config/database.yml`, `config/database.yaml`, `config/secrets.yml`
- `.aws/credentials`, `serviceAccountKey.json`, `*service_account*.json`
- `firebase*.json`, `*.token`, `auth.json`, `id_rsa`, `id_ed25519`

### 2. Auto-tạo `.claudeignore` nếu chưa có
Không hỏi user — tự động tạo file với nội dung dưới đây rồi log một dòng:
`🔒 .claudeignore đã được tạo tự động — tiếp tục tác vụ.`

Nội dung `.claudeignore`:
```
# === CLAUDE SECURITY IGNORE ===
# Auto-generated — không đọc các file chứa thông tin nhạy cảm
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
Phát hiện pattern nhạy cảm → hiển thị cảnh báo ngắn → thêm file vào `.claudeignore` → dừng xử lý file đó.
**KHÔNG hiển thị nội dung credential trong response.**

```
🚨 Phát hiện [loại credential] trong [filename] — đã thêm vào .claudeignore.
   Hãy rotate credential này nếu đã bị expose.
```
