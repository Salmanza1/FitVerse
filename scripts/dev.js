#!/usr/bin/env node
/**
 * Cross-platform dev launcher.
 *
 * macOS/Linux keep the existing shell scripts (cloudflared shared tunnel, lsof
 * port cleanup) so nothing changes for anyone already using them.
 *
 * Windows can't use those: `bash` on PATH resolves to WSL, which has no access
 * to the Windows node_modules, and `lsof` doesn't exist. There we call the Expo
 * CLI directly instead.
 *
 *   node scripts/dev.js <tunnel|lan> [...extra expo args]
 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const PORT = '8081';
const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const [, , rawMode, ...passthrough] = process.argv;
const mode = rawMode === 'tunnel' ? 'tunnel' : 'lan';

/** Best-effort: free port 8081 so a stale Metro doesn't push us to 8082. */
function freePort() {
  if (!isWindows) return; // the shell scripts already handle this via lsof
  const found = spawnSync(
    'netstat',
    ['-ano', '-p', 'TCP'],
    { encoding: 'utf8' }
  );
  if (found.status !== 0 || !found.stdout) return;

  const pids = new Set();
  for (const line of found.stdout.split(/\r?\n/)) {
    // e.g.  TCP    0.0.0.0:8081    0.0.0.0:0    LISTENING    12345
    const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/);
    if (m && m[1] === PORT) pids.add(m[2]);
  }
  for (const pid of pids) {
    if (pid === '0') continue;
    console.log(`Stopping old dev server on port ${PORT} (pid ${pid})...`);
    spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
  }
}

function run(command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: isWindows, // needed so npx/.cmd shims resolve on Windows
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
  child.on('error', (err) => {
    console.error(`Failed to start "${command}":`, err.message);
    process.exit(1);
  });
}

if (!isWindows) {
  const script = mode === 'tunnel' ? 'scripts/dev.sh' : 'scripts/dev-lan.sh';
  run('bash', [script, ...passthrough]);
} else {
  freePort();

  // --localhost sets its own host mode, so don't also pass --lan/--tunnel.
  const args = ['expo', 'start', '--port', PORT];
  if (!passthrough.includes('--localhost')) {
    args.push(mode === 'tunnel' ? '--tunnel' : '--lan');
  }
  args.push(...passthrough);

  if (mode === 'tunnel') {
    console.log('\nFitVerse dev server (Expo tunnel) — shareable QR.\n');
  } else {
    console.log('\nFitVerse dev server (LAN) — phone must be on the same Wi-Fi.\n');
  }
  run('npx', args);
}
