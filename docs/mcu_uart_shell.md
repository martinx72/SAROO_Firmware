# MCU UART Shell

This document describes the low-level MCU UART shell implemented in
`Firm_MCU/Main/shell.c`.

The shell is intended for development, repair, and board diagnostics. It can
read and write raw memory-mapped registers and RAM, so incorrect commands can
crash the MCU app, corrupt SDRAM contents, or leave the board in an invalid
runtime state until reset.

## Serial Port

The shell uses MCU `UART4`.

Current firmware configures the port at:

```text
1048576 baud, 8 data bits, no parity, 1 stop bit
```

The prompt is:

```text
stm32>
```

## When The Shell Is Available

`simple_shell()` is called from `Firm_MCU/Main/main.c`.

In the MCU app build, the firmware initializes SD, loads `ssfirm.bin`, sets up
the Saturn/FPGA services, starts the Saturn interrupt and disk tasks, and then
enters the shell.

In the bootloader build, the shell is available after several error paths, such
as no SD card, SD mount failure, or missing `/SAROO/mcuapp.bin`. This makes it
useful for board bring-up and repair even when the normal app cannot boot.

## Argument Format

Arguments are parsed as hexadecimal by default.

Use:

```text
base10
```

to switch to decimal argument parsing, and:

```text
base16
```

to switch back to hexadecimal.

Values may also use a `0x` prefix while in hexadecimal mode.

## Common Commands

Command | Meaning
--- | ---
`base16` | Parse numeric arguments as hexadecimal.
`base10` | Parse numeric arguments as decimal.
`rb <addr>` | Read 8-bit value.
`rw <addr>` | Read 16-bit value.
`rd <addr>` | Read 32-bit value.
`wb <addr> <value>` | Write 8-bit value.
`ww <addr> <value>` | Write 16-bit value.
`wd <addr> <value>` | Write 32-bit value.
`db [addr] [len]` | Dump memory as bytes.
`dw [addr] [len]` | Dump memory as 16-bit words.
`dd [addr] [len]` | Dump memory as 32-bit words.
`d [addr] [len]` | Dump memory using the previous dump width.
`go <addr>` | Jump to an address and execute it.
`fpu` | Update the FPGA SPI flash from `/SAROO/update/SSMaster.rbf`.
`flu` | Run the MCU flash update path.
`sdram [type] [reftime]` | Write SDRAM type/refresh configuration to MCU flash.
`mmt [addr] [size]` | Run a memory test. Defaults to `0x61000000`, `0x00100000`.
`memset <addr> <value> <len>` | Fill memory.
`memcpy <dst> <src> <len>` | Copy memory.
`ls` | List the SD root directory.
`q` | Exit the shell loop.

## MCU App Only Commands

These commands are excluded from the bootloader build.

Command | Meaning
--- | ---
`upmcu` | Receive a file through XMODEM and write `/SAROO/mcuapp.bin`.
`upss` | Receive a file through XMODEM and write `/SAROO/ssfirm.bin`.
`upfpga` | Receive a file through XMODEM and write `/SAROO/update/SSMaster.rbf`.
`lscue <index>` | List disc/CUE information for a game entry.
`load <index>` | Load a game entry.
`cdc [status]` | Dump CD block state.
`log [mask]` | Read or set `log_mask`.
`fsdly [n]` | Read or set forced sector delay.
`sdly [n]` | Read or set current sector delay.
`fpdly [n]` | Read or set forced play delay.
`pdly [n]` | Read or set current play delay.
`fedly [n]` | Read or set forced pending/end delay.
`edly [n]` | Read or set current pending/end delay.
`pt <id>` | Show play task information.

## Special `ss` Prefix

Input beginning with:

```text
ss <text>
```

is not handled like a normal command. The shell copies `<text>` to:

```text
TMPBUFF_ADDR + 0x10
```

and writes the text length to:

```text
TMPBUFF_ADDR
```

This appears to be a shared-buffer test path for Saturn-side communication.

## FPGA Update File

The `fpu` command looks for:

```text
/SAROO/update/SSMaster.rbf
```

The file must be an Altera/Intel raw binary file (`.rbf`). It is not a `.sof`,
`.jic`, compressed archive, or custom package.

After a successful update, the firmware deletes the update file from the SD
card.

## Useful Diagnostics

Check FPGA registers:

```text
rw 60000000
rw 60000002
rw 60000004
rw 60000016
```

Typical values:

```text
60000000: 5253
60000002: 1206
60000004: 0207
60000016: f0df
```

Check that `ssfirm.bin` was loaded into SDRAM:

```text
dd 61000000 40
```

The first bytes should decode as:

```text
SEGA SEGASATURN
```

Run a small SDRAM test:

```text
mmt 61100000 10000
```

Check for address aliasing:

```text
ww 61100000 a000
ww 61100008 a008
ww 61100010 a010
ww 61100018 a018
dw 61100000 20
```

If addresses separated by `0x10` mirror each other, suspect an SDRAM address
line fault.

