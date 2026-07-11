// ============================================================
// main.js — MaytePremium · Acceso directo al chat
// ============================================================
'use strict';

window.currentUser         = null;
window.conversationHistory = [];
window.currentIdioma       = 'es';
window.currentUserData     = null;

const GUEST_USER = {
    username: 'invitado',
    tokens:   9999,
    msgs:     0,
    idioma:   'es',
    guest:    true
};

// ── MODO OSCURO ─────────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem('mp_theme') || 'light';
    applyTheme(saved);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        applyTheme(isDark ? 'light' : 'dark');
    });
})();

function applyTheme(mode) {
    const body = document.body;
    const btn  = document.getElementById('themeToggle');
    if (mode === 'dark') {
        body.classList.add('dark');
        if (btn) btn.textContent = '☀️';
    } else {
        body.classList.remove('dark');
        if (btn) btn.textContent = '🌙';
    }
    localStorage.setItem('mp_theme', mode);
}

// ── MODALES ──────────────────────────────────────────────────
window.openModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
};
window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
};
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
    }
});

function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.className = 'toast', 3200);
}
window.showToastMsg = showToast;

// ── ENTRAR AL CHAT ────────────────────────────────────────────
function enterApp(user) {
    window.currentUser     = user.username;
    const idioma = localStorage.getItem('mp_lang') || user.idioma || 'es';
    window.currentIdioma   = idioma;
    user.idioma            = idioma;
    window.currentUserData = user;

    const shell = document.getElementById('appShell');
    if (shell) shell.style.display = 'flex';

    if (typeof window.translateUI === 'function') window.translateUI(idioma);

    const tok = document.getElementById('tokenPill');
    if (tok) tok.textContent = user.guest ? '∞' : `${user.tokens ?? 0} msgs`;

    if (typeof window.initChat === 'function') {
        window.initChat(user.username, user.tokens, idioma);
    }
}

function enterAsGuest() {
    if (typeof window.aplicarFotoAvatares === 'function' && window.mayteFotoUrl) {
        window.aplicarFotoAvatares(window.mayteFotoUrl);
    }
    enterApp({ ...GUEST_USER });
}

function showPostSplashScreen() {
    fetch('api.php?action=init_profile')
        .then(r => r.json())
        .then(data => {
            if (data.success && data.foto) {
                window.mayteFotoUrl = data.foto;
                if (typeof window.aplicarFotoAvatares === 'function') {
                    window.aplicarFotoAvatares(data.foto);
                }
            }
        })
        .catch(() => {})
        .finally(() => enterAsGuest());
}

(function init() {
    sessionStorage.removeItem('mayte_user');
    if (typeof window.initChatColors === 'function') window.initChatColors();

    if (typeof window.startSplash === 'function') {
        window.startSplash(showPostSplashScreen);
    } else {
        showPostSplashScreen();
    }
})();
