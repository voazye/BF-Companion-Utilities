# BF Companion Utilities

Based on my (old plugin)[https://github.com/voazye/battlefield-companion-QOL]

A full-featured toolkit for the Battlefield Companion emblem editor (companion.battlefield.com).  
It restores the disabled rotation handle and adds a floating control panel with precise transform controls, undo/redo, alignment tools, and a reference image overlay.

## Features

- Restores the rotation handle for any selected shape (hold **Shift** to temporarily disable 45° snapping).
- Precise transform controls via a draggable floating menu:
  - **Angle** (0–359°) – live readout and editable input.
  - **Position** (X/Y) – live readout and editable input.
  - **Size** (W/H) – live readout and editable input.
- Per‑object Undo/Redo (up to 50 steps) – works alongside the native undo button and Ctrl+Z.
- Alignment tools: Left, Right, Top, Bottom, Horizontal Center, Vertical Center – click twice to toggle between bounding‑box and center alignment.
- Reference Image Overlay – load an image via URL or file upload, drag it, resize it, adjust opacity (1–100%), show/hide, and lock it in place. All settings are saved automatically.
- Integrated help – click the `?` button next to the Angle field for a quick overview.

The floating menu is draggable, collapsible, remembers its position, and stays on top of the page.

## Installation

This extension is built for **Firefox** (desktop).  
It is available on the Firefox Add‑on Store:  
https://addons.mozilla.org/en-US/firefox/addon/battlefield-emblem-rotate-fix/

For manual installation (development):  
- Download this repository as a `.zip` file.
- Open Firefox and go to `about:debugging`.
- Click **"Load Temporary Add‑on"** and select the `.zip` file.  
  *(The add‑on will be removed when you close the browser.)*

## Privacy

This extension does not collect, store, or transmit any user data.  
All settings (position, image overlay, etc.) are stored locally in your browser's `localStorage`.

## Support

If you like this extension, please consider leaving a Tiny donation ｡◕‿◕｡. Thank you :D

<div align="center">
  <a href="https://ko-fi.com/voazye" target="_blank">
    <img src="https://i.imgur.com/h6saoAf.png" alt="Donate" height="256" style="border:0px;height:256px;" />
  </a>
</div>
