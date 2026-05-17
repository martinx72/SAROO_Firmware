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

const DEFAULT_PROFILE = {
  backend: 0,
  flags: 0,
  masterVector: 5,
  cache4Capacity: 500 / 4,
  masterOpcode: 0xC305,
  masterAddr: 0x06000914,
  cfgLocation: 0x060FF000,
};

const COMMANDS = {
  0x0: "boot16",
  0x1: "freeze16",
  0x3: "freeze8",
  0x8: "freeze8x2",
  0xD: "cond16",
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hex(value, width) {
  return (Number(value) >>> 0).toString(16).toUpperCase().padStart(width, "0");
}

function safeFilename(name) {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned || "SaturnGame"}.scht`;
}

function masterVectorFromOpcode(opcode) {
  if ((opcode & 0xFF00) !== 0xC300) {
    return 5;
  }
  return opcode & 0x000F;
}

function tokenize(text) {
  const tokens = [];
  const matches = String(text || "")
    .replace(/0x/gi, "")
    .match(/[0-9a-fA-F]{4,12}/g) || [];

  matches.forEach((token) => {
    if (token.length === 12) {
      tokens.push(token.slice(0, 8));
      tokens.push(token.slice(8));
    } else {
      tokens.push(token);
    }
  });

  return tokens;
}

function parsePairs(text) {
  const tokens = tokenize(text);
  const pairs = [];

  assert(tokens.length % 2 === 0, "Action Replay code must contain address/value pairs.");
  for (let i = 0; i < tokens.length; i += 2) {
    const addrText = tokens[i];
    const valueText = tokens[i + 1];
    assert(addrText.length === 8, `Invalid Action Replay address: ${addrText}`);
    assert(valueText.length === 4, `Invalid Action Replay value: ${valueText}`);
    pairs.push({
      rawAddr: Number.parseInt(addrText, 16) >>> 0,
      value: Number.parseInt(valueText, 16) >>> 0,
    });
  }

  return pairs;
}

function parseMasterCode(text) {
  const profile = { ...DEFAULT_PROFILE };
  const warnings = [];

  parsePairs(text).forEach((pair) => {
    const command = pair.rawAddr >>> 28;
    const addr = pair.rawAddr & 0x0FFFFFFF;

    if (command === 0xF) {
      profile.masterAddr = addr;
      profile.masterOpcode = pair.value;
      profile.masterVector = masterVectorFromOpcode(pair.value);
    } else if (command === 0xB) {
      profile.cfgLocation = addr;
      profile.cache4Capacity = pair.value & 0x00FF;
    } else {
      warnings.push(`Ignored non-master command 0x${hex(command, 1)} in Master Code.`);
    }
  });

  return { profile, warnings };
}

function mutexIdFor(label, mutexMap) {
  const text = String(label || "").trim();
  if (!text) {
    return 0;
  }
  if (/^0x[0-9a-f]+$/i.test(text)) {
    const value = Number.parseInt(text.slice(2), 16);
    assert(value >= 0 && value <= 255, "Exclusive Group must be between 0 and 255.");
    return value;
  }
  if (/^\d+$/.test(text)) {
    const value = Number.parseInt(text, 10);
    assert(value >= 0 && value <= 255, "Exclusive Group must be between 0 and 255.");
    return value;
  }
  if (!mutexMap.has(text)) {
    assert(mutexMap.size < 255, "Too many Exclusive Group names.");
    mutexMap.set(text, mutexMap.size + 1);
  }
  return mutexMap.get(text);
}

function addGroupHeader(items, groupName, groupMap) {
  const name = String(groupName || "").trim();
  if (!name || groupMap.has(name)) {
    return;
  }
  groupMap.add(name);
  items.push({
    name,
    greyout: true,
    codes: [],
  });
}

function convertCodePair(pair) {
  const command = pair.rawAddr >>> 28;
  const op = COMMANDS[command];
  if (!op) {
    return {
      warning: `Unsupported Action Replay command 0x${hex(command, 1)} at ${hex(pair.rawAddr, 8)}.`,
    };
  }
  return {
    code: {
      op,
      addr: pair.rawAddr & 0x0FFFFFFF,
      value: pair.value,
    },
  };
}

function buildSpec(input) {
  const gameName = String(input.gameName || "").trim();
  const title = gameName || "SaturnGame";
  const filename = safeFilename(title);
  const { profile, warnings } = parseMasterCode(input.masterCode || "");
  const items = [];
  const groupMap = new Set();
  const mutexMap = new Map();

  (input.effects || []).forEach((effect, index) => {
    const rawName = String(effect.description || "").trim();
    const name = rawName || `Cheat ${index + 1}`;
    const rawCode = String(effect.code || "").trim();
    const mutexId = mutexIdFor(effect.mutex || effect.exclusiveGroup || "", mutexMap);
    if (effect.type === "group") {
      addGroupHeader(items, rawName, groupMap);
      return;
    }
    if (!rawCode) {
      return;
    }

    const codes = [];
    parsePairs(rawCode).forEach((pair) => {
      const converted = convertCodePair(pair);
      if (converted.code) {
        codes.push(converted.code);
      } else {
        warnings.push(`${name}: ${converted.warning}`);
      }
    });

    if (codes.length > 0) {
      items.push({ name, mutexId, codes });
    }
  });

  assert(items.length > 0, "At least one cheat effect with supported code is required.");

  return {
    spec: {
      title,
      gameId: "",
      filename,
      profile,
      items,
    },
    warnings,
  };
}

export const ActionReplayImport = {
  buildSpec,
  hex,
  parsePairs,
  safeFilename,
};
