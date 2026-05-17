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

"use strict";

const DEFAULT_CONFIG = `# SAROO config file
#
# Available configurations:
#
#   lang_id=x
#          0: Simplified Chinese
#          1: English
#          2: Portuguese (Brazil)
#          3: Japanese
#          4: French
#          5: Russian
#          6: Traditional Chinese
#          7: Germany
#          8: Spanish
#          9: Italian
#         10: Polish
#         11: Swedish
#         12: Greek
#         13: Romanian
#
#   debug=xxxxxxxx
#     setting special flags for debugging
#   log_mask=xxxxxxxx
#     MCU UART log mask in hex. 0 disables runtime CD debug logs.
#     10 = info only, 14 = file I/O + info, 11c = full CD debug I/O.
#   auto_update=x
#     MCU auto-update flag
#   play_delay=xxxx
#     Delay before CD launch, unit: us, decimal
#   pend_delay=xxxx
#     Delay before CD play command actually ends, unit: us, decimal
#   sector_delay=xxxx
#     Delay after each CD sector read, unit: us, decimal
#   exmem_1M
#     enable 1M RAM cart built-in feature
#   exmem_4M
#     enable 4M RAM cart built-in feature
#   M_xxxxxxxx=xxxxxxxx
#     Modify RAM content in 32bit format
#   M_xxxxxxxx=xxxx
#     Modify RAM content in 16bit format
#   M_xxxxxxxx=xx
#     Modify RAM content in 8bit format
#   multi_disc="xxxx"
#     Multiple-disc image grouping string
#   category="xxxx"
#     Custom game categories, up to 12 subfolders
#   sort_mode=x
#     0 = no sort
#     1 = sort ASC
#     2 = sort DESC
#   idx_in_list=x
#     0 = do not display index in the game list
#     1 = add index number before the game title
#

[global]
lang_id = 1
sort_mode = 1
idx_in_list = 0
exmem_4M

# Final Fight Revenge
[T-1248G   V1.004]
sector_delay = 2000


# PUZZLE BOBBLE 3
[T-1109G   V1.002]
sector_delay = 4000


# D-XHIRD
[T-10307G  V1.002]
sector_delay = 1000


# TAROMARU
[T-4804G   V1.004]
sector_delay=2000


# SALAMANDER-DP
[T-9520G   V1.010]
sector_delay=4000


# Princess Crown
[T-14418G  V1.004]
sector_delay=6000


# ROUKA NI ITIDANTOA-RU
[GS-9043   V1.002]
sector_delay=4000


# The Emblem of Justice (Japan)
[T-21001G  V1.003]
sector_delay=1000


# Nobunaga no Yabou Tenshouki with Power-Up Kit
[T-7643G   V1.001]
sector_delay=2000


# Time Bokan
[T-20607G  V1.003]
play_delay = 2000


# Gotha - Ismailia SenEki (Japan)
[GS-9009   V1.000]
play_delay = 16000
sector_delay = 5000


# Last Bronx
[GS-9152   V1.113]
play_delay = 50000


[GS-9133   V1.003]
play_delay = 16000
sector_delay = 5000


[T-31505G  V1.004]
play_delay = 50000


# Bug! (USA) (R) Fixed First stage problem
[MK-81004  V1.017]
sector_delay=1000


# Bug! (USA) Fixed First stage problem
[GM-81004  V1.017]
sector_delay=1000


# Batman Forever - The Arcade Game(Japan)
[T-8118G   V1.000]
play_delay = 100000
sector_delay = 4200


# DAYTONA USA (E)
# Fixes advanced and export routes booting to system
[MK_8120050V1.000]
sector_delay=500


# DAYTONA USA (U)
# Fixes advanced and export routes booting to system
[MK-81200  V1.000]
sector_delay=500


# DAYTONA USA (J)
# Fixes advanced and export routes booting to system
[GS-9013   V1.000]
sector_delay=500


# LAST GLADIATORS
# Fixes black screen when leaving options
[T-4804H   V1.000]
sector_delay=1000


# Riglord Saga 2
[GS-9084   V1.100]
play_delay = 50000
sector_delay = 5000


# Hop Step Idol
[T-20507G  V1.002]
play_delay = 5000
pend_delay = 5000


# Thunderhawk II
[T-6006G   V1.001]
sector_delay = 8000


# Thunderhawk 2 Firestorm
[T-11501H00V1.000]
sector_delay = 8000


# Thunderstrike 2
[T-7902H   V3.000]
sector_delay = 8000


# Virtua Fighter (US)
[MK-81005  V1.000]
sector_delay = 1000

# Virtua Fighter (EU)
[MK_8100550V1.000]
sector_delay = 1000

# Virtua Fighter (JP)
[GS-9001  V1.000]
sector_delay = 1000


# Magical Drop III - Toretate Zoukan-gou! (Japan) (2M)
[T-1313G   V1.005]
play_delay = 8000
`;

const LANGUAGES = [
  ["", "noLine"],
  ["0", "lang0"],
  ["1", "lang1"],
  ["2", "lang2"],
  ["3", "lang3"],
  ["4", "lang4"],
  ["5", "lang5"],
  ["6", "lang6"],
  ["7", "lang7"],
  ["8", "lang8"],
  ["9", "lang9"],
  ["10", "lang10"],
  ["11", "lang11"],
  ["12", "lang12"],
  ["13", "lang13"],
];

const state = {
  sections: [],
  selectedIndex: 0,
  activePanel: "global-panel",
};

function $(selector) {
  return document.querySelector(selector);
}

const I18N = window.SAROO_CFGED_I18N || { en: {} };
let currentLanguage = "en";

function t(key, values = {}) {
  const template = I18N[currentLanguage]?.[key] || I18N.en?.[key] || key;
  return template.replace(/\{(\w+)}/g, (_match, name) => values[name] ?? "");
}

function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-html]").forEach((node) => {
    node.innerHTML = t(node.dataset.i18nHtml);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
}

function setUiLanguage(language, apply = true) {
  currentLanguage = I18N[language] ? language : "en";
  document.documentElement.lang = currentLanguage;
  const select = $("#ui-language");
  if (select) {
    select.value = currentLanguage;
  }
  try {
    localStorage.setItem("saroo-cfg-ui-language", currentLanguage);
  } catch (_error) {
    // Local storage can be disabled. The current page still changes language.
  }
  if (!apply) {
    return;
  }
  applyI18n();
  initLanguageSelect();
  renderGameSectionList();
  loadSectionToEditor();
  updatePreview();
}

function initUiLanguage() {
  let savedLanguage = "en";
  try {
    savedLanguage = localStorage.getItem("saroo-cfg-ui-language") || "en";
  } catch (_error) {
    savedLanguage = "en";
  }
  setUiLanguage(savedLanguage, false);
}

function setStatus(message, isError = false) {
  const status = $("#status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

function cleanLines(value) {
  return normalizeNewlines(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function makeGlobalSection() {
  return {
    type: "global",
    id: "global",
    title: "",
    settings: {},
    memory: [],
    extra: [],
  };
}

function makeGameSection(id = "T-00000G  V1.000") {
  return {
    type: "game",
    id,
    title: t("newGameTitle"),
    settings: {},
    memory: [],
    extra: [],
  };
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  const toggle = $("#theme-toggle");
  toggle.textContent = nextTheme === "dark" ? "☀" : "☾";
  try {
    localStorage.setItem("saroo-cfg-theme", nextTheme);
  } catch (_error) {
    // Local storage can be disabled. The current page still changes theme.
  }
}

function initTheme() {
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("saroo-cfg-theme") || "light";
  } catch (_error) {
    savedTheme = "light";
  }
  setTheme(savedTheme);
}

function parseAssignment(line) {
  const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
  return match ? { key: match[1], value: match[2] } : null;
}

function unquote(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function applyLineToSection(section, line) {
  const assign = parseAssignment(line);
  if (!assign) {
    if (line === "exmem_1M" || line === "exmem_4M") {
      section.settings.exmem = line;
    } else if (line) {
      section.extra.push(line);
    }
    return;
  }

  const { key, value } = assign;
  if (key === "lang_id" && section.type === "global") section.settings.lang_id = value;
  else if (key === "debug" && section.type === "global") section.settings.debug = value;
  else if (key === "log_mask" && section.type === "global") section.settings.log_mask = value;
  else if (key === "auto_update" && section.type === "global") section.settings.auto_update = value;
  else if (key === "category" && section.type === "global") section.settings.category = unquote(value);
  else if (key === "sort_mode" && section.type === "global") section.settings.sort_mode = value;
  else if (key === "idx_in_list" && section.type === "global") section.settings.idx_in_list = value;
  else if (key === "sector_delay") section.settings.sector_delay = value;
  else if (key === "play_delay") section.settings.play_delay = value;
  else if (key === "pend_delay") section.settings.pend_delay = value;
  else if (key === "multi_disc") section.settings.multi_disc = unquote(value);
  else if (key.startsWith("M_")) section.memory.push(line);
  else section.extra.push(line);
}

function parseConfig(text) {
  const sections = [];
  let current = null;
  let pendingComments = [];
  const lines = normalizeNewlines(text).split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("#")) {
      pendingComments.push(line.replace(/^#\s?/, ""));
      continue;
    }
    const header = line.match(/^\[(.*)]$/);
    if (header) {
      const id = header[1].trim();
      current = id.toLowerCase() === "global" ? makeGlobalSection() : makeGameSection(id);
      current.id = id;
      current.title = pendingComments.join("\n");
      pendingComments = [];
      sections.push(current);
      continue;
    }
    if (!current) {
      pendingComments = [];
      continue;
    }
    applyLineToSection(current, line);
  }

  if (!sections.some((section) => section.type === "global")) {
    sections.unshift(makeGlobalSection());
  }
  return sections;
}

function sectionLabel(section, index) {
  const title = section.title.split("\n").filter(Boolean).slice(-1)[0];
  return title ? `${section.id} - ${title}` : section.id || t("gameFallbackName", { value: index });
}

function globalSection() {
  let section = state.sections.find((item) => item.type === "global");
  if (!section) {
    section = makeGlobalSection();
    state.sections.unshift(section);
  }
  return section;
}

function gameSections() {
  return state.sections
    .map((section, index) => ({ section, index }))
    .filter((entry) => entry.section.type === "game");
}

function selectedGameSection() {
  const selected = state.sections[state.selectedIndex];
  if (selected && selected.type === "game") return selected;
  const firstGame = gameSections()[0];
  if (firstGame) {
    state.selectedIndex = firstGame.index;
    return firstGame.section;
  }
  return null;
}

function renderGameSectionList() {
  const list = $("#game-section-list");
  const previousValue = list.value;
  list.innerHTML = "";
  const games = gameSections();
  games.forEach(({ section, index }) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = sectionLabel(section, index);
    option.selected = index === state.selectedIndex;
    list.appendChild(option);
  });
  if (games.some((entry) => entry.index === state.selectedIndex)) {
    list.value = String(state.selectedIndex);
  } else if (previousValue && games.some((entry) => String(entry.index) === previousValue)) {
    list.value = previousValue;
    state.selectedIndex = Number(previousValue);
  }
  $("#remove-section").disabled = games.length === 0;
}

function setValue(id, value) {
  $(id).value = value == null ? "" : String(value);
}

function selectedSection() {
  return state.activePanel === "global-panel" ? globalSection() : selectedGameSection();
}

function loadSectionToEditor() {
  const section = selectedSection();
  if (!section) {
    clearGameEditor();
    return;
  }
  const isGlobal = section.type === "global";
  $("#section-hint").textContent = isGlobal
    ? t("sectionHintGlobal")
    : t("sectionHintGame");

  if (isGlobal) {
    setValue("#global-lang", section.settings.lang_id);
    setValue("#global-exmem", section.settings.exmem);
    setValue("#global-sort", section.settings.sort_mode);
    setValue("#global-index", section.settings.idx_in_list);
    setValue("#global-debug", section.settings.debug);
    setValue("#global-log", section.settings.log_mask);
    setValue("#global-auto", section.settings.auto_update);
    setValue("#global-category", section.settings.category);
    setValue("#global-extra", section.extra.join("\n"));
  } else {
    setValue("#game-id", section.id);
    setValue("#game-title", section.title);
    setValue("#game-sector", section.settings.sector_delay);
    setValue("#game-play", section.settings.play_delay);
    setValue("#game-pend", section.settings.pend_delay);
    setValue("#game-exmem", section.settings.exmem);
    setValue("#game-multi", section.settings.multi_disc);
    setValue("#game-memory", section.memory.join("\n"));
    setValue("#game-extra", section.extra.join("\n"));
  }
}

function clearGameEditor() {
  setValue("#game-id", "");
  setValue("#game-title", "");
  setValue("#game-sector", "");
  setValue("#game-play", "");
  setValue("#game-pend", "");
  setValue("#game-exmem", "");
  setValue("#game-multi", "");
  setValue("#game-memory", "");
  setValue("#game-extra", "");
  $("#section-hint").textContent = t("sectionHintAddGame");
}

function readEditorIntoSection() {
  const section = selectedSection();
  if (!section) return;
  const isGlobal = section.type === "global";

  if (isGlobal) {
    section.settings.lang_id = $("#global-lang").value.trim();
    section.settings.exmem = $("#global-exmem").value.trim();
    section.settings.sort_mode = $("#global-sort").value.trim();
    section.settings.idx_in_list = $("#global-index").value.trim();
    section.settings.debug = $("#global-debug").value.trim();
    section.settings.log_mask = $("#global-log").value.trim();
    section.settings.auto_update = $("#global-auto").value.trim();
    section.settings.category = $("#global-category").value.trim();
    section.extra = cleanLines($("#global-extra").value);
    return;
  }

  section.id = $("#game-id").value.trim() || "T-00000G  V1.000";
  section.title = $("#game-title").value.trim();
  section.settings.sector_delay = $("#game-sector").value.trim();
  section.settings.play_delay = $("#game-play").value.trim();
  section.settings.pend_delay = $("#game-pend").value.trim();
  section.settings.exmem = $("#game-exmem").value.trim();
  section.settings.multi_disc = $("#game-multi").value.trim();
  section.memory = cleanLines($("#game-memory").value);
  section.extra = cleanLines($("#game-extra").value);
}

function pushLine(lines, key, value, opts = {}) {
  if (value == null || String(value).trim() === "") return;
  const sep = opts.tight ? "=" : " = ";
  const rendered = opts.quote ? `"${String(value).replace(/"/g, '\\"')}"` : String(value).trim();
  lines.push(`${key}${sep}${rendered}`);
}

function renderConfig() {
  readEditorIntoSection();
  const lines = [
    "# SAROO config file",
    `# ${t("generatedComment")}`,
    `# ${t("generatedPathComment")}`,
    `# ${t("generatedLogComment")}`,
    "",
  ];

  state.sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    if (section.title) {
      section.title.split("\n").filter(Boolean).forEach((line) => lines.push(`# ${line}`));
    }
    lines.push(`[${section.type === "global" ? "global" : section.id}]`);

    if (section.type === "global") {
      pushLine(lines, "lang_id", section.settings.lang_id);
      pushLine(lines, "debug", section.settings.debug);
      pushLine(lines, "log_mask", section.settings.log_mask);
      pushLine(lines, "auto_update", section.settings.auto_update);
      pushLine(lines, "category", section.settings.category, { quote: true });
      pushLine(lines, "sort_mode", section.settings.sort_mode);
      pushLine(lines, "idx_in_list", section.settings.idx_in_list);
      if (section.settings.exmem) lines.push(section.settings.exmem);
    } else {
      pushLine(lines, "sector_delay", section.settings.sector_delay);
      pushLine(lines, "play_delay", section.settings.play_delay);
      pushLine(lines, "pend_delay", section.settings.pend_delay);
      if (section.settings.exmem) lines.push(section.settings.exmem);
      pushLine(lines, "multi_disc", section.settings.multi_disc, { quote: true });
      section.memory.forEach((line) => lines.push(line));
    }
    section.extra.forEach((line) => lines.push(line));
  });

  return `${lines.join("\n").trimEnd()}\n`;
}

function updatePreview() {
  $("#preview").value = renderConfig();
}

function loadConfigText(text, statusMessage) {
  state.sections = parseConfig(text);
  const firstGame = gameSections()[0];
  state.selectedIndex = firstGame ? firstGame.index : 0;
  state.activePanel = "global-panel";
  activateTab("global-panel", false);
  renderGameSectionList();
  loadSectionToEditor();
  updatePreview();
  setStatus(statusMessage);
}

async function loadConfigFile(file) {
  if (!file) return;
  const text = await file.text();
  loadConfigText(text, t("loadedFile", { value: file.name }));
  $("#output-name").value = file.name || "saroocfg.txt";
}

function saveText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.trim() || "saroocfg.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function initLanguageSelect() {
  const select = $("#global-lang");
  const previous = select.value;
  select.innerHTML = "";
  LANGUAGES.forEach(([value, labelKey]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = t(labelKey);
    select.appendChild(option);
  });
  select.value = previous;
}

function activateTab(panelId, readFirst = true) {
  if (readFirst) readEditorIntoSection();
  state.activePanel = panelId;
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === panelId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.id === panelId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  loadSectionToEditor();
  updatePreview();
}

function bindEvents() {
  $("#theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current === "dark" ? "light" : "dark");
  });

  $("#ui-language").addEventListener("change", () => {
    setUiLanguage($("#ui-language").value);
  });

  $("#cfg-file").addEventListener("change", async (event) => {
    await loadConfigFile(event.target.files && event.target.files[0]);
  });

  const fileDrop = document.querySelector(".file-drop");
  fileDrop.addEventListener("dragenter", (event) => {
    event.preventDefault();
    fileDrop.classList.add("drag-over");
    setStatus(t("dropConfigFile"));
  });
  fileDrop.addEventListener("dragover", (event) => {
    event.preventDefault();
    fileDrop.classList.add("drag-over");
  });
  fileDrop.addEventListener("dragleave", (event) => {
    if (!fileDrop.contains(event.relatedTarget)) {
      fileDrop.classList.remove("drag-over");
    }
  });
  fileDrop.addEventListener("drop", async (event) => {
    event.preventDefault();
    fileDrop.classList.remove("drag-over");
    await loadConfigFile(event.dataTransfer.files && event.dataTransfer.files[0]);
  });

  $("#load-default").addEventListener("click", () => {
    loadConfigText(DEFAULT_CONFIG, t("loadedDefault"));
  });

  $("#new-config").addEventListener("click", () => {
    loadConfigText("[global]\nlang_id = 1\nsort_mode = 1\nidx_in_list = 0\nexmem_4M\n", t("startedMinimal"));
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  $("#game-section-list").addEventListener("change", () => {
    readEditorIntoSection();
    state.selectedIndex = Number($("#game-section-list").value) || 0;
    state.activePanel = "game-panel";
    loadSectionToEditor();
    updatePreview();
  });

  $("#add-game").addEventListener("click", () => {
    readEditorIntoSection();
    state.sections.push(makeGameSection());
    state.selectedIndex = state.sections.length - 1;
    state.activePanel = "game-panel";
    activateTab("game-panel");
    renderGameSectionList();
    loadSectionToEditor();
    updatePreview();
  });

  $("#remove-section").addEventListener("click", () => {
    const section = selectedSection();
    if (!section || section.type === "global") return;
    state.sections.splice(state.selectedIndex, 1);
    const firstGame = gameSections()[0];
    state.selectedIndex = firstGame ? firstGame.index : 0;
    renderGameSectionList();
    loadSectionToEditor();
    updatePreview();
  });

  document.querySelectorAll("input, select, textarea").forEach((node) => {
    if (node.id === "preview" || node.id === "ui-language") return;
    node.addEventListener("input", updatePreview);
    node.addEventListener("change", updatePreview);
  });

  $("#preview").addEventListener("input", () => {
    setStatus(t("previewEdited"));
  });

  $("#save-config").addEventListener("click", () => {
    const text = renderConfig();
    $("#preview").value = text;
    saveText($("#output-name").value || "saroocfg.txt", text);
    setStatus(t("savedConfig"));
  });

  $("#copy-preview").addEventListener("click", async () => {
    const text = renderConfig();
    $("#preview").value = text;
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t("copiedPreview"));
    } catch (_error) {
      setStatus(t("clipboardFailed"), true);
    }
  });
}

function init() {
  initUiLanguage();
  applyI18n();
  initTheme();
  initLanguageSelect();
  bindEvents();
  loadConfigText(DEFAULT_CONFIG, t("loadedDefault"));
}

init();
