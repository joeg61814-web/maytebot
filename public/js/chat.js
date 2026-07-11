// ============================================================
// chat.js — Lógica del chat para MayteBot
// ============================================================

const API_URL = (window.API_BASE || '') + '/chat';

// ── Renderizar mensaje ──

function addMessage(text, isUser, skipTrack) {
    const area = document.getElementById('messagesArea');
    const wrap = document.createElement('div');
    wrap.className = `message ${isUser ? 'user' : 'bot'}`;

    if (!isUser) {
        const av = document.createElement('div');
        av.className = 'msg-avatar';
        // Usamos la variable global si ya cargó, o un fallback relativo sin barra al inicio
        const photo = window.mayteFotoUrl || ((typeof getProfilePhoto === 'function') ? getProfilePhoto() : 'assets/mayte-default.jpg');
        
        if (photo) {
            const img = document.createElement('img');
            // Quitamos cualquier barra inicial destructiva si viene de getProfilePhoto
            img.src = photo.startsWith('/') ? photo.substring(1) : photo;
            img.onerror = function() { 
                this.remove(); // Si da 404, se borra la imagen y queda el texto 'MC' de respaldo sin romper el código
            };
            av.appendChild(img);
        }
        av.insertAdjacentText('beforeend', 'MC');
        wrap.appendChild(av);
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    area.appendChild(wrap);
    area.scrollTop = area.scrollHeight;

    if (!skipTrack) {
        if (!window.chatDisplayMessages) window.chatDisplayMessages = [];
        window.chatDisplayMessages.push({ content: text, isUser: !!isUser });
    }
}

// ── Indicador de escritura (CORREGIDO) ──
function showTyping() {
    const area = document.getElementById('messagesArea');
    const wrap = document.createElement('div');
    wrap.className = 'message bot';
    wrap.id = 'typingIndicator';

    const av = document.createElement('div');
    av.className = 'msg-avatar';
    const photo = window.mayteFotoUrl || ((typeof getProfilePhoto === 'function') ? getProfilePhoto() : 'assets/mayte-default.jpg');
    
    if (photo) {
        const img = document.createElement('img');
        img.src = photo.startsWith('/') ? photo.substring(1) : photo;
        img.onerror = function() { this.remove(); };
        av.appendChild(img);
    }
    av.insertAdjacentText('beforeend', 'MC');
    wrap.appendChild(av);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    wrap.appendChild(bubble);
    area.appendChild(wrap);
    area.scrollTop = area.scrollHeight;
}
function removeTyping() { document.getElementById('typingIndicator')?.remove(); }

// ── Tokens display ──
function updateTokenDisplay(tokensOverride) {
    if (window.currentUserData?.guest) {
        const pill = document.getElementById('tokenPill');
        if (pill) { pill.textContent = '∞'; pill.className = 'token-pill'; }
        return;
    }
    let tokens = tokensOverride;
    if (tokens === undefined) {
        const user = (typeof getUser === 'function') ? getUser(window.currentUser) : null;
        tokens = user ? user.tokens : 0;
    }
    const pill = document.getElementById('tokenPill');
    if (!pill) return;
    pill.textContent = `${tokens} msgs`;
    pill.className = `token-pill ${tokens <= 3 ? 'low' : ''}`;
}

function checkTokenWarning(tokensOverride) {
    let tokens = tokensOverride;
    if (tokens === undefined) {
        const user = (typeof getUser === 'function') ? getUser(window.currentUser) : null;
        tokens = user ? user.tokens : 0;
    }
    const input   = document.getElementById('messageInput');
    const sendBtn = document.querySelector('.send-btn');
    const warning = document.getElementById('tokenWarning');

    const t = (window.TRANSLATIONS && window.TRANSLATIONS[window.currentIdioma]) ? window.TRANSLATIONS[window.currentIdioma] : null;

    if (tokens <= 0) {
        if (input)   input.disabled   = true;
        if (sendBtn) sendBtn.disabled = true;
        if (warning) {
            warning.style.display = 'block';
            warning.textContent = t ? t.tokenWarningEmpty : '✨ Se acabaron tus mensajes. Contacta al admin para recargar. ✨';
        }
    } else if (tokens <= 3) {
        if (input)   input.disabled   = false;
        if (sendBtn) sendBtn.disabled = false;
        if (warning) {
            warning.style.display = 'block';
            warning.textContent = t 
                ? t.tokenWarningLow.replace('{n}', tokens) 
                : `⚠️ Te quedan ${tokens} mensaje${tokens !== 1 ? 's' : ''}. ¡Úsalos bien!`;
        }
    } else {
        if (input)   input.disabled   = false;
        if (sendBtn) sendBtn.disabled = false;
        if (warning) warning.style.display = 'none';
    }
}

// ── Enviar mensaje ──
window.sendMessage = async function() {
    if (!window.currentUser) return;
    const input = document.getElementById('messageInput');
    const text  = input.value.trim();
    if (!text) return;

    const isGuest = window.currentUserData?.guest === true;
    let tokensLeft = window.currentUserData?.tokens ?? 9999;

    if (!isGuest) {
        try {
            const deductRes = await fetch('tokens.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deduct', username: window.currentUser, session_user: window.currentUser })
            });
            const deductData = await deductRes.json();
            if (!deductRes.ok) {
                if (typeof showToastMsg === 'function') showToastMsg(deductData.error || 'Sin tokens disponibles');
                return;
            }
            tokensLeft = deductData.tokens_left;
        } catch(e) {
            if (typeof deductUserToken === 'function' && !deductUserToken(window.currentUser)) {
                if (typeof showToastMsg === 'function') showToastMsg('Sin tokens disponibles');
                return;
            }
            const user = (typeof getUser === 'function') ? getUser(window.currentUser) : null;
            tokensLeft = user ? user.tokens : 0;
        }
    }

    input.value = '';
    updateTokenDisplay(tokensLeft);
    checkTokenWarning(tokensLeft);
    addMessage(text, true);
    if (typeof window.persistCurrentChat === 'function') window.persistCurrentChat();

    showTyping();
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: window.conversationHistory,
                username: window.currentUser,
                idioma: window.currentIdioma || 'es',
                guest_id: (typeof window.getGuestId === 'function') ? window.getGuestId() : '',
                memories: (typeof window.getMemoriesPayload === 'function') ? window.getMemoriesPayload() : []
            })
        });
        const rawText = await res.text();
        let data;
        try { data = JSON.parse(rawText); }
        catch {
            removeTyping();
            addMessage('El servidor no respondió bien. Activa Apache y MySQL en XAMPP e intenta de nuevo.', false);
            return;
        }
        removeTyping();

        if (data.success) {
            // ✅ FIX: push primero, slice después — así el límite de 40 es exacto
            // y nunca se tienen más de 42 elementos momentáneamente.
            window.conversationHistory.push({ role: 'user',      content: text });
            window.conversationHistory.push({ role: 'assistant', content: data.reply });
            if (window.conversationHistory.length > 40) {
                window.conversationHistory = window.conversationHistory.slice(-40);
            }
            addMessage(data.reply, false);
            
            // Actualizar estado dinámico
            if (data.estado) {
                const statusEl = document.getElementById('mayteStatus');
                if (statusEl) {
                    statusEl.textContent = `@mayyy_chh · ${data.estado} 🟢`;
                }
            }
            if (typeof window.persistCurrentChat === 'function') window.persistCurrentChat();
            if (typeof window.tryLearnFromChat === 'function') window.tryLearnFromChat();
        } else {
            addMessage(data.reply || data.message || data.error || 'Ay no, algo salió mal. Intenta de nuevo 😅', false);
        }
    } catch(err) {
        removeTyping();
        console.error("Error al enviar mensaje:", err);
        const t = (window.TRANSLATIONS && window.TRANSLATIONS[window.currentIdioma]) ? window.TRANSLATIONS[window.currentIdioma] : null;
        addMessage(t ? t.networkErrorMsg : 'Me quedé sin conexión. ¡Reintenta! 🙏', false);
    }
};

window.sendSuggestion = function(text) {
    document.getElementById('messageInput').value = text;
    window.sendMessage();
};

// ── Cargar perfil dinámico de Mayte (foto de la semana y estado del día) ──
async function cargarPerfilMayte() {
    try {
        const res  = await fetch('api.php?action=init_profile');
        const data = await res.json();
        if (data.success) {
            if (data.foto) {
                window.mayteFotoUrl = data.foto;
                if (typeof setProfilePhoto === 'function') setProfilePhoto(data.foto);
                aplicarFotoAvatares(data.foto);
            }
            // Actualizar estado dinámico en el header del chat
            const statusEl = document.getElementById('mayteStatus');
            if (statusEl) {
                statusEl.textContent = `@mayyy_chh · ${data.estado} 🟢`;
                if (data.frase) statusEl.title = data.frase; // Mostrar la frase completa al posar el cursor
            }
        }
    } catch(e) {
        console.error("Error al cargar perfil dinámico:", e);
    }
}

// Aplica la foto a todos los avatares de Mayte visibles en pantalla
function aplicarFotoAvatares(url) {
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;

    function setImgOnEl(el) {
        if (!el) return;
        let img = el.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:50%';
            el.appendChild(img);
        }
        img.src = cleanUrl;
        img.onerror = () => img.remove();
        el.classList.add('has-photo');
    }

    // Header del chat
    setImgOnEl(document.getElementById('profileAvatar'));
    // Logo login
    setImgOnEl(document.getElementById('logo'));
    // Logo pantalla idioma
    setImgOnEl(document.getElementById('langLogo'));
    // Logo splash
    setImgOnEl(document.getElementById('splashLogo'));

    // Avatares en mensajes ya renderizados
    document.querySelectorAll('.msg-avatar').forEach(av => {
        if (!av.querySelector('img')) {
            const img = document.createElement('img');
            img.src = cleanUrl;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:50%';
            img.onerror = () => img.remove();
            av.appendChild(img);
        }
    });
}
window.aplicarFotoAvatares = aplicarFotoAvatares;

// ── Iniciar o restaurar sesión de chat ──
window.beginChatSession = function(showWelcome) {
    window.conversationHistory = [];
    window.chatDisplayMessages = [];
    const area = document.getElementById('messagesArea');
    if (area) area.innerHTML = '';

    if (!window.currentChatId && typeof window.createNewChat === 'function') {
        const chat = window.createNewChat();
        window.currentChatId = chat.id;
    }

    if (showWelcome) {
        const t = (window.TRANSLATIONS && window.TRANSLATIONS[window.currentIdioma]) ? window.TRANSLATIONS[window.currentIdioma] : null;
        const welcome = t ? t.welcomeMsg : 'heyy ✨ aquí estoy — cuéntame algo, pídeme una historia o hablemos de lo que sea 🤎';
        addMessage(welcome, false);
    }

    if (typeof window.persistCurrentChat === 'function') window.persistCurrentChat();
};

window.restoreChatSession = function(chat) {
    window.conversationHistory = Array.isArray(chat.history) ? [...chat.history] : [];
    window.chatDisplayMessages = Array.isArray(chat.messages) ? [...chat.messages] : [];

    const area = document.getElementById('messagesArea');
    if (area) area.innerHTML = '';

    window.chatDisplayMessages.forEach(m => addMessage(m.content, m.isUser, true));

    const area2 = document.getElementById('messagesArea');
    if (area2) area2.scrollTop = area2.scrollHeight;
};

// ── Inicializar chat ──
window.initChat = function(username, serverTokens, idioma) {
    window.currentIdioma = idioma || 'es';

    updateTokenDisplay(serverTokens);
    if (!window.currentUserData?.guest) checkTokenWarning(serverTokens);
    else {
        const warning = document.getElementById('tokenWarning');
        if (warning) warning.style.display = 'none';
        const pill = document.getElementById('tokenPill');
        if (pill) pill.textContent = '∞';
    }

    cargarPerfilMayte();

    if (typeof window.loadMayteMemories === 'function') {
        window.loadMayteMemories();
    }

    const input = document.getElementById('messageInput');
    if (input) input.onkeydown = (e) => { if (e.key === 'Enter') window.sendMessage(); };

    if (typeof window.initChatHistory === 'function') {
        window.initChatHistory();
    } else {
        window.beginChatSession(true);
    }
};