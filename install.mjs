#!/usr/bin/env node
/**
 * install.mjs — Cài security-check vào một project.
 *
 *   node install.mjs [đường-dẫn-project]   (mặc định: thư mục hiện tại)
 *
 * Việc thực hiện (idempotent — chạy lại không tạo trùng lặp):
 *   1. Copy hooks/secret-guard.js  →  <project>/.claude/hooks/secret-guard.js
 *   2. Merge settings-template.json vào <project>/.claude/settings.json
 *      (giữ nguyên settings sẵn có; chỉ thêm deny rule / hook còn thiếu)
 *   3. Append CLAUDE-security-policy.md vào <project>/CLAUDE.md nếu chưa có
 *
 * Cross-platform: Windows / macOS / Linux, chỉ cần Node >= 16.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(process.argv[2] || process.cwd());

if (!fs.existsSync(PROJECT)) {
  console.error(`❌ Không tìm thấy thư mục project: ${PROJECT}`);
  process.exit(1);
}

const log = (msg) => console.log(msg);
log(`🔧 Cài security-check vào: ${PROJECT}\n`);

// ── 1. Copy hook ────────────────────────────────────────────────────────────
const hookSrc = path.join(HERE, 'hooks', 'secret-guard.js');
const hookDstDir = path.join(PROJECT, '.claude', 'hooks');
const hookDst = path.join(hookDstDir, 'secret-guard.js');

fs.mkdirSync(hookDstDir, { recursive: true });
fs.copyFileSync(hookSrc, hookDst);
log('✅ .claude/hooks/secret-guard.js');

// ── 2. Merge settings.json ──────────────────────────────────────────────────
const template = JSON.parse(
  fs.readFileSync(path.join(HERE, 'settings-template.json'), 'utf8')
);
delete template['//'];
delete template['//layers'];

const settingsPath = path.join(PROJECT, '.claude', 'settings.json');
let settings = {};
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    console.error(`❌ .claude/settings.json sẵn có nhưng không parse được JSON: ${e.message}`);
    console.error('   Sửa file này trước rồi chạy lại — installer không ghi đè file hỏng.');
    process.exit(1);
  }
}

// permissions.deny: union, giữ thứ tự sẵn có
settings.permissions = settings.permissions || {};
const existingDeny = settings.permissions.deny || [];
const newDeny = template.permissions.deny.filter((r) => !existingDeny.includes(r));
settings.permissions.deny = [...existingDeny, ...newDeny];

// hooks.PreToolUse: thêm nếu chưa có entry secret-guard; nếu có rồi thì
// đồng bộ lại command + matcher (nâng cấp bản cài cũ).
//
// Hook command dùng ABSOLUTE PATH của node đang chạy installer thay vì
// "node" trần: trên máy không có node trong PATH, hook spawn fail → exit
// khác 2 → harness coi là lỗi không chặn → lớp 2 TẮT ÂM THẦM (fail-open).
// Đổi lại settings.json thành machine-specific — nếu project share settings
// qua git giữa nhiều máy, mỗi máy chạy lại installer một lần là xong.
const nodeCmd = `"${process.execPath}" .claude/hooks/secret-guard.js`;
const guardEntry = JSON.parse(JSON.stringify(template.hooks.PreToolUse[0]));
guardEntry.hooks[0].command = nodeCmd;

settings.hooks = settings.hooks || {};
settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
let hasGuard = false;
for (const entry of settings.hooks.PreToolUse) {
  if (!(entry.hooks || []).some((h) => String(h.command || '').includes('secret-guard'))) continue;
  hasGuard = true;
  entry.matcher = guardEntry.matcher;
  for (const h of entry.hooks) {
    if (String(h.command || '').includes('secret-guard')) h.command = nodeCmd;
  }
}
if (!hasGuard) settings.hooks.PreToolUse.push(guardEntry);

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
log(
  `✅ .claude/settings.json (${newDeny.length} deny rule mới, hook ${hasGuard ? 'đã đồng bộ lại' : 'đã thêm'}, node: ${process.execPath})`
);

// ── 3. Append policy vào CLAUDE.md ──────────────────────────────────────────
const policy = fs.readFileSync(path.join(HERE, 'CLAUDE-security-policy.md'), 'utf8');
const claudeMdPath = path.join(PROJECT, 'CLAUDE.md');
const existingMd = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';

if (existingMd.includes('Security Policy')) {
  log('⏭️  CLAUDE.md đã có Security Policy — bỏ qua');
} else {
  fs.writeFileSync(claudeMdPath, existingMd + (existingMd ? '\n\n' : '') + policy);
  log('✅ CLAUDE.md (đã append security policy)');
}

log('\n🔒 Xong. Khởi động lại session Claude Code để settings + hook có hiệu lực.');
