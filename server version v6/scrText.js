// scrText.js
// 依赖Scr.js提供的屏幕操作API

(function() {
    'use strict';
    
    // 内部状态
    let _fontLoaded = false;
    let _fontFamily = 'monospace';
    let _canvas = null;
    let _ctx = null;
    
    /**
     * 加载Unifont字体
     * @param {string} fontUrl - Unifont字体文件的URL
     * @returns {Promise} 加载完成的Promise
     */
    window.loadScrfont = function(fontUrl) {
        return new Promise(async (resolve, reject) => {
            try {
                // 创建隐藏canvas用于字体测量
                _canvas = document.createElement('canvas');
                _canvas.width = 100;
                _canvas.height = 50;
                _canvas.style.position = 'absolute';
                _canvas.style.visibility = 'hidden';
                document.body.appendChild(_canvas);
                _ctx = _canvas.getContext('2d');
                
                // 使用XMLHttpRequest下载字体
                const xhr = new XMLHttpRequest();
                xhr.open('GET', fontUrl, true);
                xhr.responseType = 'blob';
                
                xhr.addEventListener('load', async function() {
                    if (xhr.status === 200) {
                        try {
                            const fontBlob = xhr.response;
                            const fontUrl = URL.createObjectURL(fontBlob);
                            const fontFace = new FontFace('Unifont', `url(${fontUrl})`);
                            
                            const loadedFont = await fontFace.load();
                            document.fonts.add(loadedFont);
                            await document.fonts.ready;
                            
                            _fontLoaded = true;
                            _fontFamily = 'Unifont, monospace';
                            
                            // 测试字体是否可用
                            _ctx.font = '16px ' + _fontFamily;
                            _ctx.fillText('测试', 10, 10);
                            
                            resolve();
                        } catch (error) {
                            console.error('字体应用失败:', error);
                            _fontLoaded = false;
                            reject(new Error('字体加载失败: ' + error.message));
                        }
                    } else {
                        reject(new Error('字体下载失败，HTTP状态: ' + xhr.status));
                    }
                });
                
                xhr.addEventListener('error', function() {
                    reject(new Error('字体下载失败，网络错误'));
                });
                
                xhr.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        // 可以通过自定义事件或回调通知进度
                        const event = new CustomEvent('fontloadprogress', { 
                            detail: { loaded: e.loaded, total: e.total, percent: percent }
                        });
                        window.dispatchEvent(event);
                    }
                });
                
                xhr.send();
                
            } catch (error) {
                _fontLoaded = false;
                reject(new Error('字体加载初始化失败: ' + error.message));
            }
        });
    };
    
    /**
     * 检查字体是否已加载
     * @private
     */
    function _checkFontLoaded() {
        if (!_fontLoaded) {
            throw new Error('loadScrfont must be called first');
        }
    }
    
    /**
     * 检查屏幕是否已创建
     * @private
     */
    function _checkScreenCreated() {
        if (typeof window.getScr !== 'function') {
            throw new Error('createScr must be called first');
        }
        
        // 尝试获取一个像素来验证屏幕是否真的存在
        try {
            window.getScr(0, 0);
        } catch (e) {
            throw new Error('createScr must be called first');
        }
    }
    
    /**
     * 获取文本的点阵信息
     * @param {string} text - 要转换的文本
     * @param {number} scale - 放大倍数（正整数）
     * @returns {Array} [宽度, 高度] - 点阵的宽度和高度（像素点数量）
     */
    window.getScrText = function(text, scale) {
        _checkFontLoaded();
        
        if (typeof text !== 'string') {
            throw new Error('Text must be a string');
        }
        
        if (!Number.isInteger(scale) || scale <= 0) {
            throw new Error('Scale must be a positive integer');
        }
        
        // 测量文本尺寸
        _ctx.font = '16px ' + _fontFamily;
        const metrics = _ctx.measureText(text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = 16; // 16px字体高度
        
        // 返回点阵尺寸（放大后的像素点数量）
        return [textWidth * scale, textHeight * scale];
    };
    
    /**
     * 将文本绘制到屏幕上
     * @param {string} text - 要绘制的文本
     * @param {number} startX - 起始X坐标（屏幕像素坐标）
     * @param {number} startY - 起始Y坐标（屏幕像素坐标）
     * @param {number} scale - 放大倍数（正整数）
     * @param {number} rText - 文字颜色R分量 (0-255)
     * @param {number} gText - 文字颜色G分量 (0-255)
     * @param {number} bText - 文字颜色B分量 (0-255)
     * @param {number} rBg - 背景颜色R分量 (0-255)
     * @param {number} gBg - 背景颜色G分量 (0-255)
     * @param {number} bBg - 背景颜色B分量 (0-255)
     */
    window.setScrText = function(text, startX, startY, scale, rText, gText, bText, rBg, gBg, bBg) {
        _checkFontLoaded();
        _checkScreenCreated();
        
        // 参数验证
        if (typeof text !== 'string') {
            throw new Error('Text must be a string');
        }
        
        if (!Number.isInteger(scale) || scale <= 0) {
            throw new Error('Scale must be a positive integer');
        }
        
        // 颜色值验证和钳位
        const clampColor = (c) => Math.max(0, Math.min(255, Math.round(c)));
        rText = clampColor(rText);
        gText = clampColor(gText);
        bText = clampColor(bText);
        rBg = clampColor(rBg);
        gBg = clampColor(gBg);
        bBg = clampColor(bBg);
        
        // 创建临时canvas绘制文本
        _ctx.font = '16px ' + _fontFamily;
        const metrics = _ctx.measureText(text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = 16;
        // 避免 0 宽/0 高导致 getImageData 报错（如 U+FFFC 等）
        const drawWidth = Math.max(1, textWidth);
        const drawHeight = Math.max(1, textHeight);
        
        const canvas = document.createElement('canvas');
        canvas.width = drawWidth;
        canvas.height = drawHeight;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, drawWidth, drawHeight);
        
        ctx.font = '16px ' + _fontFamily;
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'top';
        ctx.fillText(text, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, drawWidth, drawHeight);
        const data = imageData.data;
        
        // 生成点阵信息
        const bitmap = [];
        for (let y = 0; y < drawHeight; y++) {
            bitmap[y] = [];
            for (let x = 0; x < drawWidth; x++) {
                const index = (y * drawWidth + x) * 4;
                const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
                bitmap[y][x] = gray < 128 ? 1 : 0;
            }
        }
        
        // 逐行扫描，合并连续相同颜色的点
        for (let y = 0; y < drawHeight; y++) {
            let x = 0;
            while (x < drawWidth) {
                // 确定当前点的颜色类型
                const isTextDot = bitmap[y][x] === 1;
                let runLength = 1;
                
                // 找出连续相同颜色的长度
                while (x + runLength < drawWidth && bitmap[y][x + runLength] === (isTextDot ? 1 : 0)) {
                    runLength++;
                }
                
                // 计算在屏幕上的实际坐标和尺寸
                const screenX = startX + x * scale;
                const screenY = startY + y * scale;
                const width = runLength * scale;
                const height = scale;
                
                // 选择颜色
                const r = isTextDot ? rText : rBg;
                const g = isTextDot ? gText : gBg;
                const b = isTextDot ? bText : bBg;
                
                // 使用setScr2绘制矩形
                // 注意：setScr2使用浮点数坐标，会自动处理边界
                window.setScr2(
                    screenX, screenY,
                    screenX + width - 1, screenY + height - 1,
                    r, g, b
                );
                
                x += runLength;
            }
        }
    };
    
    /**
     * 获取字体加载状态
     * @returns {boolean} 字体是否已加载
     */
    window.isScrfontLoaded = function() {
        return _fontLoaded;
    };
    
    /**
     * 清理资源
     */
    window.cleanupScrText = function() {
        if (_canvas && _canvas.parentNode) {
            _canvas.parentNode.removeChild(_canvas);
        }
        _canvas = null;
        _ctx = null;
        _fontLoaded = false;
    };
})();