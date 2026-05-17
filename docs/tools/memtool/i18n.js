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
 *
 * Translation text copyrights remain with their respective translation
 * contributors. Translation contributions are expected to be provided under
 * AGPL-3.0-or-later for distribution with this tool unless otherwise stated.
 */

"use strict";

window.SAROO_MEMTOOL_I18N = {
  en: {
    appTitle: "SAROO Save Memory Tool",
    appIntro: "Inspect and rebuild SAROO internal-save and external-memory-card images. All parsing is done locally in the browser.",
    themeToggle: "Toggle color theme",
    backupTitle: "Backup First",
    backupText: "This tool rewrites save-memory images. Keep a backup of the original <code>SS_SAVE.BIN</code> or <code>SS_MEMS.BIN</code> before replacing files on the SD card.",
    tabSSave: "SS_SAVE.BIN",
    tabSMems: "SS_MEMS.BIN",
    tabListLabel: "Memory tool tabs",

    loadSSaveTitle: "1. Load Internal Save Image",
    loadSSaveText: "Load <code>/SAROO/SS_SAVE.BIN</code>. This file contains one internal-backup slot per game id.",
    selectSSave: "Select SS_SAVE.BIN",
    noSSaveLoaded: "No SS_SAVE.BIN loaded.",
    createSlotTitle: "Create Game Slot",
    createSlotHint: "Use this only when a game id slot does not exist yet. Game id is stored as a 16-byte SAROO slot key.",
    gameIdPlaceholder: "T-12345G  V1.000",
    createSlot: "Create Slot",
    gameSlotsWithSaves: "Game Slots With Saves",
    gameIdSlots: "Game id slots",
    saveEntries: "Save entries",
    noGameSlotSelected: "No game slot selected.",
    playedSlots0: "Played slots with 0 saves",

    exportImportTitle: "2. Export / Import",
    ssaveExportImportText: "Export one internal save as <code>SSAVERAW</code>, or import a <code>SSAVERAW</code> file into the selected game slot.",
    smemsExportImportText: "Export one external-card save as <code>SSAVERAW</code>, or import a <code>SSAVERAW</code> file into the card image.",
    selectSaveEntry: "Select a save entry.",
    exportSelectedSave: "Export Selected Save",
    deleteSelectedSave: "Delete Selected Save",
    importSSAVERAW: "Import SSAVERAW",
    selectSingleSave: "Select single-save file",
    noRawLoaded: "No SSAVERAW loaded.",
    importTarget: "Import Target",
    addAsNewSave: "Add as new save",
    replaceSelectedSave: "Replace selected save",
    outputFilename: "Output filename",
    downloadSSave: "Download Rebuilt SS_SAVE.BIN",
    downloadSMems: "Download Rebuilt SS_MEMS.BIN",

    loadSMemsTitle: "1. Load External Memory Card Image",
    loadSMemsText: "Load <code>/SAROO/SS_MEMS.BIN</code>. This file is one virtual external backup memory cartridge.",
    selectSMems: "Select SS_MEMS.BIN",
    noSMemsLoaded: "No SS_MEMS.BIN loaded.",
    externalCardSaves: "External card saves",

    externalMemoryCard: "External Memory Card",
    rawFileTooSmall: "SSAVERAW file is too small",
    notRawFile: "Not a SSAVERAW file",
    rawTruncated: "SSAVERAW data is truncated",
    invalidSSave: "Invalid SS_SAVE.BIN header",
    invalidSMemsSize: "SS_MEMS.BIN should be 8 MB",
    invalidSMems: "Invalid SS_MEMS.BIN header",
    unsupportedImage: "Unsupported image. Expected SS_SAVE.BIN or SS_MEMS.BIN.",
    loadSSaveFirst: "Load SS_SAVE.BIN first",
    loadSMemsFirst: "Load SS_MEMS.BIN first",
    gameIdRequired: "Game id is required",
    gameIdTooLong: "Game id must fit in 16 bytes",
    gameIdExists: "This game id already exists",
    ssaveIndexFull: "SS_SAVE index is full",
    chainBroken: "Save chain is broken",
    notEnoughSSaveBlocks: "Not enough free blocks in SS_SAVE slot",
    notEnoughSMemsBlocks: "Not enough free blocks in SS_MEMS",
    noFreeHeaderBlock: "No free header block",
    noFreeDataBlock: "No free data block",
    smemsDirFull: "SS_MEMS directory is full",
    selectSaveFirst: "Select a save first",
    loadImageAndRawFirst: "Load an image and a SSAVERAW file first",
    selectSaveToReplace: "Select the save entry to replace",
    duplicateSave: "A save with this file name already exists. Use Replace selected save.",

    rawSummaryFileName: "File name: {value}",
    rawSummaryComment: "Comment: {value}",
    rawSummaryDataSize: "Data size: {value} bytes",
    detailFileName: "File name: {value}",
    detailComment: "Comment: {value}",
    detailDataSize: "Data size: {value} bytes",
    detailSaturnBlocks: "Saturn used blocks: {value}",
    detailLanguage: "Language: {value}",
    detailDateRaw: "Date raw: 0x{value}",
    detailInternalBlock: "Internal start block: {value}",
    emptyValue: "(empty)",

    summaryType: "Type: {value}",
    summarySize: "Size: {value} bytes",
    summaryGameSlots: "Game slots: {value}",
    summarySlotsWithSaves: "Slots with saves: {value}",
    summaryPlayedSlots0: "Played slots with 0 saves: {value}",
    summarySaves: "Saves: {value}",
    summaryExternalSaves: "External card saves: {value}",
    summaryFreeBlocks: "Free blocks: {value}",
    listBlocks: "{value} blocks",
    slotIndex: "Slot index: {value}",
    slotFreeBlocks: "Free blocks: {value}",
    slotSaveEntries: "Save entries: {value}",
    selectGameSlot: "Select a game slot.",
    selectedGameSlot: "Selected game slot: {value}",
    noSaveSelectedSMems: "No save selected. Importing a SSAVERAW file can add a save to this card image.",
    importFirstSaveHint: "Importing a SSAVERAW file can add the first save to this slot.",

    createdSlot: "Created SS_SAVE slot: {value}",
    deletedSave: "Deleted save: {value}",
    importedSave: "Imported save: {value}",
    loadedFile: "Loaded {value}",
    loadedRawFile: "Loaded SSAVERAW: {value}",
    exportedSave: "Exported save: {value}",
    downloadedSSave: "Downloaded rebuilt SS_SAVE.BIN.",
    downloadedSMems: "Downloaded rebuilt SS_MEMS.BIN."
  }
};
