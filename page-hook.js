(function () {
  'use strict';

  const LOG_PREFIX = '[Emblem Rotate Fix]';
  const STORAGE_KEY = 'emblemRotateFixPosition';
  const MAX_UNDO_STEPS = 50;

  window.__emblemRotateHandleEnabled = true;

  const SNAP_ANGLE = 45;
  const SNAP_THRESHOLD = 6;

  // ----- Reference Image State -----
  let refImageVisible = false;
  let refImageUrl = null;
  let refImageLocked = false;
  let refImageOpacity = 1;
  let refImageWidth = 300;
  let refImageHeight = 300;
  let refImagePosX = null;
  let refImagePosY = null;

  // ----- Helper functions -----
  function snapAngleValue(angle) {
    const nearest = Math.round(angle / SNAP_ANGLE) * SNAP_ANGLE;
    const diff = Math.abs(angle - nearest);
    if (diff <= SNAP_THRESHOLD || diff >= 360 - SNAP_THRESHOLD) {
      return ((nearest % 360) + 360) % 360;
    }
    return angle;
  }

  function clampAngle(value) {
    let n = Math.round(Number(value));
    if (Number.isNaN(n)) return 0;
    n = n % 360;
    if (n < 0) n += 360;
    return n;
  }

  function clampCoord(value) {
    let n = Math.round(Number(value));
    if (Number.isNaN(n)) return 0;
    return n;
  }

  function clampSize(value) {
    let n = parseFloat(value);
    if (isNaN(n) || n < 0) return 0;
    return Math.round(n * 10) / 10;
  }

  function getObjectState(obj) {
    if (!obj) return null;
    return {
      left: obj.left,
      top: obj.top,
      angle: obj.angle,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      width: obj.width,
      height: obj.height
    };
  }

  function applyObjectState(obj, state) {
    if (!obj || !state) return;
    obj.left = state.left;
    obj.top = state.top;
    obj.angle = state.angle;
    obj.scaleX = state.scaleX;
    obj.scaleY = state.scaleY;
    obj.setCoords();
  }

  function statesAreEqual(a, b) {
    if (!a || !b) return false;
    return a.left === b.left &&
           a.top === b.top &&
           a.angle === b.angle &&
           a.scaleX === b.scaleX &&
           a.scaleY === b.scaleY;
  }

  // ----- Global menu styles (fixed) -----
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #emblem-rotate-fix-menu {
        position: fixed;
        z-index: 999999;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        border-radius: 12px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06);
        backdrop-filter: blur(12px);
        background: rgba(18, 20, 26, 0.92);
        color: #e8e8e8;
        min-width: 290px;
        pointer-events: auto;
        user-select: none;
        display: inline-block;
        transition: box-shadow 0.25s ease, transform 0.2s ease;
        max-height: 90vh;
        overflow-y: auto;
      }
      #emblem-rotate-fix-menu::-webkit-scrollbar {
        width: 4px;
      }
      #emblem-rotate-fix-menu::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
      }
      #emblem-rotate-fix-menu::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
      }
      #emblem-rotate-fix-menu:hover {
        box-shadow: 0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1);
      }
      #emblem-rotate-fix-menu .menu-header {
        display: flex;
        align-items: center;
        padding: 10px 14px;
        cursor: grab;
        gap: 10px;
        border-radius: 12px 12px 0 0;
        background: rgba(255,255,255,0.04);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        transition: background 0.2s;
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(8px);
      }
      #emblem-rotate-fix-menu .menu-header:hover {
        background: rgba(255,255,255,0.08);
      }
      #emblem-rotate-fix-menu .menu-header:active {
        cursor: grabbing;
      }
      #emblem-rotate-fix-menu .menu-toggle {
        font-size: 12px;
        opacity: 0.5;
        transition: transform 0.3s ease;
        line-height: 1;
      }
      #emblem-rotate-fix-menu .menu-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: #fff;
        flex: 1;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      #emblem-rotate-fix-menu .menu-body {
        padding: 14px 16px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      #emblem-rotate-fix-menu .control-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #emblem-rotate-fix-menu .control-row label {
        opacity: 0.7;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        flex: 0 0 60px;
        letter-spacing: 0.2px;
        text-transform: uppercase;
        color: #bbb;
      }
      #emblem-rotate-fix-menu .control-row .coord-group {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 1;
        justify-content: flex-end;
      }
      #emblem-rotate-fix-menu .control-row .coord-group span {
        opacity: 0.5;
        font-size: 11px;
        font-weight: 600;
        margin-right: 2px;
      }
      #emblem-rotate-fix-menu .number-input-group {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      #emblem-rotate-fix-menu .number-input-group input[type="number"] {
        width: 52px;
        background: rgba(255,255,255,0.06);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        font-size: 13px;
        padding: 6px 4px;
        outline: none;
        transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
        font-family: inherit;
        text-align: center;
        -moz-appearance: textfield;
      }
      #emblem-rotate-fix-menu .number-input-group input[type="number"]::-webkit-outer-spin-button,
      #emblem-rotate-fix-menu .number-input-group input[type="number"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      #emblem-rotate-fix-menu .number-input-group input[type="number"]:focus {
        border-color: #5b9aff;
        box-shadow: 0 0 0 3px rgba(91, 154, 255, 0.25);
        background: rgba(255,255,255,0.08);
      }
      #emblem-rotate-fix-menu .number-input-group .step-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        color: #c0c0c0;
        border-radius: 4px;
        width: 22px;
        height: 22px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s, transform 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
      #emblem-rotate-fix-menu .number-input-group .step-btn:hover {
        background: rgba(255,255,255,0.14);
        border-color: rgba(255,255,255,0.2);
      }
      #emblem-rotate-fix-menu .number-input-group .step-btn:active {
        background: rgba(255,255,255,0.22);
        transform: scale(0.92);
      }
      #emblem-rotate-fix-menu input[type="text"].readonly {
        width: 52px;
        background: rgba(255,255,255,0.06);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        font-size: 13px;
        padding: 6px 4px;
        outline: none;
        font-family: inherit;
        text-align: center;
        pointer-events: none;
        opacity: 0.6;
      }
      #emblem-rotate-fix-menu input[type="text"].editable {
        flex: 1;
        background: rgba(255,255,255,0.06);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        font-size: 12px;
        padding: 4px 6px;
        outline: none;
        transition: border-color 0.25s, box-shadow 0.25s;
        font-family: inherit;
        pointer-events: auto;
        opacity: 1;
        width: auto;
        min-width: 100px;
      }
      #emblem-rotate-fix-menu input[type="text"].editable:focus {
        border-color: #5b9aff;
        box-shadow: 0 0 0 3px rgba(91, 154, 255, 0.25);
        background: rgba(255,255,255,0.08);
      }
      #emblem-rotate-fix-menu .control-row .deg-symbol {
        opacity: 0.5;
        font-size: 13px;
        margin-left: 2px;
      }
      #emblem-rotate-fix-menu .divider {
        border: none;
        border-top: 1px solid rgba(255,255,255,0.06);
        margin: 4px 0;
      }
      #emblem-rotate-fix-menu .checkbox-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #emblem-rotate-fix-menu .checkbox-row label {
        opacity: 0.7;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        flex: 0 0 60px;
        letter-spacing: 0.2px;
        text-transform: uppercase;
        color: #bbb;
      }
      #emblem-rotate-fix-menu .checkbox-row input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: #5b9aff;
        cursor: pointer;
        margin: 0;
      }
      /* Reference Image Controls */
      #emblem-rotate-fix-menu .ref-controls {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-left: 8px;
        border-left: 2px solid rgba(255,255,255,0.06);
      }
      #emblem-rotate-fix-menu .ref-controls.hidden {
        display: none;
      }
      #emblem-rotate-fix-menu .ref-controls .ref-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #emblem-rotate-fix-menu .ref-controls .ref-row label {
        opacity: 0.5;
        font-size: 11px;
        font-weight: 400;
        flex: 0 0 50px;
        text-transform: none;
        color: #aaa;
        cursor: default;
      }
      #emblem-rotate-fix-menu .ref-controls input[type="file"] {
        flex: 1;
        font-size: 11px;
        color: #aaa;
        pointer-events: auto;
        opacity: 1;
      }
      #emblem-rotate-fix-menu .ref-controls .ref-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: #e0e0e0;
        border-radius: 4px;
        padding: 3px 12px;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
        font-family: inherit;
        white-space: nowrap;
      }
      #emblem-rotate-fix-menu .ref-controls .ref-btn:hover {
        background: rgba(255,255,255,0.14);
        border-color: rgba(255,255,255,0.2);
      }
      #emblem-rotate-fix-menu .ref-controls .ref-btn:active {
        background: rgba(255,255,255,0.22);
      }
      #emblem-rotate-fix-menu .ref-controls .ref-btn.danger {
        color: #f87171;
      }
      #emblem-rotate-fix-menu .ref-controls .ref-btn.danger:hover {
        background: rgba(248, 113, 113, 0.15);
        border-color: rgba(248, 113, 113, 0.3);
      }
      #emblem-rotate-fix-menu .ref-controls input[type="range"] {
        flex: 1;
        accent-color: #5b9aff;
        background: transparent;
        cursor: pointer;
        height: 4px;
        padding: 0;
      }
      #emblem-rotate-fix-menu .ref-controls .range-value {
        min-width: 32px;
        text-align: center;
        font-size: 11px;
        opacity: 0.7;
      }
      /* Undo/Redo Buttons */
      #emblem-rotate-fix-menu .undo-group {
        display: flex;
        gap: 8px;
        flex: 1;
        justify-content: flex-end;
      }
      #emblem-rotate-fix-menu .undo-group button {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: #e0e0e0;
        border-radius: 6px;
        padding: 4px 14px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s, opacity 0.2s;
        font-family: inherit;
        letter-spacing: 0.3px;
      }
      #emblem-rotate-fix-menu .undo-group button:hover:not(:disabled) {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.25);
      }
      #emblem-rotate-fix-menu .undo-group button:active:not(:disabled) {
        background: rgba(255,255,255,0.25);
        transform: scale(0.96);
      }
      #emblem-rotate-fix-menu .undo-group button:disabled {
        opacity: 0.25;
        cursor: default;
      }
      /* Align Grid */
      #emblem-rotate-fix-menu .align-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        flex: 1;
      }
      #emblem-rotate-fix-menu .align-grid button {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: #d0d0d0;
        border-radius: 6px;
        padding: 6px 0;
        font-size: 18px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s, transform 0.15s, opacity 0.2s;
        font-family: inherit;
        line-height: 1.4;
        min-height: 34px;
      }
      #emblem-rotate-fix-menu .align-grid button:hover:not(:disabled) {
        background: rgba(255,255,255,0.14);
        border-color: rgba(255,255,255,0.25);
        transform: scale(1.04);
      }
      #emblem-rotate-fix-menu .align-grid button:active:not(:disabled) {
        background: rgba(255,255,255,0.22);
        transform: scale(0.94);
      }
      #emblem-rotate-fix-menu .align-grid button:disabled {
        opacity: 0.2;
        cursor: default;
        transform: none;
      }
      /* Image Overlay Section Header */
      #emblem-rotate-fix-menu .overlay-header {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;
        padding: 2px 0;
      }
      #emblem-rotate-fix-menu .overlay-header:hover {
        opacity: 0.9;
      }
      #emblem-rotate-fix-menu .overlay-header .overlay-toggle {
        font-size: 10px;
        opacity: 0.5;
        transition: transform 0.2s;
        line-height: 1;
      }
      #emblem-rotate-fix-menu .overlay-header .overlay-title {
        font-size: 12px;
        font-weight: 500;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.2px;
        color: #bbb;
        flex: 1;
      }
      #emblem-rotate-fix-menu .overlay-header label {
        opacity: 0.6;
        font-size: 11px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      #emblem-rotate-fix-menu .overlay-header label input[type="checkbox"] {
        accent-color: #5b9aff;
        cursor: pointer;
        margin: 0;
        width: 14px;
        height: 14px;
      }
      #emblem-rotate-fix-menu .overlay-header .overlay-status {
        font-size: 10px;
        opacity: 0.4;
      }
      /* Help View */
      #emblem-rotate-fix-menu .help-view {
        display: none;
        flex-direction: column;
        gap: 12px;
        padding: 4px 0;
      }
      #emblem-rotate-fix-menu .help-view h2 {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: #fff;
        letter-spacing: 0.3px;
      }
      #emblem-rotate-fix-menu .help-view p {
        font-size: 13px;
        line-height: 1.6;
        opacity: 0.85;
        margin: 0;
      }
      #emblem-rotate-fix-menu .help-view ul {
        margin: 4px 0 0 0;
        padding-left: 20px;
        font-size: 13px;
        line-height: 1.6;
        opacity: 0.85;
      }
      #emblem-rotate-fix-menu .help-view .help-return-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        color: #e0e0e0;
        border-radius: 6px;
        padding: 6px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
        font-family: inherit;
        align-self: flex-start;
        margin-top: 4px;
      }
      #emblem-rotate-fix-menu .help-view .help-return-btn:hover {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.25);
      }
      /* Reference Image Overlay */
      #emblem-ref-image {
        position: fixed;
        z-index: 2147483646;
        cursor: move;
        border: 2px solid rgba(59, 130, 246, 0.8);
        box-sizing: border-box;
        transition: opacity 0.15s ease;
        display: none;
        pointer-events: auto;
        user-select: none;
      }
      #emblem-ref-image.locked {
        border-color: rgba(255,255,255,0.25);
        cursor: default;
        pointer-events: none;
      }
      #emblem-ref-image img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
      }
      #emblem-ref-image .resize-handle {
        position: absolute;
        right: -6px;
        bottom: -6px;
        width: 14px;
        height: 14px;
        background: #5b9aff;
        border-radius: 50%;
        cursor: nwse-resize;
        pointer-events: auto;
      }
      #emblem-ref-image.locked .resize-handle {
        display: none;
      }
      #emblem-ref-image .lock-badge {
        position: absolute;
        top: -10px;
        left: -10px;
        width: 20px;
        height: 20px;
        background: #1e1e1e;
        border-radius: 50%;
        display: none;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        pointer-events: none;
        border: 1px solid rgba(255,255,255,0.15);
      }
      #emblem-ref-image.locked .lock-badge {
        display: flex;
      }
    `;
    document.head.appendChild(style);
  }

  // ----- Create reference image overlay -----
  function createRefImageOverlay() {
    const wrapper = document.createElement('div');
    wrapper.id = 'emblem-ref-image';
    wrapper.innerHTML = `
      <img id="emblem-ref-img" src="" alt="Reference Image">
      <div class="resize-handle" id="emblem-ref-resize-handle"></div>
      <div class="lock-badge">🔒</div>
    `;
    document.body.appendChild(wrapper);

    const img = document.getElementById('emblem-ref-img');
    const handle = document.getElementById('emblem-ref-resize-handle');

    let isDragging = false;
    let offsetX, offsetY;

    wrapper.addEventListener('mousedown', (e) => {
      if (refImageLocked || e.target.classList.contains('resize-handle')) return;
      isDragging = true;
      const rect = wrapper.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      wrapper.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      wrapper.style.left = x + 'px';
      wrapper.style.top = y + 'px';
      wrapper.style.right = 'auto';
      wrapper.style.bottom = 'auto';
      refImagePosX = x;
      refImagePosY = y;
      saveRefSettings();
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      wrapper.style.cursor = 'move';
    });

    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = refImageWidth;
      startHeight = refImageHeight;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      let newWidth = Math.max(50, startWidth + (e.clientX - startX));
      let newHeight = Math.max(50, startHeight + (e.clientY - startY));
      refImageWidth = newWidth;
      refImageHeight = newHeight;
      wrapper.style.width = newWidth + 'px';
      wrapper.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        saveRefSettings();
      }
    });

    window.addEventListener('resize', () => {
      const rect = wrapper.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      if (rect.left > maxX && maxX > 0) {
        wrapper.style.left = maxX + 'px';
        refImagePosX = maxX;
        saveRefSettings();
      }
      if (rect.top > maxY && maxY > 0) {
        wrapper.style.top = maxY + 'px';
        refImagePosY = maxY;
        saveRefSettings();
      }
    });

    return wrapper;
  }

  // ----- Reference image controls -----
  function showRefImage(url) {
    const wrapper = document.getElementById('emblem-ref-image');
    const img = document.getElementById('emblem-ref-img');
    if (!wrapper || !img) return;

    img.src = url;
    wrapper.style.display = 'block';
    wrapper.style.width = refImageWidth + 'px';
    wrapper.style.height = refImageHeight + 'px';
    wrapper.style.opacity = refImageOpacity;

    if (refImagePosX !== null && refImagePosY !== null) {
      wrapper.style.left = refImagePosX + 'px';
      wrapper.style.top = refImagePosY + 'px';
    } else {
      const x = (window.innerWidth - refImageWidth) / 2;
      const y = (window.innerHeight - refImageHeight) / 2;
      wrapper.style.left = x + 'px';
      wrapper.style.top = y + 'px';
      refImagePosX = x;
      refImagePosY = y;
    }
    wrapper.style.right = 'auto';
    wrapper.style.bottom = 'auto';

    if (refImageLocked) {
      wrapper.classList.add('locked');
    } else {
      wrapper.classList.remove('locked');
    }

    refImageVisible = true;
    refImageUrl = url;
    saveRefSettings();
  }

  function hideRefImage() {
    const wrapper = document.getElementById('emblem-ref-image');
    if (wrapper) {
      wrapper.style.display = 'none';
    }
    refImageVisible = false;
  }

  function unloadRefImage() {
    const wrapper = document.getElementById('emblem-ref-image');
    if (wrapper) {
      wrapper.style.display = 'none';
    }
    const img = document.getElementById('emblem-ref-img');
    if (img) img.src = '';
    refImageUrl = null;
    refImageVisible = false;
    if (refImageLocked) {
      refImageLocked = false;
      if (wrapper) wrapper.classList.remove('locked');
    }
    localStorage.removeItem('refImageUrl');
    localStorage.removeItem('refImageOpacity');
    localStorage.removeItem('refImageLocked');
    localStorage.removeItem('refImageWidth');
    localStorage.removeItem('refImageHeight');
    localStorage.removeItem('refImagePosX');
    localStorage.removeItem('refImagePosY');
  }

  function updateRefOpacity(value) {
    refImageOpacity = value / 100;
    const wrapper = document.getElementById('emblem-ref-image');
    if (wrapper) wrapper.style.opacity = refImageOpacity;
    saveRefSettings();
  }

  function toggleRefLock() {
    refImageLocked = !refImageLocked;
    const wrapper = document.getElementById('emblem-ref-image');
    if (wrapper) {
      if (refImageLocked) {
        wrapper.classList.add('locked');
      } else {
        wrapper.classList.remove('locked');
      }
    }
    saveRefSettings();
  }

  function saveRefSettings() {
    if (refImageUrl) {
      try {
        localStorage.setItem('refImageUrl', refImageUrl);
        localStorage.setItem('refImageOpacity', refImageOpacity);
        localStorage.setItem('refImageLocked', refImageLocked);
        localStorage.setItem('refImageWidth', refImageWidth);
        localStorage.setItem('refImageHeight', refImageHeight);
        if (refImagePosX !== null && refImagePosY !== null) {
          localStorage.setItem('refImagePosX', refImagePosX);
          localStorage.setItem('refImagePosY', refImagePosY);
        }
      } catch (_) {}
    }
  }

  function loadRefSettings() {
    try {
      const url = localStorage.getItem('refImageUrl');
      if (url) {
        refImageUrl = url;
        refImageOpacity = parseFloat(localStorage.getItem('refImageOpacity')) || 1;
        refImageLocked = localStorage.getItem('refImageLocked') === 'true';
        refImageWidth = parseInt(localStorage.getItem('refImageWidth')) || 300;
        refImageHeight = parseInt(localStorage.getItem('refImageHeight')) || 300;
        refImagePosX = parseFloat(localStorage.getItem('refImagePosX'));
        refImagePosY = parseFloat(localStorage.getItem('refImagePosY'));
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ----- Floating Menu -----
  function createFloatingMenu() {
    const existing = document.getElementById('emblem-rotate-fix-menu');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'emblem-rotate-fix-menu';

    let posX = 20, posY = 20;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.x === 'number') posX = parsed.x;
        if (typeof parsed.y === 'number') posY = parsed.y;
      }
    } catch (_) {}
    container.style.left = posX + 'px';
    container.style.top = posY + 'px';

    const header = document.createElement('div');
    header.className = 'menu-header';

    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'menu-toggle';
    toggleBtn.textContent = '▼';

    const title = document.createElement('span');
    title.className = 'menu-title';
    title.textContent = 'BF Companion Utilities';

    header.appendChild(toggleBtn);
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'menu-body';

    // ----- Normal view -----
    const normalView = document.createElement('div');
    normalView.style.cssText = 'display:flex; flex-direction:column; gap:14px;';

    // ----- Help view -----
    const helpView = document.createElement('div');
    helpView.className = 'help-view';
    helpView.innerHTML = `
      <h2>📖 How to use</h2>
      <p><strong>Angle</strong> – Rotate the selected object precisely (0–359°).</p>
      <p><strong>Rotate Handle</strong> – Enable/disable the rotation handle on the object.</p>
      <p><strong>Position</strong> – Move the object to exact X/Y coordinates.</p>
      <p><strong>Size</strong> – Scale the object to exact width/height (in pixels).</p>
      <p><strong>Canvas</strong> – Shows the current size of the drawing area (info only).</p>
      <p><strong>History</strong> – Undo/Redo for changes to the current object (max. 50 steps).</p>
      <p><strong>Align</strong> – Align the object to the edge or center it (click multiple times for BoundingBox / center toggle).</p>
      <p><strong>Image Overlay</strong> – Load a reference image (URL or file) as an overlay. Drag it, resize it, adjust opacity. Use <em>Show</em> to toggle visibility, <em>Lock</em> to prevent moving.</p>
      <button class="help-return-btn" id="help-return-btn">← Return</button>
    `;

    // ----- Helper for number input group with step buttons -----
    function createNumberInputGroup(step, min, max) {
      const group = document.createElement('div');
      group.className = 'number-input-group';

      const input = document.createElement('input');
      input.type = 'number';
      input.step = step;
      if (min !== undefined) input.min = min;
      if (max !== undefined) input.max = max;

      const btnDown = document.createElement('button');
      btnDown.className = 'step-btn';
      btnDown.textContent = '−';
      btnDown.type = 'button';
      btnDown.addEventListener('click', function(e) {
        e.preventDefault();
        const val = parseFloat(input.value) || 0;
        const stepVal = parseFloat(input.step) || 1;
        const newVal = val - stepVal;
        if (input.min !== undefined && newVal < parseFloat(input.min)) return;
        input.value = newVal;
        input.dispatchEvent(new Event('change'));
        input.dispatchEvent(new Event('input'));
      });

      const btnUp = document.createElement('button');
      btnUp.className = 'step-btn';
      btnUp.textContent = '+';
      btnUp.type = 'button';
      btnUp.addEventListener('click', function(e) {
        e.preventDefault();
        const val = parseFloat(input.value) || 0;
        const stepVal = parseFloat(input.step) || 1;
        const newVal = val + stepVal;
        if (input.max !== undefined && newVal > parseFloat(input.max)) return;
        input.value = newVal;
        input.dispatchEvent(new Event('change'));
        input.dispatchEvent(new Event('input'));
      });

      group.appendChild(btnDown);
      group.appendChild(input);
      group.appendChild(btnUp);

      return group;
    }

    // ----- Row 1: Angle with "How to use" button -----
    const angleRow = document.createElement('div');
    angleRow.className = 'control-row';
    angleRow.style.cssText = 'justify-content: space-between;';

    const angleLabel = document.createElement('label');
    angleLabel.textContent = 'Angle';

    const angleGroup = createNumberInputGroup(1, 0, 359);
    const angleInput = angleGroup.querySelector('input');

    const deg = document.createElement('span');
    deg.className = 'deg-symbol';
    deg.textContent = '°';

    const leftWrapper = document.createElement('div');
    leftWrapper.style.cssText = 'display:flex; align-items:center; gap:6px; flex:1;';
    leftWrapper.appendChild(angleLabel);
    leftWrapper.appendChild(angleGroup);
    leftWrapper.appendChild(deg);

    const helpBtn = document.createElement('button');
    helpBtn.textContent = '?';
    helpBtn.style.cssText = `
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: #c0c0c0;
      border-radius: 50%;
      width: 26px;
      height: 26px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex-shrink: 0;
    `;
    helpBtn.title = 'How to use';
    helpBtn.addEventListener('mouseenter', () => {
      helpBtn.style.background = 'rgba(255,255,255,0.14)';
      helpBtn.style.borderColor = 'rgba(255,255,255,0.25)';
    });
    helpBtn.addEventListener('mouseleave', () => {
      helpBtn.style.background = 'rgba(255,255,255,0.06)';
      helpBtn.style.borderColor = 'rgba(255,255,255,0.12)';
    });
    helpBtn.addEventListener('click', () => {
      normalView.style.display = 'none';
      helpView.style.display = 'flex';
    });

    angleRow.appendChild(leftWrapper);
    angleRow.appendChild(helpBtn);

    // ----- Row 2: Rotate Handle (Checkbox) -----
    const handleRow = document.createElement('div');
    handleRow.className = 'checkbox-row';
    const handleLabel = document.createElement('label');
    handleLabel.textContent = 'Rotate Handle';
    const handleCheckbox = document.createElement('input');
    handleCheckbox.type = 'checkbox';
    handleCheckbox.checked = window.__emblemRotateHandleEnabled;
    handleRow.appendChild(handleLabel);
    handleRow.appendChild(handleCheckbox);

    // ----- Row 3: Position (X / Y) -----
    const posRow = document.createElement('div');
    posRow.className = 'control-row';
    const posLabel = document.createElement('label');
    posLabel.textContent = 'Position';

    const coordGroup = document.createElement('div');
    coordGroup.className = 'coord-group';

    const xLabel = document.createElement('span');
    xLabel.textContent = 'X';
    const xGroup = createNumberInputGroup(1);
    const xInput = xGroup.querySelector('input');
    const yLabel = document.createElement('span');
    yLabel.textContent = 'Y';
    const yGroup = createNumberInputGroup(1);
    const yInput = yGroup.querySelector('input');

    coordGroup.appendChild(xLabel);
    coordGroup.appendChild(xGroup);
    coordGroup.appendChild(yLabel);
    coordGroup.appendChild(yGroup);

    posRow.appendChild(posLabel);
    posRow.appendChild(coordGroup);

    // ----- Row 4: Size (W / H) -----
    const sizeRow = document.createElement('div');
    sizeRow.className = 'control-row';
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Size';

    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'coord-group';

    const wLabel = document.createElement('span');
    wLabel.textContent = 'W';
    const wGroup = createNumberInputGroup(0.1);
    const wInput = wGroup.querySelector('input');
    const hLabel = document.createElement('span');
    hLabel.textContent = 'H';
    const hGroup = createNumberInputGroup(0.1);
    const hInput = hGroup.querySelector('input');

    sizeGroup.appendChild(wLabel);
    sizeGroup.appendChild(wGroup);
    sizeGroup.appendChild(hLabel);
    sizeGroup.appendChild(hGroup);

    sizeRow.appendChild(sizeLabel);
    sizeRow.appendChild(sizeGroup);

    // ----- Row 5: Canvas (DOM) READONLY -----
    const canvasSizeRow = document.createElement('div');
    canvasSizeRow.className = 'control-row';
    const canvasSizeLabel = document.createElement('label');
    canvasSizeLabel.textContent = 'Canvas';
    canvasSizeLabel.style.fontSize = '11px';

    const canvasSizeGroup = document.createElement('div');
    canvasSizeGroup.className = 'coord-group';

    const cwLabel = document.createElement('span');
    cwLabel.textContent = 'W';
    cwLabel.style.opacity = '0.4';
    const cwInput = document.createElement('input');
    cwInput.type = 'text';
    cwInput.className = 'readonly';
    cwInput.value = '?';

    const chLabel = document.createElement('span');
    chLabel.textContent = 'H';
    chLabel.style.opacity = '0.4';
    const chInput = document.createElement('input');
    chInput.type = 'text';
    chInput.className = 'readonly';
    chInput.value = '?';

    canvasSizeGroup.appendChild(cwLabel);
    canvasSizeGroup.appendChild(cwInput);
    canvasSizeGroup.appendChild(chLabel);
    canvasSizeGroup.appendChild(chInput);

    canvasSizeRow.appendChild(canvasSizeLabel);
    canvasSizeRow.appendChild(canvasSizeGroup);

    // ----- Divider 1 -----
    const divider1 = document.createElement('hr');
    divider1.className = 'divider';

    // ----- Row 6: Undo / Redo Buttons -----
    const undoRow = document.createElement('div');
    undoRow.className = 'control-row';
    const undoLabel = document.createElement('label');
    undoLabel.textContent = 'History';
    undoLabel.style.flex = '0 0 60px';
    const undoGroup = document.createElement('div');
    undoGroup.className = 'undo-group';

    const undoBtn = document.createElement('button');
    undoBtn.textContent = '↩ Undo';
    undoBtn.disabled = true;

    const redoBtn = document.createElement('button');
    redoBtn.textContent = 'Redo ↪';
    redoBtn.disabled = true;

    undoGroup.appendChild(undoBtn);
    undoGroup.appendChild(redoBtn);
    undoRow.appendChild(undoLabel);
    undoRow.appendChild(undoGroup);

    // ----- Divider 2 -----
    const divider2 = document.createElement('hr');
    divider2.className = 'divider';

    // ----- Row 7: Alignment tools -----
    const alignRow = document.createElement('div');
    alignRow.className = 'control-row';
    const alignLabel = document.createElement('label');
    alignLabel.textContent = 'Align';
    alignLabel.style.alignSelf = 'flex-start';
    alignLabel.style.paddingTop = '4px';

    const alignGrid = document.createElement('div');
    alignGrid.className = 'align-grid';

    const btnVCenter = document.createElement('button');
    btnVCenter.textContent = '⇕';
    btnVCenter.title = 'Center Vertical';
    btnVCenter.disabled = true;

    const btnTop = document.createElement('button');
    btnTop.textContent = '↑';
    btnTop.title = 'Align Top';
    btnTop.disabled = true;

    const btnHCenter = document.createElement('button');
    btnHCenter.textContent = '↔';
    btnHCenter.title = 'Center Horizontal';
    btnHCenter.disabled = true;

    const btnLeft = document.createElement('button');
    btnLeft.textContent = '←';
    btnLeft.title = 'Align Left';
    btnLeft.disabled = true;

    const btnBottom = document.createElement('button');
    btnBottom.textContent = '↓';
    btnBottom.title = 'Align Bottom';
    btnBottom.disabled = true;

    const btnRight = document.createElement('button');
    btnRight.textContent = '→';
    btnRight.title = 'Align Right';
    btnRight.disabled = true;

    alignGrid.appendChild(btnVCenter);
    alignGrid.appendChild(btnTop);
    alignGrid.appendChild(btnHCenter);
    alignGrid.appendChild(btnLeft);
    alignGrid.appendChild(btnBottom);
    alignGrid.appendChild(btnRight);

    alignRow.appendChild(alignLabel);
    alignRow.appendChild(alignGrid);

    // ----- Divider 3 -----
    const divider3 = document.createElement('hr');
    divider3.className = 'divider';

    // ----- Row 8: Image Overlay (collapsable, at the bottom) -----
    const overlayRow = document.createElement('div');
    overlayRow.style.cssText = 'display:flex; flex-direction:column; align-items:stretch; gap:6px;';

    const overlayHeader = document.createElement('div');
    overlayHeader.className = 'overlay-header';

    const overlayToggle = document.createElement('span');
    overlayToggle.className = 'overlay-toggle';
    overlayToggle.textContent = '▶';

    const overlayTitle = document.createElement('span');
    overlayTitle.className = 'overlay-title';
    overlayTitle.textContent = 'Image Overlay';

    const overlayShowLabel = document.createElement('label');
    const overlayShowCheck = document.createElement('input');
    overlayShowCheck.type = 'checkbox';
    overlayShowCheck.checked = refImageVisible && !!refImageUrl;
    overlayShowLabel.appendChild(overlayShowCheck);
    overlayShowLabel.appendChild(document.createTextNode('Show'));

    const overlayLockLabel = document.createElement('label');
    const overlayLockCheck = document.createElement('input');
    overlayLockCheck.type = 'checkbox';
    overlayLockCheck.checked = refImageLocked;
    overlayLockCheck.disabled = !refImageUrl;
    overlayLockLabel.appendChild(overlayLockCheck);
    overlayLockLabel.appendChild(document.createTextNode('Lock'));

    const overlayStatus = document.createElement('span');
    overlayStatus.className = 'overlay-status';
    overlayStatus.textContent = refImageUrl ? '✓' : '—';

    overlayHeader.appendChild(overlayToggle);
    overlayHeader.appendChild(overlayTitle);
    overlayHeader.appendChild(overlayShowLabel);
    overlayHeader.appendChild(overlayLockLabel);
    overlayHeader.appendChild(overlayStatus);

    // Collapsable content
    const overlayContent = document.createElement('div');
    overlayContent.className = 'ref-controls' + (refImageUrl ? '' : ' hidden');

    // URL row
    const urlRow = document.createElement('div');
    urlRow.className = 'ref-row';
    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'URL';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'editable';
    urlInput.placeholder = 'https://example.com/image.png';
    urlInput.value = refImageUrl || '';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'ref-btn';
    loadBtn.textContent = 'Load';
    urlRow.appendChild(urlLabel);
    urlRow.appendChild(urlInput);
    urlRow.appendChild(loadBtn);

    // File upload
    const fileRow = document.createElement('div');
    fileRow.className = 'ref-row';
    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'File';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileRow.appendChild(fileLabel);
    fileRow.appendChild(fileInput);

    // Opacity
    const opacityRow = document.createElement('div');
    opacityRow.className = 'ref-row';
    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Opacity';
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '1';
    opacitySlider.max = '100';
    opacitySlider.value = Math.round(refImageOpacity * 100);
    const opacityValue = document.createElement('span');
    opacityValue.className = 'range-value';
    opacityValue.textContent = Math.round(refImageOpacity * 100) + '%';
    opacityRow.appendChild(opacityLabel);
    opacityRow.appendChild(opacitySlider);
    opacityRow.appendChild(opacityValue);

    // Unload button
    const unloadRow = document.createElement('div');
    unloadRow.className = 'ref-row';
    unloadRow.style.justifyContent = 'flex-end';
    const unloadBtn = document.createElement('button');
    unloadBtn.className = 'ref-btn danger';
    unloadBtn.textContent = 'Unload';
    unloadRow.appendChild(unloadBtn);

    overlayContent.appendChild(urlRow);
    overlayContent.appendChild(fileRow);
    overlayContent.appendChild(opacityRow);
    overlayContent.appendChild(unloadRow);

    overlayRow.appendChild(overlayHeader);
    overlayRow.appendChild(overlayContent);

    // --- Collapse toggle ---
    let overlayExpanded = !!refImageUrl;
    function toggleOverlay(e) {
      if (e.target.tagName === 'INPUT') return;
      overlayExpanded = !overlayExpanded;
      overlayContent.style.display = overlayExpanded ? 'flex' : 'none';
      overlayToggle.textContent = overlayExpanded ? '▼' : '▶';
    }
    overlayHeader.addEventListener('click', toggleOverlay);

    function expandOverlay() {
      overlayExpanded = true;
      overlayContent.style.display = 'flex';
      overlayToggle.textContent = '▼';
    }

    // ----- Add everything to normalView -----
    normalView.appendChild(angleRow);
    normalView.appendChild(handleRow);
    normalView.appendChild(posRow);
    normalView.appendChild(sizeRow);
    normalView.appendChild(canvasSizeRow);
    normalView.appendChild(divider1);
    normalView.appendChild(undoRow);
    normalView.appendChild(divider2);
    normalView.appendChild(alignRow);
    normalView.appendChild(divider3);
    normalView.appendChild(overlayRow);

    // ----- Add normal and help view to body -----
    body.appendChild(normalView);
    body.appendChild(helpView);

    container.appendChild(header);
    container.appendChild(body);

    // Toggle logic for entire menu
    let expanded = true;
    function toggleMenu(e) {
      expanded = !expanded;
      body.style.display = expanded ? 'flex' : 'none';
      toggleBtn.textContent = expanded ? '▼' : '▶';
    }
    body.style.display = 'flex';

    // Drag logic
    let isDragging = false;
    let startX = 0, startY = 0;
    let origX = 0, origY = 0;
    let wasDragged = false;

    function onHeaderMouseDown(e) {
      if (e.button !== 0) return;
      const target = e.target;
      if (target.tagName === 'INPUT') return;

      isDragging = true;
      wasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      header.style.cursor = 'grabbing';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 5) wasDragged = true;
      container.style.left = (origX + dx) + 'px';
      container.style.top = (origY + dy) + 'px';
      e.preventDefault();
    }

    function onMouseUp(e) {
      if (!isDragging) return;
      isDragging = false;
      header.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const rect = container.getBoundingClientRect();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
      } catch (_) {}
      e.preventDefault();
    }

    header.addEventListener('mousedown', onHeaderMouseDown);

    header.addEventListener('click', function(e) {
      if (wasDragged) {
        wasDragged = false;
        return;
      }
      if (e.target.tagName === 'INPUT') return;
      toggleMenu(e);
    });

    document.body.appendChild(container);

    // ----- Help Return Button -----
    const helpReturnBtn = helpView.querySelector('#help-return-btn');
    helpReturnBtn.addEventListener('click', () => {
      helpView.style.display = 'none';
      normalView.style.display = 'flex';
    });

    // ----- Reference image event listeners -----
    overlayShowCheck.addEventListener('change', function() {
      if (this.checked && refImageUrl) {
        showRefImage(refImageUrl);
      } else {
        hideRefImage();
      }
    });

    overlayLockCheck.addEventListener('change', function() {
      toggleRefLock();
      this.checked = refImageLocked;
    });

    loadBtn.addEventListener('click', function() {
      const url = urlInput.value.trim();
      if (!url) return;
      showRefImage(url);
      overlayStatus.textContent = '✓';
      overlayLockCheck.disabled = false;
      overlayShowCheck.checked = true;
      expandOverlay();
    });

    urlInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') loadBtn.click();
    });

    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(event) {
        showRefImage(event.target.result);
        overlayStatus.textContent = '✓';
        overlayLockCheck.disabled = false;
        overlayShowCheck.checked = true;
        urlInput.value = '';
        expandOverlay();
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });

    opacitySlider.addEventListener('input', function() {
      const val = parseInt(this.value);
      opacityValue.textContent = val + '%';
      updateRefOpacity(val);
    });

    unloadBtn.addEventListener('click', function() {
      unloadRefImage();
      overlayStatus.textContent = '—';
      overlayLockCheck.disabled = true;
      overlayLockCheck.checked = false;
      overlayShowCheck.checked = false;
      urlInput.value = '';
      opacitySlider.value = '100';
      opacityValue.textContent = '100%';
      overlayContent.style.display = 'none';
      overlayToggle.textContent = '▶';
      overlayExpanded = false;
    });

    // ---- Initial state ----
    if (refImageUrl) {
      overlayStatus.textContent = '✓';
      overlayLockCheck.disabled = false;
      overlayShowCheck.checked = refImageVisible;
      if (refImageVisible) {
        showRefImage(refImageUrl);
      }
      opacitySlider.value = Math.round(refImageOpacity * 100);
      opacityValue.textContent = Math.round(refImageOpacity * 100) + '%';
      overlayLockCheck.checked = refImageLocked;
      overlayExpanded = true;
      overlayContent.style.display = 'flex';
      overlayToggle.textContent = '▼';
    }

    return {
      container,
      angleInput,
      xInput,
      yInput,
      wInput,
      hInput,
      cwInput,
      chInput,
      handleCheckbox,
      undoBtn,
      redoBtn,
      btnLeft,
      btnHCenter,
      btnRight,
      btnTop,
      btnVCenter,
      btnBottom,
      body,
      header,
      toggleMenu,
      overlayShowCheck,
      overlayLockCheck,
      overlayStatus,
      overlayContent,
      urlInput,
      opacitySlider,
      opacityValue,
      loadBtn,
      unloadBtn,
      fileInput,
      expandOverlay,
      helpBtn,
      helpView,
      normalView
    };
  }

  // ----- Per-Object Undo/Redo Stack -----
  function createUndoManager() {
    const stores = new Map();
    let activeObject = null;
    let isRestoring = false;

    function getObjectId(obj) {
      if (obj.id) return obj.id;
      if (obj.objectId) return obj.objectId;
      if (!obj._undoId) {
        obj._undoId = 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      }
      return obj._undoId;
    }

    function getOrCreateStore(obj) {
      const id = getObjectId(obj);
      if (!stores.has(id)) {
        stores.set(id, { stack: [], index: -1 });
      }
      return stores.get(id);
    }

    function hasState(obj) {
      if (!obj) return false;
      const id = getObjectId(obj);
      return stores.has(id) && stores.get(id).stack.length > 0;
    }

    function pushState(obj) {
      if (isRestoring) return;
      if (!obj) return;

      const store = getOrCreateStore(obj);
      const state = getObjectState(obj);
      if (!state) return;

      for (let i = 0; i < store.stack.length; i++) {
        if (statesAreEqual(store.stack[i], state)) {
          store.index = i;
          updateButtons();
          return;
        }
      }

      if (store.index < store.stack.length - 1) {
        store.stack.splice(store.index + 1);
      }

      store.stack.push(state);
      if (store.stack.length > MAX_UNDO_STEPS) {
        store.stack.shift();
        store.index--;
      }
      store.index = store.stack.length - 1;
      updateButtons();
    }

    function undo(obj) {
      if (isRestoring) return;
      if (!obj) return;

      const store = getOrCreateStore(obj);
      if (store.index <= 0 || store.stack.length === 0) return;

      store.index--;
      const state = store.stack[store.index];
      if (!state) return;

      isRestoring = true;
      applyObjectState(obj, state);
      obj.setCoords();
      if (obj.canvas) obj.canvas.renderAll();

      if (activeObject === obj && window._emblemUpdateUI) {
        window._emblemUpdateUI(obj);
      }

      isRestoring = false;
      updateButtons();
    }

    function redo(obj) {
      if (isRestoring) return;
      if (!obj) return;

      const store = getOrCreateStore(obj);
      if (store.index >= store.stack.length - 1 || store.stack.length === 0) return;

      store.index++;
      const state = store.stack[store.index];
      if (!state) return;

      isRestoring = true;
      applyObjectState(obj, state);
      obj.setCoords();
      if (obj.canvas) obj.canvas.renderAll();

      if (activeObject === obj && window._emblemUpdateUI) {
        window._emblemUpdateUI(obj);
      }

      isRestoring = false;
      updateButtons();
    }

    function setActiveObject(obj) {
      activeObject = obj;
      updateButtons();
    }

    function updateButtons() {
      // set from outside
    }

    return {
      pushState,
      undo,
      redo,
      setActiveObject,
      getActiveObject: () => activeObject,
      hasState,
      setButtons: function(undoBtn, redoBtn) {
        const update = function() {
          if (!activeObject) {
            undoBtn.disabled = true;
            redoBtn.disabled = true;
            return;
          }
          const store = getOrCreateStore(activeObject);
          undoBtn.disabled = (store.index <= 0 || store.stack.length === 0);
          redoBtn.disabled = (store.index >= store.stack.length - 1 || store.stack.length === 0);
        };

        const origUpdate = updateButtons;
        updateButtons = function() {
          update();
        };

        const originalPush = pushState;
        pushState = function(obj) {
          originalPush(obj);
          update();
        };
        const originalUndo = undo;
        undo = function(obj) {
          originalUndo(obj);
          update();
        };
        const originalRedo = redo;
        redo = function(obj) {
          originalRedo(obj);
          update();
        };
        const originalSetActive = setActiveObject;
        setActiveObject = function(obj) {
          originalSetActive(obj);
          update();
        };

        setTimeout(update, 100);
        update();
      }
    };
  }

  // ----- Canvas integration -----
  function attachSnapping(canvasInstance) {
    canvasInstance.on('object:rotating', function (e) {
      const obj = e.target;
      if (!obj) return;
      const originalEvent = e.e || {};
      if (originalEvent.shiftKey) return;
      const snapped = snapAngleValue(obj.angle);
      if (snapped !== obj.angle) {
        obj.angle = snapped;
        obj.setCoords();
        canvasInstance.renderAll();
      }
    });
  }

  function attachToolsMenu(canvasInstance) {
    const menu = createFloatingMenu();
    const {
      angleInput, xInput, yInput, wInput, hInput,
      cwInput, chInput,
      handleCheckbox, undoBtn, redoBtn,
      btnLeft, btnHCenter, btnRight, btnTop, btnVCenter, btnBottom,
      overlayShowCheck, overlayLockCheck, overlayStatus, overlayContent,
      urlInput, opacitySlider, opacityValue, loadBtn, unloadBtn, fileInput,
      expandOverlay
    } = menu;

    const undoManager = createUndoManager();
    undoManager.setButtons(undoBtn, redoBtn);

    let currentTarget = null;
    let suppressInputEvent = false;

    const alignMode = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    };

    function updateSizeFields(obj) {
      const rect = obj.getBoundingRect ? obj.getBoundingRect() : { width: 0, height: 0 };
      const w = rect.width || (obj.width * obj.scaleX) || 0;
      const h = rect.height || (obj.height * obj.scaleY) || 0;
      wInput.value = clampSize(w);
      hInput.value = clampSize(h);
    }

    function updateAlignButtons(hasObj) {
      const disabled = !hasObj;
      btnLeft.disabled = disabled;
      btnHCenter.disabled = disabled;
      btnRight.disabled = disabled;
      btnTop.disabled = disabled;
      btnVCenter.disabled = disabled;
      btnBottom.disabled = disabled;
    }

    function updateDOMCanvasSize() {
      const canvasEl = canvasInstance.lowerCanvasEl || canvasInstance.wrapperEl;
      if (canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        cwInput.value = Math.round(rect.width);
        chInput.value = Math.round(rect.height);
      } else {
        cwInput.value = '?';
        chInput.value = '?';
      }
    }

    function showFor(obj) {
      currentTarget = obj;
      undoManager.setActiveObject(obj);
      updateAlignButtons(true);

      if (!undoManager.hasState(obj)) {
        undoManager.pushState(obj);
      }

      suppressInputEvent = true;
      angleInput.value = clampAngle(obj.angle);
      xInput.value = clampCoord(obj.left);
      yInput.value = clampCoord(obj.top);
      updateSizeFields(obj);
      suppressInputEvent = false;

      updateDOMCanvasSize();
    }

    function hideBox() {
      currentTarget = null;
      undoManager.setActiveObject(null);
      updateAlignButtons(false);
    }

    window._emblemUpdateUI = function(obj) {
      if (obj === currentTarget) {
        suppressInputEvent = true;
        angleInput.value = clampAngle(obj.angle);
        xInput.value = clampCoord(obj.left);
        yInput.value = clampCoord(obj.top);
        updateSizeFields(obj);
        suppressInputEvent = false;
      }
    };

    function alignObject(type) {
      if (!currentTarget) return;
      const obj = currentTarget;
      const canvas = obj.canvas;

      const canvasEl = canvas.lowerCanvasEl || canvas.wrapperEl;
      if (!canvasEl) return;
      const domRect = canvasEl.getBoundingClientRect();
      const domWidth = domRect.width;
      const domHeight = domRect.height;

      const objRect = obj.getBoundingRect ? obj.getBoundingRect() : { width: obj.width * obj.scaleX, height: obj.height * obj.scaleY };
      const objWidth = objRect.width;
      const objHeight = objRect.height;

      const currentRect = obj.getBoundingRect ? obj.getBoundingRect() : { left: obj.left, top: obj.top };
      const currentLeft = currentRect.left || 0;
      const currentTop = currentRect.top || 0;

      let targetPixelX, targetPixelY;

      const isDirection = ['left', 'right', 'top', 'bottom'].includes(type);
      let mode = 0;
      if (isDirection) {
        mode = alignMode[type];
        alignMode[type] = (mode === 0) ? 1 : 0;
      }

      switch(type) {
        case 'left':
          targetPixelX = (mode === 0) ? 0 : -objWidth / 2;
          break;
        case 'right':
          targetPixelX = (mode === 0) ? domWidth - objWidth : domWidth - objWidth / 2;
          break;
        case 'top':
          targetPixelY = (mode === 0) ? 0 : -objHeight / 2;
          break;
        case 'bottom':
          targetPixelY = (mode === 0) ? domHeight - objHeight : domHeight - objHeight / 2;
          break;
        case 'hcenter':
          targetPixelX = (domWidth - objWidth) / 2;
          break;
        case 'vcenter':
          targetPixelY = (domHeight - objHeight) / 2;
          break;
      }

      const steps = 30;
      const stepDelay = 8;
      let currentStep = 0;

      const diffDomX = (targetPixelX !== undefined) ? targetPixelX - currentLeft : 0;
      const diffDomY = (targetPixelY !== undefined) ? targetPixelY - currentTop : 0;

      function doStep() {
        if (currentStep >= steps) {
          obj.setCoords();
          canvas.renderAll();
          canvas.fire('object:modified', { target: obj });
          return;
        }
        currentStep++;
        const stepFabricX = diffDomX / steps;
        const stepFabricY = diffDomY / steps;
        obj.left += stepFabricX;
        obj.top += stepFabricY;
        obj.setCoords();
        canvas.renderAll();
        setTimeout(doStep, stepDelay);
      }
      doStep();
    }

    btnLeft.addEventListener('click', () => alignObject('left'));
    btnHCenter.addEventListener('click', () => alignObject('hcenter'));
    btnRight.addEventListener('click', () => alignObject('right'));
    btnTop.addEventListener('click', () => alignObject('top'));
    btnVCenter.addEventListener('click', () => alignObject('vcenter'));
    btnBottom.addEventListener('click', () => alignObject('bottom'));

    canvasInstance.on('object:selected', function (e) {
      if (e && e.target) {
        showFor(e.target);
      }
    });

    canvasInstance.on('selection:cleared', hideBox);

    canvasInstance.on('object:modified', function(e) {
      const obj = e.target;
      if (!obj) return;

      if (obj === currentTarget) {
        suppressInputEvent = true;
        angleInput.value = clampAngle(obj.angle);
        xInput.value = clampCoord(obj.left);
        yInput.value = clampCoord(obj.top);
        updateSizeFields(obj);
        suppressInputEvent = false;
      }

      undoManager.pushState(obj);
      updateDOMCanvasSize();
    });

    canvasInstance.on('object:moving', function(e) {
      if (e && e.target && e.target === currentTarget) {
        suppressInputEvent = true;
        xInput.value = clampCoord(e.target.left);
        yInput.value = clampCoord(e.target.top);
        suppressInputEvent = false;
      }
    });

    canvasInstance.on('object:scaling', function(e) {
      if (e && e.target && e.target === currentTarget) {
        suppressInputEvent = true;
        updateSizeFields(e.target);
        suppressInputEvent = false;
      }
    });

    canvasInstance.on('object:rotating', function(e) {
      if (e && e.target && e.target === currentTarget) {
        suppressInputEvent = true;
        angleInput.value = clampAngle(e.target.angle);
        suppressInputEvent = false;
      }
    });

    // ----- Manual input handlers -----
    function applyAngleInput() {
      if (suppressInputEvent || !currentTarget) return;
      const newAngle = clampAngle(angleInput.value);
      currentTarget.angle = newAngle;
      currentTarget.setCoords();
      canvasInstance.renderAll();
      canvasInstance.fire('object:modified', { target: currentTarget });
    }
    angleInput.addEventListener('change', applyAngleInput);
    angleInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        applyAngleInput();
        angleInput.blur();
      }
      e.stopPropagation();
    });

    function applyXInput() {
      if (suppressInputEvent || !currentTarget) return;
      const newX = clampCoord(xInput.value);
      currentTarget.left = newX;
      currentTarget.setCoords();
      canvasInstance.renderAll();
      canvasInstance.fire('object:modified', { target: currentTarget });
    }
    xInput.addEventListener('change', applyXInput);
    xInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        applyXInput();
        xInput.blur();
      }
      e.stopPropagation();
    });

    function applyYInput() {
      if (suppressInputEvent || !currentTarget) return;
      const newY = clampCoord(yInput.value);
      currentTarget.top = newY;
      currentTarget.setCoords();
      canvasInstance.renderAll();
      canvasInstance.fire('object:modified', { target: currentTarget });
    }
    yInput.addEventListener('change', applyYInput);
    yInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        applyYInput();
        yInput.blur();
      }
      e.stopPropagation();
    });

    function applyWInput() {
      if (suppressInputEvent || !currentTarget) return;
      const newW = clampSize(wInput.value);
      if (newW <= 0) return;
      const rect = currentTarget.getBoundingRect ? currentTarget.getBoundingRect() : { width: currentTarget.width * currentTarget.scaleX };
      const currentW = rect.width || (currentTarget.width * currentTarget.scaleX) || 1;
      const scaleFactor = newW / currentW;
      currentTarget.scaleX = (currentTarget.scaleX || 1) * scaleFactor;
      currentTarget.setCoords();
      canvasInstance.renderAll();
      canvasInstance.fire('object:modified', { target: currentTarget });
    }
    wInput.addEventListener('change', applyWInput);
    wInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        applyWInput();
        wInput.blur();
      }
      e.stopPropagation();
    });

    function applyHInput() {
      if (suppressInputEvent || !currentTarget) return;
      const newH = clampSize(hInput.value);
      if (newH <= 0) return;
      const rect = currentTarget.getBoundingRect ? currentTarget.getBoundingRect() : { height: currentTarget.height * currentTarget.scaleY };
      const currentH = rect.height || (currentTarget.height * currentTarget.scaleY) || 1;
      const scaleFactor = newH / currentH;
      currentTarget.scaleY = (currentTarget.scaleY || 1) * scaleFactor;
      currentTarget.setCoords();
      canvasInstance.renderAll();
      canvasInstance.fire('object:modified', { target: currentTarget });
    }
    hInput.addEventListener('change', applyHInput);
    hInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        applyHInput();
        hInput.blur();
      }
      e.stopPropagation();
    });

    // ----- Rotate Handle -----
    handleCheckbox.addEventListener('change', function () {
      const enabled = handleCheckbox.checked;
      window.__emblemRotateHandleEnabled = enabled;
      const objects = canvasInstance.getObjects();
      objects.forEach(function (obj) {
        obj.hasRotatingPoint = enabled;
        obj.lockRotation = !enabled;
      });
      canvasInstance.renderAll();
    });

    // ----- Undo / Redo -----
    undoBtn.addEventListener('click', function () {
      if (currentTarget) {
        undoManager.undo(currentTarget);
      }
    });

    redoBtn.addEventListener('click', function () {
      if (currentTarget) {
        undoManager.redo(currentTarget);
      }
    });

    window.addEventListener('resize', updateDOMCanvasSize);
    const pollInterval = setInterval(updateDOMCanvasSize, 500);

    const cleanup = function() {
      clearInterval(pollInterval);
      window.removeEventListener('resize', updateDOMCanvasSize);
    };
    if (!window._emblemCleanup) {
      window._emblemCleanup = [];
    }
    window._emblemCleanup.push(cleanup);

    const active = canvasInstance.getActiveObject && canvasInstance.getActiveObject();
    if (active) showFor(active);
  }

  function patchObject(obj) {
    if (!obj || obj.__rotateFixApplied) return;
    const enabled = window.__emblemRotateHandleEnabled !== undefined ? window.__emblemRotateHandleEnabled : true;
    obj.hasRotatingPoint = enabled;
    obj.lockRotation = !enabled;
    obj.__rotateFixApplied = true;
  }

  function patchCanvas(canvasInstance) {
    if (!canvasInstance || canvasInstance.__rotateFixHooked) return;
    canvasInstance.__rotateFixHooked = true;

    attachSnapping(canvasInstance);
    attachToolsMenu(canvasInstance);

    (canvasInstance._objects || []).forEach(patchObject);
    canvasInstance.renderAll();

    canvasInstance.on('object:added', function (e) {
      if (e && e.target) {
        patchObject(e.target);
        canvasInstance.renderAll();
      }
    });

    console.log(LOG_PREFIX, 'Canvas ready, rotation enabled, snap to', SNAP_ANGLE + '°.', canvasInstance);
    window.dispatchEvent(new CustomEvent('emblem-rotate-fix:active'));
  }

  function installHook() {
    if (typeof window.fabric === 'undefined' || !window.fabric.Canvas) {
      return false;
    }
    if (window.fabric.Canvas.__rotateFixPatched) {
      return true;
    }

    const OriginalCanvas = window.fabric.Canvas;

    function PatchedCanvas(...args) {
      const instance = new OriginalCanvas(...args);
      patchCanvas(instance);
      return instance;
    }
    PatchedCanvas.prototype = OriginalCanvas.prototype;
    PatchedCanvas.prototype.constructor = PatchedCanvas;
    PatchedCanvas.__rotateFixPatched = true;

    Object.keys(OriginalCanvas).forEach(function (key) {
      PatchedCanvas[key] = OriginalCanvas[key];
    });

    window.fabric.Canvas = PatchedCanvas;
    console.log(LOG_PREFIX, 'Hook installed on fabric.Canvas.');
    return true;
  }

  // ----- Start -----
  injectStyles();
  createRefImageOverlay();
  loadRefSettings();

  let attempts = 0;
  const maxAttempts = 100;
  const interval = setInterval(function () {
    attempts++;
    if (installHook() || attempts >= maxAttempts) {
      clearInterval(interval);
      if (attempts >= maxAttempts) {
        console.warn(LOG_PREFIX, 'fabric.js not found within the waiting time.');
      }
    }
  }, 200);
})();