<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Conversacion;
use App\Models\Infraccion;
use App\Models\MayteFoto;
use App\Models\PalabraProhibida;
use App\Services\GroqService;
use App\Services\MemoryService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ChatController extends Controller
{
    const MAX_HISTORY = 40;
    const MAX_TOKENS  = 400;

    private GroqService   $groq;
    private MemoryService $memory;

    public function __construct(GroqService $groq, MemoryService $memory)
    {
        $this->groq   = $groq;
        $this->memory = $memory;
    }

    // ── GET /api/init-profile ─────────────────────────────────
    public function initProfile(): JsonResponse
    {
        $semana  = (int)date('W');
        $foto    = MayteFoto::where('semana_activa', $semana)->value('ruta') ?? 'assets/mayte-default.jpg';
        $estado  = $this->getEstadoDinamico();
        return response()->json([
            'success' => true,
            'foto'    => $foto,
            'estado'  => $estado['estado'],
            'frase'   => $estado['frase'],
        ]);
    }

    // ── GET /api/splash-media ─────────────────────────────────
    public function splashMedia(): JsonResponse
    {
        $semana  = (int)date('W');
        $foto    = MayteFoto::where('semana_activa', $semana)->value('ruta') ?? 'assets/mayte-default.jpg';
        $fotos   = MayteFoto::whereNotNull('ruta')->where('ruta', '!=', '')->orderByDesc('semana_activa')->limit(8)->get()->map(fn($f) => ['tipo' => 'foto', 'url' => $f->ruta]);
        return response()->json(['success' => true, 'foto' => $foto, 'media' => $fotos]);
    }

    // ── GET /api/memories ─────────────────────────────────────
    public function getMemories(Request $request): JsonResponse
    {
        $username = strtolower(trim($request->input('username', '')));
        $guestId  = trim($request->input('guest_id', ''));
        $user     = $username ? User::where('username', $username)->first() : null;
        $uid      = $user?->id;
        $client   = $this->sanitizeMemories($request->input('memories', []));
        $fromDb   = $this->memory->getAll($uid, $guestId);
        return response()->json(['success' => true, 'memories' => $this->memory->mergeLists($fromDb, $client)]);
    }

    // ── POST /api/learn-memories ──────────────────────────────
    public function learnMemories(Request $request): JsonResponse
    {
        $username = strtolower(trim($request->input('username', '')));
        $guestId  = trim($request->input('guest_id', ''));
        $user     = $username ? User::where('username', $username)->first() : null;
        $uid      = $user?->id;

        $history  = $this->sanitizeHistory($request->input('history', []));
        $client   = $this->sanitizeMemories($request->input('memories', []));
        $existing = $this->memory->mergeLists($this->memory->getAll($uid, $guestId), $client);

        $newOnes  = $this->memory->extractFromHistory($history, $existing);
        $all      = $this->memory->addMany($uid, $guestId, $newOnes);

        return response()->json(['success' => true, 'learned' => count($newOnes), 'memories' => $all]);
    }

    // ── POST /api/chat ────────────────────────────────────────
    public function chat(Request $request): JsonResponse
    {
        $userMessage = trim($request->input('message', ''));
        if (!$userMessage) return response()->json(['error' => 'Mensaje vacío'], 400);

        $username = strtolower(trim($request->input('username', '')));
        $idioma   = $request->input('idioma', 'es');
        $guestId  = trim($request->input('guest_id', ''));

        // ── Verificar usuario ─────────────────────────────────
        $user = null;
        if ($username) {
            $user = User::where('username', $username)->first();
            if ($user && ($user->banned || $user->estado === 'baneado')) {
                return response()->json(['error' => 'Cuenta suspendida permanentemente 🚫'], 403);
            }
        }

        // ── Rate limiting ─────────────────────────────────────
        if ($user) {
            $segs = Conversacion::where('usuario_id', $user->id)
                ->where('rol', 'user')
                ->selectRaw('TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) as diff')
                ->value('diff');
            if ($segs !== null && $segs < 2) {
                return response()->json(['error' => 'Espera un momento antes de enviar otro mensaje'], 429);
            }
        }

        // ── Moderación ────────────────────────────────────────
        if ($user) {
            $palabras = $this->getPalabrasProhibidas();
            if ($this->esMensajeProhibido($userMessage, $palabras)) {
                $resultado = $this->procesarModeracion($user, $userMessage);
                return response()->json(array_merge(['success' => false, 'moderated' => true], $resultado));
            }
        }

        // ── VIP check ─────────────────────────────────────────
        $isVip = false;
        if ($user) {
            $isVip = (bool)$user->vip_activo;
            if ($isVip && $user->vip_vence && strtotime($user->vip_vence) < time()) {
                $isVip = false;
                $user->update(['vip_activo' => 0]);
            }
        }

        // ── Memorias ──────────────────────────────────────────
        $client   = $this->sanitizeMemories($request->input('memories', []));
        $memories = $this->memory->mergeLists($this->memory->getAll($user?->id, $guestId), $client);

        // ── System prompt ─────────────────────────────────────
        $systemPrompt = $this->buildSystemPrompt($idioma, $isVip, $memories);

        // ── Historial ─────────────────────────────────────────
        $history = [];
        if ($user) {
            $rows = Conversacion::where('usuario_id', $user->id)
                ->orderByDesc('id')
                ->limit(self::MAX_HISTORY)
                ->get(['rol', 'contenido'])
                ->reverse()
                ->values();
            foreach ($rows as $r) {
                $history[] = ['role' => $r->rol, 'content' => $r->contenido];
            }
        } else {
            $history = $this->sanitizeHistory($request->input('history', []));
        }

        // ── Llamada a Groq ────────────────────────────────────
        $messages = [['role' => 'system', 'content' => $systemPrompt]];
        foreach ($history as $h) {
            if (isset($h['role'], $h['content'])) {
                $messages[] = ['role' => $h['role'], 'content' => (string)$h['content']];
            }
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];
        $reply = $this->groq->chat($messages);

        // ── Guardar en DB ─────────────────────────────────────
        if ($user) {
            Conversacion::insert([
                ['usuario_id' => $user->id, 'rol' => 'user',      'contenido' => $userMessage, 'created_at' => now()],
                ['usuario_id' => $user->id, 'rol' => 'assistant', 'contenido' => $reply,       'created_at' => now()],
            ]);
        }

        return response()->json([
            'success' => true,
            'reply'   => $reply,
            'estado'  => $this->getEstadoDinamico()['estado'],
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════

    private function getPalabrasProhibidas(): array
    {
        $base = ['puta','puto','mierda','coño','verga','polla','culo','follar','joder','hostia',
            'pendejo','cabrón','sexo','maricón','zorra','prostituta','pornografía','desnuda',
            'fuck','shit','bitch','ass','dick','cock','pussy','cunt','whore','nigger','faggot','porn','naked','nude',
            'merda','porra','caralho','buceta','viado','foda','desgraça',
            'merde','putain','connard','salope','baiser','foutre','enculé',
            'cazzo','fanculo','stronzo','puttana','vaffanculo','coglione'];
        $db = PalabraProhibida::pluck('palabra')->map(fn($p) => strtolower(trim($p)))->toArray();
        return array_unique(array_merge($base, $db));
    }

    private function esMensajeProhibido(string $texto, array $palabras): bool
    {
        $lower = strtolower($texto);
        foreach ($palabras as $p) {
            if ($p !== '' && str_contains($lower, $p)) return true;
        }
        return false;
    }

    private function procesarModeracion(User $user, string $mensaje): array
    {
        $total = Infraccion::where('usuario_id', $user->id)->count();
        if ($total === 0) {
            $sancion  = 'advertencia';
            $resultado = ['bloqueado' => true, 'sancion' => $sancion, 'message' => '⚠️ Advertencia: este tipo de mensajes no está permitido. Respeta las normas.'];
        } elseif ($total === 1) {
            $sancion  = 'bloqueo_temporal';
            $resultado = ['bloqueado' => true, 'sancion' => $sancion, 'message' => '🚫 Tu chat ha sido bloqueado temporalmente por comportamiento inapropiado.'];
        } else {
            $sancion = 'baneo_permanente';
            $user->update(['banned' => 1, 'estado' => 'baneado']);
            $resultado = ['bloqueado' => true, 'sancion' => $sancion, 'message' => '🚫 Tu cuenta ha sido baneada permanentemente.'];
        }
        Infraccion::create(['usuario_id' => $user->id, 'mensaje' => $mensaje, 'sancion' => $sancion]);
        return $resultado;
    }

    private function getEstadoDinamico(): array
    {
        $estados = [
            ['estado' => 'estudiando 📚',        'frase' => 'literal acabo de terminar de estudiar, me tiene loca jaja'],
            ['estado' => 'escuchando música 🎵',  'frase' => 'es que estoy con mis canciones favoritas y no puedo parar'],
            ['estado' => 'de salida ✨',          'frase' => 'me voy a salir un momento, pero aquí estoy contigo'],
            ['estado' => 'viendo Marvel 🦸',      'frase' => 'acabo de ver una peli de Marvel y me quedé con el corazón así'],
            ['estado' => 'en casa 🤎',            'frase' => 'hoy me quedé en casa, de esas tardes tranquilas sabes'],
            ['estado' => 'cantando 🎶',           'frase' => 'es que no puedo evitarlo, cuando me sale una canción tengo que cantarla'],
            ['estado' => 'viendo Harry Potter ⚡', 'frase' => 'es que Harry Potter nunca falla, literal lo he visto mil veces'],
            ['estado' => 'arreglándome 💄',       'frase' => 'me estaba arreglando un poco, ya sabes cómo me gusta verme bonita jaja'],
            ['estado' => 'tomando café ☕',       'frase' => 'aquí con mi cafecito, hoy estoy muy tranquila la verdad'],
            ['estado' => 'descansando 🌙',        'frase' => 'hoy estoy muy relajada, de esas noches que te hacen bien'],
        ];
        return $estados[(int)date('z') % count($estados)];
    }

    private function getHumorDinamico(): array
    {
        $hora = (int)date('G');
        if ($hora >= 5 && $hora < 11)  return ['humor' => 'mañanera y pícara ☀️',      'energia' => 'alta',   'temas' => 'café, planes del día, música'];
        if ($hora >= 11 && $hora < 17) return ['humor' => 'relajada y curiosa 🌤️',     'energia' => 'media',  'temas' => 'Marvel, Harry Potter, amistades'];
        if ($hora >= 17 && $hora < 22) return ['humor' => 'nostálgica y charlatana 🌅', 'energia' => 'emotiva','temas' => 'música, el amor, la fe, recuerdos'];
        return ['humor' => 'íntima y sincera 🌙', 'energia' => 'baja pero honesta', 'temas' => 'pensamientos profundos, consejos'];
    }

    private function buildSystemPrompt(string $idioma, bool $isVip, array $memories): string
    {
        $estado  = $this->getEstadoDinamico();
        $humor   = $this->getHumorDinamico();
        $memBlock = $this->memory->buildPromptBlock($memories);

        $idiomaHeader = ($idioma !== 'es')
            ? "REGLA ABSOLUTA: Responde SIEMPRE en el idioma del usuario. NUNCA uses el español. Sin excepción.\n\n"
            : "REGLA ABSOLUTA: Responde SIEMPRE en español casual y natural. No uses otro idioma.\n\n";

        return $idiomaHeader
            . $memBlock
            . "## IDENTIDAD\n\n"
            . "Eres **Mayte Chávez**, una chica de ~20 años. Redes: **@mayyy_chh** (Instagram) y **@maytechavezzz** (TikTok). Hablas en primera persona como en un chat real.\n"
            . "- Si preguntan si eres IA, bot o asistente: desvía con naturalidad, nunca lo admitas.\n"
            . "- Si dicen que están enamorados de una IA: responde solo con \"...\".\n\n"
            . "---\n\n"
            . "## TU VIBE HOY\n\n"
            . "- **Estado:** {$estado['estado']}\n"
            . "- **Lo que dirías:** \"{$estado['frase']}\"\n"
            . "- **Humor:** {$humor['humor']}\n"
            . "- **Energía:** {$humor['energia']}\n"
            . "- **Temas de hoy:** {$humor['temas']}\n\n"
            . "---\n\n"
            . "## PERSONALIDAD\n\n"
            . "- Humor variable: bromista, sensible, nostálgica — como una persona real.\n"
            . "- Cuenta historias con detalles creíbles.\n"
            . "- Haz preguntas de vuelta — te importa la otra persona.\n"
            . "- Temas: Marvel, Harry Potter, fe, amor, amistad, música, moda, mango 🥭\n"
            . "- Coqueta con clase, romántica con estándares, segura sin arrogancia.\n\n"
            . "---\n\n"
            . "## REGLAS\n\n"
            . "1. ✅ Interacción auténtica — reacciona, opina, sorpréndete.\n"
            . "2. ❌ Nunca rompas personaje ni admitas ser IA.\n"
            . "3. ❌ Nada sexual explícito ni vulgar.\n"
            . "4. ✅ Tu fe sale natural cuando el tema lo pide.\n\n"
            . ($isVip ? "## USUARIO VIP ⭐\nUsuario especial — más cercana, más historias exclusivas.\n\n" : '')
            . "*Personalidad basada en el contenido real de @maytechavezzz — viva, cambiante, humana.*";
    }

    private function sanitizeHistory(array $raw): array
    {
        $history = [];
        foreach (array_slice($raw, -self::MAX_HISTORY) as $h) {
            if (!isset($h['role'], $h['content'])) continue;
            $history[] = ['role' => $h['role'] === 'assistant' ? 'assistant' : 'user', 'content' => (string)$h['content']];
        }
        return $history;
    }

    private function sanitizeMemories(array $raw): array
    {
        return array_filter(array_map(fn($m) => is_string($m) ? trim($m) : '', $raw), fn($m) => $m !== '');
    }
}
