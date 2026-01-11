/**
 * Enhanced snapshot with element refs for deterministic element selection.
 *
 * This module generates accessibility snapshots with embedded refs that can be
 * used to click/fill/interact with elements without re-querying the DOM.
 *
 * Example output:
 *   - heading "Example Domain" [ref=e1] [level=1]
 *   - paragraph: Some text content
 *   - button "Submit" [ref=e2]
 *   - textbox "Email" [ref=e3]
 *
 * Usage:
 *   agent-browser snapshot          # Get snapshot with refs
 *   agent-browser click @e2         # Click element by ref
 *   agent-browser fill @e3 "test"   # Fill element by ref
 */

import type { Page, Locator } from 'playwright-core';

export interface RefMap {
  [ref: string]: {
    selector: string;
    role: string;
    name?: string;
  };
}

export interface EnhancedSnapshot {
  tree: string;
  refs: RefMap;
}

// Counter for generating refs
let refCounter = 0;

/**
 * Reset ref counter (call at start of each snapshot)
 */
export function resetRefs(): void {
  refCounter = 0;
}

/**
 * Generate next ref ID
 */
function nextRef(): string {
  return `e${++refCounter}`;
}

/**
 * Roles that are interactive and should get refs
 */
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem',
]);

/**
 * Roles that provide structure/context (get refs for text extraction)
 */
const CONTENT_ROLES = new Set([
  'heading',
  'cell',
  'gridcell',
  'columnheader',
  'rowheader',
  'listitem',
  'article',
  'region',
  'main',
  'navigation',
]);

/**
 * Build a selector string for storing in ref map
 */
function buildSelector(role: string, name?: string): string {
  if (name) {
    const escapedName = name.replace(/"/g, '\\"');
    return `getByRole('${role}', { name: "${escapedName}" })`;
  }
  return `getByRole('${role}')`;
}

/**
 * Get enhanced snapshot with refs
 *
 * Uses ariaSnapshot() which returns ARIA tree, then parses and adds refs
 */
export async function getEnhancedSnapshot(page: Page): Promise<EnhancedSnapshot> {
  resetRefs();
  const refs: RefMap = {};

  // Get ARIA snapshot from Playwright
  const ariaTree = await page.locator(':root').ariaSnapshot();

  if (!ariaTree) {
    return {
      tree: '(empty page)',
      refs: {},
    };
  }

  // Parse the ARIA tree and add refs to interactive elements
  const enhancedTree = addRefsToAriaTree(ariaTree, refs);

  return { tree: enhancedTree, refs };
}

/**
 * Parse ARIA snapshot and add refs to interactive elements
 *
 * Input format from ariaSnapshot():
 *   - document:
 *     - heading "Example Domain" [level=1]
 *     - paragraph: This is text
 *     - link "More info":
 *       - /url: https://...
 */
function addRefsToAriaTree(ariaTree: string, refs: RefMap): string {
  const lines = ariaTree.split('\n');
  const enhancedLines: string[] = [];

  for (const line of lines) {
    // Match lines like:
    //   - button "Submit"
    //   - heading "Title" [level=1]
    //   - link "Click me":
    //   - textbox "Email"
    const match = line.match(/^(\s*-\s*)(\w+)(?:\s+"([^"]*)")?(.*)$/);

    if (match) {
      const [, prefix, role, name, suffix] = match;
      const roleLower = role.toLowerCase();

      // Skip metadata lines (like /url:)
      if (role.startsWith('/')) {
        enhancedLines.push(line);
        continue;
      }

      // Add ref for interactive or named content elements
      const isInteractive = INTERACTIVE_ROLES.has(roleLower);
      const isNamedContent = CONTENT_ROLES.has(roleLower) && name;

      if (isInteractive || isNamedContent) {
        const ref = nextRef();

        // Store ref data for later locator creation
        refs[ref] = {
          selector: buildSelector(roleLower, name),
          role: roleLower,
          name,
        };

        // Insert ref tag before any trailing content (like [level=1] or :)
        const refTag = `[ref=${ref}]`;

        // Build the enhanced line
        let enhanced = `${prefix}${role}`;
        if (name) enhanced += ` "${name}"`;
        enhanced += ` ${refTag}`;
        if (suffix) enhanced += suffix;

        enhancedLines.push(enhanced);
      } else {
        enhancedLines.push(line);
      }
    } else {
      enhancedLines.push(line);
    }
  }

  return enhancedLines.join('\n');
}

/**
 * Parse a ref from command argument (e.g., "@e1" -> "e1")
 */
export function parseRef(arg: string): string | null {
  if (arg.startsWith('@')) {
    return arg.slice(1);
  }
  if (arg.startsWith('ref=')) {
    return arg.slice(4);
  }
  if (/^e\d+$/.test(arg)) {
    return arg;
  }
  return null;
}
