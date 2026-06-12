#!/usr/bin/env node
/**
 * secret-guard.js — PreToolUse hook cho Claude Code
 *
 * Chặn các tool đọc file (Read / Edit / Grep) khi target là file nhạy cảm.
 * Chạy qua matcher "^(Read|Edit|Grep)$" trong .claude/settings.json — anchor ^$
 * để không match nhầm tool khác (vd: ReadMcpResourceTool) và KHÔNG match
 * các tool mcp__* nên không thêm latency / không block các luồng MCP đang chạy.
 *
 * Quy ước exit code của PreToolUse hook:
 *   0 = cho phép tool chạy
 *   2 = chặn tool, nội dung stderr được đưa lại cho Claude làm lý do
 *
 * Nguyên tắc fail-open: lỗi parse / input lạ → exit 0 (cho qua),
 * để hook lỗi không làm gãy phiên làm việc. Lớp chặn cứng cuối cùng
 * là permissions.deny trong settings.json.
 */

'use strict';

// ── Allowlist: không bao giờ chặn ──────────────────────────────────────────
// - .env.example/.sample/.template/.dist: file mẫu, không chứa secret thật
// - .mcp.json / .claude.json / .claude/settings*.json: config MCP & harness —
//   chặn các file này sẽ làm mất khả năng debug/sửa MCP server.
//   (Giá trị token bên trong được xử lý bằng quy tắc redact ở CLAUDE.md.)
// - *.pub: public key, không phải secret
// - *.pen: file Pencil mã hóa, chỉ truy cập qua MCP tools — không can thiệp
const ALLOW = [
  /\.env\.(example|sample|template|dist)$/i,
  /(^|\/)\.mcp\.json$/i,
  /(^|\/)\.claude\.json$/i,
  /(^|\/)\.claude\/settings(\.local)?\.json$/i,
  /\.pub$/i,
  /\.pen$/i,
];

// ── Blocklist: chặn đọc ────────────────────────────────────────────────────
// Chỉ gồm file gần như chắc chắn chứa secret. Các file "có thể chứa secret"
// (database.yml, firebase.json, *.crt...) KHÔNG chặn — xử lý bằng quy tắc
// redact trong CLAUDE-security-policy.md để không cản trở công việc hợp lệ.
const BLOCK = [
  { re: /(^|\/)\.env(\.[^/]+)?$/i,                    label: 'environment file' },
  { re: /\.(pem|p12|pfx)$/i,                          label: 'private key / keystore' },
  { re: /\.key$/i,                                    label: 'key file' },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,         label: 'SSH private key' },
  { re: /(^|\/)(credentials|secrets|\.secrets)(\/|$)/i, label: 'credentials directory' },
  { re: /(^|\/)\.aws\/(credentials|config)$/i,        label: 'AWS credentials' },
  { re: /service_?account.*\.json$/i,                 label: 'service account key' },
  { re: /\.token$/i,                                  label: 'token file' },
  { re: /(^|\/)(auth|token)\.json$/i,                 label: 'auth token file' },
];

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    process.exit(0); // fail-open
  }

  const toolInput = (data && data.tool_input) || {};
  // Read/Edit dùng file_path; Grep dùng path (file hoặc thư mục)
  const target = toolInput.file_path || toolInput.path || toolInput.notebook_path || '';
  if (!target) process.exit(0);

  const p = String(target).replace(/\\/g, '/');

  if (ALLOW.some((re) => re.test(p))) process.exit(0);

  for (const rule of BLOCK) {
    if (rule.re.test(p)) {
      process.stderr.write(
        `🔒 secret-guard: đã chặn truy cập "${target}" (${rule.label}). ` +
          `File này nằm trong danh sách nhạy cảm của security policy. ` +
          `Nếu cần giá trị bên trong, hãy yêu cầu user cung cấp bản đã redact, ` +
          `hoặc dùng file .env.example. Tiếp tục tác vụ và bỏ qua file này.\n`
      );
      process.exit(2);
    }
  }

  process.exit(0);
});
