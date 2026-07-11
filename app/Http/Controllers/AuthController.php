<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Sesion;
use App\Models\CorreoBaneado;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // ── POST /api/register ────────────────────────────────────
    public function register(Request $request): JsonResponse
    {
        $username = strtolower(trim($request->input('username', '')));
        $email    = strtolower(trim($request->input('email', '')));
        $password = $request->input('password', '');

        if (!$username || !$email || !$password) {
            return response()->json(['error' => 'Completa todos los campos'], 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json(['error' => 'Correo electrónico no válido'], 400);
        }
        if (strlen($password) < 6) {
            return response()->json(['error' => 'La contraseña debe tener al menos 6 caracteres'], 400);
        }
        if (!preg_match('/^[a-z0-9_]{3,20}$/', $username)) {
            return response()->json(['error' => 'Usuario no válido (letras, números y _, 3-20 caracteres)'], 400);
        }
        if (CorreoBaneado::where('email', $email)->exists()) {
            return response()->json(['error' => 'Este correo no puede registrarse'], 403);
        }
        if (User::where('username', $username)->orWhere('email', $email)->exists()) {
            return response()->json(['error' => 'El usuario o el correo ya están en uso'], 409);
        }

        User::create([
            'username' => $username,
            'email'    => $email,
            'password' => Hash::make($password),
            'estado'   => 'activo',
            'tokens'   => 10,
        ]);

        return response()->json(['success' => true, 'message' => 'Cuenta creada exitosamente. Ya puedes iniciar sesión.']);
    }

    // ── POST /api/login ───────────────────────────────────────
    public function login(Request $request): JsonResponse
    {
        $username = strtolower(trim($request->input('username', '')));
        $password = $request->input('password', '');

        if (!$username || !$password) {
            return response()->json(['error' => 'Completa todos los campos'], 400);
        }

        $user = User::where('username', $username)->orWhere('email', $username)->first();
        if (!$user) {
            return response()->json(['error' => 'Usuario no encontrado'], 401);
        }
        if ($user->banned || $user->estado === 'baneado') {
            return response()->json(['error' => 'Cuenta suspendida 🚫'], 403);
        }
        if (!Hash::check($password, $user->password)) {
            return response()->json(['error' => 'Contraseña incorrecta'], 401);
        }

        if ($user->estado === 'inactivo') {
            $user->update(['estado' => 'activo']);
        }

        // VIP check
        $isVip = (bool)$user->vip_activo;
        if ($isVip && $user->vip_vence && strtotime($user->vip_vence) < time()) {
            $isVip = false;
            $user->update(['vip_activo' => 0]);
        }

        // Sesión server-side
        $token  = bin2hex(random_bytes(32));
        $expiry = now()->addDays(7);
        Sesion::where('usuario_id', $user->id)->delete();
        Sesion::create(['usuario_id' => $user->id, 'token' => $token, 'expiry' => $expiry]);

        return response()->json([
            'success'   => true,
            'username'  => $user->username,
            'tokens'    => (int)$user->tokens,
            'msgs'      => (int)$user->msgs,
            'idioma'    => $user->idioma,
            'foto'      => $user->foto_perfil,
            'vip'       => $isVip,
            'vip_vence' => $user->vip_vence,
            'token'     => $token,
        ]);
    }

    // ── POST /api/logout ──────────────────────────────────────
    public function logout(Request $request): JsonResponse
    {
        $token = $request->input('token', $request->bearerToken());
        if ($token) Sesion::where('token', $token)->delete();
        return response()->json(['success' => true]);
    }
}
