<!DOCTYPE html>
<html lang="es" id="htmlRoot">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MaytePremium · Chat con Mayte Chávez ✨</title>
    <meta name="description" content="Chatea con Mayte Chávez, accede a fondos de pantalla exclusivos y vive la experiencia MaytePremium.">
    <link rel="stylesheet" href="{{ asset('css/style.css') }}">
</head>
<body class="splash-pending">

<!-- ════ SPLASH / INTRO ANIMACIÓN ════ -->
<div id="splashScreen" class="splash-screen" style="display:flex;">
    <div class="splash-bg-gradient"></div>
    <div class="splash-orbs" aria-hidden="true">
        <span class="splash-orb splash-orb-1"></span>
        <span class="splash-orb splash-orb-2"></span>
        <span class="splash-orb splash-orb-3"></span>
    </div>
    <div class="splash-vignette"></div>

    <div class="splash-stage">
        <div class="splash-silhouette-wrap" aria-hidden="true">
            <div class="splash-silhouette-float">
                <div class="splash-silhouette-glow"></div>
                <img class="splash-silhouette-img" src="{{ asset('assets/silueta-mujer.png') }}" alt="">
            </div>
        </div>

        <div class="splash-content">
            <div class="splash-logo" id="splashLogo">
                <span>MC</span>
            </div>
            <h1 class="splash-title splash-item splash-item-1">Mayte <em>Chávez</em> ✨</h1>
            <p class="splash-tagline splash-item splash-item-2">Chatea conmigo 🤎</p>
            <div class="splash-progress splash-item splash-item-3">
                <div class="splash-progress-bar"></div>
            </div>
            <button type="button" class="splash-skip splash-item splash-item-4" id="splashSkip">Saltar →</button>
        </div>
    </div>
</div>

<!-- Fondo decorativo -->
<div class="bg-layer"></div>
<div class="orb orb-1"></div>
<div class="orb orb-2"></div>
<div class="orb orb-3"></div>

<!-- Toggle modo oscuro -->
<button id="themeToggle" title="Cambiar tema" aria-label="Cambiar tema">🌙</button>

<!-- Toast notificaciones -->
<div id="toast"></div>

<!-- CONTENEDOR PRINCIPAL -->
<div class="container">
    <!-- ════ APP SHELL ════ -->
    <div id="appShell" style="display:none;">
        <div class="app-section active" id="chatSection">
            <div class="chat-header">
                <div class="avatar" id="profileAvatar">
                    <span id="avatarInitials">MC</span>
                    <div class="online-dot"></div>
                </div>
                <div class="user-info">
                    <h3>Mayte <em>Chávez</em> ✨</h3>
                    <p id="mayteStatus">Activa ahora 🟢</p>
                </div>
                <div class="user-stats">
                    <button type="button" class="history-btn" id="historyBtn" onclick="window.openChatHistory()" title="Mis conversaciones">📋</button>
                    <span class="token-pill" id="tokenPill" title="Mensajes disponibles">∞</span>
                </div>
            </div>

            <div class="chat-history-backdrop" id="chatHistoryBackdrop" onclick="window.closeChatHistory()"></div>
            <aside class="chat-history-panel" id="chatHistoryPanel" aria-label="Historial de conversaciones">
                <div class="chat-history-header">
                    <h4>Mis conversaciones</h4>
                    <button type="button" class="chat-history-close" onclick="window.closeChatHistory()">✕</button>
                </div>
                <button type="button" class="chat-history-new" onclick="window.startNewChat()">+ Nueva conversación</button>
                <div class="chat-history-list" id="chatHistoryList"></div>
            </aside>

            <div class="messages-area" id="messagesArea"></div>
            <div class="token-warning" id="tokenWarning"></div>

            <div class="suggestions">
                <button class="sugg-btn" id="suggBtn1" onclick="window.sendSuggestion('Cuéntame una historia tuya')">📖 Una historia</button>
                <button class="sugg-btn" id="suggBtn2" onclick="window.sendSuggestion('¿Cómo te sientes hoy?')">💭 Tu mood</button>
                <button class="sugg-btn" id="suggBtn3" onclick="window.sendSuggestion('¿Te gusta Harry Potter?')">⚡ Harry Potter</button>
                <button class="sugg-btn" id="suggBtn4" onclick="window.sendSuggestion('¿Qué opinas de la vida?')">🤔 Opina</button>
            </div>

            <div class="input-area">
                <input type="text" id="messageInput" placeholder="Escríbele a Mayte..." autocomplete="off">
                <button class="send-btn" id="sendBtn" onclick="window.sendMessage()">
                    <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
            </div>

            <div class="footer-quote" id="footerQuote">"Con Dios todo tiene propósito" 🤎</div>
        </div>
    </div><!-- /appShell -->
</div><!-- /container -->

{{-- La URL base de la API ahora apunta a las rutas de Laravel --}}
<script>
    window.API_BASE = '{{ url("/api") }}';
</script>

<!-- Scripts -->
<script src="{{ asset('js/estorage.js') }}"></script>
<script src="{{ asset('js/translations.js') }}"></script>
<script src="{{ asset('js/chat-colors.js') }}"></script>
<script src="{{ asset('js/splash.js') }}"></script>
<script src="{{ asset('js/chat-history.js') }}"></script>
<script src="{{ asset('js/chat-memory.js') }}"></script>
<script src="{{ asset('js/chat.js') }}"></script>
<script src="{{ asset('js/main.js') }}"></script>

</body>
</html>
