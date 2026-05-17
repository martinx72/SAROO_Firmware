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

const SSAVE_MAGIC = "Saroo Save File";
const SARO_SAVE_MAGIC0 = 0x5361726f;
const SARO_SAVE_MAGIC1 = 0x53617665;
const SARO_MEMS_MAGIC1 = 0x4d656d73;
const SSAVERAW_MAGIC = "SSAVERAW";
const SSAVE_SLOT_SIZE = 0x10000;
const SSAVE_INDEX_LIMIT = 4096;
const INTERNAL_BLOCK_SIZE = 128;
const INTERNAL_BLOCK_COUNT = 512;
const MEMS_SIZE = 0x800000;
const MEMS_BLOCK_SIZE = 1024;
const MEMS_BLOCK_COUNT = 8064;
const MEMS_DIR_OFFSET = 1024;
const MEMS_DIR_COUNT = 448;

const state = {
  active: "ssave",
  ssave: {
    image: null,
    rawSave: null,
  },
  smems: {
    image: null,
    rawSave: null,
  },
};

const $ = (id) => document.getElementById(id);
const I18N = window.SAROO_MEMTOOL_I18N?.en || {};

function t(key, values = {}) {
  const template = I18N[key] || key;
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readAscii(bytes, offset, length) {
  let text = "";
  for (let i = 0; i < length && offset + i < bytes.length; i += 1) {
    const value = bytes[offset + i];
    if (value === 0) {
      break;
    }
    text += value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : ".";
  }
  return text.trimEnd();
}

function readFieldBytes(bytes, offset, length) {
  let end = offset;
  const limit = Math.min(bytes.length, offset + length);
  while (end < limit && bytes[end] !== 0) {
    end += 1;
  }
  while (end > offset && bytes[end - 1] === 0x20) {
    end -= 1;
  }
  return bytes.slice(offset, end);
}

function readBackupText(bytes, offset, length) {
  const raw = readFieldBytes(bytes, offset, length);
  if (!raw.length) {
    return "";
  }
  const asciiOnly = raw.every((value) => value >= 0x20 && value <= 0x7e);
  if (asciiOnly) {
    return String.fromCharCode(...raw);
  }
  try {
    return new TextDecoder("shift-jis").decode(raw).trimEnd();
  } catch (error) {
    return Array.from(raw).map((value) => `\\x${value.toString(16).padStart(2, "0")}`).join("");
  }
}

function writeAscii(bytes, offset, length, text) {
  bytes.fill(0, offset, offset + length);
  const value = String(text || "");
  for (let i = 0; i < value.length && i < length; i += 1) {
    bytes[offset + i] = value.charCodeAt(i) & 0xff;
  }
}

function readU16BE(bytes, offset) {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

function writeU16BE(bytes, offset, value) {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function readU32BE(bytes, offset) {
  return (
    (bytes[offset] * 0x1000000) +
    ((bytes[offset + 1] << 16) >>> 0) +
    ((bytes[offset + 2] << 8) >>> 0) +
    bytes[offset + 3]
  ) >>> 0;
}

function writeU32BE(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function bitIsSet(bytes, offset, index) {
  return (bytes[offset + Math.floor(index / 8)] & (1 << (index & 7))) !== 0;
}

function setBit(bytes, offset, index, enabled) {
  const byteOffset = offset + Math.floor(index / 8);
  const mask = 1 << (index & 7);
  if (enabled) {
    bytes[byteOffset] |= mask;
  } else {
    bytes[byteOffset] &= ~mask;
  }
}

function getNextBitmapBlock(bytes, bitmapOffset, start, limit) {
  for (let i = start; i < limit; i += 1) {
    if (bitIsSet(bytes, bitmapOffset, i)) {
      return i;
    }
  }
  return 0;
}

function findFreeBlock(bytes, bitmapOffset, start, limit) {
  for (let i = start; i < limit; i += 1) {
    if (!bitIsSet(bytes, bitmapOffset, i)) {
      setBit(bytes, bitmapOffset, i, true);
      return i;
    }
  }
  return 0;
}

function downloadBytes(filename, bytes) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function readFileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

function parseRawSave(bytes, filename = "save.ssaveraw") {
  assert(bytes.length >= 0x40, t("rawFileTooSmall"));
  assert(readAscii(bytes, 0, 8) === SSAVERAW_MAGIC, t("notRawFile"));
  const dataSize = readU32BE(bytes, 0x1c);
  assert(dataSize <= bytes.length - 0x40, t("rawTruncated"));
  return {
    filename,
    fileName: readAscii(bytes, 0x10, 11),
    comment: readAscii(bytes, 0x20, 10),
    language: bytes[0x2b],
    date: readU32BE(bytes, 0x2c),
    dataSize,
    data: bytes.slice(0x40, 0x40 + dataSize),
    raw: bytes,
  };
}

function makeRawSave(save) {
  const bytes = new Uint8Array(0x40 + save.dataSize);
  writeAscii(bytes, 0x00, 8, SSAVERAW_MAGIC);
  writeAscii(bytes, 0x10, 11, save.fileName);
  writeU32BE(bytes, 0x1c, save.dataSize);
  writeAscii(bytes, 0x20, 10, save.comment);
  bytes[0x2b] = save.language & 0xff;
  writeU32BE(bytes, 0x2c, save.date >>> 0);
  bytes.set(save.data.slice(0, save.dataSize), 0x40);
  return bytes;
}

function sanitizeOutputName(name, fallback) {
  const cleaned = String(name || "").trim().replace(/[\\/:*?"<>|]+/g, "_");
  return cleaned || fallback;
}

function parseSaveHeader(bytes, offset, blockSize, source, id) {
  const dataSize = readU32BE(bytes, offset + 0x0c);
  const saturnUsedBlocks = source === "smems" && dataSize <= MEMS_BLOCK_SIZE - 64
    ? Math.ceil(dataSize / 64)
    : Math.ceil(dataSize / 64) + 1;
  return {
    id,
    source,
    block: id,
    blockOffset: offset,
    fileName: readAscii(bytes, offset + 0x00, 11),
    comment: readBackupText(bytes, offset + 0x10, 10),
    language: bytes[offset + 0x1b],
    date: readU32BE(bytes, offset + 0x1c),
    dataSize,
    blockSize,
    saturnUsedBlocks,
  };
}

function parseSSave(bytes) {
  assert(readAscii(bytes, 0, SSAVE_MAGIC.length) === SSAVE_MAGIC, t("invalidSSave"));
  const slots = [];
  const maxSlot = Math.min(SSAVE_INDEX_LIMIT, Math.floor(bytes.length / SSAVE_SLOT_SIZE));
  for (let i = 1; i < maxSlot; i += 1) {
    const slotName = readAscii(bytes, i * 16, 16);
    if (!slotName) {
      break;
    }
    const offset = i * SSAVE_SLOT_SIZE;
    const valid = readU32BE(bytes, offset) === SARO_SAVE_MAGIC0 && readU32BE(bytes, offset + 4) === SARO_SAVE_MAGIC1;
    slots.push({
      index: i,
      name: slotName,
      offset,
      valid,
      freeBlock: valid ? readU16BE(bytes, offset + 0x0e) : 0,
      saves: valid ? listInternalSaves(bytes, offset) : [],
    });
  }
  return { type: "ssave", bytes, slots };
}

function listInternalSaves(bytes, slotOffset) {
  const saves = [];
  let block = readU16BE(bytes, slotOffset + 0x3e);
  let guard = 0;
  while (block && block < INTERNAL_BLOCK_COUNT && guard < INTERNAL_BLOCK_COUNT) {
    const blockOffset = slotOffset + block * INTERNAL_BLOCK_SIZE;
    const save = parseSaveHeader(bytes, blockOffset, INTERNAL_BLOCK_SIZE, "ssave", block);
    save.index = saves.length;
    save.data = readInternalSaveData(bytes, slotOffset, save);
    saves.push(save);
    block = readU16BE(bytes, blockOffset + 0x3e);
    guard += 1;
  }
  return saves;
}

function readInternalSaveData(bytes, slotOffset, save) {
  const data = new Uint8Array(save.dataSize);
  let dataOffset = 0;
  let block = 0;
  while (dataOffset < save.dataSize) {
    block = getNextBitmapBlock(bytes, save.blockOffset + 0x40, block, INTERNAL_BLOCK_COUNT);
    if (!block) {
      break;
    }
    const sourceOffset = slotOffset + block * INTERNAL_BLOCK_SIZE;
    const size = Math.min(INTERNAL_BLOCK_SIZE, save.dataSize - dataOffset);
    data.set(bytes.slice(sourceOffset, sourceOffset + size), dataOffset);
    dataOffset += size;
    block += 1;
  }
  return data;
}

function parseSMems(bytes) {
  assert(bytes.length >= MEMS_SIZE, t("invalidSMemsSize"));
  assert(readU32BE(bytes, 0) === SARO_SAVE_MAGIC0 && readU32BE(bytes, 4) === SARO_MEMS_MAGIC1, t("invalidSMems"));
  const saves = [];
  for (let i = 0; i < MEMS_DIR_COUNT; i += 1) {
    const entryOffset = MEMS_DIR_OFFSET + i * 16;
    if (bytes[entryOffset] === 0) {
      continue;
    }
    const block = readU16BE(bytes, entryOffset + 0x0e);
    if (!block || block >= MEMS_BLOCK_COUNT) {
      continue;
    }
    const blockOffset = block * MEMS_BLOCK_SIZE;
    const save = parseSaveHeader(bytes, blockOffset, MEMS_BLOCK_SIZE, "smems", block);
    save.index = saves.length;
    save.dirIndex = i;
    save.dirOffset = entryOffset;
    save.data = readMemsSaveData(bytes, save);
    saves.push(save);
  }
  return {
    type: "smems",
    bytes,
    freeBlock: readU16BE(bytes, 0x0c),
    saves,
    slots: [{
      index: 0,
      name: t("externalMemoryCard"),
      offset: 0,
      valid: true,
      freeBlock: readU16BE(bytes, 0x0c),
      saves,
    }],
  };
}

function readMemsSaveData(bytes, save) {
  const data = new Uint8Array(save.dataSize);
  if (save.dataSize <= MEMS_BLOCK_SIZE - 64) {
    data.set(bytes.slice(save.blockOffset + 0x40, save.blockOffset + 0x40 + save.dataSize));
    return data;
  }

  let dataOffset = 0;
  let pointerOffset = save.blockOffset + 0x40;
  while (dataOffset < save.dataSize) {
    const block = readU16BE(bytes, pointerOffset);
    if (!block) {
      break;
    }
    const sourceOffset = block * MEMS_BLOCK_SIZE;
    const size = Math.min(MEMS_BLOCK_SIZE, save.dataSize - dataOffset);
    data.set(bytes.slice(sourceOffset, sourceOffset + size), dataOffset);
    dataOffset += size;
    pointerOffset += 2;
  }
  return data;
}

function detectImage(bytes) {
  if (readAscii(bytes, 0, SSAVE_MAGIC.length) === SSAVE_MAGIC) {
    return parseSSave(bytes);
  }
  if (bytes.length >= 8 && readU32BE(bytes, 0) === SARO_SAVE_MAGIC0 && readU32BE(bytes, 4) === SARO_MEMS_MAGIC1) {
    return parseSMems(bytes);
  }
  throw new Error(t("unsupportedImage"));
}

function refreshParsedImage(type) {
  const current = state[type].image;
  if (!current) {
    return;
  }
  state[type].image = type === "ssave" ? parseSSave(current.bytes) : parseSMems(current.bytes);
}

function makeOption(value, text) {
  const option = document.createElement("option");
  option.value = String(value);
  option.textContent = text;
  return option;
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  const toggle = $("theme-toggle");
  toggle.textContent = nextTheme === "dark" ? "☀" : "☾";
  try {
    localStorage.setItem("saroo-memtool-theme", nextTheme);
  } catch (_error) {
    // Local storage can be disabled. The current page still changes theme.
  }
}

function initTheme() {
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("saroo-memtool-theme") || "light";
  } catch (_error) {
    savedTheme = "light";
  }
  setTheme(savedTheme);
}

function rawSummary(raw) {
  if (!raw) {
    return t("noRawLoaded");
  }
  return [
    t("rawSummaryFileName", { value: raw.fileName }),
    t("rawSummaryComment", { value: raw.comment || t("emptyValue") }),
    t("rawSummaryDataSize", { value: raw.dataSize }),
  ].join("\n");
}

function saveDetailText(save) {
  return [
    t("detailFileName", { value: save.fileName }),
    t("detailComment", { value: save.comment || t("emptyValue") }),
    t("detailDataSize", { value: save.dataSize }),
    t("detailSaturnBlocks", { value: save.saturnUsedBlocks }),
    t("detailLanguage", { value: save.language }),
    t("detailDateRaw", { value: save.date.toString(16).padStart(8, "0").toUpperCase() }),
    t("detailInternalBlock", { value: save.block }),
  ].join("\n");
}

function selectedSSaveSlot() {
  const image = state.ssave.image;
  if (!image) {
    return null;
  }

  const slotValue = $("ssave-slot-list").value;
  if (slotValue !== "") {
    const slot = image.slots.find((item) => item.index === Number(slotValue));
    if (slot) {
      return slot;
    }
  }

  const emptyValue = $("empty-slot-list").value;
  if (emptyValue !== "") {
    return image.slots.find((item) => item.index === Number(emptyValue)) || null;
  }

  return null;
}

function selectedSSaveSave() {
  const slot = selectedSSaveSlot();
  if (!slot) {
    return null;
  }
  const index = Number($("ssave-save-list").value);
  return slot.saves.find((save) => save.index === index) || null;
}

function selectedSMemsSlot() {
  const image = state.smems.image;
  if (!image) {
    return null;
  }
  return image.slots[0];
}

function selectedSMemsSave() {
  const image = state.smems.image;
  if (!image) {
    return null;
  }
  const index = Number($("smems-save-list").value);
  return image.saves.find((save) => save.index === index) || null;
}

function selectedSlot(type) {
  return type === "ssave" ? selectedSSaveSlot() : selectedSMemsSlot();
}

function selectedSave(type) {
  return type === "ssave" ? selectedSSaveSave() : selectedSMemsSave();
}

function setTab(tabId) {
  document.querySelectorAll(".tab").forEach((button) => {
    const active = button.dataset.tab === tabId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const active = panel.id === tabId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  state.active = tabId === "smems-panel" ? "smems" : "ssave";
}

function updateSSaveUi(message = "") {
  const image = state.ssave.image;
  $("ssave-status").textContent = message;
  $("ssave-slot-list").innerHTML = "";
  $("empty-slot-list").innerHTML = "";
  $("ssave-save-list").innerHTML = "";
  $("create-slot").disabled = !image;
  $("ssave-download").disabled = !image;
  $("ssave-export").disabled = true;
  $("ssave-delete").disabled = true;
  $("ssave-import").disabled = !image || !state.ssave.rawSave;
  $("ssave-import-mode").disabled = !image || !state.ssave.rawSave;

  if (!image) {
    $("ssave-summary").textContent = t("noSSaveLoaded");
    $("ssave-detail").textContent = t("selectSaveEntry");
    $("ssave-slot-meta").textContent = t("noGameSlotSelected");
    $("ssave-slot-list").disabled = true;
    $("empty-slot-list").disabled = true;
    $("ssave-save-list").disabled = true;
    return;
  }

  const slotsWithSaves = image.slots.filter((slot) => slot.saves.length > 0);
  const emptySlots = image.slots.filter((slot) => slot.saves.length === 0);
  const saveCount = slotsWithSaves.reduce((total, slot) => total + slot.saves.length, 0);
  $("ssave-summary").textContent = [
    t("summaryType", { value: "SS_SAVE.BIN" }),
    t("summarySize", { value: image.bytes.length.toLocaleString() }),
    t("summaryGameSlots", { value: image.slots.length }),
    t("summarySlotsWithSaves", { value: slotsWithSaves.length }),
    t("summaryPlayedSlots0", { value: emptySlots.length }),
    t("summarySaves", { value: saveCount }),
  ].join("\n");

  slotsWithSaves.forEach((slot) => {
    $("ssave-slot-list").appendChild(makeOption(slot.index, `${slot.name} (${slot.saves.length})`));
  });
  emptySlots.forEach((slot) => {
    $("empty-slot-list").appendChild(makeOption(slot.index, slot.name));
  });

  $("ssave-slot-list").disabled = slotsWithSaves.length === 0;
  $("empty-slot-list").disabled = emptySlots.length === 0;
  $("ssave-save-list").disabled = slotsWithSaves.length === 0;

  if (slotsWithSaves.length) {
    $("ssave-slot-list").selectedIndex = 0;
    $("empty-slot-list").selectedIndex = -1;
  } else if (emptySlots.length) {
    $("empty-slot-list").selectedIndex = 0;
  }
  updateSSaveSaveList();
}

function updateSSaveSaveList() {
  const slot = selectedSSaveSlot();
  $("ssave-save-list").innerHTML = "";
  if (!slot) {
    $("ssave-slot-meta").textContent = t("noGameSlotSelected");
    $("ssave-detail").textContent = t("selectGameSlot");
    updateSSaveButtons();
    return;
  }

  $("ssave-slot-meta").textContent = [
    t("slotIndex", { value: slot.index }),
    t("slotFreeBlocks", { value: slot.freeBlock }),
    t("slotSaveEntries", { value: slot.saves.length }),
  ].join("\n");

  slot.saves.forEach((save) => {
    $("ssave-save-list").appendChild(makeOption(save.index, `${save.index}: ${save.fileName} (${t("listBlocks", { value: save.saturnUsedBlocks })})`));
  });
  if (slot.saves.length) {
    $("ssave-save-list").selectedIndex = 0;
  }
  updateSSaveDetail();
}

function updateSSaveDetail() {
  const slot = selectedSSaveSlot();
  const save = selectedSSaveSave();
  if (!slot) {
    $("ssave-detail").textContent = t("selectGameSlot");
  } else if (!save) {
    $("ssave-detail").textContent = [
      t("selectedGameSlot", { value: slot.name }),
      t("slotSaveEntries", { value: 0 }),
      t("importFirstSaveHint"),
    ].join("\n");
  } else {
    $("ssave-detail").textContent = saveDetailText(save);
  }
  updateSSaveButtons();
}

function updateSSaveButtons() {
  const image = state.ssave.image;
  const slot = selectedSSaveSlot();
  const save = selectedSSaveSave();
  const canImport = Boolean(image && slot && state.ssave.rawSave);
  $("ssave-export").disabled = !save;
  $("ssave-delete").disabled = !save;
  $("ssave-import").disabled = !canImport;
  $("ssave-import-mode").disabled = !canImport;
}

function updateSMemsUi(message = "") {
  const image = state.smems.image;
  $("smems-status").textContent = message;
  $("smems-save-list").innerHTML = "";
  $("smems-download").disabled = !image;
  $("smems-export").disabled = true;
  $("smems-delete").disabled = true;
  $("smems-import").disabled = !image || !state.smems.rawSave;
  $("smems-import-mode").disabled = !image || !state.smems.rawSave;

  if (!image) {
    $("smems-summary").textContent = t("noSMemsLoaded");
    $("smems-detail").textContent = t("selectSaveEntry");
    $("smems-save-list").disabled = true;
    return;
  }

  $("smems-summary").textContent = [
    t("summaryType", { value: "SS_MEMS.BIN" }),
    t("summarySize", { value: image.bytes.length.toLocaleString() }),
    t("summaryExternalSaves", { value: image.saves.length }),
    t("summaryFreeBlocks", { value: image.freeBlock }),
  ].join("\n");

  image.saves.forEach((save) => {
    $("smems-save-list").appendChild(makeOption(save.index, `${save.index}: ${save.fileName} (${t("listBlocks", { value: save.saturnUsedBlocks })})`));
  });
  $("smems-save-list").disabled = image.saves.length === 0;
  if (image.saves.length) {
    $("smems-save-list").selectedIndex = 0;
  }
  updateSMemsDetail();
}

function updateSMemsDetail() {
  const save = selectedSMemsSave();
  if (!save) {
    $("smems-detail").textContent = t("noSaveSelectedSMems");
  } else {
    $("smems-detail").textContent = saveDetailText(save);
  }
  updateSMemsButtons();
}

function updateSMemsButtons() {
  const image = state.smems.image;
  const save = selectedSMemsSave();
  const canImport = Boolean(image && state.smems.rawSave);
  $("smems-export").disabled = !save;
  $("smems-delete").disabled = !save;
  $("smems-import").disabled = !canImport;
  $("smems-import-mode").disabled = !canImport;
}

function formatInternalSlot(bytes, slotOffset, gameId) {
  bytes.fill(0, slotOffset, slotOffset + SSAVE_SLOT_SIZE);
  writeU32BE(bytes, slotOffset + 0x00, SARO_SAVE_MAGIC0);
  writeU32BE(bytes, slotOffset + 0x04, SARO_SAVE_MAGIC1);
  writeU32BE(bytes, slotOffset + 0x08, SSAVE_SLOT_SIZE);
  writeU16BE(bytes, slotOffset + 0x0c, INTERNAL_BLOCK_SIZE);
  writeU16BE(bytes, slotOffset + 0x0e, INTERNAL_BLOCK_COUNT - 1);
  writeAscii(bytes, slotOffset + 0x20, 16, gameId);
  writeU16BE(bytes, slotOffset + 0x3e, 0);
  bytes[slotOffset + 0x40] = 0x01;
}

function ensureSSaveCapacity(bytes, slotIndex) {
  const needed = (slotIndex + 1) * SSAVE_SLOT_SIZE;
  if (bytes.length >= needed) {
    return bytes;
  }
  const next = new Uint8Array(needed);
  next.set(bytes);
  return next;
}

function createSSaveSlot(gameId) {
  const image = state.ssave.image;
  assert(image && image.type === "ssave", t("loadSSaveFirst"));
  const cleanId = String(gameId || "").trim();
  assert(cleanId.length > 0, t("gameIdRequired"));
  assert(cleanId.length <= 16, t("gameIdTooLong"));

  const existing = image.slots.find((slot) => slot.name === cleanId);
  assert(!existing, t("gameIdExists"));

  let slotIndex = 1;
  for (; slotIndex < SSAVE_INDEX_LIMIT; slotIndex += 1) {
    if (!readAscii(image.bytes, slotIndex * 16, 16)) {
      break;
    }
  }
  assert(slotIndex < SSAVE_INDEX_LIMIT, t("ssaveIndexFull"));
  image.bytes = ensureSSaveCapacity(image.bytes, slotIndex);
  writeAscii(image.bytes, slotIndex * 16, 16, cleanId);
  formatInternalSlot(image.bytes, slotIndex * SSAVE_SLOT_SIZE, cleanId);
  refreshParsedImage("ssave");
  updateSSaveUi(t("createdSlot", { value: cleanId }));
  $("ssave-slot-list").selectedIndex = -1;
  $("empty-slot-list").value = String(slotIndex);
  updateSSaveSaveList();
}

function deleteInternalSave(bytes, slot, save) {
  const headerOffset = save.blockOffset;
  setBit(bytes, slot.offset + 0x40, save.block, false);
  let freeBlock = readU16BE(bytes, slot.offset + 0x0e) + 1;

  let block = 0;
  while (true) {
    block = getNextBitmapBlock(bytes, headerOffset + 0x40, block, INTERNAL_BLOCK_COUNT);
    if (!block) {
      break;
    }
    setBit(bytes, slot.offset + 0x40, block, false);
    freeBlock += 1;
    block += 1;
  }

  let last = 0;
  let current = readU16BE(bytes, slot.offset + 0x3e);
  while (current && current !== save.block) {
    last = current;
    current = readU16BE(bytes, slot.offset + current * INTERNAL_BLOCK_SIZE + 0x3e);
  }
  assert(current === save.block, t("chainBroken"));
  const next = readU16BE(bytes, headerOffset + 0x3e);
  writeU16BE(bytes, slot.offset + last * INTERNAL_BLOCK_SIZE + 0x3e, next);
  writeU16BE(bytes, slot.offset + 0x0e, freeBlock);
  bytes.fill(0, headerOffset, headerOffset + INTERNAL_BLOCK_SIZE);
}

function addInternalSave(bytes, slot, raw) {
  let freeBlock = readU16BE(bytes, slot.offset + 0x0e);
  const blockNeed = Math.ceil(raw.dataSize / INTERNAL_BLOCK_SIZE);
  assert(blockNeed + 1 <= freeBlock, t("notEnoughSSaveBlocks"));

  const hdr = findFreeBlock(bytes, slot.offset + 0x40, 0, INTERNAL_BLOCK_COUNT);
  assert(hdr, t("noFreeHeaderBlock"));
  freeBlock -= 1;
  const headerOffset = slot.offset + hdr * INTERNAL_BLOCK_SIZE;
  bytes.fill(0, headerOffset, headerOffset + INTERNAL_BLOCK_SIZE);
  writeAscii(bytes, headerOffset + 0x00, 11, raw.fileName);
  writeU32BE(bytes, headerOffset + 0x0c, raw.dataSize);
  writeAscii(bytes, headerOffset + 0x10, 10, raw.comment);
  bytes[headerOffset + 0x1b] = raw.language & 0xff;
  writeU32BE(bytes, headerOffset + 0x1c, raw.date);

  let dataOffset = 0;
  let nextSearch = 0;
  for (let i = 0; i < blockNeed; i += 1) {
    const block = findFreeBlock(bytes, slot.offset + 0x40, nextSearch, INTERNAL_BLOCK_COUNT);
    assert(block, t("noFreeDataBlock"));
    setBit(bytes, headerOffset + 0x40, block, true);
    const destOffset = slot.offset + block * INTERNAL_BLOCK_SIZE;
    bytes.fill(0, destOffset, destOffset + INTERNAL_BLOCK_SIZE);
    const size = Math.min(INTERNAL_BLOCK_SIZE, raw.dataSize - dataOffset);
    bytes.set(raw.data.slice(dataOffset, dataOffset + size), destOffset);
    dataOffset += size;
    nextSearch = block + 1;
    freeBlock -= 1;
  }

  let last = 0;
  let current = readU16BE(bytes, slot.offset + 0x3e);
  while (current) {
    last = current;
    current = readU16BE(bytes, slot.offset + current * INTERNAL_BLOCK_SIZE + 0x3e);
  }
  writeU16BE(bytes, slot.offset + last * INTERNAL_BLOCK_SIZE + 0x3e, hdr);
  writeU16BE(bytes, slot.offset + 0x0e, freeBlock);
}

function deleteMemsSave(bytes, save) {
  setBit(bytes, 0x10, save.block, false);
  let freeBlock = readU16BE(bytes, 0x0c) + 1;

  if (save.dataSize > MEMS_BLOCK_SIZE - 64) {
    let pointerOffset = save.blockOffset + 0x40;
    while (true) {
      const block = readU16BE(bytes, pointerOffset);
      if (!block) {
        break;
      }
      setBit(bytes, 0x10, block, false);
      freeBlock += 1;
      pointerOffset += 2;
    }
  }

  bytes.fill(0, save.dirOffset, save.dirOffset + 16);
  bytes.fill(0, save.blockOffset, save.blockOffset + MEMS_BLOCK_SIZE);
  writeU16BE(bytes, 0x0c, freeBlock);
}

function addMemsSave(bytes, raw) {
  let dirIndex = -1;
  for (let i = 0; i < MEMS_DIR_COUNT; i += 1) {
    if (bytes[MEMS_DIR_OFFSET + i * 16] === 0) {
      dirIndex = i;
      break;
    }
  }
  assert(dirIndex >= 0, t("smemsDirFull"));

  let freeBlock = readU16BE(bytes, 0x0c);
  const blockNeed = raw.dataSize <= MEMS_BLOCK_SIZE - 64 ? 0 : Math.ceil(raw.dataSize / MEMS_BLOCK_SIZE);
  assert(blockNeed + 1 <= freeBlock, t("notEnoughSMemsBlocks"));

  const hdr = findFreeBlock(bytes, 0x10, 0, MEMS_BLOCK_COUNT);
  assert(hdr, t("noFreeHeaderBlock"));
  freeBlock -= 1;
  const headerOffset = hdr * MEMS_BLOCK_SIZE;
  bytes.fill(0, headerOffset, headerOffset + MEMS_BLOCK_SIZE);
  writeAscii(bytes, headerOffset + 0x00, 11, raw.fileName);
  writeU32BE(bytes, headerOffset + 0x0c, raw.dataSize);
  writeAscii(bytes, headerOffset + 0x10, 10, raw.comment);
  bytes[headerOffset + 0x1b] = raw.language & 0xff;
  writeU32BE(bytes, headerOffset + 0x1c, raw.date);

  if (blockNeed === 0) {
    bytes.set(raw.data, headerOffset + 0x40);
  } else {
    let dataOffset = 0;
    let nextSearch = 0;
    for (let i = 0; i < blockNeed; i += 1) {
      const block = findFreeBlock(bytes, 0x10, nextSearch, MEMS_BLOCK_COUNT);
      assert(block, t("noFreeDataBlock"));
      writeU16BE(bytes, headerOffset + 0x40 + i * 2, block);
      const destOffset = block * MEMS_BLOCK_SIZE;
      bytes.fill(0, destOffset, destOffset + MEMS_BLOCK_SIZE);
      const size = Math.min(MEMS_BLOCK_SIZE, raw.dataSize - dataOffset);
      bytes.set(raw.data.slice(dataOffset, dataOffset + size), destOffset);
      dataOffset += size;
      nextSearch = block + 1;
      freeBlock -= 1;
    }
    writeU16BE(bytes, headerOffset + 0x40 + blockNeed * 2, 0);
  }

  const dirOffset = MEMS_DIR_OFFSET + dirIndex * 16;
  bytes.fill(0, dirOffset, dirOffset + 16);
  writeAscii(bytes, dirOffset, 11, raw.fileName);
  writeU16BE(bytes, dirOffset + 0x0e, hdr);
  writeU16BE(bytes, 0x0c, freeBlock);
}

function deleteSelectedSave(type) {
  const image = state[type].image;
  const slot = selectedSlot(type);
  const save = selectedSave(type);
  assert(image && slot && save, t("selectSaveFirst"));
  if (image.type === "ssave") {
    deleteInternalSave(image.bytes, slot, save);
  } else {
    deleteMemsSave(image.bytes, save);
  }
  refreshParsedImage(type);
  if (type === "ssave") {
    updateSSaveUi(t("deletedSave", { value: save.fileName }));
  } else {
    updateSMemsUi(t("deletedSave", { value: save.fileName }));
  }
}

function importRawSave(type) {
  const image = state[type].image;
  const raw = state[type].rawSave;
  const slot = selectedSlot(type);
  assert(image && raw && slot, t("loadImageAndRawFirst"));

  const mode = $(`${type}-import-mode`).value;
  const backup = image.bytes.slice();
  try {
    if (mode === "replace") {
      const save = selectedSave(type);
      assert(save, t("selectSaveToReplace"));
      if (image.type === "ssave") {
        deleteInternalSave(image.bytes, slot, save);
      } else {
        deleteMemsSave(image.bytes, save);
      }
    } else {
      const duplicate = slot.saves.find((save) => save.fileName === raw.fileName);
      assert(!duplicate, t("duplicateSave"));
    }

    if (image.type === "ssave") {
      addInternalSave(image.bytes, slot, raw);
    } else {
      addMemsSave(image.bytes, raw);
    }
  } catch (error) {
    image.bytes = backup;
    throw error;
  }
  refreshParsedImage(type);
  if (type === "ssave") {
    updateSSaveUi(t("importedSave", { value: raw.fileName }));
  } else {
    updateSMemsUi(t("importedSave", { value: raw.fileName }));
  }
}

function wireEvents() {
  $("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current === "dark" ? "light" : "dark");
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  $("ssave-file").addEventListener("change", async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      state.ssave.image = parseSSave(await readFileBytes(file));
      $("ssave-output-name").value = "SS_SAVE.BIN";
      updateSSaveUi(t("loadedFile", { value: file.name }));
    } catch (error) {
      state.ssave.image = null;
      updateSSaveUi(error.message);
    }
  });

  $("smems-file").addEventListener("change", async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      state.smems.image = parseSMems(await readFileBytes(file));
      $("smems-output-name").value = "SS_MEMS.BIN";
      updateSMemsUi(t("loadedFile", { value: file.name }));
    } catch (error) {
      state.smems.image = null;
      updateSMemsUi(error.message);
    }
  });

  $("ssave-raw-file").addEventListener("change", async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      state.ssave.rawSave = parseRawSave(await readFileBytes(file), file.name);
      $("ssave-raw-summary").textContent = rawSummary(state.ssave.rawSave);
      updateSSaveUi(t("loadedRawFile", { value: file.name }));
    } catch (error) {
      state.ssave.rawSave = null;
      $("ssave-raw-summary").textContent = error.message;
      updateSSaveUi(error.message);
    }
  });

  $("smems-raw-file").addEventListener("change", async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      state.smems.rawSave = parseRawSave(await readFileBytes(file), file.name);
      $("smems-raw-summary").textContent = rawSummary(state.smems.rawSave);
      updateSMemsUi(t("loadedRawFile", { value: file.name }));
    } catch (error) {
      state.smems.rawSave = null;
      $("smems-raw-summary").textContent = error.message;
      updateSMemsUi(error.message);
    }
  });

  $("ssave-slot-list").addEventListener("change", () => {
    $("empty-slot-list").selectedIndex = -1;
    updateSSaveSaveList();
  });
  $("empty-slot-list").addEventListener("change", () => {
    $("ssave-slot-list").selectedIndex = -1;
    updateSSaveSaveList();
  });
  $("ssave-save-list").addEventListener("change", updateSSaveDetail);
  $("smems-save-list").addEventListener("change", updateSMemsDetail);

  $("create-slot").addEventListener("click", () => {
    try {
      createSSaveSlot($("new-game-id").value);
    } catch (error) {
      updateSSaveUi(error.message);
    }
  });

  $("ssave-export").addEventListener("click", () => {
    try {
      const save = selectedSave("ssave");
      assert(save, t("selectSaveFirst"));
      const raw = makeRawSave(save);
      downloadBytes(`${sanitizeOutputName(save.fileName, "save")}.ssaveraw`, raw);
      updateSSaveUi(t("exportedSave", { value: save.fileName }));
    } catch (error) {
      updateSSaveUi(error.message);
    }
  });

  $("smems-export").addEventListener("click", () => {
    try {
      const save = selectedSave("smems");
      assert(save, t("selectSaveFirst"));
      const raw = makeRawSave(save);
      downloadBytes(`${sanitizeOutputName(save.fileName, "save")}.ssaveraw`, raw);
      updateSMemsUi(t("exportedSave", { value: save.fileName }));
    } catch (error) {
      updateSMemsUi(error.message);
    }
  });

  $("ssave-delete").addEventListener("click", () => {
    try {
      deleteSelectedSave("ssave");
    } catch (error) {
      updateSSaveUi(error.message);
    }
  });

  $("smems-delete").addEventListener("click", () => {
    try {
      deleteSelectedSave("smems");
    } catch (error) {
      updateSMemsUi(error.message);
    }
  });

  $("ssave-import").addEventListener("click", () => {
    try {
      importRawSave("ssave");
    } catch (error) {
      updateSSaveUi(error.message);
    }
  });

  $("smems-import").addEventListener("click", () => {
    try {
      importRawSave("smems");
    } catch (error) {
      updateSMemsUi(error.message);
    }
  });

  $("ssave-download").addEventListener("click", () => {
    try {
      assert(state.ssave.image, t("loadSSaveFirst"));
      downloadBytes(sanitizeOutputName($("ssave-output-name").value, "SS_SAVE.BIN"), state.ssave.image.bytes);
      updateSSaveUi(t("downloadedSSave"));
    } catch (error) {
      updateSSaveUi(error.message);
    }
  });

  $("smems-download").addEventListener("click", () => {
    try {
      assert(state.smems.image, t("loadSMemsFirst"));
      downloadBytes(sanitizeOutputName($("smems-output-name").value, "SS_MEMS.BIN"), state.smems.image.bytes);
      updateSMemsUi(t("downloadedSMems"));
    } catch (error) {
      updateSMemsUi(error.message);
    }
  });
}

applyI18n();
initTheme();
wireEvents();
