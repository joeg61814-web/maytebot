<?php

namespace App\Services;

use App\Models\MemoriaChat;
use Illuminate\Support\Str;

class MemoryService
{
    const MAX_MEMORIES = 50;
    const MAX_LEN      = 300;

    private GroqService $groq;

    public function __construct(GroqService $groq)
    {
        $this->groq = $groq;
    }

    public function ownerKey(?int $userId, string $guestId = ''): ?string
    {
        if ($userId) return 'user:' . $userId;
        $guestId = preg_replace('/[^a-zA-Z0-9_-]/', '', $guestId);
        return $guestId !== '' ? 'guest:' . $guestId : null;
    }

    public function normalize(string $text): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $text));
        if (strlen($text) > self::MAX_LEN) {
            $text = substr($text, 0, self::MAX_LEN - 1) . '…';
        }
        return $text;
    }

    public function getAll(?int $userId, string $guestId = ''): array
    {
        $owner = $this->ownerKey($userId, $guestId);
        if (!$owner) return [];

        return MemoriaChat::where('owner_key', $owner)
            ->orderBy('id', 'desc')
            ->limit(self::MAX_MEMORIES)
            ->pluck('contenido')
            ->reverse()
            ->values()
            ->toArray();
    }

    public function addMany(?int $userId, string $guestId, array $memories): array
    {
        $owner = $this->ownerKey($userId, $guestId);
        if (!$owner || empty($memories)) return $this->getAll($userId, $guestId);

        foreach ($memories as $raw) {
            $content = $this->normalize((string)$raw);
            if ($content === '' || strlen($content) < 4) continue;
            if (MemoriaChat::where('owner_key', $owner)->where('contenido', $content)->exists()) continue;
            MemoriaChat::create(['owner_key' => $owner, 'contenido' => $content]);
        }

        $this->trimOld($owner);
        return $this->getAll($userId, $guestId);
    }

    public function trimOld(string $owner): void
    {
        $count = MemoriaChat::where('owner_key', $owner)->count();
        if ($count <= self::MAX_MEMORIES) return;
        $excess = $count - self::MAX_MEMORIES;
        MemoriaChat::where('owner_key', $owner)
            ->orderBy('id')
            ->limit($excess)
            ->delete();
    }

    public function mergeLists(array ...$lists): array
    {
        $seen = [];
        $out  = [];
        foreach ($lists as $list) {
            foreach ($list as $item) {
                $norm = strtolower($this->normalize((string)$item));
                if ($norm === '' || isset($seen[$norm])) continue;
                $seen[$norm] = true;
                $out[] = $this->normalize((string)$item);
            }
        }
        return array_slice($out, 0, self::MAX_MEMORIES);
    }

    public function buildPromptBlock(array $memories): string
    {
        if (empty($memories)) return '';
        $block = "## LO QUE RECUERDAS DE ESTA PERSONA (de charlas anteriores)\n\n";
        foreach ($memories as $m) {
            $block .= '- ' . $m . "\n";
        }
        $block .= "\nÚsalo con naturalidad cuando encaje — como quien recuerda a un amigo. "
            . "No digas \"aprendí\", \"mi memoria\" ni \"en nuestra conversación anterior\".\n\n"
            . "---\n\n";
        return $block;
    }

    public function extractFromHistory(array $history, array $existing): array
    {
        if (count($history) < 4) return [];

        $recent = array_slice($history, -24);
        $conv   = '';
        foreach ($recent as $m) {
            if (!isset($m['role'], $m['content'])) continue;
            $who   = $m['role'] === 'assistant' ? 'Mayte' : 'Usuario';
            $conv .= $who . ': ' . trim((string)$m['content']) . "\n";
        }
        if (strlen($conv) < 40) return [];

        $known = empty($existing)
            ? '(ninguna aún)'
            : implode("\n", array_map(fn($x) => '- ' . $x, $existing));

        $prompt = "Analiza esta charla y extrae SOLO datos NUEVOS sobre el USUARIO "
            . "(nombre, gustos, miedos, sueños, estado de ánimo actual, cómo le gusta que le traten, detalles personales).\n\n"
            . "Ya sabes esto (NO repetir):\n$known\n\n"
            . "Conversación reciente:\n$conv\n\n"
            . "Responde con líneas que empiezan con '- '. Máximo 5 puntos clave. "
            . "Si no hay nada nuevo, escribe solo: NINGUNO";

        $reply = $this->groq->extract([
            ['role' => 'system', 'content' => 'Extraes hechos sobre el usuario. Respuestas breves en español.'],
            ['role' => 'user',   'content' => $prompt],
        ]);

        return $this->parseExtracted($reply);
    }

    private function parseExtracted(string $reply): array
    {
        $reply = trim($reply);
        if ($reply === '' || stripos($reply, 'NINGUNO') === 0) return [];
        $lines = preg_split('/\r\n|\r|\n/', $reply);
        $items = [];
        foreach ($lines as $line) {
            $line = trim(preg_replace('/^[-*•]\s*/', '', trim($line)));
            if ($line === '' || stripos($line, 'NINGUNO') === 0) continue;
            $items[] = $line;
        }
        return $items;
    }
}
