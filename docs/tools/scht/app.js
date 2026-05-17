/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Additional attribution notice under AGPL-3.0-or-later section 7(b):
 *
 * Modified versions must preserve the following author attribution in the
 * source code notices and in the interactive web tool's legal notice/footer
 * or an equivalent "About / Credits" area:
 *
 * ©2026 - MarTinX (https://github.com/martinx72) /
 * Retro Game Restore (https://retrogamerestore.com/)
 */

import { ActionReplayImport } from "./lib/action-replay-import.js";
import { strings as enStrings } from "./i18n/en.js";
import { strings as jaStrings } from "./i18n/ja.js";
import { strings as zhTwStrings } from "./i18n/zh-TW.js";
import { PskaiImport } from "./lib/pskai-import.js";
import { RetroArchImport } from "./lib/retroarch-import.js";
import { SarooCheat } from "./lib/saroo-cht.js";

const I18N = {
  en: enStrings,
  ja: jaStrings,
  "zh-TW": zhTwStrings,
};
const fileStore = new Map();
const MENU_PREVIEW_ITEMS = 12;
let database = null;
let selectedGame = null;
let selectedBuild = null;
let arBuild = null;
let editorBuild = null;
let retroBuild = null;
let retroWarnings = [];
let idRecords = [];
let selectedIdRecord = null;
let currentLanguage = "en";
let gameIdSourceLabel = "";
let gameIdAutoLoadFailed = false;

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setStatus(selector, message, isError = false) {
  const status = $(selector);
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.en?.[key] || key;
}

function tf(key, values = {}) {
  return t(key).replace(/\{(\w+)}/g, (_match, name) => values[name] ?? "");
}

function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-html]").forEach((node) => {
    node.innerHTML = t(node.dataset.i18nHtml);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
}

function renderRequiredFiles(root = document) {
  root.querySelectorAll("[data-required-files]").forEach((node) => {
    node.textContent = PskaiImport.REQUIRED_FILES.join(", ");
  });
}

function ensureSchtFilename(filename) {
  return filename.endsWith(".scht") ? filename : `${filename}.scht`;
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  const toggle = $("#theme-toggle");
  if (toggle) {
    toggle.textContent = nextTheme === "dark" ? "☀" : "☾";
    toggle.title = nextTheme === "dark" ? "Switch to day theme" : "Switch to night theme";
    toggle.setAttribute("aria-pressed", nextTheme === "dark" ? "true" : "false");
  }
  try {
    localStorage.setItem("saroo-cheat-theme", nextTheme);
  } catch (_error) {
    // Local storage can be disabled; the visual toggle still works for this session.
  }
}

function initTheme() {
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("saroo-cheat-theme") || "light";
  } catch (_error) {
    savedTheme = "light";
  }
  setTheme(savedTheme);
}

function setUiLanguage(language, apply = true) {
  currentLanguage = I18N[language] ? language : "en";
  document.documentElement.lang = currentLanguage;
  const select = $("#ui-language");
  if (select) {
    select.value = currentLanguage;
  }
  try {
    localStorage.setItem("saroo-cheat-ui-language", currentLanguage);
  } catch (_error) {
    // Local storage can be disabled. The current page still changes language.
  }
  if (apply) {
    applyI18n();
    renderRequiredFiles();
    refreshLocalizedState();
  }
}

function initUiLanguage() {
  let savedLanguage = "en";
  try {
    savedLanguage = localStorage.getItem("saroo-cheat-ui-language") || "en";
  } catch (_error) {
    savedLanguage = "en";
  }
  setUiLanguage(savedLanguage, false);
}

function activateTab(panelId) {
  $all(".tab").forEach((tab) => {
    const active = tab.dataset.tab === panelId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  $all(".tab-panel").forEach((panel) => {
    const active = panel.id === panelId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function makePreview(spec, warnings, sourceLabel) {
  const codeCount = spec.items.reduce((sum, item) => sum + item.codes.length, 0);
  return [
    `# ${spec.title}`,
    `# Generated from ${sourceLabel}.`,
    "",
    `filename: ${spec.filename}`,
    `items: ${spec.items.length}`,
    `codes: ${codeCount}`,
    "",
    "warnings:",
    ...(warnings.length > 0 ? warnings.map((line) => `- ${line}`) : ["- none"]),
    "",
    "plain-text sample:",
    SarooCheat.toDsl(spec).trimEnd(),
    "",
  ].join("\n");
}

function basenameWithoutExtension(filename) {
  return String(filename || "SaturnGame")
    .replace(/\.[^.]*$/, "")
    .trim() || "SaturnGame";
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((entry) => entry.some((value) => String(value).trim()));
}

function parseGameIdCell(text) {
  const raw = String(text || "").trim();
  const match = raw.match(/^(.*?)(V\s*\d[\d.\s]*)$/i);
  const gameId = (match ? match[1] : raw.split(/\s+/)[0]).replace(/\s+/g, "").trim();
  const version = match ? match[2].replace(/\s+/g, "").toUpperCase() : "";
  return { raw, gameId, version };
}

function parseGameIdCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    throw new Error("Game ID CSV has no data rows.");
  }
  const header = rows[0].map((value) => String(value).trim().toLowerCase());
  const gameIndex = header.indexOf("game");
  const idIndex = header.indexOf("id");
  if (gameIndex < 0 || idIndex < 0) {
    throw new Error("Game ID CSV must contain Game and ID columns.");
  }
  return rows.slice(1).map((row, index) => {
    const title = String(row[gameIndex] || "").trim();
    const idParts = parseGameIdCell(row[idIndex]);
    return {
      index,
      title,
      id: idParts.gameId,
      version: idParts.version,
      rawId: idParts.raw,
    };
  }).filter((record) => record.title && record.id);
}

function makeSummary(spec, bytesLength = 0) {
  const codeCount = spec.items.reduce((sum, item) => sum + item.codes.length, 0);
  return [
    `Title: ${spec.title || "-"}`,
    `Filename: ${spec.filename || "-"}`,
    `Items: ${spec.items.length}`,
    `Codes: ${codeCount}`,
    bytesLength ? `Binary size: ${bytesLength} bytes` : "",
  ].filter(Boolean).join("\n");
}

function makeMenuPreviewState(spec) {
  const db = SarooCheat.normalizeSpec(spec);
  return db.items.map((item) => ({
    name: item.name,
    greyout: Boolean(item.greyout),
    mutexId: item.mutexId || 0,
    enabled: Boolean(item.defaultOn),
    codes: item.codes.map((code) => ({
      op: code.op,
      addr: code.addr,
      value: code.value,
    })),
  }));
}

function menuPreviewCodeIsEnable(code) {
  return code.op === SarooCheat.OPS.cond16;
}

function menuPreviewFindLastEnableCode(item) {
  let enableCode = null;
  item.codes.forEach((code) => {
    if (menuPreviewCodeIsEnable(code)) {
      enableCode = code;
    }
  });
  return enableCode;
}

function menuPreviewCodeIsDuplicateForPsk(code, item, selected) {
  for (const selectedCode of selected.codes) {
    if (!menuPreviewCodeIsEnable(code)) {
      if (code.op === selectedCode.op && code.addr === selectedCode.addr) {
        return true;
      }
    } else if (item.codes.length >= 2) {
      return true;
    }
  }
  return false;
}

function applyMenuPreviewRules(items, selectedIndex) {
  const selected = items[selectedIndex];
  if (!selected || selected.greyout || !selected.enabled) {
    return;
  }

  if (selected.mutexId) {
    items.forEach((item, index) => {
      if (index !== selectedIndex && !item.greyout && item.enabled && item.mutexId === selected.mutexId) {
        item.enabled = false;
      }
    });
  }

  const selectedEnable = menuPreviewFindLastEnableCode(selected);
  if (selectedEnable) {
    items.forEach((item, index) => {
      if (index === selectedIndex || item.greyout || !item.enabled) {
        return;
      }
      if (item.codes.some((code) => menuPreviewCodeIsEnable(code)
          && (code.addr !== selectedEnable.addr || code.value !== selectedEnable.value))) {
        item.enabled = false;
      }
    });
  }

  items.forEach((item, index) => {
    if (index === selectedIndex || item.greyout || !item.enabled) {
      return;
    }
    const disableItem = item.codes.every((code) => menuPreviewCodeIsDuplicateForPsk(code, item, selected));
    if (disableItem) {
      item.enabled = false;
    }
  });
}

function renderCheatMenuPreview(selector, spec, emptyMessage = t("common.noMenuPreview")) {
  const root = $(selector);
  root.innerHTML = "";

  if (!spec || !Array.isArray(spec.items) || spec.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-preview-empty";
    empty.textContent = emptyMessage;
    root.appendChild(empty);
    return;
  }

  let items;
  try {
    items = makeMenuPreviewState(spec);
  } catch (error) {
    const empty = document.createElement("div");
    empty.className = "menu-preview-empty";
    empty.textContent = error.message;
    root.appendChild(empty);
    return;
  }

  let page = 0;
  const pageCount = Math.max(1, Math.ceil(items.length / MENU_PREVIEW_ITEMS));

  const draw = () => {
    const pageStart = page * MENU_PREVIEW_ITEMS;
    const pageItems = items.slice(pageStart, pageStart + MENU_PREVIEW_ITEMS);

    root.innerHTML = "";
    const frame = document.createElement("div");
    frame.className = "menu-preview-frame";

    const title = document.createElement("div");
    title.className = "menu-preview-title";
    title.textContent = `Cheats: ${spec.title || "SaturnGame"} (${page + 1}/${pageCount})`;
    frame.appendChild(title);

    const list = document.createElement("div");
    list.className = "menu-preview-list";
    pageItems.forEach((item, pageIndex) => {
      const itemIndex = pageStart + pageIndex;
      const row = document.createElement("label");
      row.className = item.greyout ? "menu-preview-row group" : "menu-preview-row";

      if (item.greyout) {
        row.textContent = `    ${item.name}`;
      } else {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = item.enabled;
        checkbox.addEventListener("change", () => {
          item.enabled = checkbox.checked;
          applyMenuPreviewRules(items, itemIndex);
          draw();
        });
        const name = document.createElement("span");
        name.textContent = item.name;
        row.appendChild(checkbox);
        row.appendChild(name);
      }
      list.appendChild(row);
    });

    frame.appendChild(list);
    if (pageCount > 1) {
      const pager = document.createElement("div");
      pager.className = "menu-preview-pager";

      const prev = document.createElement("button");
      prev.type = "button";
      prev.textContent = "Prev";
      prev.addEventListener("click", () => {
        page = page > 0 ? page - 1 : pageCount - 1;
        draw();
      });

      const next = document.createElement("button");
      next.type = "button";
      next.textContent = "Next";
      next.addEventListener("click", () => {
        page = page + 1 < pageCount ? page + 1 : 0;
        draw();
      });

      const hint = document.createElement("span");
      hint.textContent = `${MENU_PREVIEW_ITEMS} items per page`;

      pager.appendChild(prev);
      pager.appendChild(hint);
      pager.appendChild(next);
      frame.appendChild(pager);
    }
    root.appendChild(frame);
  };

  draw();
}

function collectArEffects() {
  return $all(".effect-row").map((row) => {
    if (row.dataset.rowType === "group") {
      return {
        type: "group",
        description: row.querySelector(".group-title-input").value,
      };
    }
    return {
      type: "effect",
      description: row.querySelector(".effect-description").value,
      mutex: row.querySelector(".effect-mutex").value,
      code: row.querySelector(".effect-code").value,
    };
  });
}

function translateArError(message) {
  const map = {
    "At least one cheat effect with supported code is required.": "ar.errorAtLeastOneEffect",
    "Action Replay code must contain address/value pairs.": "ar.errorAddressValuePairs",
  };
  return map[message] ? t(map[message]) : message;
}

function updateArPreview() {
  try {
    arBuild = ActionReplayImport.buildSpec({
      gameName: $("#ar-game-name").value,
      masterCode: $("#ar-master-code").value,
      effects: collectArEffects(),
    });
    $("#ar-filename").value = arBuild.spec.filename;
    $("#ar-preview").textContent = makePreview(arBuild.spec, arBuild.warnings, "manual AR/GameShark-style input");
    renderCheatMenuPreview("#ar-menu-preview", arBuild.spec);
    $("#ar-save").disabled = false;
    setStatus("#ar-status", tf("status.converted", { name: arBuild.spec.title }));
  } catch (error) {
    arBuild = null;
    const errorText = translateArError(error.message);
    renderCheatMenuPreview("#ar-menu-preview", null);
    $("#ar-preview").textContent = [
      t("ar.errorIncompleteInvalid"),
      "",
      errorText,
      "",
      t("ar.supportedCommands"),
      t("ar.commandBoot16"),
      t("ar.commandFreeze16"),
      t("ar.commandFreeze8"),
      t("ar.commandFreeze8x2"),
      t("ar.commandCond16"),
      "",
      t("ar.masterCodeHint"),
    ].join("\n");
    $("#ar-save").disabled = true;
    setStatus("#ar-status", errorText, true);
  }
}

function addEffectRow(description = "", code = "", mutex = "") {
  const template = $("#effect-template");
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector(".effect-row");
  applyI18n(fragment);
  row.querySelector(".effect-description").value = description;
  row.querySelector(".effect-mutex").value = mutex;
  row.querySelector(".effect-code").value = code;
  row.querySelector(".remove-effect").addEventListener("click", () => {
    row.remove();
    if ($all(".effect-row").length === 0) {
      addEffectRow();
    }
    updateArPreview();
  });
  row.querySelector(".effect-description").addEventListener("input", updateArPreview);
  row.querySelector(".effect-mutex").addEventListener("input", updateArPreview);
  row.querySelector(".effect-code").addEventListener("input", updateArPreview);
  $("#ar-effects").appendChild(fragment);
}

function addGroupRow(title = "") {
  const template = $("#group-template");
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector(".effect-row");
  applyI18n(fragment);
  row.querySelector(".group-title-input").value = title;
  row.querySelector(".remove-effect").addEventListener("click", () => {
    row.remove();
    if ($all(".effect-row").length === 0) {
      addEffectRow();
    }
    updateArPreview();
  });
  row.querySelector(".group-title-input").addEventListener("input", updateArPreview);
  $("#ar-effects").appendChild(fragment);
}

function updateEditorPreview() {
  try {
    const spec = SarooCheat.parseDsl($("#editor-dsl").value);
    const filename = ensureSchtFilename($("#editor-filename").value.trim() || spec.filename || "SaturnGame.scht");
    const bytes = SarooCheat.encodeCheatFile({
      ...spec,
      filename,
    });
    editorBuild = { spec, filename, bytes };
    $("#editor-preview").textContent = makeSummary({ ...spec, filename }, bytes.length);
    renderCheatMenuPreview("#editor-menu-preview", { ...spec, filename });
    $("#editor-save").disabled = false;
    setStatus("#editor-status", tf("status.readyToSave", { filename }));
  } catch (error) {
    editorBuild = null;
    renderCheatMenuPreview("#editor-menu-preview", null);
    $("#editor-preview").textContent = error.message;
    $("#editor-save").disabled = true;
    setStatus("#editor-status", error.message, true);
  }
}

async function loadEditorFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoded = SarooCheat.decodeCheatFile(bytes);
  const filename = ensureSchtFilename(file.name || decoded.filename || "SaturnGame.scht");
  const title = decoded.title || basenameWithoutExtension(filename);
  const spec = {
    ...decoded,
    title,
    filename,
  };

  $("#editor-filename").value = filename;
  $("#editor-dsl").value = SarooCheat.toDsl(spec);
  $("#editor-preview").textContent = makeSummary(spec, bytes.length);
  renderCheatMenuPreview("#editor-menu-preview", spec);
  $("#editor-save").disabled = false;
  setStatus("#editor-status", tf("status.loadedBytes", {
    filename,
    bytes: bytes.length,
  }));
  updateEditorPreview();
}

function handleEditorLoadError(error) {
  editorBuild = null;
  $("#editor-save").disabled = true;
  $("#editor-preview").textContent = error.message;
  renderCheatMenuPreview("#editor-menu-preview", null);
  setStatus("#editor-status", error.message, true);
}

async function handleEditorFile(file) {
  if (!file) {
    return;
  }
  try {
    await loadEditorFile(file);
  } catch (error) {
    handleEditorLoadError(error);
  }
}

function updateRetroPreview() {
  try {
    const spec = SarooCheat.parseDsl($("#retro-dsl").value);
    const filename = ensureSchtFilename($("#retro-filename").value.trim() || spec.filename || "SaturnGame.scht");
    const bytes = SarooCheat.encodeCheatFile({
      ...spec,
      filename,
    });
    retroBuild = { spec, filename, bytes };
    $("#retro-preview").textContent = [
      makeSummary({ ...spec, filename }, bytes.length),
      "",
      "warnings:",
      ...(retroWarnings.length > 0 ? retroWarnings.map((line) => `- ${line}`) : ["- none"]),
    ].join("\n");
    renderCheatMenuPreview("#retro-menu-preview", { ...spec, filename });
    $("#retro-save").disabled = false;
    setStatus("#retro-status", tf("status.readyToSave", { filename }));
  } catch (error) {
    retroBuild = null;
    renderCheatMenuPreview("#retro-menu-preview", null);
    $("#retro-preview").textContent = error.message;
    $("#retro-save").disabled = true;
    setStatus("#retro-status", error.message, true);
  }
}

async function loadRetroFile(file) {
  const text = await file.text();
  const build = RetroArchImport.buildSpec(text, file.name || "SaturnGame.cht");
  retroWarnings = build.warnings;
  $("#retro-filename").value = build.spec.filename;
  $("#retro-dsl").value = RetroArchImport.makeEditableDsl(build, SarooCheat.toDsl);
  if (build.spec.items.length === 0) {
    retroBuild = null;
    $("#retro-save").disabled = true;
    $("#retro-preview").textContent = [
      "No binary can be saved yet.",
      "",
      "This file only produced commented manual entries. Replace each ?? with a concrete hex value, uncomment the item lines, then press Validate.",
      "",
      "warnings:",
      ...(build.warnings.length > 0 ? build.warnings.map((line) => `- ${line}`) : ["- none"]),
    ].join("\n");
    renderCheatMenuPreview("#retro-menu-preview", null);
    setStatus("#retro-status", tf("retro.loadedManualRequired", { filename: file.name }), true);
    return;
  }
  updateRetroPreview();
  const warningText = build.warnings.length > 0
    ? tf("status.loadedWithWarnings", { filename: file.name, count: build.warnings.length })
    : tf("status.loaded", { filename: file.name });
  setStatus("#retro-status", warningText);
}

function handleRetroLoadError(error) {
  retroBuild = null;
  retroWarnings = [];
  $("#retro-save").disabled = true;
  $("#retro-preview").textContent = error.message;
  renderCheatMenuPreview("#retro-menu-preview", null);
  setStatus("#retro-status", error.message, true);
}

async function handleRetroFile(file) {
  if (!file) {
    return;
  }
  try {
    await loadRetroFile(file);
  } catch (error) {
    handleRetroLoadError(error);
  }
}

function describeFiles() {
  const required = PskaiImport.REQUIRED_FILES.map((name) => {
    const state = fileStore.has(name) ? t("psk.fileStateLoaded") : t("psk.fileStateMissing");
    return `- ${name}: ${state}`;
  });
  const optional = PskaiImport.OPTIONAL_FILES.map((name) => {
    const state = fileStore.has(name) ? t("psk.fileStateLoaded") : t("psk.fileStateOptional");
    return `- ${name}: ${state}`;
  });
  $("#file-status").textContent = [
    t("psk.requiredFilesLabel"),
    ...required,
    "",
    t("psk.optionalFilesLabel"),
    ...optional,
  ].join("\n");
}

function missingRequiredFiles() {
  return PskaiImport.REQUIRED_FILES.filter((name) => !fileStore.has(name));
}

function updateLoadState() {
  describeFiles();
  const missing = missingRequiredFiles();
  if (missing.length > 0) {
    database = null;
    selectedGame = null;
    selectedBuild = null;
    $("#game-list").innerHTML = "";
    $("#psk-preview").textContent = [
      t("psk.dataIncomplete"),
      "",
      t("psk.provideFiles"),
      ...missing.map((name) => `- ${name}`),
      "",
      t("psk.provideFilesHint"),
    ].join("\n");
    renderCheatMenuPreview("#psk-menu-preview", null);
    $("#psk-save").disabled = true;
    return;
  }

  try {
    database = PskaiImport.parse(Object.fromEntries(fileStore));
    renderGameList();
  } catch (error) {
    database = null;
    $("#game-list").innerHTML = "";
    $("#psk-preview").textContent = error.message;
    renderCheatMenuPreview("#psk-menu-preview", null);
    $("#psk-save").disabled = true;
    setStatus("#psk-status", error.message, true);
  }
}

function filteredGames() {
  if (!database) {
    return [];
  }
  const query = $("#game-filter").value.trim().toLowerCase();
  if (!query) {
    return database.games;
  }
  return database.games.filter((game) => game.name.toLowerCase().includes(query));
}

function renderGameList(preferredIndex = selectedGame?.index) {
  const list = $("#game-list");
  const games = filteredGames();
  list.innerHTML = "";
  games.forEach((game) => {
    const option = document.createElement("option");
    option.value = String(game.index);
    option.textContent = game.name;
    list.appendChild(option);
  });

  $("#game-count").textContent = database
    ? tf("psk.gameCountLoaded", {
      shown: games.length,
      games: database.games.length,
      cheats: database.cheats.length,
      codes: database.codes.length,
    })
    : t("common.zeroGames");

  if (games.length > 0) {
    const selected = games.some((game) => game.index === Number(preferredIndex))
      ? preferredIndex
      : games[0].index;
    list.value = String(selected);
    selectGameByIndex(selected);
  } else {
    selectedGame = null;
    selectedBuild = null;
    $("#psk-preview").textContent = t("psk.noGamesMatch");
    renderCheatMenuPreview("#psk-menu-preview", null);
    $("#psk-save").disabled = true;
  }
}

function makePskPreview(game, build) {
  const warnings = [];
  build.warnings.forEach((warning) => {
    if (warning.commands) {
      const commands = warning.commands
        .map((entry) => `0x${PskaiImport.hex(entry.command, 2)}@${entry.codeIndex}`)
        .join(", ");
      warnings.push(`${warning.item}: unsupported PSKai command(s) ${commands}`);
    } else {
      warnings.push(`${warning.item}: ${warning.message}`);
    }
  });

  return [
    `# ${game.name}`,
    "# Generated from user-supplied Pseudo Saturn Kai cheat data.",
    "# SAROO does not bundle PSKai cheat data.",
    "",
    `filename: ${build.spec.filename}`,
    `master: ${PskaiImport.hex(game.masterAddr, 8)} ${PskaiImport.hex(game.masterOpcode, 4)}`,
    `cfg: ${PskaiImport.hex(game.cfgLocation, 8)}`,
    `cache4: ${game.cache4Capacity}`,
    "",
    makePreview(build.spec, warnings, "user-supplied Pseudo Saturn Kai cheat data").trimEnd(),
    "",
  ].join("\n");
}

function selectGameByIndex(index) {
  if (!database) {
    return;
  }
  selectedGame = database.games.find((game) => game.index === Number(index));
  if (!selectedGame) {
    selectedBuild = null;
    $("#psk-preview").textContent = "Selected game was not found.";
    renderCheatMenuPreview("#psk-menu-preview", null);
    $("#psk-save").disabled = true;
    return;
  }

  selectedBuild = PskaiImport.buildSpecForGame(database, selectedGame, {
    forceRomHandler: $("#force-rom-handler").checked,
  });
  $("#psk-filename").value = selectedBuild.spec.filename;
  $("#psk-preview").textContent = makePskPreview(selectedGame, selectedBuild);
  renderCheatMenuPreview("#psk-menu-preview", selectedBuild.spec);
  $("#psk-save").disabled = selectedBuild.spec.items.length === 0;
  const warningText = selectedBuild.warnings.length > 0
    ? tf("status.convertedWithWarnings", { name: selectedGame.name, count: selectedBuild.warnings.length })
    : tf("status.converted", { name: selectedGame.name });
  setStatus("#psk-status", warningText, false);
}

function filteredIdRecords() {
  const query = $("#id-filter").value.trim().toLowerCase();
  if (!query) {
    return idRecords;
  }
  return idRecords.filter((record) => [
    record.title,
    record.id,
    record.version,
    record.rawId,
  ].some((value) => String(value || "").toLowerCase().includes(query)));
}

function renderIdList(preferredIndex = selectedIdRecord?.index) {
  const list = $("#id-list");
  const records = filteredIdRecords();
  list.innerHTML = "";
  records.forEach((record) => {
    const option = document.createElement("option");
    option.value = String(record.index);
    option.textContent = `${record.title}  [${record.id}${record.version ? ` ${record.version}` : ""}]`;
    list.appendChild(option);
  });

  $("#id-count").textContent = tf("ids.gameCount", {
    shown: records.length,
    total: idRecords.length,
  });

  if (records.length > 0) {
    const selected = records.some((record) => record.index === Number(preferredIndex))
      ? preferredIndex
      : records[0].index;
    list.value = String(selected);
    selectIdRecord(selected);
  } else {
    selectedIdRecord = null;
    $("#id-detail").innerHTML = `<p>${t("ids.noGamesMatch")}</p>`;
  }
}

function selectIdRecord(index) {
  selectedIdRecord = idRecords.find((record) => record.index === Number(index));
  const detail = $("#id-detail");
  detail.innerHTML = "";
  if (!selectedIdRecord) {
    detail.innerHTML = `<p>${t("ids.noGameSelected")}</p>`;
    return;
  }

  const title = document.createElement("h3");
  title.textContent = selectedIdRecord.title;
  detail.appendChild(title);

  const rows = [
    [t("ids.detailGameId"), selectedIdRecord.id, true],
    [t("ids.detailVersion"), selectedIdRecord.version || "-", false],
    [t("ids.detailRawIdField"), selectedIdRecord.rawId || "-", false],
  ];

  rows.forEach(([label, value, copyable]) => {
    const row = document.createElement("div");
    row.className = "id-detail-row";
    const key = document.createElement("span");
    key.textContent = label;
    const val = document.createElement(copyable ? "button" : "span");
    val.textContent = value;
    val.className = copyable ? "id-copy-button" : "id-detail-value";
    if (copyable) {
      val.type = "button";
      val.title = "Click to copy";
      val.addEventListener("click", () => copyGameId(value));
    }
    row.appendChild(key);
    row.appendChild(val);
    detail.appendChild(row);
  });
}

function refreshLocalizedState() {
  updateArPreview();
  describeFiles();
  if ($("#editor-dsl").value.trim()) {
    updateEditorPreview();
  } else {
    renderCheatMenuPreview("#editor-menu-preview", null);
  }
  if ($("#retro-dsl").value.trim()) {
    updateRetroPreview();
  } else {
    renderCheatMenuPreview("#retro-menu-preview", null);
  }
  if (database) {
    renderGameList();
  }
  if (idRecords.length > 0) {
    renderIdList();
    if (gameIdSourceLabel) {
      $("#id-status").textContent = tf("ids.loadedRows", {
        count: idRecords.length,
        source: gameIdSourceLabel,
      });
    }
  } else {
    $("#id-count").textContent = t("common.zeroGames");
    if (!selectedIdRecord) {
      $("#id-detail").innerHTML = `<p>${t("ids.noGameSelected")}</p>`;
    }
    if (gameIdAutoLoadFailed) {
      $("#id-status").textContent = [
        t("ids.notAutoLoaded"),
        t("ids.autoLoadHint"),
      ].join("\n");
    }
  }
}

async function copyGameId(gameId) {
  try {
    await navigator.clipboard.writeText(gameId);
    setStatus("#id-copy-status", tf("status.copied", { value: gameId }));
  } catch (_error) {
    const temp = document.createElement("input");
    temp.value = gameId;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
    setStatus("#id-copy-status", tf("status.copied", { value: gameId }));
  }
}

function loadGameIdCsvText(text, sourceLabel) {
  idRecords = parseGameIdCsv(text);
  gameIdSourceLabel = sourceLabel;
  gameIdAutoLoadFailed = false;
  renderIdList();
  $("#id-status").textContent = tf("ids.loadedRows", {
    count: idRecords.length,
    source: sourceLabel,
  });
  setStatus("#id-copy-status", t("ids.clickToCopy"));
}

async function loadPickedFiles(files) {
  for (const file of Array.from(files)) {
    if ([...PskaiImport.REQUIRED_FILES, ...PskaiImport.OPTIONAL_FILES].includes(file.name)) {
      fileStore.set(file.name, await file.text());
    }
  }
  updateLoadState();
}

async function handlePskFiles(files) {
  try {
    await loadPickedFiles(files);
  } catch (error) {
    setStatus("#psk-status", error.message, true);
  }
}

function handleGameIdLoadError(error) {
  idRecords = [];
  selectedIdRecord = null;
  gameIdSourceLabel = "";
  gameIdAutoLoadFailed = false;
  $("#id-list").innerHTML = "";
  $("#id-count").textContent = t("common.zeroGames");
  $("#id-detail").innerHTML = `<p>${t("ids.noGameSelected")}</p>`;
  $("#id-status").textContent = error.message;
  setStatus("#id-copy-status", error.message, true);
}

async function handleGameIdFile(file) {
  if (!file) {
    return;
  }
  try {
    loadGameIdCsvText(await file.text(), file.name);
  } catch (error) {
    handleGameIdLoadError(error);
  }
}

function bindFileDrop({
  dropSelector,
  inputSelector,
  multiple = false,
  statusSelector,
  dropMessageKey,
  onFiles,
}) {
  const dropZone = $(dropSelector);
  const input = $(inputSelector);
  if (!dropZone || !input) {
    return;
  }

  const setDragging = (isDragging) => {
    dropZone.classList.toggle("drag-over", isDragging);
  };

  const loadFiles = (files) => {
    const picked = Array.from(files || []);
    if (picked.length === 0) {
      return;
    }
    const payload = multiple ? picked : picked[0];
    Promise.resolve(onFiles(payload)).catch((error) => {
      if (statusSelector) {
        setStatus(statusSelector, error.message, true);
      }
    });
  };

  input.addEventListener("change", (event) => loadFiles(event.target.files));

  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(true);
    if (statusSelector && dropMessageKey) {
      setStatus(statusSelector, t(dropMessageKey));
    }
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  });

  dropZone.addEventListener("dragleave", (event) => {
    if (!dropZone.contains(event.relatedTarget)) {
      setDragging(false);
    }
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    loadFiles(event.dataTransfer.files);
  });
}

async function tryAutoLoadGameIds() {
  try {
    const response = await fetch("./id_list/game_ids.csv", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    loadGameIdCsvText(await response.text(), "./id_list/game_ids.csv");
  } catch (_error) {
    gameIdSourceLabel = "";
    gameIdAutoLoadFailed = true;
    $("#id-status").textContent = [
      t("ids.notAutoLoaded"),
      t("ids.autoLoadHint"),
    ].join("\n");
  }
}

async function tryAutoLoad() {
  const names = [...PskaiImport.REQUIRED_FILES, ...PskaiImport.OPTIONAL_FILES];
  const loaded = [];
  const searchDirs = ["./", "./psk-data/"];

  await Promise.all(names.map(async (name) => {
    for (const dir of searchDirs) {
      try {
        const response = await fetch(`${dir}${name}`, { cache: "no-store" });
        if (response.ok) {
          fileStore.set(name, await response.text());
          loaded.push(`${dir}${name}`);
          return;
        }
      } catch (_error) {
        // File URLs and strict local servers can reject fetch; manual file picking remains available.
      }
    }
  }));

  updateLoadState();
}

$all(".tab").forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

$("#theme-toggle").addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  setTheme(currentTheme === "dark" ? "light" : "dark");
});

$("#ui-language").addEventListener("change", () => {
  setUiLanguage($("#ui-language").value);
});

$("#ar-game-name").addEventListener("input", updateArPreview);
$("#ar-master-code").addEventListener("input", updateArPreview);
$("#ar-add-effect").addEventListener("click", () => {
  addEffectRow();
  updateArPreview();
});
$("#ar-add-group").addEventListener("click", () => {
  addGroupRow();
  updateArPreview();
});
$("#ar-save").addEventListener("click", () => {
  if (!arBuild) {
    return;
  }
  const filename = ensureSchtFilename($("#ar-filename").value.trim() || arBuild.spec.filename);
  const bytes = SarooCheat.encodeCheatFile({
    ...arBuild.spec,
    filename,
  });
  SarooCheat.downloadBinary(filename, bytes);
  setStatus("#ar-status", tf("status.savedBytes", { filename, bytes: bytes.length }));
});

bindFileDrop({
  dropSelector: "label[for=\"editor-file\"]",
  inputSelector: "#editor-file",
  statusSelector: "#editor-status",
  dropMessageKey: "editor.dropFile",
  onFiles: handleEditorFile,
});
$("#editor-dsl").addEventListener("input", updateEditorPreview);
$("#editor-filename").addEventListener("input", updateEditorPreview);
$("#editor-validate").addEventListener("click", updateEditorPreview);
$("#editor-save").addEventListener("click", () => {
  updateEditorPreview();
  if (!editorBuild) {
    return;
  }
  SarooCheat.downloadBinary(editorBuild.filename, editorBuild.bytes);
  setStatus("#editor-status", tf("status.savedBytes", {
    filename: editorBuild.filename,
    bytes: editorBuild.bytes.length,
  }));
});

bindFileDrop({
  dropSelector: "label[for=\"retro-file\"]",
  inputSelector: "#retro-file",
  statusSelector: "#retro-status",
  dropMessageKey: "retro.dropFile",
  onFiles: handleRetroFile,
});
$("#retro-dsl").addEventListener("input", updateRetroPreview);
$("#retro-filename").addEventListener("input", updateRetroPreview);
$("#retro-validate").addEventListener("click", updateRetroPreview);
$("#retro-save").addEventListener("click", () => {
  updateRetroPreview();
  if (!retroBuild) {
    return;
  }
  SarooCheat.downloadBinary(retroBuild.filename, retroBuild.bytes);
  setStatus("#retro-status", tf("status.savedBytes", {
    filename: retroBuild.filename,
    bytes: retroBuild.bytes.length,
  }));
});

bindFileDrop({
  dropSelector: "label[for=\"psk-files\"]",
  inputSelector: "#psk-files",
  multiple: true,
  statusSelector: "#psk-status",
  dropMessageKey: "psk.dropFiles",
  onFiles: handlePskFiles,
});
$("#game-filter").addEventListener("input", () => {
  if (database) {
    renderGameList();
  }
});
$("#game-list").addEventListener("change", (event) => {
  selectGameByIndex(event.target.value);
});
$("#force-rom-handler").addEventListener("change", () => {
  if (selectedGame) {
    selectGameByIndex(selectedGame.index);
  }
});
$("#psk-save").addEventListener("click", () => {
  if (!selectedBuild) {
    return;
  }
  const filename = ensureSchtFilename($("#psk-filename").value.trim() || selectedBuild.spec.filename);
  const bytes = SarooCheat.encodeCheatFile({
    ...selectedBuild.spec,
    filename,
  });
  SarooCheat.downloadBinary(filename, bytes);
  setStatus("#psk-status", tf("status.savedBytes", { filename, bytes: bytes.length }));
});

bindFileDrop({
  dropSelector: "label[for=\"id-file\"]",
  inputSelector: "#id-file",
  statusSelector: "#id-copy-status",
  dropMessageKey: "ids.dropCsv",
  onFiles: handleGameIdFile,
});
$("#id-filter").addEventListener("input", renderIdList);
$("#id-list").addEventListener("change", (event) => {
  selectIdRecord(event.target.value);
});

addEffectRow();
initUiLanguage();
applyI18n();
renderRequiredFiles();
initTheme();
updateArPreview();
activateTab("ar-panel");
tryAutoLoad();
tryAutoLoadGameIds();
