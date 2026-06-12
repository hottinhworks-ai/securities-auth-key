---
name: security-check
description: >
  Cài đặt và vận hành lớp bảo vệ secrets cho project (API key, credentials,
  certificate, .env). Dùng khi user yêu cầu: bảo vệ secrets, chặn đọc .env,
  setup security check, audit xem project đã được bảo vệ chưa, hoặc hỏi vì sao
  một file bị chặn đọc. Skill này CHỈ thực hiện setup và giải thích —
  việc chặn thật sự do permissions.deny và PreToolUse hook đảm nhận.
---

# Security Check — Setup & Vận hành

## Kiến trúc 3 lớp

| Lớp | Cơ chế | Tính chất |
|---|---|---|
| 1 | `permissions.deny` trong `.claude/settings.json` | Harness cưỡng chế, deterministic, 0 latency |
| 2 | PreToolUse hook `secret-guard.js`, matcher `^(Read\|Edit\|Grep\|Write\|Bash\|PowerShell)$` | Deterministic, có allowlist tinh (.env.example, .mcp.json, *.pen); nhánh shell tokenize command, chặn lệnh nhắc tới path nhạy cảm; Write bị chặn để không tạo/ghi đè file secret |
| 3 | Security Policy trong `CLAUDE.md` | Behavioral: redact khi hiển thị, kể cả nội dung từ MCP |

Cả 3 lớp **không can thiệp tool `mcp__*`** — các luồng MCP (Jira, Outline,
Figma, Pencil, Slack...) chạy bình thường, không thêm latency, không bị block oan.

## Khi user yêu cầu setup

1. Clone hoặc xác định vị trí repo `securities-auth-key`.
2. Chạy installer (idempotent, merge — không ghi đè settings sẵn có):

   ```bash
   node <repo>/install.mjs <đường-dẫn-project>
   ```

3. Báo user khởi động lại session Claude Code để settings + hook có hiệu lực.
4. KHÔNG tự ý chạy installer giữa một tác vụ khác — setup là hành động
   user yêu cầu tường minh.

Nếu không có Node trong môi trường, thực hiện thủ công 3 việc của installer:
copy `hooks/secret-guard.js` vào `.claude/hooks/`, merge nội dung
`settings-template.json` vào `.claude/settings.json` (union mảng `deny`,
append hook entry nếu chưa có), append `CLAUDE-security-policy.md` vào
`CLAUDE.md` nếu chưa có mục "Security Policy".

## Khi user yêu cầu audit

Kiểm tra và báo cáo trạng thái từng lớp:

- `.claude/settings.json` có các rule `Read(...)` deny chưa? Thiếu rule nào
  so với `settings-template.json`?
- `.claude/hooks/secret-guard.js` tồn tại chưa? Hook entry có trong
  `settings.json` với matcher anchor `^(...)$` không?
- `CLAUDE.md` có mục Security Policy chưa?
- `.gitignore` có cover `.env`, `*.pem`, `secrets/` chưa? (bảo vệ khỏi
  commit nhầm — ngoài phạm vi Claude nhưng đáng cảnh báo)

## Khi một file bị chặn

Giải thích cho user: file khớp blocklist (xem `hooks/secret-guard.js`).
Không tìm cách lách (hook cũng chặn lệnh Bash/PowerShell nhắc tới path
nhạy cảm — kể cả `rm`/`echo >`; nếu user cần tự chạy lệnh đó, gợi ý họ
gõ `! <command>` trong prompt). Nếu user muốn cho phép file cụ thể,
hướng dẫn thêm pattern vào `ALLOW` trong hook, hoặc bỏ rule deny tương ứng
trong `.claude/settings.json` — đó là quyết định của user.

## Giới hạn cần nói rõ khi user hỏi

- Các lớp này chỉ guard **tool call của Claude**. MCP server là process riêng
  với quyền filesystem riêng — chúng vẫn tự đọc được file của chúng.
- Grep trên cả thư mục có thể trả về dòng khớp từ file nhạy cảm nằm trong đó
  (hook chỉ chặn khi `path` trỏ thẳng vào file/thư mục nhạy cảm) — lớp 3
  (redact) là lưới đỡ cho trường hợp này.
- Secret đã nằm trong context từ trước khi setup thì không thu hồi được —
  chỉ redact khi hiển thị; khuyên user rotate nếu đã expose.
