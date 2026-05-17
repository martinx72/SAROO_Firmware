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

export const SarooCheat = (() => {
  const MAGIC = "SRCHT01";
  const VERSION = 1;
  const HEADER_SIZE = 64;
  const ITEM_SIZE = 64;
  const CODE_SIZE = 16;

  const OPS = {
    boot8: 1,
    boot16: 2,
    boot32: 3,
    freeze8: 4,
    freeze16: 5,
    freeze32: 6,
    cond16: 7,
    freeze8x2: 8,
  };

  const WIDTHS = {
    boot8: 1,
    boot16: 2,
    boot32: 4,
    freeze8: 1,
    freeze16: 2,
    freeze32: 4,
    cond16: 2,
    freeze8x2: 2,
  };

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function normalizeProfile(profile) {
    if (!profile) {
      return null;
    }
    return {
      backend: Number(profile.backend || 0) >>> 0,
      masterVector: Number(profile.masterVector || 0) >>> 0,
      cache4Capacity: Number(profile.cache4Capacity || 0) >>> 0,
      flags: Number(profile.flags || 0) >>> 0,
      runtimeInterval: normalizeByte(profile.runtimeInterval || profile.runtime_interval || 0, "runtime interval"),
      masterOpcode: normalizeHex(profile.masterOpcode || 0),
      masterAddr: normalizeHex(profile.masterAddr || 0),
      cfgLocation: normalizeHex(profile.cfgLocation || 0),
    };
  }

  function normalizeHex(value) {
    if (typeof value === "number") {
      return value >>> 0;
    }
    const text = String(value).trim().replace(/^0x/i, "");
    assert(text.length > 0, "Empty numeric value");
    return Number.parseInt(text, 16) >>> 0;
  }

  function normalizeByte(value, fieldName) {
    const number = typeof value === "string" && value.trim().match(/^0x/i)
      ? normalizeHex(value)
      : Number(value || 0);
    assert(Number.isFinite(number), `Invalid ${fieldName}`);
    assert(number >= 0 && number <= 255, `${fieldName} must be between 0 and 255`);
    return number >>> 0;
  }

  function makeCode(code) {
    const opName = typeof code.op === "number"
      ? opNameFromId(code.op)
      : String(code.op || "").trim();
    assert(OPS[opName], `Unsupported op: ${opName}`);
    return {
      op: OPS[opName],
      width: WIDTHS[opName],
      reserved: 0,
      addr: normalizeHex(code.addr),
      value: normalizeHex(code.value),
      aux: normalizeHex(code.aux || 0),
    };
  }

  function makeItem(item, firstCodeIndex) {
    const name = String(item.name || "").trim();
    assert(name.length > 0, "Cheat item name is required");
    const codes = (item.codes || []).map(makeCode);
    const greyout = item.greyout || item.group ? 1 : 0;
    assert(codes.length > 0 || greyout, `Cheat item '${name}' has no codes`);
    return {
      name,
      firstCode: firstCodeIndex,
      codeCount: codes.length,
      defaultOn: item.defaultOn ? 1 : 0,
      enabled: item.defaultOn ? 1 : 0,
      greyout,
      mutexId: normalizeByte(item.mutexId || item.mutex || item.exclusiveGroup || 0, "mutex id"),
      codes,
    };
  }

  function normalizeSpec(spec) {
    const sourceItems = Array.isArray(spec.items) ? spec.items : [];
    let firstCodeIndex = 0;
    const items = sourceItems.map((item) => {
      const normalized = makeItem(item, firstCodeIndex);
      firstCodeIndex += normalized.codeCount;
      return normalized;
    });
    const codes = items.flatMap((item) => item.codes);
    return {
      title: String(spec.title || "").trim(),
      gameId: String(spec.gameId || "").trim(),
      filename: String(spec.filename || "").trim(),
      profile: normalizeProfile(spec.profile),
      items,
      codes,
    };
  }

  function writeFixedString(view, offset, length, value) {
    for (let i = 0; i < length; i += 1) {
      view.setUint8(offset + i, 0);
    }
    for (let i = 0; i < value.length && i < length - 1; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i) & 0xff);
    }
  }

  function readFixedString(view, offset, length) {
    let text = "";
    for (let i = 0; i < length; i += 1) {
      const value = view.getUint8(offset + i);
      if (value === 0) {
        break;
      }
      text += String.fromCharCode(value);
    }
    return text;
  }

  function opNameFromId(opId) {
    return Object.keys(OPS).find((key) => OPS[key] === opId);
  }

  function encodeCheatFile(spec) {
    const db = normalizeSpec(spec);
    const itemCount = db.items.length;
    const codeCount = db.codes.length;
    const itemsOffset = HEADER_SIZE;
    const codesOffset = itemsOffset + itemCount * ITEM_SIZE;
    const totalSize = codesOffset + codeCount * CODE_SIZE;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    writeFixedString(view, 0x00, 8, MAGIC);
    view.setUint16(0x08, VERSION, true);
    view.setUint16(0x0a, 0, true);
    view.setUint16(0x0c, itemCount, true);
    view.setUint16(0x0e, codeCount, true);
    view.setUint32(0x10, itemsOffset, true);
    view.setUint32(0x14, codesOffset, true);
    if (db.profile) {
      view.setUint8(0x18, 1);
      view.setUint8(0x19, db.profile.backend >>> 0);
      view.setUint8(0x1a, db.profile.masterVector >>> 0);
      view.setUint8(0x1b, db.profile.cache4Capacity >>> 0);
      view.setUint16(0x1c, db.profile.masterOpcode >>> 0, true);
      view.setUint8(0x1e, db.profile.flags >>> 0);
      view.setUint8(0x1f, db.profile.runtimeInterval >>> 0);
      view.setUint32(0x20, db.profile.masterAddr >>> 0, true);
      view.setUint32(0x24, db.profile.cfgLocation >>> 0, true);
    }

    db.items.forEach((item, index) => {
      const base = itemsOffset + index * ITEM_SIZE;
      writeFixedString(view, base + 0x00, 48, item.name);
      view.setUint16(base + 0x30, item.firstCode, true);
      view.setUint16(base + 0x32, item.codeCount, true);
      view.setUint8(base + 0x34, item.defaultOn);
      view.setUint8(base + 0x35, item.greyout);
      view.setUint8(base + 0x36, item.mutexId);
    });

    db.codes.forEach((code, index) => {
      const base = codesOffset + index * CODE_SIZE;
      view.setUint8(base + 0x00, code.op);
      view.setUint8(base + 0x01, code.width);
      view.setUint16(base + 0x02, code.reserved, true);
      view.setUint32(base + 0x04, code.addr, true);
      view.setUint32(base + 0x08, code.value, true);
      view.setUint32(base + 0x0c, code.aux, true);
    });

    return new Uint8Array(buffer);
  }

  function decodeCheatFile(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert(bytes.byteLength >= HEADER_SIZE, "File is too small to be a SAROO cheat file");
    assert(readFixedString(view, 0x00, 8) === MAGIC, "Invalid SAROO cheat file magic");

    const version = view.getUint16(0x08, true);
    const itemCount = view.getUint16(0x0c, true);
    const codeCount = view.getUint16(0x0e, true);
    const itemsOffset = view.getUint32(0x10, true);
    const codesOffset = view.getUint32(0x14, true);
    const itemsEnd = itemsOffset + itemCount * ITEM_SIZE;
    const codesEnd = codesOffset + codeCount * CODE_SIZE;

    assert(version === VERSION, `Unsupported SAROO cheat version: ${version}`);
    assert(itemsOffset >= HEADER_SIZE && codesOffset >= HEADER_SIZE, "Invalid item/code offsets");
    assert(itemsEnd <= bytes.byteLength && codesEnd <= bytes.byteLength, "SAROO cheat file is truncated");
    assert(itemCount <= 96, "Too many cheat items");
    assert(codeCount <= 384, "Too many cheat codes");

    const profile = view.getUint8(0x18) ? {
      backend: view.getUint8(0x19),
      masterVector: view.getUint8(0x1a),
      cache4Capacity: view.getUint8(0x1b),
      masterOpcode: view.getUint16(0x1c, true),
      flags: view.getUint8(0x1e),
      runtimeInterval: view.getUint8(0x1f),
      masterAddr: view.getUint32(0x20, true),
      cfgLocation: view.getUint32(0x24, true),
    } : null;

    const rawCodes = [];
    for (let i = 0; i < codeCount; i += 1) {
      const base = codesOffset + i * CODE_SIZE;
      const op = view.getUint8(base + 0x00);
      const opName = opNameFromId(op);
      assert(opName, `Unsupported encoded op id: ${op}`);
      rawCodes.push({
        op: opName,
        addr: view.getUint32(base + 0x04, true),
        value: view.getUint32(base + 0x08, true),
        aux: view.getUint32(base + 0x0c, true),
      });
    }

    const items = [];
    for (let i = 0; i < itemCount; i += 1) {
      const base = itemsOffset + i * ITEM_SIZE;
      const firstCode = view.getUint16(base + 0x30, true);
      const itemCodeCount = view.getUint16(base + 0x32, true);
      assert(firstCode + itemCodeCount <= rawCodes.length, `Cheat item ${i + 1} references codes outside the file`);
      items.push({
        name: readFixedString(view, base + 0x00, 48),
        defaultOn: view.getUint8(base + 0x34) ? true : false,
        greyout: view.getUint8(base + 0x35) ? true : false,
        mutexId: view.getUint8(base + 0x36),
        codes: rawCodes.slice(firstCode, firstCode + itemCodeCount),
      });
    }

    return {
      title: "",
      gameId: "",
      filename: "",
      profile,
      items,
    };
  }

  function parseDsl(text) {
    const lines = String(text).replace(/\r/g, "").split("\n");
    const spec = {
      title: "",
      gameId: "",
      filename: "",
      items: [],
    };
    let current = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith(";")) {
        continue;
      }
      if (line.startsWith("@title ")) {
        spec.title = line.slice(7).trim();
        continue;
      }
      if (line.startsWith("@gameid ")) {
        spec.gameId = line.slice(8).trim();
        continue;
      }
      if (line.startsWith("@file ")) {
        spec.filename = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("@backend ")) {
        spec.profile = spec.profile || {};
        spec.profile.backend = Number.parseInt(line.slice(9).trim(), 10) >>> 0;
        continue;
      }
      if (line.startsWith("@flags ")) {
        spec.profile = spec.profile || {};
        spec.profile.flags = normalizeHex(line.slice(7).trim());
        continue;
      }
      if (line.startsWith("@vector ")) {
        spec.profile = spec.profile || {};
        spec.profile.masterVector = Number.parseInt(line.slice(8).trim(), 10) >>> 0;
        continue;
      }
      if (line.startsWith("@cache4 ")) {
        spec.profile = spec.profile || {};
        spec.profile.cache4Capacity = Number.parseInt(line.slice(8).trim(), 10) >>> 0;
        continue;
      }
      if (line.startsWith("@runtime_interval ")) {
        spec.profile = spec.profile || {};
        spec.profile.runtimeInterval = normalizeByte(line.slice(18).trim(), "runtime interval");
        continue;
      }
      if (line.startsWith("@master ")) {
        spec.profile = spec.profile || {};
        const parts = line.slice(8).trim().split(/\s+/);
        assert(parts.length >= 2, `Invalid @master line: ${line}`);
        spec.profile.masterAddr = parts[0];
        spec.profile.masterOpcode = parts[1];
        continue;
      }
      if (line.startsWith("@cfg ")) {
        spec.profile = spec.profile || {};
        spec.profile.cfgLocation = line.slice(5).trim();
        continue;
      }
      if (line.startsWith("[") && line.endsWith("]")) {
        current = {
          name: line.slice(1, -1).trim(),
          defaultOn: false,
          greyout: false,
          codes: [],
        };
        spec.items.push(current);
        continue;
      }
      if (line === "@greyout") {
        assert(current, "@greyout must appear inside a cheat item section");
        current.greyout = true;
        continue;
      }
      if (line === "@group") {
        assert(current, "@group must appear inside a cheat item section");
        current.greyout = true;
        continue;
      }
      if (line === "@defaulton") {
        assert(current, "@defaulton must appear inside a cheat item section");
        current.defaultOn = true;
        continue;
      }
      if (line.startsWith("@mutex ")) {
        assert(current, "@mutex must appear inside a cheat item section");
        current.mutexId = normalizeByte(line.slice(7).trim(), "mutex id");
        continue;
      }

      assert(current, `Code line without a section: ${line}`);
      const parts = line.split(/\s+/);
      assert(parts.length >= 3, `Invalid code line: ${line}`);
      current.codes.push({
        op: parts[0],
        addr: parts[1],
        value: parts[2],
        aux: parts[3] || 0,
      });
    }

    assert(spec.items.length > 0, "No cheat items found");
    return normalizeSpec(spec);
  }

  function toDsl(spec) {
    const db = normalizeSpec(spec);
    const lines = [];
    if (db.title) {
      lines.push(`@title ${db.title}`);
    }
    if (db.gameId) {
      lines.push(`@gameid ${db.gameId}`);
    }
    if (db.filename) {
      lines.push(`@file ${db.filename}`);
    }
    if (db.profile) {
      lines.push(`@backend ${db.profile.backend}`);
      lines.push(`@flags ${db.profile.flags.toString(16).toUpperCase().padStart(2, "0")}`);
      lines.push(`@vector ${db.profile.masterVector}`);
      lines.push(`@cache4 ${db.profile.cache4Capacity}`);
      if (db.profile.runtimeInterval > 1) {
        lines.push(`@runtime_interval ${db.profile.runtimeInterval}`);
      }
      lines.push(`@master ${db.profile.masterAddr.toString(16).toUpperCase().padStart(8, "0")} ${db.profile.masterOpcode.toString(16).toUpperCase().padStart(4, "0")}`);
      lines.push(`@cfg ${db.profile.cfgLocation.toString(16).toUpperCase().padStart(8, "0")}`);
    }
    lines.push("");
    for (const item of db.items) {
      lines.push(`[${item.name}]`);
      if (item.greyout) {
        lines.push("@greyout");
      }
      if (item.defaultOn) {
        lines.push("@defaulton");
      }
      if (item.mutexId) {
        lines.push(`@mutex ${item.mutexId}`);
      }
      for (const code of item.codes) {
        const opName = Object.keys(OPS).find((key) => OPS[key] === code.op);
        const addr = code.addr.toString(16).toUpperCase().padStart(8, "0");
        const value = code.value.toString(16).toUpperCase().padStart(4, "0");
        lines.push(`${opName} ${addr} ${value}`);
      }
      lines.push("");
    }
    return lines.join("\n").trim() + "\n";
  }

  function downloadBinary(filename, bytes) {
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return {
    OPS,
    VERSION,
    decodeCheatFile,
    encodeCheatFile,
    normalizeSpec,
    parseDsl,
    toDsl,
    downloadBinary,
  };
})();
