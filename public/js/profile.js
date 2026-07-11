// ============================================================
// profile.js — Sección de perfil de usuario
// ============================================================
'use strict';

// ── Cargar perfil ────────────────────────────────────────────
window.loadProfile = function() {
    const user = window.currentUserData;
    if (!user) return;

    // Username
    const uDisp = document.getElementById('profileUsernameDisplay');
    if (uDisp) uDisp.textContent = user.username;

    // Iniciales en avatar
    const initials = document.getElementById('profileInitials');
    if (initials) initials.textContent = user.username.slice(0, 2).toUpperCase();

    // Foto de perfil propia si existe
    if (user.foto) {
        setProfileAvatarImg(user.foto);
    }

    // Stats
    const ts = document.getElementById('profileTokensStat');
    const ms = document.getElementById('profileMsgsStat');
    const vs = document.getElementById('profileVipStat');
    if (ts) ts.textContent = user.tokens ?? 0;
    if (ms) ms.textContent = user.msgs   ?? 0;
    if (vs) vs.textContent = user.vip ? (window.getTranslation ? window.getTranslation('vipPremiumActive') : '⭐ Activo') : (window.getTranslation ? window.getTranslation('vipFreeLabel') : 'Free');

    // Badge VIP
    const badge = document.getElementById('profileVipBadge');
    if (badge) badge.style.display = user.vip ? 'inline-flex' : 'none';

    // Sección VIP en perfil
    const vipProfileContent  = document.getElementById('vipProfileContent');
    const vipActiveContent   = document.getElementById('vipActiveContent');
    if (vipProfileContent && vipActiveContent) {
        if (user.vip) {
            vipProfileContent.style.display  = 'none';
            vipActiveContent.style.display   = 'block';
            const expEl = document.getElementById('vipExpiry');
            if (expEl && user.vip_vence) {
                expEl.textContent = new Date(user.vip_vence).toLocaleDateString();
            }
        } else {
            vipProfileContent.style.display  = 'block';
            vipActiveContent.style.display   = 'none';
        }
    }

    // Idioma
    const langSel = document.getElementById('profileLangSelect');
    if (langSel) langSel.value = user.idioma || 'es';
};


// ── Cambiar contraseña ────────────────────────────────────────
window.changePassword = async function() {
    const current = document.getElementById('currentPass').value;
    const newP    = document.getElementById('newPass').value;
    const newP2   = document.getElementById('newPass2').value;
    const msg     = document.getElementById('passChangeMsg');

    if (!current || !newP || !newP2) {
        if (msg) { msg.textContent = 'Completa todos los campos'; msg.style.color = '#dc2626'; }
        return;
    }
    if (newP.length < 8) {
        if (msg) { msg.textContent = 'La contraseña debe tener mínimo 8 caracteres'; msg.style.color = '#dc2626'; }
        return;
    }
    if (newP !== newP2) {
        if (msg) { msg.textContent = 'Las contraseñas no coinciden'; msg.style.color = '#dc2626'; }
        return;
    }

    try {
        const res = await fetch('profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'change_password',
                username: window.currentUser,
                current_password: current,
                new_password: newP
            })
        });
        const data = await res.json();
        if (data.success) {
            if (msg) { msg.textContent = '✅ Contraseña cambiada exitosamente'; msg.style.color = '#15803d'; }
            document.getElementById('currentPass').value = '';
            document.getElementById('newPass').value = '';
            document.getElementById('newPass2').value = '';
        } else {
            if (msg) { msg.textContent = data.error || 'Error al cambiar la contraseña'; msg.style.color = '#dc2626'; }
        }
    } catch(e) {
        if (msg) { msg.textContent = 'Error de conexión. Intenta de nuevo.'; msg.style.color = '#dc2626'; }
    }
};

// ── Subir foto de perfil ──────────────────────────────────────
window.uploadProfilePhoto = async function(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToastMsg('La imagen es demasiado grande (máx. 5MB)', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('action', 'upload_photo');
    formData.append('username', window.currentUser);
    formData.append('photo', file);

    try {
        const res  = await fetch('profile.php', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) {
            setProfileAvatarImg(data.url);
            // Actualizar también en el chat header
            if (window.currentUserData) {
                window.currentUserData.foto = data.url;
                saveSession(window.currentUserData);
            }
            // Aplicar a avatares del chat
            if (typeof aplicarFotoAvatares === 'function') {
                // No aplica — esta es la foto del usuario, no de Mayte
            }
            showToastMsg('Foto actualizada ✨', 'success');
        } else {
            showToastMsg(data.error || 'Error al subir la foto', 'error');
        }
    } catch(e) {
        // Demo: preview local sin servidor
        const reader = new FileReader();
        reader.onload = ev => setProfileAvatarImg(ev.target.result);
        reader.readAsDataURL(file);
        showToastMsg('Vista previa local (sin servidor)', 'info');
    }
};

function setProfileAvatarImg(url) {
    const bigAv = document.getElementById('profileAvatarBig');
    if (bigAv) {
        let img = bigAv.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:50%;';
            bigAv.appendChild(img);
        }
        img.src = url;
    }
}

// ── Exportar historial ────────────────────────────────────────
window.exportHistory = async function() {
    showToastMsg('Enviando historial a tu correo...', 'info');
    try {
        const res = await fetch('profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'export_history', username: window.currentUser })
        });
        const data = await res.json();
        if (data.success) {
            showToastMsg('¡Historial enviado a tu correo! 📧', 'success');
        } else {
            showToastMsg(data.error || 'Error al exportar', 'error');
        }
    } catch(e) {
        showToastMsg('Función disponible próximamente 🚧', 'info');
    }
};

// ── Eliminar cuenta ───────────────────────────────────────────
window.deleteAccount = async function() {
    const confirmed = confirm(
        '¿Estás segura de que quieres eliminar tu cuenta?\n\n' +
        'Tus datos se guardarán y podrás volver iniciando sesión. ' +
        'Esta acción es reversible.'
    );
    if (!confirmed) return;

    try {
        const res = await fetch('profile.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_account', username: window.currentUser })
        });
        const data = await res.json();
        if (data.success) {
            showToastMsg('Cuenta desactivada. ¡Hasta pronto! 🤎', 'success');
            setTimeout(() => window.doLogout(), 1500);
        } else {
            showToastMsg(data.error || 'Error al eliminar la cuenta', 'error');
        }
    } catch(e) {
        showToastMsg('Error de conexión', 'error');
    }
};

// ── Helper: guardar sesión ────────────────────────────────────
function saveSession(user) {
    try { sessionStorage.setItem('mayte_user', JSON.stringify(user)); } catch(_) {}
}
