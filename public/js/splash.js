// ============================================================
// splash.js — Intro premium con animaciones coordinadas
// ============================================================
'use strict';

const SPLASH_DURATION_MS = 5200;
const SPLASH_EXIT_MS     = 700;

function finishSplash(callback) {
    const splash = document.getElementById('splashScreen');
    const body   = document.body;

    if (!splash) {
        body.classList.remove('splash-pending', 'splash-active');
        if (typeof callback === 'function') callback();
        return;
    }

    splash.classList.remove('splash-ready');
    splash.classList.add('splash-out');
    body.classList.remove('splash-active');

    setTimeout(() => {
        splash.style.display = 'none';
        body.classList.remove('splash-pending');
        if (typeof callback === 'function') callback();
    }, SPLASH_EXIT_MS);
}

function animateProgressBar(bar, durationMs, delayMs) {
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = '0';
    setTimeout(() => {
        bar.style.transition = `width ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        requestAnimationFrame(() => { bar.style.width = '100%'; });
    }, delayMs);
}

window.startSplash = function(callback) {
    const splash  = document.getElementById('splashScreen');
    const bar     = document.querySelector('.splash-progress-bar');
    const skipBtn = document.getElementById('splashSkip');
    const body    = document.body;

    if (!splash) {
        body.classList.remove('splash-pending');
        if (typeof callback === 'function') callback();
        return;
    }

    body.classList.add('splash-active');
    splash.style.display = 'flex';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => splash.classList.add('splash-ready'));
    });

    let finished = false;
    const done = () => {
        if (finished) return;
        finished = true;
        finishSplash(callback);
    };

    if (skipBtn) skipBtn.addEventListener('click', done, { once: true });

    const progressDelay = 1400;
    const progressTime  = SPLASH_DURATION_MS - progressDelay - SPLASH_EXIT_MS;
    animateProgressBar(bar, Math.max(progressTime, 2800), progressDelay);

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
        .catch(() => {});

    setTimeout(done, SPLASH_DURATION_MS);
};
