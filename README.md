# SAROO Firmware

Firmware package and companion browser tools for MarTinX SAROO firmware build.

Base projects:

- tpunix SAROO https://github.com/tpunix/SAROO
- xvortex SAROO-related work https://github.com/xvortex/SAROO

Enhancements:

- MarTinX / Retro Game Restore
- psplandy

Community:

- Kaito Gaming Group on Facebook: https://www.facebook.com/groups/kaitogaming

Note: this program is freeware. If you paid for it, you have been scammed. The
Kaito team does not manufacture or sell SAROO hardware.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/rgrdev)&nbsp;&nbsp;&nbsp;&nbsp;[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I2I1J3G3I)

&nbsp;&nbsp;<img src="https://github.com/martinx72/SAROO_Firmware/blob/09ebe1ff1cbf52a99284ff4a69d700a4839aedc2/demo_gif/2024010718085950%20%5BAVC%20720p%5D%20%5B640i%5D.gif" width="320"/>&nbsp;&nbsp;<img src="https://github.com/martinx72/SAROO_Firmware/blob/09ebe1ff1cbf52a99284ff4a69d700a4839aedc2/demo_gif/2024010718044765%20%5BAVC%20720p%5D%20%5B640i%5D.gif" width="320"/>

## Firmware Files

Make sure your SAROO cartridge is already updated to FPGA `05` and MCU
`231125` or later. If not, contact your hardware source and confirm that the
cartridge has been updated.

Latest MarTinX SAROO firmware build package:
https://github.com/martinx72/SAROO_Firmware/

Basic SD card layout:

```text
[SD card root]
  + SAROO/
      + ssfirm.bin
      + saroocfg.txt
      + mcuapp.bin
      + BIN/
      + ISO/
      + update/
	  + CHEAT /
	      + ID /
		  + F /
```

Game ISO or CUE/BIN files must be placed under `/SAROO/ISO`. Use one folder per
game:

```text
[SD card root]
  + SAROO/
      + ISO/
          + Game0/
              + game0.iso
          + Game1/
              + game1.cue
              + game1.bin
          + Game2/
              + game2.iso
```

## Browser Tools

These tools run locally in the browser. No files are uploaded to a server.

GitHub Pages URLs:

- SCHT cheat builder: https://martinx72.github.io/SAROO_Firmware/tools/scht/
- Config editor: https://martinx72.github.io/SAROO_Firmware/tools/cfged/
- Save memory tool: https://martinx72.github.io/SAROO_Firmware/tools/memtool/

Notes:

- `.scht` cheat files and the built-in cheat code feature were added in
  MarTinX SAROO firmware builds from May 2026 onward. Older MarTinX builds and
  firmware builds from other maintainers may not support `.scht` files, and may
  not include cheat code support at all.
- PSKai cheat source files are not bundled. Users must provide their own files
  when using the PSKai conversion tab.
- Game ID CSV auto-loading is optional. Users can also load the CSV manually.

## Documentation

- SCHT binary format: `docs/cheat_cht_format.md`
- Cheat builder usage: `docs/cheat_web_tool.md`
- MCU UART shell commands: `docs/mcu_uart_shell.md`

## SAROO Config

Use the config editor above, or edit `/SAROO/saroocfg.txt` manually.

Common global settings:

```text
[global]
lang_id = 1
sort_mode = 1
idx_in_list = 0
exmem_4M
```

Common per-game fix example:

```text
# Final Fight Revenge
[T-1248G   V1.004]
sector_delay = 2000
```
