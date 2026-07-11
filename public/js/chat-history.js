// ============================================================
// chat-history.js — Guardar y recuperar conversaciones
// ============================================================
'use strict';

const CONV_STORAGE_KEY = 'mayte_saved_chats';
const ACTIVE_CONV_KEY  = 'mayte_active_chat_id';
const MAX_SAVED_CHATS  = 80;

window.currentChatId       = null;
window.chatDisplayMessages = [];

function genChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function loadAllChats() {
    try {
        const data = JSON.parse(localStorage.getItem(CONV_STORAGE_KEY) || '[]');
        return Array.isArray(data) ? data : [];
    } catch (_) {
        return [];
    }
}

function saveAllChats(chats) {
    try {
        localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_SAVED_CHATS)));
    } catch (_) {}
}

function getActiveChatId() {
    try { return localStorage.getItem(ACTIVE_CONV_KEY); } catch (_) { return null; }
}

function setActiveChatId(id) {
    try {
        if (id) localStorage.setItem(ACTIVE_CONV_KEY, id);
        else localStorage.removeItem(ACTIVE_CONV_KEY);
    } catch (_) {}
}

function chatTitleFromMessages(messages) {
    const first = (messages || []).find(m => m.isUser && m.content);
    if (!first) return 'Nueva conversación';
    const t = first.content.trim();
    return t.length > 48 ? t.slice(0, 48) + '…' : t;
}

window.createNewChat = function() {
    const chat = {
        id:        genChatId(),
        title:     'Nueva conversación',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages:  [],
        history:   []
    };
    const chats = loadAllChats();
    chats.unshift(chat);
    saveAllChats(chats);
    setActiveChatId(chat.id);
    return chat;
};

window.persistCurrentChat = function() {
    if (!window.currentChatId) return;
    const chats = loadAllChats();
    const idx   = chats.findIndex(c => c.id === window.currentChatId);
    if (idx === -1) return;

    chats[idx].updatedAt = new Date().toISOString();
    chats[idx].messages  = window.chatDisplayMessages || [];
    chats[idx].history   = window.conversationHistory || [];
    chats[idx].title     = chatTitleFromMessages(chats[idx].messages);

    chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    saveAllChats(chats);
};

function formatDateLabel(iso) {
    const d = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfThat  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfToday - startOfThat) / 86400000);

    const time = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Hoy · ${time}`;
    if (diffDays === 1) return `Ayer · ${time}`;
    return d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${time}`;
}

function groupChatsByDay(chats) {
    const groups = {};
    chats.forEach(chat => {
        const d = new Date(chat.updatedAt || chat.createdAt);
        const key = d.toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(chat);
    });
    return groups;
}

function renderChatHistoryList() {
    const list = document.getElementById('chatHistoryList');
    if (!list) return;

    const chats = loadAllChats();
    if (!chats.length) {
        list.innerHTML = '<p class="chat-history-empty">Aún no hay conversaciones guardadas.<br>¡Empieza a chatear y se guardarán solas ✨</p>';
        return;
    }

    const groups = groupChatsByDay(chats);
    let html = '';

    Object.keys(groups).forEach(dayLabel => {
        html += `<div class="chat-history-day">${dayLabel}</div>`;
        groups[dayLabel].forEach(chat => {
            const active = chat.id === window.currentChatId ? ' active' : '';
            const count  = (chat.messages || []).filter(m => m.isUser).length;
            const preview = chat.title || 'Sin título';
            html += `
                <div class="chat-history-item${active}" data-id="${chat.id}">
                    <button type="button" class="chat-history-open" onclick="window.openSavedChat('${chat.id}')">
                        <span class="chat-history-item-title">${escapeHtml(preview)}</span>
                        <span class="chat-history-item-meta">${formatDateLabel(chat.updatedAt)} · ${count} mensaje${count !== 1 ? 's' : ''}</span>
                    </button>
                    <button type="button" class="chat-history-del" onclick="window.deleteSavedChat('${chat.id}')" title="Eliminar">🗑</button>
                </div>`;
        });
    });

    list.innerHTML = html;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.openChatHistory = function() {
    renderChatHistoryList();
    document.getElementById('chatHistoryPanel')?.classList.add('open');
    document.getElementById('chatHistoryBackdrop')?.classList.add('open');
};

window.closeChatHistory = function() {
    document.getElementById('chatHistoryPanel')?.classList.remove('open');
    document.getElementById('chatHistoryBackdrop')?.classList.remove('open');
};

window.startNewChat = function() {
    window.closeChatHistory();
    window.currentChatId = null;
    setActiveChatId(null);
    if (typeof window.beginChatSession === 'function') {
        window.beginChatSession(true);
    }
};

window.openSavedChat = function(id) {
    const chats = loadAllChats();
    const chat  = chats.find(c => c.id === id);
    if (!chat) return;

    window.closeChatHistory();
    window.currentChatId = chat.id;
    setActiveChatId(chat.id);

    if (typeof window.restoreChatSession === 'function') {
        window.restoreChatSession(chat);
    }
};

window.deleteSavedChat = function(id) {
    if (!confirm('¿Eliminar esta conversación?')) return;

    let chats = loadAllChats().filter(c => c.id !== id);
    saveAllChats(chats);

    if (window.currentChatId === id) {
        const next = chats[0];
        if (next) window.openSavedChat(next.id);
        else window.startNewChat();
    } else {
        renderChatHistoryList();
    }
};

window.initChatHistory = function() {
    const chats    = loadAllChats();
    const activeId = getActiveChatId();
    const existing = activeId && chats.find(c => c.id === activeId);

    if (existing && (existing.messages || []).some(m => m.isUser)) {
        window.currentChatId = existing.id;
        if (typeof window.restoreChatSession === 'function') {
            window.restoreChatSession(existing);
        }
        return;
    }

    const chat = window.createNewChat();
    window.currentChatId = chat.id;
    if (typeof window.beginChatSession === 'function') {
        window.beginChatSession(true);
    }
};
