## 🔒 Security Policy

Đây là **lớp hành vi** (lớp 3) của security-check. Hai lớp cưỡng chế nằm ở
`.claude/settings.json` (`permissions.deny` + PreToolUse hook `secret-guard.js`)
— xem repo [securities-auth-key](https://github.com/hottinhworks-ai/securities-auth-key).
Lớp này chỉ quy định cách Claude **hiển thị và xử lý** nội dung nhạy cảm đã lọt
vào context; nó KHÔNG tự tạo file, KHÔNG sửa config, KHÔNG dừng luồng đang chạy.

### 1. Quy tắc redact khi hiển thị

Nếu nội dung trong context (từ file đọc được, tool output, hoặc MCP response)
chứa chuỗi khớp các pattern sau, **luôn che giá trị khi hiển thị** trong response
(giữ 4 ký tự đầu, thay phần còn lại bằng `…[redacted]`):

| Pattern | Loại credential |
|---|---|
| `AKIA[0-9A-Z]{16}` | AWS Access Key |
| `-----BEGIN [A-Z ]*PRIVATE KEY-----` | Private key |
| `eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}` | JWT (đủ 3 segment) |
| `gh[pousr]_[A-Za-z0-9]{36,}` | GitHub token |
| `glpat-[\w-]{20,}` | GitLab token |
| `xox[baprs]-[0-9A-Za-z-]{10,}` | Slack token |
| `sk-ant-[\w-]{20,}` | Anthropic API key |
| `sk-[A-Za-z0-9]{20,}` | OpenAI API key |
| `AIza[0-9A-Za-z_-]{35}` | Google API key |
| `sk_live_[A-Za-z0-9]{20,}` | Stripe live key |
| `npm_[A-Za-z0-9]{36}` | npm token |
| `(password|passwd|pwd)\s*[:=]\s*\S{6,}` | Password hardcode (cả `=` lẫn `:` YAML/JSON) |
| `(mysql|postgres(ql)?|mongodb(\+srv)?|redis|amqp)://[^/\s:]+:[^@\s]+@` | DB connection string có password |

Khi redact từ một **file trong project**, kèm thêm cảnh báo một dòng:

```
🚨 Phát hiện [loại credential] trong [filename] — đã che trong response.
   Nếu credential này từng bị expose (commit/log/chat), hãy rotate ngay.
```

### 2. Nội dung đến từ MCP — chỉ redact, KHÔNG dừng

Response từ các tool `mcp__*` (Jira, Confluence, Outline, Slack, Figma, Pencil...)
thường chứa chuỗi giống token (base64, JWT của chính API, ID dài). Với nội dung này:

- **Không bao giờ dừng tác vụ** hay từ chối xử lý trang/tài liệu — tiếp tục
  bình thường, chỉ che các giá trị khớp pattern khi hiển thị lại.
- Không ghi các giá trị đó vào file, commit, hay tài liệu khác.
- Không thêm bất kỳ rule chặn nào nhắm vào tool `mcp__*`.

### 3. File config của Claude Code / MCP

`.mcp.json`, `~/.claude.json`, `.claude/settings*.json` chứa env/token của các
MCP server. Được phép **đọc và sửa** các file này khi user yêu cầu (debug MCP,
thêm server...), nhưng khi hiển thị nội dung thì che giá trị của các key dạng
`*_TOKEN`, `*_KEY`, `*_SECRET`, `apiKey`, `Authorization`.

### 4. Khi bị hook/deny chặn đọc file

Nếu tool Read/Edit/Grep bị chặn bởi `secret-guard` hoặc `permissions.deny`:
**bỏ qua file đó và tiếp tục tác vụ** — không thử lách (cat, PowerShell,
copy file, đổi tên...). Nếu thật sự cần giá trị bên trong, nói rõ với user
và đề nghị họ cung cấp bản đã redact hoặc dùng `.env.example`.

### 5. Khi viết code mới

- Không hardcode credential vào code/ví dụ — dùng biến môi trường và cập nhật
  `.env.example` (không phải `.env`).
- Không log giá trị secret; log tên biến là đủ.
