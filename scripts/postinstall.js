#!/usr/bin/env node

/**
 * Postinstall script for agent-browser
 *
 * Downloads the platform-specific native binary if not present (or invalid).
 */

import {
  existsSync,
  mkdirSync,
  chmodSync,
  createWriteStream,
  unlinkSync,
  accessSync,
  statSync,
  constants,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { platform, arch } from 'os';
import { get } from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const binDir = join(projectRoot, 'bin');

// Platform detection
const platformKey = `${platform()}-${arch()}`;
const ext = platform() === 'win32' ? '.exe' : '';
const binaryName = `agent-browser-${platformKey}${ext}`;
const binaryPath = join(binDir, binaryName);

// Package info
const packageJson = JSON.parse(
  (await import('fs')).readFileSync(join(projectRoot, 'package.json'), 'utf8')
);
const version = packageJson.version;

function getGithubRepo(packageJson) {
  const repoUrl =
    typeof packageJson?.repository === 'string'
      ? packageJson.repository
      : packageJson?.repository?.url;
  if (typeof repoUrl !== 'string') return 'vercel-labs/agent-browser';

  const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/i);
  return match?.[1] ?? 'vercel-labs/agent-browser';
}

const GITHUB_REPO = getGithubRepo(packageJson);
const DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${binaryName}`;

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    let settled = false;

    const cleanup = (err) => {
      if (settled) return;
      settled = true;
      try {
        file.close();
      } catch {}
      try {
        unlinkSync(dest);
      } catch {}
      reject(err);
    };

    const request = (url) => {
      get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          request(response.headers.location);
          return;
        }
        
        if (response.statusCode !== 200) {
          cleanup(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }
        
        response.on('error', cleanup);
        response.pipe(file);
        file.on('finish', () => {
          if (settled) return;
          settled = true;
          file.close();
          resolve();
        });
      }).on('error', cleanup);
    };
    
    request(url);
  });
}

function isValidBinary(binaryPath) {
  try {
    const stats = statSync(binaryPath);
    if (!stats.isFile() || stats.size === 0) return false;
    if (platform() === 'win32') return true;
    accessSync(binaryPath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Check if binary already exists
  if (existsSync(binaryPath) && isValidBinary(binaryPath)) {
    console.log(`✓ Native binary already exists: ${binaryName}`);
    return;
  }

  // Ensure bin directory exists
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  console.log(`Downloading native binary for ${platformKey}...`);
  console.log(`URL: ${DOWNLOAD_URL}`);

  try {
    if (existsSync(binaryPath)) {
      unlinkSync(binaryPath);
    }

    await downloadFile(DOWNLOAD_URL, binaryPath);
    
    // Make executable on Unix
    if (platform() !== 'win32') {
      chmodSync(binaryPath, 0o755);
    }
    
    console.log(`✓ Downloaded native binary: ${binaryName}`);
  } catch (err) {
    console.log(`⚠ Could not download native binary: ${err.message}`);
    console.log('');
    console.log('The agent-browser CLI requires a native binary for your platform.');
    console.log('To build the native binary locally:');
    console.log('  1. Install Rust: https://rustup.rs');
    console.log('  2. Run: npm run build:native');
  }

  // Reminder about Playwright browsers
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║ To download browser binaries, run:                                        ║');
  console.log('║                                                                           ║');
  console.log('║     npx playwright install chromium                                       ║');
  console.log('║                                                                           ║');
  console.log('║ On Linux, include system dependencies with:                               ║');
  console.log('║                                                                           ║');
  console.log('║     npx playwright install --with-deps chromium                           ║');
  console.log('║                                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
}

main().catch(console.error);
