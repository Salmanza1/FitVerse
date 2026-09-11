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

/**
 * Open a cloudflared quick tunnel and return its public URL.
 *
 * Expo's own --tunnel uses ngrok, which doesn't work here: the lockfile only
 * carries the darwin-arm64 ngrok binary, so on Windows it tries to spawn a
 * macOS executable. cloudflared needs no account and is the same thing
 * scripts/dev.sh already uses on macOS.
 */
function startCloudflared() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', 'cloudflared@latest', 'tunnel', '--url', `http://127.0.0.1:${PORT}`], {
      cwd: projectRoot,
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let settled = false;
    const done = (err, url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      err ? reject(err) : resolve({ url, child });
    };

    // cloudflared prints the URL on stderr.
    const scan = (buf) => {
      const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) done(null, m[0]);
    };
    child.stdout.on('data', scan);
    child.stderr.on('data', scan);
    child.on('error', (e) => done(new Error(`cloudflared failed to start: ${e.message}`)));
    child.on('exit', (code) => done(new Error(`cloudflared exited early (code ${code})`)));

    const timer = setTimeout(() => done(new Error('timed out waiting for a tunnel URL')), 60000);

    const stop = () => { try { child.kill(); } catch {} };
    process.on('exit', stop);
    process.on('SIGINT', () => { stop(); process.exit(0); });
    process.on('SIGTERM', () => { stop(); process.exit(0); });
  });
}

async function main() {
  if (!isWindows) {
    const script = mode === 'tunnel' ? 'scripts/dev.sh' : 'scripts/dev-lan.sh';
    run('bash', [script, ...passthrough]);
    return;
  }

  freePort();

  // --localhost sets its own host mode, so don't also pass --lan.
  const args = ['expo', 'start', '--port', PORT];
  const hostFlag = !passthrough.includes('--localhost');

  if (mode === 'tunnel') {
    console.log('\nFitVerse dev server — starting public tunnel...\n');
    try {
      const { url } = await startCloudflared();
      const host = url.replace(/^https?:\/\//, '');
      console.log(`Public link: ${url}`);
      console.log(`Expo Go URL: exp://${host}`);
      console.log('\nWorks on any network — useful on Wi-Fi that blocks device-to-device traffic.\n');
      // Tells Metro to hand out the tunnel host instead of the LAN IP.
      process.env.EXPO_PACKAGER_PROXY_URL = url;
    } catch (err) {
      console.error(`\nCould not start the tunnel: ${err.message}`);
      console.error('Falling back to LAN — this only works if your phone can reach this machine.\n');
    }
    if (hostFlag) args.push('--lan');
  } else {
    console.log('\nFitVerse dev server (LAN) — phone must be on the same Wi-Fi.\n');
    if (hostFlag) args.push('--lan');
  }

  args.push(...passthrough);
  run('npx', args);
}

main();
