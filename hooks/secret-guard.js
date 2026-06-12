#!/usr/bin/env node
/**
 * secret-guard.js — PreToolUse hook cho Claude Code
 *
 * Chặn các tool đọc/ghi file (Read / Edit / Grep / Write) khi target là file
 * nhạy cảm, và chặn lệnh shell (Bash / PowerShell) khi command nhắc tới file
 * nhạy cảm. Write bị chặn để Claude không tạo/ghi đè .env, key... — theo
 * policy thì code mới phải dùng .env.example.
 * Chạy qua matcher "^(Read|Edit|Grep|Write|Bash|PowerShell)$" trong
 * .claude/settings.json — anchor ^$ để không match nhầm tool khác
 * (vd: ReadMcpResourceTool) và KHÔNG match các tool mcp__* nên không thêm
 * latency / không block các luồng MCP đang chạy.
 *
 * Lưu ý nhánh shell: đây là tripwire chống đọc nhầm, không phải sandbox —
 * tokenize thô chuỗi lệnh rồi so từng token với BLOCK list. Glob/biến gián
 * tiếp (cat .en*, $f=.env) có thể lách; lớp hành vi trong CLAUDE.md xử lý
 * phần còn lại. Chặn theo "lệnh có nhắc tới path" nên cả rm/echo > .env
 * cũng bị chặn — chấp nhận false positive này cho an toàn.
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

  const toolName = (data && data.tool_name) || '';
  const toolInput = (data && data.tool_input) || {};

  const deny = (target, label, via) => {
    process.stderr.write(
      `🔒 secret-guard: đã chặn ${via} "${target}" (${label}). ` +
        `File này nằm trong danh sách nhạy cảm của security policy. ` +
        `Nếu cần giá trị bên trong, hãy yêu cầu user cung cấp bản đã redact, ` +
        `hoặc dùng file .env.example. Tiếp tục tác vụ và bỏ qua file này.\n`
    );
    process.exit(2);
  };

  const matchBlock = (p) => {
    if (ALLOW.some((re) => re.test(p))) return null;
    for (const rule of BLOCK) if (rule.re.test(p)) return rule;
    return null;
  };

  if (toolName === 'Bash' || toolName === 'PowerShell') {
    // Tách thô theo whitespace + ký tự điều khiển shell, bỏ quote bao ngoài.
    // Tách cả "=" để bắt dạng --glob=.env; path chứa space bị cắt đôi nhưng
    // phần đuôi (nơi BLOCK pattern match) vẫn còn nguyên.
    const cmd = String(toolInput.command || '');
    const tokens = cmd.split(/[\s;|&<>()'"`,=]+/).filter(Boolean);
    for (const t of tokens) {
      const rule = matchBlock(t.replace(/\\/g, '/'));
      if (rule) deny(t, rule.label, `lệnh ${toolName} chạm tới`);
    }
    process.exit(0);
  }

  // Read/Edit dùng file_path; Grep dùng path (file hoặc thư mục)
  const target = toolInput.file_path || toolInput.path || toolInput.notebook_path || '';
  if (!target) process.exit(0);

  const rule = matchBlock(String(target).replace(/\\/g, '/'));
  if (rule) deny(target, rule.label, 'truy cập');

  process.exit(0);
});
