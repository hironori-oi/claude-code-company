#!/usr/bin/env node

/**
 * claude-code-company Plugin Installer
 *
 * Registers this plugin in Claude Code's settings.json
 * so that organizational management commands are available
 * in all projects.
 *
 * Usage:
 *   node scripts/install.mjs          # Install plugin
 *   node scripts/install.mjs --remove # Remove plugin
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const PLUGIN_NAME = "company";
const settingsDir = join(homedir(), ".claude");
const settingsPath = join(settingsDir, "settings.json");

function loadSettings() {
  if (!existsSync(settingsPath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

function getPluginRoot() {
  // Plugin root is the parent directory of scripts/
  return join(new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), "..").replace(/\\/g, "/");
}

function install() {
  const pluginRoot = getPluginRoot();
  const settings = loadSettings();

  if (!settings.plugins) {
    settings.plugins = {};
  }

  // Register plugin with its path
  const pluginKey = `${PLUGIN_NAME}@local`;
  settings.plugins[pluginKey] = pluginRoot;

  saveSettings(settings);

  console.log("");
  console.log("  claude-code-company plugin installed successfully!");
  console.log("");
  console.log(`  Plugin path: ${pluginRoot}`);
  console.log(`  Settings:    ${settingsPath}`);
  console.log("");
  console.log("  Available commands:");
  console.log("    /company:ceo          - CEO: delegate tasks");
  console.log("    /company:new-project  - Register new project");
  console.log("    /company:secretary    - Secretary operations");
  console.log("    /company:pm           - Project management");
  console.log("    /company:research     - Technology research");
  console.log("    /company:dev          - Development");
  console.log("    /company:marketing    - Marketing & proposals");
  console.log("    /company:review       - Quality review");
  console.log("    /company:web-ops      - Website operations");
  console.log("    /company:status       - Project status");
  console.log("    /company:report       - Management reports");
  console.log("");
  console.log("  Restart Claude Code to activate the plugin.");
  console.log("");
}

function remove() {
  const settings = loadSettings();
  const pluginKey = `${PLUGIN_NAME}@local`;

  if (settings.plugins && settings.plugins[pluginKey]) {
    delete settings.plugins[pluginKey];
    saveSettings(settings);
    console.log("  Plugin removed successfully.");
  } else {
    console.log("  Plugin is not installed.");
  }
}

const args = process.argv.slice(2);
if (args.includes("--remove") || args.includes("-r")) {
  remove();
} else {
  install();
}
