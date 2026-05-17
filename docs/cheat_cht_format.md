# SAROO Cheat `.scht` Format

This document describes SAROO Kaito's binary cheat file format.

The public extension is `.scht` to avoid confusion with RetroArch `.cht`
files. A SAROO `.scht` file is not a RetroArch cheat file, not a PSKai data
blob, and not an Action Replay save dump. External formats must be converted
before they are copied to the SD card.

## License And Attribution

SPDX-License-Identifier: AGPL-3.0-or-later

Additional attribution notice under AGPL-3.0-or-later section 7(b):

Modified versions must preserve the following author attribution in the source
code notices and in the interactive web tool's legal notice/footer or an
equivalent "About / Credits" area:

©2026 - MarTinX (https://github.com/martinx72) /
Retro Game Restore (https://retrogamerestore.com/)

Translation text copyrights remain with their respective translation
contributors. Translation contributions are expected to be provided under
AGPL-3.0-or-later for distribution with this tool unless otherwise stated.

## Design Goals

- Keep Saturn-side parsing small and deterministic.
- Use fixed-size records so the loader does not allocate memory dynamically.
- Store PSKai-style master hook metadata in the file so the firmware does not
  need per-game firmware updates.
- Ship no copyrighted cheat database with the firmware.
- Let users generate `.scht` files from their own Action Replay text or their
  own copy of PSKai source data.
- Let users convert their own RetroArch `.cht` files through the web tool
  without treating `.cht` as a firmware-loadable format.

## File Lookup

The firmware searches for a cheat file only when a game is selected from the
SAROO game list.

Lookup order:

1. `/SAROO/CHEAT/ID/<GAMEID>.scht`
2. `/SAROO/CHEAT/F/<FolderName>.scht`

Examples:

- `/SAROO/CHEAT/ID/GS-9015.scht`
- `/SAROO/CHEAT/ID/T-1213G.scht`
- `/SAROO/CHEAT/F/Panzer Dragoon JP.scht`

`ID` is preferred. It uses the Saturn disc product ID from the disc IP header,
for example `GS-9015` or `T-1213G`. This avoids problems caused by renamed
folders, translated folder names, or non-ASCII characters.

`F` is a fallback path. It uses the game folder name under `/SAROO/ISO`. For
example:

```text
/SAROO/ISO/Panzer Dragoon JP/
```

maps to:

```text
/SAROO/CHEAT/F/Panzer Dragoon JP.scht
```

The folder name must match exactly.

## Finding the Game ID

Use the ID from the exact game region and revision you are running.

Practical methods:

- Check the game's technical information on Saturn databases such as SegaRetro
  or Redump.
- Inspect the product ID in the disc image IP header with an external Saturn
  image tool.
- If the ID is unknown, use the `/SAROO/CHEAT/F/<FolderName>.scht` fallback
  until the correct ID is confirmed.

Do not guess an ID from another region or another revision. Cheat addresses are
often game-version specific.

## Byte Order

All multi-byte integer fields are little-endian.

## File Layout

The file contains:

1. one 64-byte header
2. a fixed-size item table
3. a fixed-size code table

Current constants are defined in `Firm_Saturn_MX/cheat/types.h`.

Constant | Value
--- | ---
`CHEAT_FILE_MAGIC` | `SRCHT01`
`CHEAT_FILE_VERSION` | `0x0001`
`CHEAT_FILE_HDR_SIZE` | `64`
`CHEAT_FILE_ITEM_SIZE` | `64`
`CHEAT_FILE_CODE_SIZE` | `16`
`CHEAT_MAX_ITEMS` | `96`
`CHEAT_MAX_CODES` | `384`
`CHEAT_FILE_BUF_SIZE` | `14848`

## Header

Offset | Size | Type | Meaning
--- | --- | --- | ---
`0x00` | 8 | char[8] | magic, written as `SRCHT01\0`
`0x08` | 2 | u16 | format version, currently `0x0001`
`0x0A` | 2 | u16 | file flags, currently `0`
`0x0C` | 2 | u16 | item count
`0x0E` | 2 | u16 | code count
`0x10` | 4 | u32 | item table offset
`0x14` | 4 | u32 | code table offset
`0x18` | 1 | u8 | profile valid flag
`0x19` | 1 | u8 | backend id
`0x1A` | 1 | u8 | PSKai master vector
`0x1B` | 1 | u8 | runtime cache capacity in groups of 4 codes
`0x1C` | 2 | u16 | PSKai master opcode
`0x1E` | 1 | u8 | profile flags
`0x1F` | 1 | u8 | runtime interval; `0` or `1` means every trap, `N` means every Nth trap
`0x20` | 4 | u32 | PSKai master address
`0x24` | 4 | u32 | PSKai config location
`0x28` | 24 | bytes | reserved, must be zero

The loader currently checks only the first 7 bytes of the magic for compatibility
with C string storage, but tools must still write the trailing NUL byte.

## Profile Fields

The profile block is required for PSKai-derived or Action Replay-derived freeze
codes. It tells the Saturn runtime where to install the master hook and where to
place the PSKai-compatible runtime config.

Field | Meaning
--- | ---
`profile valid` | `1` when the file supplies runtime metadata
`backend id` | currently `0`, PSKai trap backend
`master vector` | SH-2 branch vector extracted from the master opcode
`cache capacity` | number of 4-code groups available for cached runtime codes
`master opcode` | original master opcode, usually `C305` or another `C30x`
`profile flags` | runtime behavior flags
`runtime interval` | optional freeze-code throttle for timing-sensitive games
`master address` | address patched with the master hook
`cfg location` | RAM location used for PSKai-compatible runtime config

Profile flags:

Value | Meaning
--- | ---
`0x01` | force ROM-handler path instead of cached in-RAM handler

Most users should not edit these fields manually. The SAROO Cheat Builder fills them
from the Action Replay master code or from the PSKai source data.

## Item Record

Each item record is 64 bytes.

Offset | Size | Type | Meaning
--- | --- | --- | ---
`0x00` | 48 | char[48] | menu display name, NUL-terminated when shorter
`0x30` | 2 | u16 | first code index
`0x32` | 2 | u16 | code count
`0x34` | 1 | u8 | default enabled flag, `0` or `1`
`0x35` | 1 | u8 | greyout/group row flag, `0` or `1`
`0x36` | 1 | u8 | mutex group id, `0` means no explicit mutex
`0x37` | 9 | bytes | reserved, must be zero

Notes:

- Items are the rows shown in the pre-game cheat menu.
- One item may reference one or more code records.
- A greyout item is a non-toggle group row and may contain zero code records.
- Items with the same non-zero mutex group id are mutually exclusive in the
  Saturn cheat menu. Selecting one disables the others in the same mutex group.
- Enabled state is not persisted to SD; it is chosen in the pre-game menu.

## Code Record

Each code record is 16 bytes.

Offset | Size | Type | Meaning
--- | --- | --- | ---
`0x00` | 1 | u8 | operation id
`0x01` | 1 | u8 | width hint
`0x02` | 2 | u16 | reserved, must be zero
`0x04` | 4 | u32 | target address
`0x08` | 4 | u32 | value
`0x0C` | 4 | u32 | auxiliary value, currently zero

## Operation IDs

Value | Web-tool text name | Meaning
--- | --- | ---
`1` | `boot8` | one-shot 8-bit write
`2` | `boot16` | one-shot 16-bit write
`3` | `boot32` | one-shot 32-bit write
`4` | `freeze8` | repeated 8-bit write
`5` | `freeze16` | repeated 16-bit write
`6` | `freeze32` | repeated 32-bit write, reserved for compatibility
`7` | `cond16` | 16-bit equality condition for the current enabled set
`8` | `freeze8x2` | repeated two-byte write used by Action Replay command `8`

Current validated import mappings:

Source command | SAROO op
--- | ---
PSKai `0x00` | `boot16`
PSKai `0x01` | `freeze16`
PSKai `0x03` | `freeze8`
PSKai `0x08` | `freeze8x2`
PSKai `0x0D` | `cond16`
Action Replay `0xxxxxxx yyyy` | `boot16`
Action Replay `1xxxxxxx yyyy` | `freeze16`
Action Replay `3xxxxxxx yyyy` | `freeze8`
Action Replay `8xxxxxxx yyyy` | `freeze8x2`
Action Replay `Dxxxxxxx yyyy` | `cond16`
RetroArch `0xxxxxxx+yyyy` | `boot16`
RetroArch `1xxxxxxx+yyyy` | `freeze16`
RetroArch `3xxxxxxx+yyyy` | `freeze8`
RetroArch `8xxxxxxx+yyyy` | `freeze8x2`
RetroArch `Dxxxxxxx+yyyy` | `cond16`
RetroArch `Fxxxxxxx+yyyy` | profile metadata
RetroArch `Bxxxxxxx+yyyy` | profile metadata

Unsupported external commands are skipped by the builder and reported as
warnings when possible.

RetroArch entries containing `??` placeholder values are not written to binary
automatically. The web tool emits commented DSL lines for those entries so the
user can fill the missing value, uncomment the item, validate, and then save a
new `.scht`.

## Width Values

Value | Meaning
--- | ---
`1` | 8-bit
`2` | 16-bit
`4` | 32-bit

Converters should write the matching width for each operation even when the
current runtime primarily uses the operation id.

## DSL (Domain-Specific Language) Used by the Web Tool

The web tool uses a text DSL as an editable intermediate format. The Saturn
firmware does not load this DSL directly; it only loads binary `.scht`.

Example:

```text
@title Panzer Dragoon JP
@gameid GS-9015
@file GS-9015.scht
@backend 0
@flags 00
@vector 5
@cache4 125
@master 06000914 C305
@cfg 060FF000

[Invincibility]
boot16 0602BA92 2322

[Unl Credits]
freeze16 06084846 000F
```

Supported directives:

Directive | Meaning
--- | ---
`@title <text>` | human-readable title used by the tool
`@gameid <id>` | optional game ID note, not required by firmware lookup
`@file <name.scht>` | suggested output filename
`@backend <n>` | runtime backend id
`@flags <hex>` | profile flags
`@vector <n>` | master hook vector
`@cache4 <n>` | runtime cache capacity in groups of 4 codes
`@runtime_interval <n>` | optional runtime throttle; `0` or `1` applies every trap, `4` applies every fourth trap
`@master <addr> <opcode>` | master hook address and opcode
`@cfg <addr>` | runtime config location
`[Item Name]` | cheat menu item
`@greyout` | mark current item as a non-toggle group row
`@group` | alias for `@greyout`
`@defaulton` | mark current item enabled by default
`@mutex <n>` | assign current item to mutex group `1`-`255`; `0` disables explicit mutex

## Loader Validation

The Saturn loader rejects files when:

- the header is smaller than 64 bytes
- the magic or version does not match
- item or code count exceeds the fixed limits
- item/code table offsets overlap or point outside the loaded file
- the computed file size exceeds `CHEAT_FILE_BUF_SIZE`

The loader intentionally performs no dynamic allocation.

## Runtime Safety

Cheat codes write directly to Saturn memory. A wrong code, wrong game revision,
wrong region, bad master code, or mistyped address can freeze the game, corrupt
runtime state, or black-screen the console until reset.

Practical rules:

- Match cheat data to the exact game region and revision.
- Test one cheat item at a time first.
- For games with flickering or unstable video playback while freeze cheats are
  enabled, try `@runtime_interval 2` or `@runtime_interval 4` in the DSL and
  save a new `.scht`.
- Prefer PSKai-derived data when it is known to work on real PSKai.
- If a game crashes with a real PSKai cartridge and the same code, treat the
  source code as incompatible with that game image/revision.
- Keep a known-good `.scht` backup before editing a binary file.

## Compatibility

`.scht` version 1 is SAROO-specific.

Not supported directly:

- RetroArch `.cht`
- raw PSKai generated data blobs
- Action Replay cartridge save dumps
- arbitrary GameShark text files without conversion

Use the SAROO Cheat Builder in `docs/tools/scht/` to create SAROO `.scht` files.
