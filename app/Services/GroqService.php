<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GroqService
{
    private array $keys;
    private string $model;
    private string $modelFallback;
    private int $maxTokens;
    private string $statePath;

    public function __construct()
    {
        $this->model         = 'llama-3.3-70b-versatile';
        $this->modelFallback = 'llama-3.1-8b-instant';
        $this->maxTokens     = 400;
        $this->statePath     = storage_path('app/groq-state.json');
        $this->keys          = $this->loadKeys();
    }

    private function loadKeys(): array
    {
        $keys = [];
        $multi = env('GROQ_API_KEYS', '');
        if ($multi) {
            foreach (explode(',', $multi) as $k) {
                $k = trim($k);
                if ($k && str_starts_with($k, 'gsk_')) $keys[] = $k;
            }
        }
        $primary = env('GROQ_API_KEY', '');
        if ($primary && str_starts_with($primary, 'gsk_')) $keys[] = $primary;

        for ($i = 2; $i <= 20; $i++) {
            $k = env("GROQ_API_KEY_$i", '');
            if ($k && str_starts_with($k, 'gsk_')) $keys[] = $k;
        }
        return array_values(array_unique($keys));
    }

    private function loadState(): array
    {
        if (!file_exists($this->statePath)) {
            return ['last_key' => 0, 'blocked' => [], 'invalid' => []];
        }
        $data = json_decode(file_get_contents($this->statePath), true);
        return is_array($data) ? array_merge(['last_key' => 0, 'blocked' => [], 'invalid' => []], $data) : ['last_key' => 0, 'blocked' => [], 'invalid' => []];
    }

    private function saveState(array $state): void
    {
        file_put_contents($this->statePath, json_encode($state), LOCK_EX);
    }

    private function isKeyBlocked(int $index, array $state): bool
    {
        if (in_array($index, $state['invalid'] ?? [], true)) return true;
        $until = $state['blocked'][$index] ?? 0;
        return $until > time();
    }

    private function parseRetrySeconds(string $response): int
    {
        if (preg_match('/try again in (\d+)m([\d.]+)?s/i', $response, $m)) {
            return (int)$m[1] * 60 + (isset($m[2]) ? (int)ceil((float)$m[2]) : 0) + 15;
        }
        if (preg_match('/try again in ([\d.]+)s/i', $response, $m)) {
            return (int)ceil((float)$m[1]) + 10;
        }
        return 120;
    }

    private function keyIndicesOrdered(): array
    {
        $count = count($this->keys);
        if ($count === 0) return [];
        $state = $this->loadState();
        $start = (int)($state['last_key'] ?? 0) % $count;
        $indices = [];
        for ($i = 0; $i < $count; $i++) {
            $indices[] = ($start + $i) % $count;
        }
        return $indices;
    }

    private function makeRequest(array $messages, string $model, string $apiKey, int $maxTokens = 0, float $temperature = 0.92): array
    {
        $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS     => json_encode([
                'model'       => $model,
                'max_tokens'  => $maxTokens ?: $this->maxTokens,
                'messages'    => $messages,
                'temperature' => $temperature,
            ]),
            CURLOPT_SSL_VERIFYPEER => app()->environment('production'),
            CURLOPT_SSL_VERIFYHOST => app()->environment('production') ? 2 : 0,
            CURLOPT_TIMEOUT        => 45,
        ]);
        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);
        return ['httpCode' => $httpCode, 'response' => $response, 'error' => $error];
    }

    private function parseReply($response): ?string
    {
        $data = json_decode((string)$response, true);
        return $data['choices'][0]['message']['content'] ?? null;
    }

    public function chat(array $messages): string
    {
        if (empty($this->keys)) return 'Falta configurar GROQ_API_KEY en el .env';

        $models  = [$this->model, $this->modelFallback];
        $state   = $this->loadState();
        $lastRL  = null;
        $hadNet  = false;

        foreach ($models as $model) {
            foreach ($this->keyIndicesOrdered() as $keyIndex) {
                if (!isset($this->keys[$keyIndex])) continue;
                if ($this->isKeyBlocked($keyIndex, $state)) continue;

                $result = $this->makeRequest($messages, $model, $this->keys[$keyIndex]);

                if ($result['error']) { $hadNet = true; continue; }

                if ($result['httpCode'] === 200) {
                    $state['last_key'] = $keyIndex;
                    unset($state['blocked'][$keyIndex]);
                    $this->saveState($state);
                    $reply = $this->parseReply($result['response']);
                    if ($reply !== null) return $reply;
                    continue;
                }

                if (in_array($result['httpCode'], [401, 403], true)) {
                    if (!in_array($keyIndex, $state['invalid'], true)) $state['invalid'][] = $keyIndex;
                    $this->saveState($state);
                    continue;
                }

                if (in_array($result['httpCode'], [429, 413], true)) {
                    $state['blocked'][$keyIndex] = time() + $this->parseRetrySeconds((string)$result['response']);
                    $this->saveState($state);
                    $lastRL = (string)$result['response'];
                    continue;
                }
            }
        }

        if ($lastRL !== null) {
            $secs = $this->parseRetrySeconds($lastRL);
            $mins = max(1, (int)ceil($secs / 60));
            return "ay, me quedé sin energía un ratito 😅 intenta en unos {$mins} minutos, ¿sí?";
        }
        if ($hadNet) return 'Ay no, se me fue la señal. Intenta de nuevo 🙏';
        return 'Algo pasó por acá, intenta en un momento';
    }

    public function extract(array $messages): string
    {
        if (empty($this->keys)) return 'NINGUNO';
        $state = $this->loadState();
        foreach ($this->keyIndicesOrdered() as $keyIndex) {
            if (!isset($this->keys[$keyIndex])) continue;
            if ($this->isKeyBlocked($keyIndex, $state)) continue;
            $result = $this->makeRequest($messages, $this->modelFallback, $this->keys[$keyIndex], 180, 0.3);
            if ($result['httpCode'] === 200) {
                $reply = $this->parseReply($result['response']);
                if ($reply !== null) return $reply;
            }
            if (in_array($result['httpCode'], [429, 413], true)) {
                $state['blocked'][$keyIndex] = time() + $this->parseRetrySeconds((string)$result['response']);
                $this->saveState($state);
            }
        }
        return 'NINGUNO';
    }
}
