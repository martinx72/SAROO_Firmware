# SAROO Config Editor

This standalone web tool edits `saroocfg.txt` for SAROO firmware.

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

## Usage

Open `index.html` directly in a browser, or run a local static server from this
folder:

```sh
python3 -m http.server
```

The generated file should be saved as:

```text
/SAROO/saroocfg.txt
```

## Notes

- `log_mask` is hexadecimal.
- Omit `log_mask` or set it to `0` for normal quiet mode.
- `log_mask = 10` enables `_INFO` logs only.
- `log_mask = 14` enables `_FILEIO` and `_INFO`.
- `log_mask = 11c` enables full CD debug I/O: `_FILEIO`, `_CDRV`,
  `_INFO`, and `_DTASK`.
- Unknown or advanced lines are preserved in each section's `Extra Lines`
  field when loading a config.
