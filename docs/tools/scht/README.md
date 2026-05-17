# SAROO Cheat Builder

This folder contains the browser-side builder for SAROO Kaito `.scht` files.

Full usage documentation is in:

```text
../../cheat_web_tool.md
```

The builder has five tabs:

- `AR Code to SCHT`: manual Action Replay / GameShark-style code input to SAROO `.scht`
- `SCHT Editor`: decode an existing SAROO `.scht`, edit the generated DSL (Domain-Specific Language), and save a new binary
- `RetroArch CHT`: convert a RetroArch Saturn `.cht` file to editable SAROO DSL and `.scht`
- `PSKai Source`: user-supplied Pseudo Saturn Kai source files to SAROO `.scht`
- `Game IDs`: load a user-provided Saturn game ID CSV and copy product IDs

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

## Quick Start

Run a static server:

```bash
cd /PATH/SAROO_Firmware/docs/tools/scht
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

Directly opening `index.html` with `file://` is not the supported path because
browser module and local file loading rules vary by browser and OS.

## UI Text

Basic UI text is centralized in:

```text
i18n/en.js
```

HTML nodes use `data-i18n`, `data-i18n-placeholder`, and
`data-i18n-aria-label` keys. The generated DSL text, builder warnings, and
`.scht` directives intentionally remain English for now.

## PSKai Source Files

Required:

- `cheats_full_data_ram.c`
- `cheats_full_data_rom.c`

Optional:

- `cheats_full_report.txt`

These files must be provided by the user. They can be selected with the file
picker, placed next to `index.html`, or placed in `psk-data/`.

`psk-data/` is intentionally for local user-provided data and should not be
committed with PSKai cheat lists.

## RetroArch CHT Files

Use the `RetroArch CHT` tab for RetroArch Saturn `.cht` files. The builder
supports GameShark-style `cheatX_desc`, `cheatX_code`, and `cheatX_enable`
entries.

Entries containing `??` are converted into commented DSL lines. Fill the missing
hex value, uncomment the item, validate, then save. RetroArch `.cht` files
cannot be copied directly to the SAROO SD card.

## Output

The generated binary `.scht` files should be copied to one of:

```text
/SAROO/CHEAT/ID/<GAMEID>.scht
/SAROO/CHEAT/F/<FolderName>.scht
```

`ID` lookup is preferred because it is based on the Saturn disc product ID.
`F` lookup is a folder-name fallback.

## Runtime Interval

The editable DSL supports:

```text
@runtime_interval 4
```

This throttles freeze writes to every fourth runtime trap. Use it only when a
game shows timing-sensitive flicker or instability during video playback while
freeze cheats are enabled. Omit it, or set it to `1`, for the original behavior.

## Game ID List

The `Game IDs` tab auto-loads:

```text
./id_list/game_ids.csv
```

when the file is available from the same static server. The CSV can also be
selected manually. Clicking the `Game ID` value copies only the product ID, not
the version suffix.

## Warning

Wrong cheat codes, wrong master codes, or codes for a different game region or
revision can crash the game. Test one cheat at a time first.
