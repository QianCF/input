(function() {
    'use strict';
    let _width = 0;
    let _height = 0;
    let _container = null;
    let _pixels = [];       // 真实 DOM：二维数组，每个元素为 div
    let _bufferA = [];      // A 缓冲：与真实 DOM 一致，每像素 [r,g,b]
    let _bufferB = [];      // B 缓冲：绘制时只写入此缓冲，每像素 [r,g,b]
    function _checkInitialized() {
        if (!_container || _pixels.length === 0) {
            throw new Error('createScr must be called first');
        }
    }
    function _clampColor(c) {
        return Math.max(0, Math.min(255, Math.round(c)));
    }
    function _clampCoord(x, y) {
        const cx = Math.max(0, Math.min(_width - 1, Math.floor(x)));
        const cy = Math.max(0, Math.min(_height - 1, Math.floor(y)));
        return { x: cx, y: cy };
    }
    function _rgbToCss(r, g, b) {
        return `rgb(${r}, ${g}, ${b})`;
    }
    function _updateViewportHeightPx() {
        document.documentElement.style.setProperty('--viewport-height-px', window.innerHeight + 'px');
    }
    window.createScr = function(horizontalPoints, verticalPoints) {
        if (!Number.isInteger(horizontalPoints) || horizontalPoints <= 0 ||
            !Number.isInteger(verticalPoints) || verticalPoints <= 0) {
            throw new Error('Dimensions must be positive integers');
        }
        _width = horizontalPoints;
        _height = verticalPoints;
        _updateViewportHeightPx();
        window.addEventListener('resize', _updateViewportHeightPx);
        document.body.innerHTML = '';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.backgroundColor = '#ffffffff';
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';
        document.body.style.minHeight = 'var(--viewport-height-px)';
        document.body.style.width = '100vw';
        document.body.style.overflow = 'hidden';
        _container = document.createElement('div');
        _container.style.display = 'grid';
        _container.style.gridTemplateColumns = `repeat(${_width}, 1fr)`;
        _container.style.gridTemplateRows = `repeat(${_height}, 1fr)`;
        _container.style.backgroundColor = 'white';
        _container.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
        _container.style.maxWidth = '100vw';
        _container.style.maxHeight = 'var(--viewport-height-px)';
        _container.style.aspectRatio = `${_width} / ${_height}`;
        _container.style.width = `min(100vw, calc(var(--viewport-height-px) * ${_width} / ${_height}))`;
        _container.style.height = 'auto';
        _pixels = [];
        _bufferA = [];
        _bufferB = [];
        const white = [255, 255, 255];
        for (let y = 0; y < _height; y++) {
            const row = [];
            const rowA = [];
            const rowB = [];
            for (let x = 0; x < _width; x++) {
                const pixel = document.createElement('div');
                pixel.style.width = '100%';
                pixel.style.height = '100%';
                pixel.style.backgroundColor = 'rgb(255, 255, 255)';
                pixel.style.boxSizing = 'border-box';
                pixel.dataset.x = x;
                pixel.dataset.y = y;
                _container.appendChild(pixel);
                row.push(pixel);
                rowA.push(white.slice());
                rowB.push(white.slice());
            }
            _pixels.push(row);
            _bufferA.push(rowA);
            _bufferB.push(rowB);
        }
        document.body.appendChild(_container);
    };
    window.setScr1 = function(x, y, horizontalPoints, verticalPoints, R, G, B) {
        _checkInitialized();
        const r = _clampColor(R);
        const g = _clampColor(G);
        const b = _clampColor(B);
        const startX = Math.max(0, Math.floor(x));
        const endX = Math.min(_width - 1, Math.floor(x) + horizontalPoints - 1);
        const startY = Math.max(0, Math.floor(y));
        const endY = Math.min(_height - 1, Math.floor(y) + verticalPoints - 1);
        for (let cy = startY; cy <= endY; cy++) {
            const rowB = _bufferB[cy];
            for (let cx = startX; cx <= endX; cx++) {
                rowB[cx][0] = r;
                rowB[cx][1] = g;
                rowB[cx][2] = b;
            }
        }
    };
    window.setScr2 = function(x1, y1, x2, y2, R, G, B) {
        _checkInitialized();
        const r = _clampColor(R);
        const g = _clampColor(G);
        const b = _clampColor(B);
        const minX = Math.min(Math.floor(x1), Math.floor(x2));
        const maxX = Math.max(Math.floor(x1), Math.floor(x2));
        const minY = Math.min(Math.floor(y1), Math.floor(y2));
        const maxY = Math.max(Math.floor(y1), Math.floor(y2));
        const startX = Math.max(0, minX);
        const endX = Math.min(_width - 1, maxX);
        const startY = Math.max(0, minY);
        const endY = Math.min(_height - 1, maxY);
        for (let y = startY; y <= endY; y++) {
            const rowB = _bufferB[y];
            for (let x = startX; x <= endX; x++) {
                rowB[x][0] = r;
                rowB[x][1] = g;
                rowB[x][2] = b;
            }
        }
    };
    window.getScr = function(x, y) {
        _checkInitialized();
        const { x: cx, y: cy } = _clampCoord(x, y);
        const rgb = _bufferB[cy][cx];
        return [rgb[0], rgb[1], rgb[2]];
    };

    /**
     * 确认缓冲：对比 A 与 B，将颜色不同的像素更新到真实 DOM，然后用 B 覆盖 A。
     * 调用后 A 缓冲与真实 DOM 一致。
     */
    window.confirmScr = function() {
        _checkInitialized();
        for (let y = 0; y < _height; y++) {
            const rowA = _bufferA[y];
            const rowB = _bufferB[y];
            const rowPixels = _pixels[y];
            for (let x = 0; x < _width; x++) {
                const a = rowA[x];
                const b = rowB[x];
                if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) {
                    rowPixels[x].style.backgroundColor = _rgbToCss(b[0], b[1], b[2]);
                    rowA[x][0] = b[0];
                    rowA[x][1] = b[1];
                    rowA[x][2] = b[2];
                }
            }
        }
    };
})();