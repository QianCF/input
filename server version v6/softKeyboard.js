// softKeyboard.js
// 软键盘：在屏幕初始化完成后调用 initSoftKeyboard()，通过派发 keydown 事件与编辑器交互。
// Shift/Ctrl 为点击切换状态，并影响所有 keydown 的 shiftKey/ctrlKey。

(function() {
    'use strict';

    let _softShift = false;
    let _softCtrl = false;
    let _keyboardEl = null;
    let _keyboardOverlay = null;
    let _keyboardVisible = false;
    let _shiftBtn = null;
    let _ctrlBtn = null;
    let _screenViewport = null;  // 包裹屏幕的容器，用于根据键盘开闭调整高度
    let _keyboardHeightVh = 30;   // 当前键盘高度 30 或 60
    let _resizeObserver = null;

    // 左侧 4 行：数字 + QWERTY 三行
    const LEFT_ROWS = [
        [
            { key: '1', code: 'Digit1', shiftKey: '!' },
            { key: '2', code: 'Digit2', shiftKey: '@' },
            { key: '3', code: 'Digit3', shiftKey: '#' },
            { key: '4', code: 'Digit4', shiftKey: '$' },
            { key: '5', code: 'Digit5', shiftKey: '%' },
            { key: '6', code: 'Digit6', shiftKey: '^' },
            { key: '7', code: 'Digit7', shiftKey: '&' },
            { key: '8', code: 'Digit8', shiftKey: '*' },
            { key: '9', code: 'Digit9', shiftKey: '(' },
            { key: '0', code: 'Digit0', shiftKey: ')' },
        ],
        [
            { key: 'q', code: 'KeyQ', shiftKey: 'Q' },
            { key: 'w', code: 'KeyW', shiftKey: 'W' },
            { key: 'e', code: 'KeyE', shiftKey: 'E' },
            { key: 'r', code: 'KeyR', shiftKey: 'R' },
            { key: 't', code: 'KeyT', shiftKey: 'T' },
            { key: 'y', code: 'KeyY', shiftKey: 'Y' },
            { key: 'u', code: 'KeyU', shiftKey: 'U' },
            { key: 'i', code: 'KeyI', shiftKey: 'I' },
            { key: 'o', code: 'KeyO', shiftKey: 'O' },
            { key: 'p', code: 'KeyP', shiftKey: 'P' },
        ],
        [
            { key: 'a', code: 'KeyA', shiftKey: 'A' },
            { key: 's', code: 'KeyS', shiftKey: 'S' },
            { key: 'd', code: 'KeyD', shiftKey: 'D' },
            { key: 'f', code: 'KeyF', shiftKey: 'F' },
            { key: 'g', code: 'KeyG', shiftKey: 'G' },
            { key: 'h', code: 'KeyH', shiftKey: 'H' },
            { key: 'j', code: 'KeyJ', shiftKey: 'J' },
            { key: 'k', code: 'KeyK', shiftKey: 'K' },
            { key: 'l', code: 'KeyL', shiftKey: 'L' },
        ],
        [
            { key: 'z', code: 'KeyZ', shiftKey: 'Z' },
            { key: 'x', code: 'KeyX', shiftKey: 'X' },
            { key: 'c', code: 'KeyC', shiftKey: 'C' },
            { key: 'v', code: 'KeyV', shiftKey: 'V' },
            { key: 'b', code: 'KeyB', shiftKey: 'B' },
            { key: 'n', code: 'KeyN', shiftKey: 'N' },
            { key: 'm', code: 'KeyM', shiftKey: 'M' },
        ],
    ];
    // 右侧 4 行：符号/空格、导航键、方向键、修饰与回车等
    const RIGHT_ROWS = [
        [
            { key: ',', code: 'Comma', shiftKey: '<' },
            { key: '.', code: 'Period', shiftKey: '>' },
            { key: '/', code: 'Slash', shiftKey: '?' },
            { key: ';', code: 'Semicolon', shiftKey: ':' },
            { key: "'", code: 'Quote', shiftKey: '"' },
            { key: '[', code: 'BracketLeft', shiftKey: '{' },
            { key: ']', code: 'BracketRight', shiftKey: '}' },
            { key: '-', code: 'Minus', shiftKey: '_' },
            { key: '=', code: 'Equal', shiftKey: '+' },
            { key: '\\', code: 'Backslash', shiftKey: '|' },
        ],
        [
            { key: ' ', code: 'Space', shiftKey: null, label: 'space' },
            { key: 'Home', code: 'Home', shiftKey: null, label: 'Home' },
            { key: 'End', code: 'End', shiftKey: null, label: 'End' },
            { key: 'PageUp', code: 'PageUp', shiftKey: null, label: 'PgUp' },
            { key: 'PageDown', code: 'PageDown', shiftKey: null, label: 'PgDn' },
        ],
        [
            { key: 'Insert', code: 'Insert', shiftKey: null, label: 'Ins' },
            { key: 'Delete', code: 'Delete', shiftKey: null, label: 'Del' },
            { key: 'ArrowLeft', code: 'ArrowLeft', shiftKey: null, label: '←' },
            { key: 'ArrowUp', code: 'ArrowUp', shiftKey: null, label: '↑' },
            { key: 'ArrowDown', code: 'ArrowDown', shiftKey: null, label: '↓' },
            { key: 'ArrowRight', code: 'ArrowRight', shiftKey: null, label: '→' },
        ],
        [
            { special: 'Shift', label: 'Shift' },
            { special: 'Ctrl', label: 'Ctrl' },
            { key: 'Backspace', code: 'Backspace', shiftKey: null, label: 'bak' },
            { key: 'Enter', code: 'Enter', shiftKey: null, label: 'Enter' },
            { key: 'Escape', code: 'Escape', shiftKey: null, label: 'Esc' },
        ],
    ];

    function getDisplayLabel(opt) {
        if (opt.label) return opt.label;
        if (opt.shiftKey != null) return opt.key + (opt.shiftKey ? '\n' + opt.shiftKey : '');
        return opt.key;
    }

    function getEffectiveKey(opt) {
        if (opt.special) return null;
        if (opt.shiftKey != null && _softShift) return opt.shiftKey;
        return opt.key;
    }

    function dispatchKeydown(key, code) {
        const e = new KeyboardEvent('keydown', {
            key: key,
            code: code,
            shiftKey: _softShift,
            ctrlKey: _softCtrl,
            metaKey: false,
            bubbles: true,
        });
        window.dispatchEvent(e);
    }

    function updateModifierStyles() {
        if (_shiftBtn) {
            _shiftBtn.classList.toggle('soft-keyboard-modifier-active', _softShift);
        }
        if (_ctrlBtn) {
            _ctrlBtn.classList.toggle('soft-keyboard-modifier-active', _softCtrl);
        }
    }

    function createKeyEl(opt) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'soft-keyboard-key';

        if (opt.special === 'Shift') {
            _shiftBtn = btn;
            btn.textContent = 'Shift';
            btn.addEventListener('click', function() {
                _softShift = !_softShift;
                updateModifierStyles();
            });
            return btn;
        }
        if (opt.special === 'Ctrl') {
            _ctrlBtn = btn;
            btn.textContent = 'Ctrl';
            btn.addEventListener('click', function() {
                _softCtrl = !_softCtrl;
                updateModifierStyles();
            });
            return btn;
        }

        const label = getDisplayLabel(opt);
        if (opt.shiftKey != null && opt.key !== opt.shiftKey) {
            const main = document.createElement('span');
            main.className = 'soft-keyboard-key-main';
            main.textContent = opt.key;
            const sub = document.createElement('span');
            sub.className = 'soft-keyboard-key-shift';
            sub.textContent = opt.shiftKey;
            btn.appendChild(sub);
            btn.appendChild(main);
        } else {
            btn.textContent = label;
        }

        btn.addEventListener('click', function() {
            const key = getEffectiveKey(opt);
            if (key == null) return;
            dispatchKeydown(key, opt.code);
        });

        return btn;
    }

    function buildPanel(rows) {
        const panel = document.createElement('div');
        panel.className = 'soft-keyboard-panel';
        rows.forEach(function(row) {
            const rowEl = document.createElement('div');
            rowEl.className = 'soft-keyboard-row';
            row.forEach(function(opt) {
                const keyEl = createKeyEl(opt);
                if (opt.label && opt.label.length > 1) keyEl.classList.add('soft-keyboard-key-wide');
                rowEl.appendChild(keyEl);
            });
            panel.appendChild(rowEl);
        });
        return panel;
    }

    function buildKeyboard() {
        const style = document.createElement('style');
        style.textContent = [
            '.soft-keyboard-toggle {',
            '  position: fixed; top: 8px; left: 8px; z-index: 1000;',
            '  width: 40px; height: 40px;',
            '  border: 1px solid #666; border-radius: 6px;',
            '  background: rgba(232,232,232,0.1); color: #333;',
            '  cursor: pointer; user-select: none;',
            '  font-size: 18px; font-family: sans-serif;',
            '  display: flex; align-items: center; justify-content: center;',
            '  box-shadow: 0 1px 4px rgba(0,0,0,0.2);',
            '}',
            '.soft-keyboard-toggle:hover { background: rgba(221,221,221,0.1); }',
            '.soft-keyboard-toggle.active { background: rgba(160,200,255,0.1); border-color: #4488dd; }',
            '.soft-keyboard-overlay {',
            '  position: fixed; left: 0; right: 0; bottom: 0;',
            '  z-index: 999; display: none;',
            '  flex-direction: column; align-items: center; justify-content: center;',
            '  background: rgba(230,230,230,0.1); backdrop-filter: blur(6px);',
            '  box-sizing: border-box; padding: 0;',
            '}',
            '.soft-keyboard-overlay.visible { display: flex; }',
            '.soft-keyboard-area {',
            '  width: 90%; height: 90%;',
            '  display: flex; flex-direction: row; gap: 8px;',
            '  align-items: stretch; justify-content: center;',
            '  box-sizing: border-box; min-height: 0; min-width: 0;',
            '}',
            '.soft-keyboard-area.vertical { flex-direction: column; }',
            '.soft-keyboard-panel {',
            '  flex: 1 1 0; min-width: 0; min-height: 0;',
            '  display: flex; flex-direction: column; gap: 4px;',
            '}',
            '.soft-keyboard-row {',
            '  flex: 1 1 0; min-height: 0; display: flex; flex-wrap: nowrap; gap: 4px;',
            '  align-items: stretch; justify-content: center;',
            '}',
            '.soft-keyboard-key {',
            '  flex: 1 1 0; min-width: 0; min-height: 0;',
            '  padding: 2px; font-family: sans-serif;',
            '  font-size: var(--soft-key-font-size, 12px);',
            '  border: 1px solid #888; border-radius: 4px;',
            '  background: rgba(245,245,245,0.1); color: #222;',
            '  cursor: pointer; user-select: none;',
            '  display: inline-flex; align-items: center; justify-content: center;',
            '  position: relative;',
            '}',
            '.soft-keyboard-key:hover { background: rgba(224,224,224,0.9); }',
            '.soft-keyboard-key:active { background: rgba(204,204,204,0.1); }',
            '.soft-keyboard-key-main { font-size: inherit; }',
            '.soft-keyboard-key-shift {',
            '  position: absolute; top: 2px; left: 50%; transform: translateX(-50%);',
            '  font-size: var(--soft-key-font-size-shift, 0.5em); color: #666;',
            '}',
            '.soft-keyboard-modifier-active { background: rgba(160,200,255,0.2) !important; border-color: #4488dd; }',
            '.soft-keyboard-key-wide { flex: 1.2 1 0; }',
            '.soft-keyboard-key-space { flex: 2 1 0; }',
            '.soft-keyboard-screen-viewport {',
            '  align-self: flex-start; cursor: pointer;',
            '  display: flex; align-items: center; justify-content: center;',
            '  min-height: var(--viewport-height-px, 100vh); width: 100%; box-sizing: border-box;',
            '  overflow: hidden;',
            '}',
        ].join('\n');
        document.head.appendChild(style);

        const area = document.createElement('div');
        area.className = 'soft-keyboard-area';
        area.appendChild(buildPanel(LEFT_ROWS));
        area.appendChild(buildPanel(RIGHT_ROWS));
        return area;
    }

    /** 若键盘区域宽高比 < 4:1 则用 60vh + 上下布局，否则 30vh + 左右布局 */
    function shouldUseVerticalLayout() {
        const w = window.innerWidth;
        const h30 = window.innerHeight * 0.3;
        return w / h30 < 4;
    }

    function updateKeyboardLayout() {
        if (!_keyboardOverlay || !_keyboardEl) return;
        const vertical = shouldUseVerticalLayout();
        _keyboardHeightVh = vertical ? 60 : 30;
        const px = Math.round(window.innerHeight * _keyboardHeightVh / 100);
        _keyboardOverlay.style.height = px + 'px';
        _keyboardEl.classList.toggle('vertical', vertical);
    }

    function restoreScreenFullViewport(screenEl) {
        if (!screenEl) return;
        screenEl.style.maxHeight = 'var(--viewport-height-px)';
        screenEl.style.maxWidth = '100vw';
        var ar = screenEl.style.aspectRatio;
        if (ar) {
            var m = ar.match(/(\d+)\s*\/\s*(\d+)/);
            if (m) {
                var ratio = parseFloat(m[1]) / parseFloat(m[2]);
                screenEl.style.width = 'min(100vw, calc(var(--viewport-height-px) * ' + ratio + '))';
                screenEl.style.height = 'auto';
            }
        }
    }

    function getScreenAspectRatio(screenEl) {
        if (!screenEl) return null;
        var ar = screenEl.style.aspectRatio;
        if (!ar) return null;
        var m = ar.match(/(\d+)\s*\/\s*(\d+)/);
        return m ? parseFloat(m[1]) / parseFloat(m[2]) : null;
    }

    function updateScreenViewportHeight() {
        if (!_screenViewport) return;
        const screenEl = _screenViewport.firstElementChild;
        const viewportPx = window.innerHeight;
        if (_keyboardVisible) {
            const restPx = Math.round(viewportPx * (100 - _keyboardHeightVh) / 100);
            _screenViewport.style.minHeight = restPx + 'px';
            _screenViewport.style.height = restPx + 'px';
            if (screenEl) {
                var ratio = getScreenAspectRatio(screenEl);
                if (ratio != null) {
                    var maxW = Math.round(restPx * ratio);
                    screenEl.style.width = 'min(100%, ' + maxW + 'px)';
                    screenEl.style.height = 'auto';
                }
                screenEl.style.maxHeight = '100%';
                screenEl.style.maxWidth = '100%';
            }
        } else {
            _screenViewport.style.minHeight = 'var(--viewport-height-px)';
            _screenViewport.style.height = '';
            if (screenEl) restoreScreenFullViewport(screenEl);
        }
    }

    /** 按单个按键高度设置字号：主字符 = 键高 1/3，上标 = 键高 1/5 */
    function updateKeyFontSize() {
        if (!_keyboardEl || !_keyboardVisible) return;
        const key = _keyboardEl.querySelector('.soft-keyboard-key');
        const keyHeight = key ? key.clientHeight : 0;
        if (keyHeight <= 0) {
            requestAnimationFrame(updateKeyFontSize);
            return;
        }
        const mainSize = keyHeight / 3;
        const shiftSize = keyHeight / 5;
        _keyboardEl.style.setProperty('--soft-key-font-size', mainSize + 'px');
        _keyboardEl.style.setProperty('--soft-key-font-size-shift', shiftSize + 'px');
    }

    function onKeyboardToggle() {
        _keyboardVisible = !_keyboardVisible;
        _keyboardOverlay.classList.toggle('visible', _keyboardVisible);
        if (_keyboardVisible) {
            updateKeyboardLayout();
            updateKeyFontSize();
            _resizeObserver = new ResizeObserver(function() {
                updateKeyFontSize();
            });
            _resizeObserver.observe(_keyboardEl);
        } else {
            if (_resizeObserver && _keyboardEl) {
                _resizeObserver.disconnect();
                _resizeObserver = null;
            }
        }
        updateScreenViewportHeight();
    }

    function onWindowResize() {
        if (!_keyboardVisible) return;
        updateKeyboardLayout();
        updateScreenViewportHeight();
        updateKeyFontSize();
    }

    /**
     * 在屏幕初始化完成后调用。点击屏幕区域(soft-keyboard-screen-viewport)切换软键盘开关；键盘 30vh 或 60vh 悬浮底部；屏幕区域占剩余高度并保持宽高比；按键字体随键盘区域自适应。
     */
    window.initSoftKeyboard = function() {
        const body = document.body;
        const screen = body.firstElementChild;

        if (screen) {
            _screenViewport = document.createElement('div');
            _screenViewport.className = 'soft-keyboard-screen-viewport';
            _screenViewport.setAttribute('aria-label', '点击打开/关闭软键盘');
            _screenViewport.addEventListener('click', function(e) {
                e.preventDefault();
                onKeyboardToggle();
            });
            screen.classList.add('soft-keyboard-screen-inner');
            body.removeChild(screen);
            _screenViewport.appendChild(screen);
            body.insertBefore(_screenViewport, body.firstChild);
        }

        _keyboardEl = buildKeyboard();
        _keyboardOverlay = document.createElement('div');
        _keyboardOverlay.className = 'soft-keyboard-overlay';
        _keyboardOverlay.appendChild(_keyboardEl);

        window.addEventListener('resize', onWindowResize);

        body.appendChild(_keyboardOverlay);
    };
})();
