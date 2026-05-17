# SAROO Save Memory Tool

`memtool` is a browser-only tool for inspecting and rebuilding SAROO save-memory files.

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

Supported input files:

- `/SAROO/SS_SAVE.BIN`
- `/SAROO/SS_MEMS.BIN`
- Single-save `SSAVERAW` files exported by this tool or by SAROO's old `tools/savetool`

Current features:

- Separate tabs for `SS_SAVE.BIN` and `SS_MEMS.BIN`.
- List `SS_SAVE.BIN` game slots that contain save entries.
- Show `SS_SAVE.BIN` played slots with 0 saves in a separate list.
- List `SS_MEMS.BIN` external-memory-card save entries directly, because the file represents one virtual card.
- Decode Shift-JIS comments when save comments contain Japanese text.
- Show Saturn-style used blocks in both save lists.
- Show both Saturn-style used blocks and SAROO internal start blocks in the detail panel. The internal start block is a storage pointer inside the SAROO image; it is not the same value shown by the Saturn memory manager.
- Export a single save as `SSAVERAW`.
- Import a `SSAVERAW` save as a new entry.
- Replace the selected save with a `SSAVERAW` save.
- Delete the selected save.
- Download the rebuilt `.BIN` image.

The browser does not modify the original file in place. Always download the rebuilt image and keep a backup of the original file before copying it back to the SD card.

Run locally with:

```sh
python3 -m http.server
```

Then open:

```text
http://localhost:8000/
```
