// ============================================================
// chat-memory.js — Mayte aprende de conversaciones anteriores
// ============================================================
'use strict';

const GUEST_ID_KEY     = 'mayte_guest_id';
const MEMORIES_KEY     = 'mayte_memories';
const LEARN_EVERY_N    = 6;
let learnInProgress    = false;

function genGuestId() {
    return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

window.getGuestId = function() {
    try {
        let id = localStorage.getItem(GUEST_ID_KEY);
        if (!id) {
            id = genGuestId();
            localStorage.setItem(GUEST_ID_KEY, id);
        }
        return id;
    } catch (_) {
        return 'guest_temp';
    }
};

function loadLocalMemories() {
    try {
        const data = JSON.parse(localStorage.getItem(MEMORIES_KEY) || '[]');
        return Array.isArray(data) ? data.filter(m => typeof m === 'string' && m.trim()) : [];
    } catch (_) {
        return [];
    }
}

function saveLocalMemories(memories) {
    try {
        localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories || []));
    } catch (_) {}
}

window.mayteMemories = loadLocalMemories();

window.loadMayteMemories = async function() {
    try {
        const res = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action:   'get_memories',
                guest_id: window.getGuestId(),
                username: window.currentUser || 'invitado',
                memories: loadLocalMemories()
            })
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.memories)) {
            window.mayteMemories = data.memories;
            saveLocalMemories(data.memories);
        }
    } catch (_) {}
};

function countUserTurns(history) {
    return (history || []).filter(m => m.role === 'user').length;
}

window.tryLearnFromChat = async function() {
    if (learnInProgress) return;

    const history = window.conversationHistory || [];
    const turns   = countUserTurns(history);
    if (turns < 4 || turns % LEARN_EVERY_N !== 0) return;

    learnInProgress = true;
    try {
        const res = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action:   'learn_memories',
                history:  history.slice(-30),
                guest_id: window.getGuestId(),
                username: window.currentUser || 'invitado',
                memories: window.mayteMemories || []
            })
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.memories)) {
            window.mayteMemories = data.memories;
            saveLocalMemories(data.memories);
            if (data.learned > 0 && typeof window.showToastMsg === 'function') {
                window.showToastMsg('Mayte recordó algo de ti ✨');
            }
        }
    } catch (_) {
    } finally {
        learnInProgress = false;
    }
};

window.getMemoriesPayload = function() {
    return window.mayteMemories || loadLocalMemories();
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.loadMayteMemories === 'function') {
        window.loadMayteMemories();
    }
});
