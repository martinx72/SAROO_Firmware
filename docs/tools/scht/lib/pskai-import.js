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

const REQUIRED_FILES = [
  "cheats_full_data_ram.c",
  "cheats_full_data_rom.c",
];

const OPTIONAL_FILES = [
  "cheats_full_report.txt",
];

const PSK_COMMANDS = {
  0x00: "boot16",
  0x01: "freeze16",
  0x03: "freeze8",
  0x08: "freeze8x2",
  0x0D: "cond16",
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stripComments(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function parseCString(text) {
  return String(text)
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function parseNumber(value) {
  const text = String(value).trim();
  if (text.includes("/")) {
    const parts = text.split("/");
    assert(parts.length === 2, `Unsupported numeric expression: ${text}`);
    return (parseNumber(parts[0]) / parseNumber(parts[1])) >>> 0;
  }
  if (/^0x[0-9a-f]+$/i.test(text)) {
    return Number.parseInt(text, 16) >>> 0;
  }
  assert(/^\d+$/.test(text), `Unsupported numeric value: ${text}`);
  return Number.parseInt(text, 10) >>> 0;
}

function findArrayBody(text, name) {
  const start = text.indexOf(name);
  assert(start >= 0, `Cannot find ${name}`);
  const open = text.indexOf("{", start);
  assert(open >= 0, `Cannot find ${name} opening brace`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(open + 1, i);
      }
    }
  }
  throw new Error(`Cannot find ${name} closing brace`);
}

function parseCodes(romText) {
  const body = findArrayBody(stripComments(romText), "_ct_codes_data");
  const codes = [];
  const pattern = /\{\s*(0x[0-9a-f]+|\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*\}/gi;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    codes.push({
      addr: parseNumber(match[1]),
      value: parseNumber(match[2]),
      command: parseNumber(match[3]),
      extra: parseNumber(match[4]),
    });
  }
  assert(codes.length > 0, "No PSKai code records found");
  return codes;
}

function parseCheats(ramText) {
  const body = findArrayBody(stripComments(ramText), "_ct_cheats_data");
  const cheats = [];
  const pattern = /\{\s*"((?:\\.|[^"])*)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*\}/gi;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    cheats.push({
      name: parseCString(match[1]),
      firstCode: parseNumber(match[2]),
      codeCount: parseNumber(match[3]),
      flags: parseNumber(match[4]),
    });
  }
  assert(cheats.length > 0, "No PSKai cheat metadata found");
  return cheats;
}

function parseGames(ramText) {
  const body = findArrayBody(stripComments(ramText), "_ct_games_data");
  const games = [];
  const pattern = /\{\s*"((?:\\.|[^"])*)"\s*,\s*\{[^}]*\}\s*,\s*(0x[0-9a-f]+|\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*,\s*(\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*,\s*([0-9xXa-fA-F/]+)\s*,\s*(\d+)\s*\}/gi;
  let match;
  while ((match = pattern.exec(body)) !== null) {
    games.push({
      index: games.length,
      name: parseCString(match[1]),
      masterAddr: parseNumber(match[2]),
      masterOpcode: parseNumber(match[3]),
      cheatCount: parseNumber(match[4]),
      cfgLocation: parseNumber(match[5]),
      rawFlags: parseNumber(match[6]),
      cache4Capacity: parseNumber(match[7]),
      firstCheat: parseNumber(match[8]),
    });
  }
  assert(games.length > 0, "No PSKai games found");
  return games;
}

function hex(value, width) {
  return (Number(value) >>> 0).toString(16).toUpperCase().padStart(width, "0");
}

function safeFilename(name) {
  const cleaned = String(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned || "game"}.scht`;
}

function codeToSaroo(code) {
  const op = PSK_COMMANDS[code.command];
  if (!op) {
    return null;
  }
  return {
    op,
    addr: code.addr,
    value: code.value,
  };
}

function buildSpecForGame(database, game, options = {}) {
  assert(game, "PSKai game record is required");
  const items = [];
  const warnings = [];
  const end = game.firstCheat + game.cheatCount;
  const sourceCheats = database.cheats.slice(game.firstCheat, end);

  sourceCheats.forEach((cheat, relativeIndex) => {
    const greyout = (cheat.flags & 0x80) !== 0;
    const defaultOn = (cheat.flags & 0x01) !== 0;
    const rawCodes = database.codes.slice(cheat.firstCode, cheat.firstCode + cheat.codeCount);
    const converted = [];
    const unsupported = [];

    rawCodes.forEach((code, codeOffset) => {
      if (code.command === 0x0F) {
        return;
      }
      const mapped = codeToSaroo(code);
      if (mapped) {
        converted.push(mapped);
      } else {
        unsupported.push({
          command: code.command,
          codeIndex: cheat.firstCode + codeOffset,
        });
      }
    });

    if (unsupported.length > 0) {
      warnings.push({
        item: cheat.name,
        commands: unsupported,
      });
    }

    if (greyout) {
      items.push({
        name: cheat.name,
        greyout: true,
        codes: [],
      });
      return;
    }

    if (converted.length === 0) {
      warnings.push({
        item: cheat.name,
        message: `Skipped empty or unsupported cheat item at game offset ${relativeIndex}.`,
      });
      return;
    }

    items.push({
      name: cheat.name,
      defaultOn,
      codes: converted,
    });
  });

  const filename = safeFilename(options.filename || game.name);
  return {
    spec: {
      title: game.name,
      gameId: "",
      filename,
      profile: {
        backend: 0,
        flags: options.forceRomHandler ? 1 : 0,
        masterVector: game.masterOpcode === 0xFFFF ? 0 : 1,
        cache4Capacity: game.cache4Capacity,
        masterOpcode: game.masterOpcode,
        masterAddr: game.masterAddr,
        cfgLocation: game.cfgLocation,
      },
      items,
    },
    warnings,
    sourceCheats,
  };
}

function parse(fileMap) {
  const missing = REQUIRED_FILES.filter((name) => !fileMap[name]);
  assert(missing.length === 0, `Missing required PSKai files: ${missing.join(", ")}`);

  const database = {
    codes: parseCodes(fileMap["cheats_full_data_rom.c"]),
    cheats: parseCheats(fileMap["cheats_full_data_ram.c"]),
    games: parseGames(fileMap["cheats_full_data_ram.c"]),
    hasReport: Boolean(fileMap["cheats_full_report.txt"]),
  };

  return database;
}

export const PskaiImport = {
  REQUIRED_FILES,
  OPTIONAL_FILES,
  buildSpecForGame,
  hex,
  parse,
  safeFilename,
};
