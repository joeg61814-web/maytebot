// ============================================================
// chat-colors.js — Personalización de colores del chat
// ============================================================
'use strict';

const COLOR_STORAGE_KEY = 'mp_chat_colors';

const COLOR_PRESETS = {
    rosa:     { rose: '#d4547a', gold: '#c9923a', label: '🌸 Rosa' },
    morado:   { rose: '#9b59b6', gold: '#e056fd', label: '💜 Morado' },
    azul:     { rose: '#4a90d9', gold: '#67b8e3', label: '💙 Azul' },
    verde:    { rose: '#2ecc71', gold: '#27ae60', label: '💚 Verde' },
    coral:    { rose: '#ff6b6b', gold: '#ffa07a', label: '🧡 Coral' },
    atardecer:{ rose: '#e74c3c', gold: '#f39c12', label: '🌅 Atardecer' }
};

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shadeColor(hex, pct) {
    const { r, g, b } = hexToRgb(hex);
    const t = pct < 0 ? 0 : 255;
    const p = Math.abs(pct);
    const nr = Math.round((t - r) * p + r);
    const ng = Math.round((t - g) * p + g);
    const nb = Math.round((t - b) * p + b);
    return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

window.applyChatColors = function(rose, gold) {
    const saved = getSavedColors();
    const r = rose || saved.rose || '#d4547a';
    const g = gold || saved.gold || '#c9923a';
    const root = document.documentElement;

    root.style.setProperty('--rose', r);
    root.style.setProperty('--gold', g);
    root.style.setProperty('--rose-deep', shadeColor(r, -0.25));
    root.style.setProperty('--rose-light', shadeColor(r, 0.35));
    root.style.setProperty('--rose-glow', `rgba(${hexToRgb(r).r},${hexToRgb(r).g},${hexToRgb(r).b},0.5)`);
    root.style.setProperty('--gold-light', shadeColor(g, 0.4));
    root.style.setProperty('--gold-glow', `rgba(${hexToRgb(g).r},${hexToRgb(g).g},${hexToRgb(g).b},0.5)`);
    root.style.setProperty('--border', `rgba(${hexToRgb(r).r},${hexToRgb(r).g},${hexToRgb(r).b},0.15)`);

    syncColorInputs(r, g);
};

function getSavedColors() {
    try { return JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY)) || {}; }
    catch (_) { return {}; }
}

function saveColors(rose, gold) {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify({ rose, gold }));
}

function syncColorInputs(rose, gold) {
    const p = document.getElementById('colorPrimary');
    const s = document.getElementById('colorSecondary');
    if (p) p.value = rose;
    if (s) s.value = gold;
    document.querySelectorAll('.color-preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rose === rose && btn.dataset.gold === gold);
    });
}

window.selectColorPreset = function(key) {
    const preset = COLOR_PRESETS[key];
    if (!preset) return;
    saveColors(preset.rose, preset.gold);
    window.applyChatColors(preset.rose, preset.gold);
    if (typeof showToastMsg === 'function') {
        const msg = window.getTranslation ? window.getTranslation('colorsSaved') : 'Colores guardados ✨';
        showToastMsg(msg, 'success');
    }
};

window.onColorChange = function() {
    const rose = document.getElementById('colorPrimary')?.value;
    const gold = document.getElementById('colorSecondary')?.value;
    if (!rose || !gold) return;
    saveColors(rose, gold);
    window.applyChatColors(rose, gold);
};

window.resetChatColors = function() {
    localStorage.removeItem(COLOR_STORAGE_KEY);
    window.applyChatColors('#d4547a', '#c9923a');
    if (typeof showToastMsg === 'function') {
        const msg = window.getTranslation ? window.getTranslation('colorsReset') : 'Colores restaurados';
        showToastMsg(msg, 'success');
    }
};

window.initChatColors = function() {
    const saved = getSavedColors();
    window.applyChatColors(saved.rose, saved.gold);

    const wrap = document.getElementById('colorPresets');
    if (wrap && !wrap.children.length) {
        Object.entries(COLOR_PRESETS).forEach(([key, p]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-preset-btn';
            btn.dataset.rose = p.rose;
            btn.dataset.gold = p.gold;
            btn.style.background = `linear-gradient(135deg, ${p.rose}, ${p.gold})`;
            btn.title = p.label;
            btn.onclick = () => window.selectColorPreset(key);
            wrap.appendChild(btn);
        });
    }
};

(function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initChatColors);
    } else {
        window.initChatColors();
    }
})();
