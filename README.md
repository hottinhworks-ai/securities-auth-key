# 🔒 Security Check — Claude Code Skill

Bảo vệ secrets (API keys, credentials, certificates, `.env`...) khỏi bị Claude Code
đọc vào context — bằng cơ chế **harness cưỡng chế thật sự**, không chỉ là lời dặn
trong prompt. Thiết kế để **không ảnh hưởng các luồng MCP** đang hoạt động.

## English summary — and why this repo exists

**What it is:** deterministic, 3-layer secrets protection for [Claude Code](https://claude.com/claude-code).
It stops the AI agent from reading `.env` files, private keys and credentials into
its context — enforced by the harness itself (`permissions.deny` + a PreToolUse
hook covering `Read`/`Edit`/`Grep`/`Bash`/`PowerShell`), with a CLAUDE.md redaction
policy as the last safety net. All three layers are designed to never touch
`mcp__*` tools, so Jira/Confluence/Outline/Figma/Slack flows keep working with
zero added latency.

**Why it was born:** this repo came out of hard lessons running Claude Code on
real work projects:

1. **`.claudeignore` is not honored** — the "obvious" protection simply does not
   exist in Claude Code. Files we assumed were hidden were readable all along.
2. **Prompt-only rules don't survive contact with reality.** Instructions like
   "never read .env" live in CLAUDE.md, but behavioral rules can be skipped,
   misread, or silently lost when a long session gets summarized. A guardrail
   that depends on the model *remembering* it is not a guardrail.
3. **Every gap we found was found the hard way.** A live API key sitting in a
   project config file; later, a working `cat .env` bypass through the Bash tool
   that sailed past both enforcement layers (fixed in this repo — the hook now
   tokenizes shell commands too).

The conclusion: secrets protection for AI coding agents must be **deterministic
first** (deny rules + hooks the harness enforces on every tool call), **behavioral
second** (redaction policy for whatever still leaks in via directory greps or MCP
responses), and **MCP-safe by design** — a security layer that breaks your
integrations is a security layer people turn off.

Docs below are in Vietnamese; the code and config are language-neutral.

## Kiến trúc 3 lớp

```
Lớp 1  permissions.deny        .claude/settings.json — harness chặn, 0 latency
Lớp 2  PreToolUse hook         secret-guard.js — matcher ^(Read|Edit|Grep|Bash|PowerShell)$
Lớp 3  CLAUDE.md policy        redact khi hiển thị (kể cả nội dung từ MCP)
```

- **Lớp 1+2 là deterministic** — không phụ thuộc model "nhớ" policy, không bị
  mất tác dụng khi context dài bị summarize.
- **Lớp 3 là behavioral** — lưới đỡ cuối: nếu secret vẫn lọt vào context
  (qua Grep thư mục, qua MCP response...), che giá trị khi hiển thị.

## An toàn với MCP

| Thiết kế | Tác dụng |
|---|---|
| Hook matcher anchor `^(Read\|Edit\|Grep\|Bash\|PowerShell)$` | Không match `mcp__*`, không match `ReadMcpResourceTool` → các luồng Jira/Outline/Figma/Slack... không thêm latency, không bị block |
| `permissions.deny` chỉ dùng rule `Read(...)` | Chỉ áp lên file tool của harness, không đụng MCP tool |
| Allowlist `.mcp.json`, `.claude.json`, `.claude/settings*.json` | Vẫn debug/sửa được config MCP server; token bên trong được redact khi hiển thị |
| Allowlist `*.pen` | File Pencil mã hóa chỉ truy cập qua MCP tools — hook không can thiệp |
| Nội dung từ MCP: chỉ redact, không bao giờ halt | Trang Confluence/Outline chứa chuỗi giống JWT không làm đứt luồng |

**Giới hạn:** các lớp này guard tool call của Claude. MCP server là process riêng
với quyền filesystem riêng — skill này không (và không thể) ngăn server-side reads.

## Cài đặt

Yêu cầu: Node ≥ 16 (chỉ để chạy installer + hook).

```bash
git clone https://github.com/hottinhworks-ai/securities-auth-key
node securities-auth-key/install.mjs /path/to/your-project
```

Installer idempotent — chạy lại không tạo trùng lặp, **merge** vào settings sẵn có
chứ không ghi đè:

1. Copy `hooks/secret-guard.js` → `.claude/hooks/`
2. Merge `settings-template.json` → `.claude/settings.json` (union `deny`, thêm hook entry)
3. Append `CLAUDE-security-policy.md` → `CLAUDE.md` (bỏ qua nếu đã có)

Sau đó **khởi động lại session Claude Code** để có hiệu lực.

> Cài như skill (tùy chọn): copy `skills/security-check/` vào `.claude/skills/`
> của project hoặc `~/.claude/skills/` — Claude sẽ tự dùng khi bạn yêu cầu
> setup/audit security check.

## File trong repo

| File | Vai trò |
|---|---|
| `hooks/secret-guard.js` | PreToolUse hook — chặn đọc file nhạy cảm (lớp 2) |
| `settings-template.json` | `permissions.deny` + hook registration (lớp 1+2) |
| `CLAUDE-security-policy.md` | Policy redact append vào `CLAUDE.md` (lớp 3) |
| `skills/security-check/SKILL.md` | Skill setup/audit cho Claude Code |
| `install.mjs` | Installer idempotent, cross-platform |
| `test-hook.mjs` | Test suite cho hook (`node test-hook.mjs`) |

## Pattern được bảo vệ

**Chặn đọc (lớp 1+2):** `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`,
`id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519`, `credentials/`, `secrets/`, `.secrets/`,
`.aws/credentials`, `*service_account*.json`, `*.token`, `auth.json`, `token.json`

**Chặn qua shell (lớp 2):** hook tokenize chuỗi lệnh `Bash`/`PowerShell` và chặn
khi lệnh nhắc tới path khớp blocklist (vd `cat .env`, `Get-Content .env`,
`rg --glob=.env`). Đây là tripwire chống đọc nhầm, không phải sandbox — glob
(`cat .en*`) hoặc biến gián tiếp có thể lách, phần đó do lớp 3 redact đỡ.
Trade-off: mọi lệnh *nhắc tới* path nhạy cảm đều bị chặn, kể cả `rm .env`.

**Không chặn (allowlist):** `.env.example`/`.sample`/`.template`/`.dist`, `*.pub`
(public key), `.mcp.json`, `.claude.json`, `.claude/settings*.json`, `*.pen`

**Redact khi hiển thị (lớp 3):** AWS key, private key block, JWT (3 segment),
GitHub/GitLab/Slack/npm token, Anthropic/OpenAI/Google/Stripe key, password
hardcode (`=` và `:`), DB connection string có password.

Lý do tách 2 tầng chặn/redact: file kiểu `database.yml`, `firebase.json`, `*.crt`
*có thể* chứa secret nhưng thường là config hợp lệ cần đọc — chặn cứng gây phiền
mà không tăng bảo mật; redact là đủ.

## Tác giả

Built with Claude Code · [hottinhworks-ai](https://github.com/hottinhworks-ai)
