import { execSync } from 'node:child_process';

const cases = [
  ['Read', { file_path: 'C:/proj/.env' }, 2],
  ['Read', { file_path: '.env.example' }, 0],
  ['Read', { file_path: 'src/app.js' }, 0],
  ['Read', { file_path: '.mcp.json' }, 0],
  ['Read', { file_path: 'C:\\Users\\x\\.claude.json' }, 0],
  ['Read', { file_path: '/home/u/.ssh/id_rsa' }, 2],
  ['Read', { file_path: 'design/app.pen' }, 0],
  ['Grep', { path: './secrets' }, 2],
  ['Read', { file_path: 'cert/server.key' }, 2],
  ['Read', { file_path: 'cert/server.pub' }, 0],
  ['Read', { file_path: 'config/firebase.json' }, 0],
  ['Edit', { file_path: 'serviceAccountKey.json' }, 2],
  ['Read', { file_path: '.claude/settings.local.json' }, 0],
  ['Read', { file_path: 'monkey.tokens.js' }, 0],
  ['Read', { file_path: '.env.production' }, 2],
  ['Read', { file_path: 'a/credentials/gcp.json' }, 2],
  // Write: chặn tạo/ghi đè file secret, cho phép file mẫu
  ['Write', { file_path: 'C:/proj/.env' }, 2],
  ['Write', { file_path: '.env.example' }, 0],
  ['Write', { file_path: 'src/new-file.ts' }, 0],
  ['Write', { file_path: 'cert/server.key' }, 2],
  // Nhánh shell: tokenize tool_input.command
  ['Bash', { command: 'cat .env' }, 2],
  ['Bash', { command: 'cat .env.hooktest' }, 2],
  ['Bash', { command: 'rg secret --glob=.env' }, 2],
  ['Bash', { command: 'ssh-keygen -f ~/.ssh/id_rsa' }, 2],
  ['Bash', { command: 'cat ./secrets/db.txt' }, 2],
  ['Bash', { command: 'echo x > .env' }, 2],
  ['Bash', { command: 'cat .env.example' }, 0],
  ['Bash', { command: 'git status && npm test' }, 0],
  ['PowerShell', { command: 'Get-Content -Path C:\\proj\\.env -Raw' }, 2],
  ['PowerShell', { command: 'type .env | clip' }, 2],
  ['PowerShell', { command: 'Get-ChildItem src' }, 0],
];

let fail = 0;
for (const [tool, ti, want] of cases) {
  const input = JSON.stringify({ tool_name: tool, tool_input: ti });
  let got = 0;
  try {
    execSync('node hooks/secret-guard.js', { input, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    got = e.status;
  }
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${tool} ${JSON.stringify(ti)} -> exit ${got} (want ${want})`);
}
console.log(fail ? `${fail} FAILED` : 'ALL PASS');
process.exit(fail ? 1 : 0);
