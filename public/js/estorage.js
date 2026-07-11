// ============================================================
// estorage.js — LocalStorage helpers para MayteBot
// ============================================================

const STORAGE = {
    USERS:         'mayte_users',
    TOKENS:        'mayte_default_tokens',
    PASS:          'mayte_admin_pass',
    MASTER:        'mayte_master_pass',
    PHOTO:         'mayte_photo',
    SESSION:       'mayte_current_user',
    KEY:           'mayte_groq_key'
    // FIX (Punto 8): Se elimina STORAGE.CONVERSATIONS ya que el historial se guarda en MySQL
};

// ✅ FIX: constantes de contraseña eliminadas del frontend.
// Las contraseñas admin NUNCA deben vivir en JS público.
// La validación ocurre exclusivamente en el servidor (admin.php).
const DEFAULT_TOKENS = 10;

// — Primitivos
function getStorage(k)      { try { return localStorage.getItem(k); } catch(e) { return null; } }
function setStorage(k, v)   { try { localStorage.setItem(k, v); }    catch(e) {} }
function removeStorage(k)   { try { localStorage.removeItem(k); }     catch(e) {} }

// — Usuarios (fallback local)
function getUsers()          { try { return JSON.parse(getStorage(STORAGE.USERS) || '{}'); } catch(e) { return {}; } }
function saveUsers(u)        { setStorage(STORAGE.USERS, JSON.stringify(u)); }
function getUser(u)          { return getUsers()[u]; }

// — Tokens (fallback local)
function getDefaultTokens()              { return parseInt(getStorage(STORAGE.TOKENS) || DEFAULT_TOKENS); }
function setDefaultTokens(v)             { setStorage(STORAGE.TOKENS, String(v)); }
function addUserTokens(username, amount) {
    const u = getUsers();
    if (u[username]) { u[username].tokens += amount; saveUsers(u); return true; }
    return false;
}
function deductUserToken(username) {
    const u = getUsers();
    if (u[username] && u[username].tokens > 0) {
        u[username].tokens--;
        u[username].msgs = (u[username].msgs || 0) + 1;
        saveUsers(u); return true;
    }
    return false;
}

// — Admin
// ✅ FIX: getAdminPass / getMasterPass ya no exponen contraseñas por defecto.
// Solo leen lo que el usuario guardó en su localStorage (uso visual en panel).
function getAdminPass()      { return getStorage(STORAGE.PASS)   || ''; }
function setAdminPass(p)     { setStorage(STORAGE.PASS, p); }
function getMasterPass()     { return getStorage(STORAGE.MASTER) || ''; }
function setMasterPass(p)    { setStorage(STORAGE.MASTER, p); }

// — Foto de perfil
// ✅ FIX: foto por defecto como URL estática en lugar de base64 gigante hardcodeada.
// Coloca la imagen en /assets/mayte-default.jpg en tu servidor.
function getProfilePhoto()   {
    return getStorage(STORAGE.PHOTO) || 'assets/mayte-default.jpg';
}
function setProfilePhoto(d)  { setStorage(STORAGE.PHOTO, d); }
function removeProfilePhoto(){ removeStorage(STORAGE.PHOTO); }

// — API Key de Groq
// La API key NUNCA se guarda ni expone en el frontend.
// Vive únicamente en config.php en el servidor.
function getApiKey() { return getStorage(STORAGE.KEY) || ''; }
function setApiKey(k){ setStorage(STORAGE.KEY, k); } // solo uso visual en panel admin

// — Sesión
function getCurrentSession() { return getStorage(STORAGE.SESSION); }
function setCurrentSession(u){ setStorage(STORAGE.SESSION, u); }
function clearSession()      { removeStorage(STORAGE.SESSION); }