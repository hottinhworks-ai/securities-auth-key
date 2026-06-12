# 🔒 Security Check — Claude Code Skill

Skill bảo mật tự động cho Claude Code CLI. Kiểm tra và bảo vệ thông tin nhạy cảm (API keys, credentials, certificates...) trước khi chúng bị đưa vào context gửi lên server.

## Tính năng

- **Tự động tạo `.claudeignore`** khi chưa có — không hỏi, không friction
- **Chặn đọc file nhạy cảm** — `.env`, `*.key`, `*.pem`, `credentials/`...
- **Scan nội dung** — phát hiện AWS keys, JWT tokens, DB connection strings...
- **CLAUDE.md pattern** — nhúng trực tiếp vào từng project

## Cách dùng

### Cách 1 — Dùng như Claude Code Skill

```bash
# Trong Claude Code session
/install-skill security-check.skill
```

### Cách 2 — Nhúng vào CLAUDE.md của project (khuyến nghị)

```bash
cat CLAUDE-security-policy.md >> your-project/CLAUDE.md
```

## Files

| File | Mô tả |
|---|---|
| `SKILL.md` | Skill definition cho Claude Code |
| `CLAUDE-security-policy.md` | Template paste vào CLAUDE.md của project |

## Patterns được bảo vệ

```
.env, .env.*, *.pem, *.key, *.p12, *.pfx
credentials/, secrets/, .secrets/
config/database.yml, config/database.yaml
.aws/credentials, serviceAccountKey.json
firebase*.json, *.token, auth.json, id_rsa
```

## Tác giả

Built with Claude Code · [hottinhworks-ai](https://github.com/hottinhworks-ai)
