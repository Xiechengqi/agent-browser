#!/usr/bin/env node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { send, setDebug, setSession, getSession } from './client.js';
import type { Response } from './types.js';

/**
 * List all active veb sessions
 */
function listSessions(): string[] {
  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    const sessions: string[] = [];
    
    for (const file of files) {
      const match = file.match(/^veb-(.+)\.pid$/);
      if (match) {
        const pidFile = path.join(tmpDir, file);
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          // Check if process is still running
          process.kill(pid, 0);
          sessions.push(match[1]);
        } catch {
          // Process not running, ignore
        }
      }
    }
    
    return sessions;
  } catch {
    return [];
  }
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const c = (color: keyof typeof colors, text: string) => `${colors[color]}${text}${colors.reset}`;

function printHelp(): void {
  console.log(`
${c('bold', 'veb')} - headless browser automation for agents and humans

${c('yellow', 'Usage:')}
  veb <command> [options]

${c('yellow', 'Commands:')}
  ${c('cyan', 'open')} <url>                    Open a URL in the browser
  ${c('cyan', 'click')} <selector>              Click an element
  ${c('cyan', 'dblclick')} <selector>           Double-click an element
  ${c('cyan', 'type')} <selector> <text>        Type text into an element
  ${c('cyan', 'fill')} <selector> <value>       Clear and fill input
  ${c('cyan', 'press')} <key>                   Press a keyboard key
  ${c('cyan', 'check')} <selector>              Check a checkbox/radio
  ${c('cyan', 'uncheck')} <selector>            Uncheck a checkbox
  ${c('cyan', 'select')} <selector> <value>     Select dropdown option
  ${c('cyan', 'hover')} <selector>              Hover over an element
  ${c('cyan', 'focus')} <selector>              Focus an element
  ${c('cyan', 'drag')} <source> <target>        Drag and drop
  ${c('cyan', 'upload')} <selector> <file...>   Upload files
  ${c('cyan', 'wait')} <selector|text|ms>       Wait for element, text, or duration
  ${c('cyan', 'screenshot')} [path]             Take a screenshot
  ${c('cyan', 'pdf')} <path>                    Save page as PDF
  ${c('cyan', 'snapshot')}                      Get accessibility tree (for agents)
  ${c('cyan', 'extract')} <selector>            Extract element content
  ${c('cyan', 'eval')} <script>                 Evaluate JavaScript
  ${c('cyan', 'scroll')} <direction> [amount]   Scroll the page
  ${c('cyan', 'close')}                         Close browser and stop daemon

${c('yellow', 'Locator Commands:')}
  ${c('cyan', 'role')} <role> click|fill|check  Find by ARIA role
  ${c('cyan', 'text')} <text> click|hover       Find by text content
  ${c('cyan', 'label')} <label> click|fill      Find by label
  ${c('cyan', 'placeholder')} <ph> click|fill   Find by placeholder

${c('yellow', 'Frame Commands:')}
  ${c('cyan', 'frame')} <selector>              Switch to iframe
  ${c('cyan', 'mainframe')}                     Switch back to main frame

${c('yellow', 'Cookie Commands:')}
  ${c('cyan', 'cookies')}                       Get all cookies
  ${c('cyan', 'cookies set')} <json>            Set cookies
  ${c('cyan', 'cookies clear')}                 Clear all cookies

${c('yellow', 'Storage Commands:')}
  ${c('cyan', 'storage local')} [key]           Get localStorage
  ${c('cyan', 'storage local set')} <k> <v>     Set localStorage
  ${c('cyan', 'storage local clear')}           Clear localStorage
  ${c('cyan', 'storage session')} [key]         Get sessionStorage
  ${c('cyan', 'storage session set')} <k> <v>   Set sessionStorage
  ${c('cyan', 'storage session clear')}         Clear sessionStorage

${c('yellow', 'Dialog Commands:')}
  ${c('cyan', 'dialog accept')} [text]          Accept next dialog
  ${c('cyan', 'dialog dismiss')}                Dismiss next dialog

${c('yellow', 'Navigation:')}
  ${c('cyan', 'back')}                          Go back
  ${c('cyan', 'forward')}                       Go forward
  ${c('cyan', 'reload')}                        Reload page
  ${c('cyan', 'url')}                           Get current URL
  ${c('cyan', 'title')}                         Get page title

${c('yellow', 'Element Info:')}
  ${c('cyan', 'gettext')} <selector>            Get element text
  ${c('cyan', 'getattr')} <selector> <attr>     Get attribute value
  ${c('cyan', 'isvisible')} <selector>          Check if visible
  ${c('cyan', 'isenabled')} <selector>          Check if enabled
  ${c('cyan', 'ischecked')} <selector>          Check if checked
  ${c('cyan', 'count')} <selector>              Count matching elements
  ${c('cyan', 'boundingbox')} <selector>        Get element bounds

${c('yellow', 'Network:')}
  ${c('cyan', 'route')} <url> [--abort]         Intercept requests
  ${c('cyan', 'route')} <url> --body <json>     Mock response
  ${c('cyan', 'unroute')} [url]                 Remove route(s)
  ${c('cyan', 'requests')} [--filter url]       Get tracked requests

${c('yellow', 'Browser Settings:')}
  ${c('cyan', 'viewport')} <width> <height>     Set viewport size
  ${c('cyan', 'device')} <name>                 Emulate device
  ${c('cyan', 'geolocation')} <lat> <lng>       Set location
  ${c('cyan', 'permissions')} grant|deny <...>  Set permissions

${c('yellow', 'Downloads:')}
  ${c('cyan', 'download')} <selector> <path>    Download file

${c('yellow', 'Tab/Window Commands:')}
  ${c('cyan', 'tab new')}                       Open a new tab
  ${c('cyan', 'tab list')}                      List all open tabs
  ${c('cyan', 'tab')} <index>                   Switch to tab by index
  ${c('cyan', 'tab close')} [index]             Close tab (current if no index)
  ${c('cyan', 'window new')}                    Open a new window

${c('yellow', 'Session Commands:')}
  ${c('cyan', 'session')}                       Show current session name
  ${c('cyan', 'session list')}                  List all active sessions

${c('yellow', 'Options:')}
  --session <name>              Use isolated browser session (or VEB_SESSION env)
  --json                        Output raw JSON (for agents)
  --selector, -s <sel>          Target specific element
  --text, -t                    Wait for text instead of selector
  --full, -f                    Full page screenshot
  --debug                       Show debug output
  --help, -h                    Show help

${c('yellow', 'Examples:')}
  veb open https://example.com
  veb click "#submit-btn"
  veb type "#email" "hello@example.com"
  veb wait --text "Welcome"
  veb wait 2000
  veb screenshot --full page.png
  veb extract "table" --json
  veb eval "document.title"
  veb scroll down 500
  veb tab new
  veb tab list
  veb tab 0
`);
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function printResponse(response: Response, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(response));
    return;
  }
  
  if (!response.success) {
    console.error(c('red', '✗ Error:'), response.error);
    process.exit(1);
  }
  
  const data = response.data as Record<string, unknown>;
  
  // Pretty print based on data type
  if (data.url && data.title) {
    console.log(c('green', '✓'), c('bold', data.title as string));
    console.log(c('dim', `  ${data.url}`));
  } else if (data.url && !data.title) {
    console.log(data.url);
  } else if (data.title && !data.url) {
    console.log(data.title);
  } else if (data.html) {
    console.log(data.html);
  } else if (data.snapshot) {
    console.log(data.snapshot);
  } else if (data.result !== undefined) {
    const result = data.result;
    if (typeof result === 'object') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }
  } else if (data.base64) {
    console.log(c('green', '✓'), 'Screenshot captured (base64)');
    console.log(c('dim', `  ${(data.base64 as string).length} bytes`));
  } else if (data.path) {
    console.log(c('green', '✓'), `Saved to ${data.path}`);
  } else if (data.cookies) {
    // Cookies get
    const cookies = data.cookies as Array<{ name: string; value: string; domain?: string }>;
    if (cookies.length === 0) {
      console.log(c('dim', 'No cookies'));
    } else {
      cookies.forEach(cookie => {
        console.log(`${c('cyan', cookie.name)}: ${cookie.value}`);
        if (cookie.domain) console.log(c('dim', `  domain: ${cookie.domain}`));
      });
    }
  } else if (data.data) {
    // Storage get (all)
    const storage = data.data as Record<string, string>;
    const keys = Object.keys(storage);
    if (keys.length === 0) {
      console.log(c('dim', 'Empty storage'));
    } else {
      keys.forEach(key => {
        console.log(`${c('cyan', key)}: ${storage[key]}`);
      });
    }
  } else if (data.value !== undefined && data.key) {
    // Storage get (single key)
    console.log(data.value ?? c('dim', 'null'));
  } else if (data.uploaded) {
    const files = data.uploaded as string[];
    console.log(c('green', '✓'), `Uploaded ${files.length} file(s)`);
  } else if (data.handler) {
    console.log(c('green', '✓'), `Dialog handler set to ${data.response}`);
  } else if (data.text !== undefined) {
    console.log(data.text ?? c('dim', 'null'));
  } else if (data.attribute !== undefined) {
    console.log(data.value ?? c('dim', 'null'));
  } else if (data.visible !== undefined) {
    console.log(data.visible ? c('green', 'true') : c('red', 'false'));
  } else if (data.enabled !== undefined) {
    console.log(data.enabled ? c('green', 'true') : c('red', 'false'));
  } else if (data.checked !== undefined) {
    console.log(data.checked ? c('green', 'true') : c('red', 'false'));
  } else if (data.count !== undefined) {
    console.log(data.count);
  } else if (data.box) {
    const box = data.box as { x: number; y: number; width: number; height: number };
    console.log(`x: ${box.x}, y: ${box.y}, width: ${box.width}, height: ${box.height}`);
  } else if (data.requests) {
    const reqs = data.requests as Array<{ url: string; method: string; resourceType: string }>;
    if (reqs.length === 0) {
      console.log(c('dim', 'No requests tracked'));
    } else {
      reqs.forEach(req => {
        console.log(`${c('cyan', req.method)} ${req.url}`);
        console.log(c('dim', `  ${req.resourceType}`));
      });
    }
  } else if (data.routed) {
    console.log(c('green', '✓'), `Route added: ${data.routed}`);
  } else if (data.unrouted) {
    console.log(c('green', '✓'), `Route removed: ${data.unrouted}`);
  } else if (data.device) {
    const vp = data.viewport as { width: number; height: number };
    console.log(c('green', '✓'), `Emulating ${data.device}`);
    console.log(c('dim', `  Viewport: ${vp.width}x${vp.height}`));
  } else if (data.latitude !== undefined) {
    console.log(c('green', '✓'), `Location set to ${data.latitude}, ${data.longitude}`);
  } else if (data.width !== undefined && data.height !== undefined) {
    console.log(c('green', '✓'), `Viewport: ${data.width}x${data.height}`);
  } else if (data.suggestedFilename) {
    console.log(c('green', '✓'), `Downloaded: ${data.suggestedFilename}`);
    console.log(c('dim', `  Saved to: ${data.path}`));
  } else if (data.clicked || data.typed || data.pressed || data.hovered || data.scrolled || data.selected || data.waited || data.filled || data.checked || data.unchecked || data.focused || data.dragged || data.switched || data.set || data.cleared) {
    console.log(c('green', '✓'), 'Done');
  } else if (data.launched) {
    console.log(c('green', '✓'), 'Browser launched');
  } else if (data.closed === true) {
    console.log(c('green', '✓'), 'Browser closed');
  } else if (data.tabs) {
    // Tab list
    const tabs = data.tabs as Array<{ index: number; url: string; title: string; active: boolean }>;
    tabs.forEach(tab => {
      const marker = tab.active ? c('green', '→') : ' ';
      const idx = c('cyan', `[${tab.index}]`);
      const title = tab.title || c('dim', '(untitled)');
      console.log(`${marker} ${idx} ${title}`);
      if (tab.url) console.log(c('dim', `     ${tab.url}`));
    });
  } else if (data.index !== undefined && data.total !== undefined) {
    // Tab new / window new
    console.log(c('green', '✓'), `Tab ${data.index} created (${data.total} total)`);
  } else if (data.remaining !== undefined) {
    // Tab close
    console.log(c('green', '✓'), `Tab closed (${data.remaining} remaining)`);
  } else if (data.started !== undefined) {
    console.log(c('green', '✓'), 'Started');
  } else if (data.messages) {
    // Console messages
    const msgs = data.messages as Array<{ type: string; text: string; timestamp: number }>;
    if (msgs.length === 0) {
      console.log(c('dim', 'No console messages'));
    } else {
      msgs.forEach(msg => {
        const typeColor = msg.type === 'error' ? 'red' : msg.type === 'warning' ? 'yellow' : 'dim';
        console.log(`${c(typeColor, `[${msg.type}]`)} ${msg.text}`);
      });
    }
  } else if (data.errors) {
    // Page errors
    const errs = data.errors as Array<{ message: string; timestamp: number }>;
    if (errs.length === 0) {
      console.log(c('dim', 'No page errors'));
    } else {
      errs.forEach(err => {
        console.log(c('red', '✗'), err.message);
      });
    }
  } else if (data.pressed) {
    console.log(c('green', '✓'), `Pressed: ${data.pressed}`);
  } else if (data.tapped) {
    console.log(c('green', '✓'), 'Tapped');
  } else if (data.copied) {
    console.log(c('green', '✓'), 'Copied to clipboard');
  } else if (data.pasted) {
    console.log(c('green', '✓'), 'Pasted from clipboard');
  } else if (data.highlighted) {
    console.log(c('green', '✓'), 'Element highlighted');
  } else if (data.dispatched) {
    console.log(c('green', '✓'), `Event dispatched: ${data.dispatched}`);
  } else if (data.exposed) {
    console.log(c('green', '✓'), `Function exposed: ${data.exposed}`);
  } else if (data.added) {
    console.log(c('green', '✓'), 'Added');
  } else if (data.emulated) {
    console.log(c('green', '✓'), 'Media emulated');
  } else if (data.offline !== undefined) {
    console.log(c('green', '✓'), data.offline ? 'Offline mode enabled' : 'Online mode enabled');
  } else if (data.paused) {
    console.log(c('green', '✓'), 'Paused (Inspector open)');
  } else if (data.note) {
    console.log(c('yellow', '⚠'), data.note);
  } else if (data.requestCount !== undefined) {
    console.log(c('green', '✓'), `HAR saved (${data.requestCount} requests)`);
  } else if (data.moved) {
    console.log(c('green', '✓'), `Mouse moved to (${data.x}, ${data.y})`);
  } else if (data.down) {
    console.log(c('green', '✓'), 'Mouse down');
  } else if (data.up) {
    console.log(c('green', '✓'), 'Mouse up');
  } else if (data.focused) {
    console.log(c('green', '✓'), 'Brought to front');
  } else if (data.state) {
    console.log(c('green', '✓'), `Load state: ${data.state}`);
  } else {
    console.log(c('green', '✓'), JSON.stringify(data));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Enable debug mode early
  const debugMode = args.includes('--debug');
  if (debugMode) {
    setDebug(true);
  }
  
  // Handle session - check --session flag first, then env var
  const sessionIdx = args.findIndex(a => a === '--session');
  if (sessionIdx !== -1 && args[sessionIdx + 1]) {
    setSession(args[sessionIdx + 1]);
  }
  // VEB_SESSION env var is already handled by daemon.ts default
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  
  const jsonMode = args.includes('--json');
  const fullPage = args.includes('--full') || args.includes('-f');
  const textMode = args.includes('--text') || args.includes('-t');
  
  // Remove flag args and their values
  const cleanArgs = args.filter((a, i) => {
    if (a.startsWith('-')) return false;
    // Check if previous arg was a flag that takes a value
    const prev = args[i - 1];
    if (prev === '--selector' || prev === '-s') return false;
    if (prev === '--session') return false;
    if (prev === '--name' || prev === '-n') return false;
    return true;
  });
  const command = cleanArgs[0];
  
  // Find --selector value
  let selectorOverride: string | undefined;
  const sIdx = args.findIndex(a => a === '--selector' || a === '-s');
  if (sIdx !== -1 && args[sIdx + 1]) {
    selectorOverride = args[sIdx + 1];
  }
  
  // Find --name value (for locator commands)
  let nameOverride: string | undefined;
  const nIdx = args.findIndex(a => a === '--name' || a === '-n');
  if (nIdx !== -1 && args[nIdx + 1]) {
    nameOverride = args[nIdx + 1];
  }
  
  // Find --exact flag
  const exactMode = args.includes('--exact');
  
  const id = genId();
  let cmd: Record<string, unknown>;
  
  switch (command) {
    case 'open':
    case 'goto':
    case 'navigate': {
      const url = cleanArgs[1];
      if (!url) {
        console.error(c('red', 'Error:'), 'URL required');
        process.exit(1);
      }
      // Auto-add https if missing
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      cmd = { id, action: 'navigate', url: fullUrl };
      break;
    }
    
    case 'click': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'click', selector };
      break;
    }
    
    case 'type': {
      const selector = cleanArgs[1];
      const text = cleanArgs.slice(2).join(' ');
      if (!selector || !text) {
        console.error(c('red', 'Error:'), 'Selector and text required');
        process.exit(1);
      }
      cmd = { id, action: 'type', selector, text, clear: true };
      break;
    }
    
    case 'fill': {
      const selector = cleanArgs[1];
      const value = cleanArgs.slice(2).join(' ');
      if (!selector || value === undefined) {
        console.error(c('red', 'Error:'), 'Selector and value required');
        process.exit(1);
      }
      cmd = { id, action: 'fill', selector, value };
      break;
    }
    
    case 'check': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'check', selector };
      break;
    }
    
    case 'uncheck': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'uncheck', selector };
      break;
    }
    
    case 'dblclick':
    case 'doubleclick': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'dblclick', selector };
      break;
    }
    
    case 'focus': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'focus', selector };
      break;
    }
    
    case 'drag': {
      const source = cleanArgs[1];
      const target = cleanArgs[2];
      if (!source || !target) {
        console.error(c('red', 'Error:'), 'Source and target selectors required');
        process.exit(1);
      }
      cmd = { id, action: 'drag', source, target };
      break;
    }
    
    case 'upload': {
      const selector = cleanArgs[1];
      const files = cleanArgs.slice(2);
      if (!selector || files.length === 0) {
        console.error(c('red', 'Error:'), 'Selector and file(s) required');
        process.exit(1);
      }
      cmd = { id, action: 'upload', selector, files };
      break;
    }
    
    case 'press': {
      const key = cleanArgs[1];
      if (!key) {
        console.error(c('red', 'Error:'), 'Key required');
        process.exit(1);
      }
      cmd = { id, action: 'press', key, selector: selectorOverride };
      break;
    }
    
    case 'wait': {
      const target = cleanArgs[1];
      if (!target) {
        console.error(c('red', 'Error:'), 'Selector, text, or milliseconds required');
        process.exit(1);
      }
      
      // Check if it's a number (milliseconds)
      const ms = parseInt(target, 10);
      if (!isNaN(ms)) {
        cmd = { id, action: 'wait', timeout: ms };
      } else if (textMode) {
        // Wait for text - use evaluate to check for text
        cmd = { id, action: 'wait', selector: `text=${target}` };
      } else {
        cmd = { id, action: 'wait', selector: target };
      }
      break;
    }
    
    case 'screenshot':
    case 'ss': {
      const pathArg = cleanArgs[1];
      cmd = { 
        id, 
        action: 'screenshot', 
        path: pathArg,
        fullPage,
        selector: selectorOverride,
      };
      break;
    }
    
    case 'snapshot':
    case 'aria':
    case 'a11y': {
      cmd = { id, action: 'snapshot' };
      break;
    }
    
    case 'extract':
    case 'html':
    case 'content': {
      const selector = cleanArgs[1] || selectorOverride;
      cmd = { id, action: 'content', selector };
      break;
    }
    
    case 'eval':
    case 'js': {
      const script = cleanArgs.slice(1).join(' ');
      if (!script) {
        console.error(c('red', 'Error:'), 'Script required');
        process.exit(1);
      }
      cmd = { id, action: 'evaluate', script };
      break;
    }
    
    case 'scroll': {
      const dirOrAmount = cleanArgs[1];
      const amount = parseInt(cleanArgs[2], 10) || 300;
      
      if (['up', 'down', 'left', 'right'].includes(dirOrAmount)) {
        cmd = { id, action: 'scroll', direction: dirOrAmount, amount, selector: selectorOverride };
      } else {
        const y = parseInt(dirOrAmount, 10) || 300;
        cmd = { id, action: 'scroll', y, selector: selectorOverride };
      }
      break;
    }
    
    case 'hover': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'hover', selector };
      break;
    }
    
    case 'select': {
      const selector = cleanArgs[1];
      const value = cleanArgs[2];
      if (!selector || !value) {
        console.error(c('red', 'Error:'), 'Selector and value required');
        process.exit(1);
      }
      cmd = { id, action: 'select', selector, values: value };
      break;
    }
    
    case 'pdf': {
      const pdfPath = cleanArgs[1];
      if (!pdfPath) {
        console.error(c('red', 'Error:'), 'Path required');
        process.exit(1);
      }
      cmd = { id, action: 'pdf', path: pdfPath };
      break;
    }
    
    case 'frame': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Frame selector required');
        process.exit(1);
      }
      cmd = { id, action: 'frame', selector };
      break;
    }
    
    case 'mainframe': {
      cmd = { id, action: 'mainframe' };
      break;
    }
    
    case 'role': {
      const role = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'fill' | 'check' | 'hover';
      const value = cleanArgs[3];
      if (!role || !subaction) {
        console.error(c('red', 'Error:'), 'Role and action required (e.g., veb role button click --name "Submit")');
        process.exit(1);
      }
      cmd = { id, action: 'getbyrole', role, name: nameOverride, subaction, value };
      break;
    }
    
    case 'text': {
      const text = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'hover';
      if (!text || !subaction) {
        console.error(c('red', 'Error:'), 'Text and action required (e.g., veb text "Submit" click)');
        process.exit(1);
      }
      cmd = { id, action: 'getbytext', text, exact: exactMode, subaction };
      break;
    }
    
    case 'label': {
      const label = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'fill' | 'check';
      const value = cleanArgs[3];
      if (!label || !subaction) {
        console.error(c('red', 'Error:'), 'Label and action required (e.g., veb label "Email" fill "test@test.com")');
        process.exit(1);
      }
      cmd = { id, action: 'getbylabel', label, subaction, value };
      break;
    }
    
    case 'placeholder': {
      const placeholder = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'fill';
      const value = cleanArgs[3];
      if (!placeholder || !subaction) {
        console.error(c('red', 'Error:'), 'Placeholder and action required');
        process.exit(1);
      }
      cmd = { id, action: 'getbyplaceholder', placeholder, subaction, value };
      break;
    }
    
    case 'cookies': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'set') {
        const jsonStr = cleanArgs.slice(2).join(' ');
        try {
          const cookies = JSON.parse(jsonStr);
          cmd = { id, action: 'cookies_set', cookies: Array.isArray(cookies) ? cookies : [cookies] };
        } catch {
          console.error(c('red', 'Error:'), 'Invalid JSON for cookies');
          process.exit(1);
        }
      } else if (subCmd === 'clear') {
        cmd = { id, action: 'cookies_clear' };
      } else {
        cmd = { id, action: 'cookies_get' };
      }
      break;
    }
    
    case 'storage': {
      const storageType = cleanArgs[1]; // 'local' or 'session'
      const subCmd = cleanArgs[2];
      
      if (storageType !== 'local' && storageType !== 'session') {
        console.error(c('red', 'Error:'), 'Storage type must be "local" or "session"');
        process.exit(1);
      }
      
      if (subCmd === 'set') {
        const key = cleanArgs[3];
        const value = cleanArgs.slice(4).join(' ');
        if (!key) {
          console.error(c('red', 'Error:'), 'Key required');
          process.exit(1);
        }
        cmd = { id, action: 'storage_set', type: storageType, key, value };
      } else if (subCmd === 'clear') {
        cmd = { id, action: 'storage_clear', type: storageType };
      } else {
        // Get - subCmd might be a key or undefined
        cmd = { id, action: 'storage_get', type: storageType, key: subCmd };
      }
      break;
    }
    
    case 'dialog': {
      const response = cleanArgs[1];
      const promptText = cleanArgs[2];
      
      if (response !== 'accept' && response !== 'dismiss') {
        console.error(c('red', 'Error:'), 'Dialog response must be "accept" or "dismiss"');
        process.exit(1);
      }
      cmd = { id, action: 'dialog', response, promptText };
      break;
    }
    
    case 'back': {
      cmd = { id, action: 'back' };
      break;
    }
    
    case 'forward': {
      cmd = { id, action: 'forward' };
      break;
    }
    
    case 'reload': {
      cmd = { id, action: 'reload' };
      break;
    }
    
    case 'url': {
      cmd = { id, action: 'url' };
      break;
    }
    
    case 'title': {
      cmd = { id, action: 'title' };
      break;
    }
    
    case 'gettext': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'gettext', selector };
      break;
    }
    
    case 'getattr':
    case 'getattribute': {
      const selector = cleanArgs[1];
      const attribute = cleanArgs[2];
      if (!selector || !attribute) {
        console.error(c('red', 'Error:'), 'Selector and attribute required');
        process.exit(1);
      }
      cmd = { id, action: 'getattribute', selector, attribute };
      break;
    }
    
    case 'isvisible': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'isvisible', selector };
      break;
    }
    
    case 'isenabled': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'isenabled', selector };
      break;
    }
    
    case 'ischecked': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'ischecked', selector };
      break;
    }
    
    case 'count': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'count', selector };
      break;
    }
    
    case 'boundingbox':
    case 'bbox': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'boundingbox', selector };
      break;
    }
    
    case 'route': {
      const url = cleanArgs[1];
      if (!url) {
        console.error(c('red', 'Error:'), 'URL pattern required');
        process.exit(1);
      }
      
      const abortMode = args.includes('--abort');
      const bodyIdx = args.findIndex(a => a === '--body');
      let response: { status?: number; body?: string; contentType?: string } | undefined;
      
      if (bodyIdx !== -1 && args[bodyIdx + 1]) {
        try {
          const body = args[bodyIdx + 1];
          response = { body, contentType: 'application/json' };
        } catch {
          response = { body: args[bodyIdx + 1] };
        }
      }
      
      cmd = { id, action: 'route', url, abort: abortMode, response };
      break;
    }
    
    case 'unroute': {
      const url = cleanArgs[1];
      cmd = { id, action: 'unroute', url };
      break;
    }
    
    case 'requests': {
      const clearMode = args.includes('--clear');
      const filterIdx = args.findIndex(a => a === '--filter');
      const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined;
      
      cmd = { id, action: 'requests', clear: clearMode, filter };
      break;
    }
    
    case 'viewport': {
      const width = parseInt(cleanArgs[1], 10);
      const height = parseInt(cleanArgs[2], 10);
      if (isNaN(width) || isNaN(height)) {
        console.error(c('red', 'Error:'), 'Width and height required (e.g., veb viewport 1920 1080)');
        process.exit(1);
      }
      cmd = { id, action: 'viewport', width, height };
      break;
    }
    
    case 'device': {
      const device = cleanArgs[1];
      if (!device) {
        console.error(c('red', 'Error:'), 'Device name required (e.g., veb device "iPhone 14")');
        process.exit(1);
      }
      cmd = { id, action: 'device', device };
      break;
    }
    
    case 'geolocation':
    case 'geo': {
      const lat = parseFloat(cleanArgs[1]);
      const lng = parseFloat(cleanArgs[2]);
      if (isNaN(lat) || isNaN(lng)) {
        console.error(c('red', 'Error:'), 'Latitude and longitude required');
        process.exit(1);
      }
      cmd = { id, action: 'geolocation', latitude: lat, longitude: lng };
      break;
    }
    
    case 'permissions': {
      const grantOrDeny = cleanArgs[1];
      const perms = cleanArgs.slice(2);
      if ((grantOrDeny !== 'grant' && grantOrDeny !== 'deny') || perms.length === 0) {
        console.error(c('red', 'Error:'), 'Usage: veb permissions grant|deny <permission...>');
        process.exit(1);
      }
      cmd = { id, action: 'permissions', permissions: perms, grant: grantOrDeny === 'grant' };
      break;
    }
    
    case 'download': {
      const selector = cleanArgs[1];
      const downloadPath = cleanArgs[2];
      if (!selector || !downloadPath) {
        console.error(c('red', 'Error:'), 'Selector and path required');
        process.exit(1);
      }
      cmd = { id, action: 'download', selector, path: downloadPath };
      break;
    }
    
    case 'close':
    case 'quit':
    case 'exit': {
      cmd = { id, action: 'close' };
      break;
    }
    
    case 'tab': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'new') {
        cmd = { id, action: 'tab_new' };
      } else if (subCmd === 'list' || subCmd === 'ls') {
        cmd = { id, action: 'tab_list' };
      } else if (subCmd === 'close') {
        const tabIndex = cleanArgs[2] !== undefined ? parseInt(cleanArgs[2], 10) : undefined;
        cmd = { id, action: 'tab_close', index: tabIndex };
      } else if (subCmd !== undefined) {
        // Assume it's a tab index to switch to
        const tabIndex = parseInt(subCmd, 10);
        if (isNaN(tabIndex)) {
          console.error(c('red', 'Error:'), `Invalid tab command or index: ${subCmd}`);
          process.exit(1);
        }
        cmd = { id, action: 'tab_switch', index: tabIndex };
      } else {
        // No subcommand - list tabs
        cmd = { id, action: 'tab_list' };
      }
      break;
    }
    
    case 'window': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'new') {
        cmd = { id, action: 'window_new' };
      } else {
        console.error(c('red', 'Error:'), 'Usage: veb window new');
        process.exit(1);
      }
      break;
    }
    
    case 'session': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'list' || subCmd === 'ls') {
        const sessions = listSessions();
        const currentSession = getSession();
        
        if (sessions.length === 0) {
          console.log(c('dim', 'No active sessions'));
        } else {
          sessions.forEach(sess => {
            const marker = sess === currentSession ? c('green', '→') : ' ';
            console.log(`${marker} ${c('cyan', sess)}`);
          });
        }
        process.exit(0);
      } else {
        // Show current session
        console.log(c('cyan', getSession()));
        process.exit(0);
      }
    }
    
    // === Advanced commands ===
    
    case 'trace': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'start') {
        const screenshotsMode = args.includes('--screenshots');
        const snapshotsMode = args.includes('--snapshots');
        cmd = { id, action: 'trace_start', screenshots: screenshotsMode, snapshots: snapshotsMode };
      } else if (subCmd === 'stop') {
        const path = cleanArgs[2];
        if (!path) {
          console.error(c('red', 'Error:'), 'Path required for trace output');
          process.exit(1);
        }
        cmd = { id, action: 'trace_stop', path };
      } else {
        console.error(c('red', 'Error:'), 'Usage: veb trace start|stop');
        process.exit(1);
      }
      break;
    }
    
    case 'state': {
      const subCmd = cleanArgs[1];
      const path = cleanArgs[2];
      
      if (subCmd === 'save') {
        if (!path) {
          console.error(c('red', 'Error:'), 'Path required');
          process.exit(1);
        }
        cmd = { id, action: 'state_save', path };
      } else if (subCmd === 'load') {
        if (!path) {
          console.error(c('red', 'Error:'), 'Path required');
          process.exit(1);
        }
        cmd = { id, action: 'state_load', path };
      } else {
        console.error(c('red', 'Error:'), 'Usage: veb state save|load <path>');
        process.exit(1);
      }
      break;
    }
    
    case 'console': {
      const clearMode = args.includes('--clear');
      cmd = { id, action: 'console', clear: clearMode };
      break;
    }
    
    case 'errors': {
      const clearMode = args.includes('--clear');
      cmd = { id, action: 'errors', clear: clearMode };
      break;
    }
    
    case 'keyboard':
    case 'key':
    case 'press': {
      const keys = cleanArgs[1];
      if (!keys) {
        console.error(c('red', 'Error:'), 'Keys required (e.g., veb press "Control+a")');
        process.exit(1);
      }
      cmd = { id, action: 'keyboard', keys };
      break;
    }
    
    case 'wheel':
    case 'scroll-wheel': {
      const deltaY = parseInt(cleanArgs[1], 10) || 100;
      const deltaX = parseInt(cleanArgs[2], 10) || 0;
      const selector = selectorOverride;
      cmd = { id, action: 'wheel', deltaX, deltaY, selector };
      break;
    }
    
    case 'tap': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'tap', selector };
      break;
    }
    
    case 'clipboard': {
      const operation = cleanArgs[1] as 'copy' | 'paste' | 'read';
      if (!['copy', 'paste', 'read'].includes(operation)) {
        console.error(c('red', 'Error:'), 'Usage: veb clipboard copy|paste|read');
        process.exit(1);
      }
      cmd = { id, action: 'clipboard', operation };
      break;
    }
    
    case 'highlight': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'highlight', selector };
      break;
    }
    
    case 'clear-input':
    case 'clearinput': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'clear', selector };
      break;
    }
    
    case 'selectall':
    case 'select-all': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'selectall', selector };
      break;
    }
    
    case 'innertext': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'innertext', selector };
      break;
    }
    
    case 'innerhtml':
    case 'inner-html': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'innerhtml', selector };
      break;
    }
    
    case 'inputvalue':
    case 'input-value': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'inputvalue', selector };
      break;
    }
    
    case 'setvalue':
    case 'set-value': {
      const selector = cleanArgs[1];
      const value = cleanArgs[2];
      if (!selector || !value) {
        console.error(c('red', 'Error:'), 'Selector and value required');
        process.exit(1);
      }
      cmd = { id, action: 'setvalue', selector, value };
      break;
    }
    
    case 'dispatch': {
      const selector = cleanArgs[1];
      const event = cleanArgs[2];
      if (!selector || !event) {
        console.error(c('red', 'Error:'), 'Selector and event required');
        process.exit(1);
      }
      cmd = { id, action: 'dispatch', selector, event };
      break;
    }
    
    case 'addscript':
    case 'add-script': {
      const urlOrContent = cleanArgs[1];
      if (!urlOrContent) {
        console.error(c('red', 'Error:'), 'URL or content required');
        process.exit(1);
      }
      if (urlOrContent.startsWith('http')) {
        cmd = { id, action: 'addscript', url: urlOrContent };
      } else {
        cmd = { id, action: 'addscript', content: urlOrContent };
      }
      break;
    }
    
    case 'addstyle':
    case 'add-style': {
      const urlOrContent = cleanArgs[1];
      if (!urlOrContent) {
        console.error(c('red', 'Error:'), 'URL or content required');
        process.exit(1);
      }
      if (urlOrContent.startsWith('http')) {
        cmd = { id, action: 'addstyle', url: urlOrContent };
      } else {
        cmd = { id, action: 'addstyle', content: urlOrContent };
      }
      break;
    }
    
    case 'media': {
      const colorScheme = args.includes('--dark') ? 'dark' : args.includes('--light') ? 'light' : undefined;
      const media = args.includes('--print') ? 'print' : args.includes('--screen') ? 'screen' : undefined;
      const reducedMotion = args.includes('--reduced-motion') ? 'reduce' : undefined;
      
      cmd = { id, action: 'emulatemedia', colorScheme, media, reducedMotion };
      break;
    }
    
    case 'offline': {
      const offlineMode = cleanArgs[1] !== 'false' && cleanArgs[1] !== 'off';
      cmd = { id, action: 'offline', offline: offlineMode };
      break;
    }
    
    case 'headers': {
      const headersJson = cleanArgs[1];
      if (!headersJson) {
        console.error(c('red', 'Error:'), 'Headers JSON required');
        process.exit(1);
      }
      try {
        const headers = JSON.parse(headersJson);
        cmd = { id, action: 'headers', headers };
      } catch {
        console.error(c('red', 'Error:'), 'Invalid JSON for headers');
        process.exit(1);
      }
      break;
    }
    
    case 'pause': {
      cmd = { id, action: 'pause' };
      break;
    }
    
    case 'alttext':
    case 'alt': {
      const text = cleanArgs[1];
      const subaction = cleanArgs[2] || 'click';
      if (!text) {
        console.error(c('red', 'Error:'), 'Alt text required');
        process.exit(1);
      }
      cmd = { id, action: 'getbyalttext', text, subaction, exact: exactMode };
      break;
    }
    
    case 'bytitle': {
      const text = cleanArgs[1];
      const subaction = cleanArgs[2] || 'click';
      if (!text) {
        console.error(c('red', 'Error:'), 'Title text required');
        process.exit(1);
      }
      cmd = { id, action: 'getbytitle', text, subaction, exact: exactMode };
      break;
    }
    
    case 'testid':
    case 'data-testid': {
      const testId = cleanArgs[1];
      const subaction = cleanArgs[2] || 'click';
      const value = cleanArgs[3];
      if (!testId) {
        console.error(c('red', 'Error:'), 'Test ID required');
        process.exit(1);
      }
      cmd = { id, action: 'getbytestid', testId, subaction, value };
      break;
    }
    
    case 'first': {
      const selector = cleanArgs[1];
      const subaction = cleanArgs[2] || 'click';
      const value = cleanArgs[3];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'nth', selector, index: 0, subaction, value };
      break;
    }
    
    case 'last': {
      const selector = cleanArgs[1];
      const subaction = cleanArgs[2] || 'click';
      const value = cleanArgs[3];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'nth', selector, index: -1, subaction, value };
      break;
    }
    
    case 'nth': {
      const selector = cleanArgs[1];
      const index = parseInt(cleanArgs[2], 10);
      const subaction = cleanArgs[3] || 'click';
      const value = cleanArgs[4];
      if (!selector || isNaN(index)) {
        console.error(c('red', 'Error:'), 'Selector and index required');
        process.exit(1);
      }
      cmd = { id, action: 'nth', selector, index, subaction, value };
      break;
    }
    
    case 'waitforurl':
    case 'wait-for-url': {
      const url = cleanArgs[1];
      if (!url) {
        console.error(c('red', 'Error:'), 'URL pattern required');
        process.exit(1);
      }
      cmd = { id, action: 'waitforurl', url };
      break;
    }
    
    case 'waitforload':
    case 'wait-for-load': {
      const state = cleanArgs[1] || 'load';
      if (!['load', 'domcontentloaded', 'networkidle'].includes(state)) {
        console.error(c('red', 'Error:'), 'State must be: load, domcontentloaded, or networkidle');
        process.exit(1);
      }
      cmd = { id, action: 'waitforloadstate', state };
      break;
    }
    
    case 'setcontent':
    case 'set-content':
    case 'html': {
      const html = cleanArgs[1];
      if (!html) {
        console.error(c('red', 'Error:'), 'HTML content required');
        process.exit(1);
      }
      cmd = { id, action: 'setcontent', html };
      break;
    }
    
    case 'timezone':
    case 'tz': {
      const timezone = cleanArgs[1];
      if (!timezone) {
        console.error(c('red', 'Error:'), 'Timezone required (e.g., America/New_York)');
        process.exit(1);
      }
      cmd = { id, action: 'timezone', timezone };
      break;
    }
    
    case 'locale':
    case 'lang': {
      const locale = cleanArgs[1];
      if (!locale) {
        console.error(c('red', 'Error:'), 'Locale required (e.g., en-US)');
        process.exit(1);
      }
      cmd = { id, action: 'locale', locale };
      break;
    }
    
    case 'credentials':
    case 'auth': {
      const username = cleanArgs[1];
      const password = cleanArgs[2];
      if (!username || !password) {
        console.error(c('red', 'Error:'), 'Username and password required');
        process.exit(1);
      }
      cmd = { id, action: 'credentials', username, password };
      break;
    }
    
    case 'mousemove':
    case 'mouse-move': {
      const x = parseInt(cleanArgs[1], 10);
      const y = parseInt(cleanArgs[2], 10);
      if (isNaN(x) || isNaN(y)) {
        console.error(c('red', 'Error:'), 'X and Y coordinates required');
        process.exit(1);
      }
      cmd = { id, action: 'mousemove', x, y };
      break;
    }
    
    case 'mousedown':
    case 'mouse-down': {
      const button = cleanArgs[1] as 'left' | 'right' | 'middle' | undefined;
      cmd = { id, action: 'mousedown', button };
      break;
    }
    
    case 'mouseup':
    case 'mouse-up': {
      const button = cleanArgs[1] as 'left' | 'right' | 'middle' | undefined;
      cmd = { id, action: 'mouseup', button };
      break;
    }
    
    case 'focus-tab':
    case 'bringtofront': {
      cmd = { id, action: 'bringtofront' };
      break;
    }
    
    default:
      console.error(c('red', 'Error:'), `Unknown command: ${command}`);
      console.error(c('dim', 'Run veb --help for usage'));
      process.exit(1);
  }
  
  try {
    const response = await send(cmd);
    printResponse(response, jsonMode);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      console.log(JSON.stringify({ id, success: false, error: message }));
    } else {
      console.error(c('red', '✗ Error:'), message);
    }
    process.exit(1);
  }
}

main();
