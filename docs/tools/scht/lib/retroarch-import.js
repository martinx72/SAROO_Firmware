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
    .replace(/\.[^.]*$/, "")
    .replace(/\s*\((?:GameShark|Action Replay)\)\s*$/i, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return `${cleaned || "SaturnGame"}.scht`;
}

function titleFromFilename(filename) {
  return safeFilename(filename).replace(/\.scht$/i, "");
}

function masterVectorFromOpcode(opcode) {
  if ((opcode & 0xFF00) !== 0xC300) {
    return 5;
  }
  return opcode & 0x000F;
}

function parseValue(raw) {
  const text = String(raw || "").trim();
  if (text.startsWith("\"") && text.endsWith("\"")) {
    return text.slice(1, -1).replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
  }
  return text;
}

function parseRetroArchText(text) {
  const data = new Map();
  String(text || "").replace(/\r/g, "").split("\n").forEach((line) => {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) {
      data.set(match[1], parseValue(match[2]));
    }
  });

  const count = Number.parseInt(data.get("cheats") || "0", 10);
  assert(Number.isFinite(count) && count > 0, "RetroArch cheat file has no cheats.");

  const cheats = [];
  for (let i = 0; i < count; i += 1) {
    const desc = data.get(`cheat${i}_desc`) || `Cheat ${i + 1}`;
    const code = data.get(`cheat${i}_code`) || "";
    const enable = String(data.get(`cheat${i}_enable`) || "false").trim().toLowerCase() === "true";
    cheats.push({ index: i, desc, code, enable });
  }
  return cheats;
}

function tokenizeCode(rawCode) {
  const tokens = [];
  const parts = String(rawCode || "").split("+").map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes(":")) {
      return { error: "short address syntax with ':' is not supported" };
    }
    if (!/^[0-9a-fA-F?]+$/.test(part)) {
      return { error: "contains non-hex characters" };
    }
    if (part.length === 12) {
      tokens.push(part.slice(0, 8));
      tokens.push(part.slice(8));
    } else {
      tokens.push(part);
    }
  }

  if (tokens.length % 2 !== 0) {
    return { error: "does not contain address/value pairs" };
  }
  return { tokens };
}

function parsePairs(rawCode) {
  const tokenized = tokenizeCode(rawCode);
  if (tokenized.error) {
    return { error: tokenized.error };
  }

  const pairs = [];
  const manualPairs = [];
  const tokens = tokenized.tokens;
  for (let i = 0; i < tokens.length; i += 2) {
    const addrText = tokens[i];
    const valueText = tokens[i + 1];

    if (addrText.length !== 8 || valueText.length !== 4) {
      return { error: `invalid address/value length ${addrText.length}/${valueText.length}` };
    }

    if (addrText.includes("?") || valueText.includes("?")) {
      manualPairs.push({ addrText, valueText });
      continue;
    }

    pairs.push({
      rawAddr: Number.parseInt(addrText, 16) >>> 0,
      value: Number.parseInt(valueText, 16) >>> 0,
      addrText,
      valueText,
    });
  }

  return { pairs, manualPairs };
}

function applyMasterPair(profile, pair) {
  const command = pair.rawAddr >>> 28;
  const addr = pair.rawAddr & 0x0FFFFFFF;

  if (command === 0xF) {
    profile.masterAddr = addr;
    profile.masterOpcode = pair.value;
    profile.masterVector = masterVectorFromOpcode(pair.value);
    return true;
  }
  if (command === 0xB) {
    profile.cfgLocation = addr;
    profile.cache4Capacity = pair.value & 0x00FF;
    return true;
  }
  return false;
}

function convertPair(pair) {
  const command = pair.rawAddr >>> 28;
  const op = COMMANDS[command];
  if (!op) {
    return {
      warning: `unsupported command 0x${hex(command, 1)} at ${hex(pair.rawAddr, 8)}`,
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

function manualPairToDsl(pair) {
  const command = pair.addrText[0].toUpperCase();
  const commandValue = Number.parseInt(command, 16);
  const op = COMMANDS[commandValue];
  if (!op) {
    return null;
  }
  return {
    op,
    addr: hex(Number.parseInt(pair.addrText, 16) & 0x0FFFFFFF, 8),
    value: pair.valueText,
  };
}

function buildSpec(text, filename = "SaturnGame.cht") {
  const cheats = parseRetroArchText(text);
  const title = titleFromFilename(filename);
  const profile = { ...DEFAULT_PROFILE };
  const items = [];
  const warnings = [];
  const manualNotes = [];
  let foundMaster = false;

  cheats.forEach((cheat) => {
    const parsed = parsePairs(cheat.code);
    const isMaster = /master/i.test(cheat.desc);

    if (parsed.error) {
      warnings.push(`${cheat.desc}: skipped (${parsed.error}).`);
      return;
    }

    if (parsed.manualPairs && parsed.manualPairs.length > 0) {
      const manualCodes = parsed.manualPairs.map(manualPairToDsl).filter(Boolean);
      manualNotes.push({
        desc: cheat.desc,
        rawCode: cheat.code,
        manualCodes,
      });
      warnings.push(`${cheat.desc}: contains ?? placeholder value(s); edit the generated comments manually before saving this item.`);
      return;
    }

    const codes = [];
    parsed.pairs.forEach((pair) => {
      if (applyMasterPair(profile, pair)) {
        foundMaster = true;
        return;
      }
      if (isMaster) {
        warnings.push(`${cheat.desc}: ignored non-master pair ${pair.addrText}+${pair.valueText}.`);
        return;
      }

      const converted = convertPair(pair);
      if (converted.code) {
        codes.push(converted.code);
      } else {
        warnings.push(`${cheat.desc}: ${converted.warning}.`);
      }
    });

    if (!isMaster && codes.length > 0) {
      items.push({
        name: cheat.desc,
        defaultOn: cheat.enable,
        codes,
      });
    }
  });

  if (!foundMaster) {
    warnings.push("No F/B master code found; default SAROO master profile was used. Verify this before testing freeze codes.");
  }

  assert(items.length > 0 || manualNotes.length > 0, "No supported RetroArch cheat entries found.");

  return {
    spec: {
      title,
      gameId: "",
      filename: safeFilename(filename),
      profile,
      items,
    },
    warnings,
    manualNotes,
  };
}

function makeEditableDsl(build, toDsl) {
  const lines = [];
  if (build.spec.items.length > 0) {
    lines.push(toDsl(build.spec).trimEnd());
  } else {
    lines.push(`@title ${build.spec.title}`);
    lines.push(`@file ${build.spec.filename}`);
    lines.push(`@backend ${build.spec.profile.backend}`);
    lines.push(`@flags ${hex(build.spec.profile.flags, 2)}`);
    lines.push(`@vector ${build.spec.profile.masterVector}`);
    lines.push(`@cache4 ${build.spec.profile.cache4Capacity}`);
    lines.push(`@master ${hex(build.spec.profile.masterAddr, 8)} ${hex(build.spec.profile.masterOpcode, 4)}`);
    lines.push(`@cfg ${hex(build.spec.profile.cfgLocation, 8)}`);
  }

  if (build.manualNotes.length > 0) {
    lines.push("");
    lines.push("# RetroArch entries below contain ?? placeholder values.");
    lines.push("# Replace each ?? with a concrete hex value, then remove the leading '# ' lines you want to enable.");
    build.manualNotes.forEach((note) => {
      lines.push("");
      lines.push(`# ${note.desc}`);
      lines.push(`# source: ${note.rawCode}`);
      if (note.manualCodes.length === 0) {
        lines.push("# This entry uses an unsupported command and must be converted manually.");
        return;
      }
      lines.push(`# [${note.desc}]`);
      note.manualCodes.forEach((code) => {
        lines.push(`# ${code.op} ${code.addr} ${code.value}`);
      });
    });
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export const RetroArchImport = {
  buildSpec,
  hex,
  makeEditableDsl,
  safeFilename,
};
