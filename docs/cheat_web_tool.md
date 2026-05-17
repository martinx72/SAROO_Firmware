# SAROO Cheat Builder Web Tool

The SAROO Cheat Builder lives in:

```text
docs/tools/scht/
```

It builds SAROO Kaito binary `.scht` files. These files are copied to the SD
card and loaded by the Saturn-side firmware.

The tool does not bundle cheat lists. PSKai source files and Action Replay code
text, or RetroArch `.cht` files must be supplied by the user.

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

## Running the Tool

Recommended local usage:

```bash
cd /PATH/SAROO_Firmware/docs/tools/scht
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Opening `index.html` directly from the filesystem may work in some browsers for
basic file-picker use, but it is not the supported path. The page uses ES
modules and optional local `fetch()` auto-loading, which are often restricted
under `file://`, especially on Windows.

## Tabs

The current tool has five tabs:

1. `AR Code to SCHT`
2. `SCHT Editor`
3. `RetroArch CHT`
4. `PSKai Source`
5. `Game IDs`

## UI Localization

The web tool has a lightweight i18n preparation layer. Basic static UI strings
are stored in:

```text
docs/tools/scht/i18n/en.js
```

HTML uses `data-i18n`, `data-i18n-placeholder`, and `data-i18n-aria-label`
attributes. The DSL (Domain-Specific Language), builder warnings, and `.scht`
directives remain English so generated files and debug text stay consistent
across users.

## AR Code to SCHT Tab

Use this tab when the user has plain Action Replay or GameShark-style code text.

Inputs:

- `Game Name`
- `Master Code`
- optional standalone `Group Header` rows, used to insert non-toggle menu titles
- one or more `Effect Description` plus `Code` blocks
- optional `Exclusive Group` per effect row, used to make several items mutually
  exclusive

Supported commands:

Command | Meaning | SAROO op
--- | --- | ---
`0xxxxxxx yyyy` | one-shot 16-bit write | `boot16`
`1xxxxxxx yyyy` | repeated 16-bit write | `freeze16`
`3xxxxxxx yyyy` | repeated 8-bit write | `freeze8`
`8xxxxxxx yyyy` | repeated two-byte write | `freeze8x2`
`Dxxxxxxx yyyy` | 16-bit equality condition | `cond16`

Master code support:

- `Fxxxxxxx yyyy`: master hook address and opcode
- `Bxxxxxxx yyyy`: runtime config location and cache capacity

Flow:

1. Enter the game name.
2. Paste the master code if the source provides one.
3. Add one effect row per cheat item.
4. Use `Add Group Header` for title-only rows such as `Super Street Fighter II`
   or `Super Street Fighter IIX`.
5. Fill the same `Exclusive Group` name or number on options that must not be
   enabled together.
6. Review the generated DSL (Domain-Specific Language) preview and warnings.
7. Use the SAROO menu preview to check group headers, visible checkboxes, and
   mutual-exclusion behavior.
8. Press `Save .scht`.

The SAROO menu preview is interactive, but it is only a visual checker. Toggling
checkboxes in the preview does not change the saved `.scht`; it only simulates
how the Saturn menu will react when the user enables items.

The preview follows the Saturn menu page size of 12 items per page. When a file
contains more than 12 rows, use `Prev` and `Next` to inspect the simulated pages.
It also follows the Saturn-side PSKai-compatible selection rules, so duplicated
runtime writes and incompatible conditional-code selections are shown as
mutually exclusive even when the `.scht` does not contain explicit `@mutex`
directives.

Default filename:

- if `Game Name` is filled: `<Game Name>.scht`
- otherwise: `SaturnGame.scht`

## SCHT Editor Tab

Use this tab to inspect or edit an existing SAROO binary `.scht`.

Flow:

1. Select an existing `.scht` file.
2. The tool decodes it into editable DSL text.
3. Edit item names, profile fields, or code lines if needed.
4. Press `Validate` to rebuild the preview.
5. Press `Save .scht` to download a new binary.

Useful item directives:

- `@greyout` or `@group` makes the current item a non-toggle group header.
- `@defaulton` makes the current item enabled by default.
- `@mutex <n>` assigns the current item to a mutual-exclusion group. Selecting
  one item disables other enabled items with the same non-zero mutex id.

The editor also shows the same SAROO menu preview used by the `AR Code to SCHT` tab,
so group rows and mutex behavior can be checked after loading or editing an
existing binary `.scht`.

Limitations:

- The binary `.scht` format does not store the original `@title` text.
- The editor derives the title and suggested filename from the loaded filename.
- Keep a known-good copy before manually editing profile fields or addresses.

## RetroArch CHT Tab

Use this tab when the user has a RetroArch Saturn `.cht` file. This is a
builder input format only; RetroArch `.cht` files cannot be copied directly to
the SAROO SD card.

The supported RetroArch file structure is:

```text
cheats = 2

cheat0_desc = "Master Code"
cheat0_code = "F6000914+C305+B6002800+0000"
cheat0_enable = false

cheat1_desc = "Infinite Health"
cheat1_code = "1606CE28+0064"
cheat1_enable = false
```

Supported code commands:

Command | Meaning | SAROO op
--- | --- | ---
`0xxxxxxx+yyyy` | one-shot 16-bit write | `boot16`
`1xxxxxxx+yyyy` | repeated 16-bit write | `freeze16`
`3xxxxxxx+yyyy` | repeated 8-bit write | `freeze8`
`8xxxxxxx+yyyy` | repeated two-byte write | `freeze8x2`
`Dxxxxxxx+yyyy` | 16-bit equality condition | `cond16`
`Fxxxxxxx+yyyy` | master hook address and opcode | profile metadata
`Bxxxxxxx+yyyy` | runtime config location and cache capacity | profile metadata

The editable DSL accepts `@runtime_interval <n>` in the profile block. This is
useful for timing-sensitive games: `0` or `1` keeps the original behavior, while
`4` applies freeze writes every fourth trap.

The builder also accepts compact 12-hex forms such as:

```text
160BE50A000A
```

and treats it as:

```text
160BE50A+000A
```

Flow:

1. Select one RetroArch `.cht` file.
2. Review the generated DSL preview.
3. If the source contains `??`, fill the value manually in the commented section
   and uncomment the item before saving.
4. Press `Validate`.
5. Press `Save .scht`.

`??` placeholder handling:

- entries containing `??` are not written into the binary automatically
- the tool adds commented DSL lines showing where the value must be filled
- replace `??` with a concrete hex value before uncommenting those lines
- save only after validation succeeds

Unsupported RetroArch patterns:

- short-address `addr:value` forms such as `FF83E9:90`
- malformed address/value lengths
- unsupported command families
- files that contain only a master code and no actual cheat items

If the builder reports warnings, test the generated `.scht` one cheat at a
time.

## PSKai Source Tab

Use this tab when the user has their own copy of the relevant PSKai generated
source data.

PSKai project page:

```text
https://ppcenter.webou.net/pskai/
```

Required files:

- `cheats_full_data_ram.c`
- `cheats_full_data_rom.c`

Optional file:

- `cheats_full_report.txt`

The two required C files are enough for the current builder to reconstruct:

- PSKai game list
- PSKai master hook profile
- cheat menu item names
- code records
- runtime cache metadata

The report text is useful for human review, but is not required for `.scht`
generation.

## Game IDs Tab

Use this tab to look up Saturn product IDs for naming files under
`/SAROO/CHEAT/ID/`.

The tool auto-loads this user-provided file when available:

```text
./id_list/game_ids.csv
```

The expected CSV columns are:

```text
Game,ID
```

The source `ID` field may contain both the product ID and version text, such as
`T-6802G   V1.003` or `T-8113H-50V1.000`. The lookup table displays both parts,
but clicking the `Game ID` value copies only the product ID, for example
`T-6802G`.

If auto-load is unavailable because the page is opened by `file://` or the CSV is
not under `./id_list/`, select `game_ids.csv` manually with the file picker.

Users can download the CSV from the `Saroo` folder in:

```text
https://github.com/elephantflea/elephantflea-resources
```

Ways to provide files:

- select them with the file picker
- place them next to `index.html`
- place them in `docs/tools/scht/psk-data/`

`psk-data/` is intentionally for user-provided local files and should not be
committed with PSKai cheat data.

Flow:

1. Load the required PSKai files.
2. Select a game from the parsed list.
3. Review the generated DSL preview and warnings.
4. Press `Save .scht`.

The default filename is based on the PSKai game name. After download, rename it
to the correct game ID if you plan to use the `/SAROO/CHEAT/ID/` lookup path.

## SD Card Placement

Preferred path:

```text
/SAROO/CHEAT/ID/<GAMEID>.scht
```

Fallback path:

```text
/SAROO/CHEAT/F/<FolderName>.scht
```

Examples:

```text
/SAROO/CHEAT/ID/GS-9015.scht
/SAROO/CHEAT/ID/T-1213G.scht
/SAROO/CHEAT/F/Panzer Dragoon JP.scht
```

`ID` lookup is safer because it is based on the Saturn disc product ID. `F`
lookup depends on the folder name under `/SAROO/ISO` matching exactly.

## Game ID Selection

The game ID must match the exact region and revision of the game image.

Use one of these methods:

- look up the product ID on Saturn technical databases
- inspect the disc image IP header with an external Saturn image tool
- use the folder fallback path until the ID is confirmed

Do not use a Japanese ID for a US image, or a Rev A ID for another revision,
unless you have verified that the cheat addresses match.

## Crash Risk

Cheat codes write directly into Saturn memory. Wrong codes can crash the game.

Common causes:

- code made for a different region
- code made for a different disc revision
- bad dump or patched game image
- missing or wrong master code
- unsupported command converted incorrectly by hand
- code that is already broken on real PSKai

Recommended testing:

- start with one cheat enabled
- test boot-only cheats separately from freeze cheats
- if the game crashes, retest the same code on real PSKai when possible
- if real PSKai crashes at the same point, treat the source cheat as incompatible

## Copyright Boundary

SAROO Kaito firmware packages should not include copyrighted cheat lists.

The supported distribution model is:

- firmware provides the loader and builder
- users provide their own PSKai source files or Action Replay text
- users generate their own `.scht` files locally
- generated files are the user's responsibility
