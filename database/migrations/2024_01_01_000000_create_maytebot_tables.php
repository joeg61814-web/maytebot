<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Usuarios ─────────────────────────────────────────
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username', 64)->unique();
            $table->string('email', 255)->unique();
            $table->string('password', 255);
            $table->string('idioma', 10)->default('es');
            $table->date('fecha_nacimiento')->nullable();
            $table->string('foto_perfil', 255)->nullable();
            $table->tinyInteger('vip_activo')->default(0);
            $table->dateTime('vip_vence')->nullable();
            $table->integer('tokens')->default(10);
            $table->integer('msgs')->default(0);
            $table->tinyInteger('terminos_aceptados')->default(0);
            $table->enum('estado', ['activo','inactivo','baneado'])->default('activo');
            $table->tinyInteger('banned')->default(0);
            $table->tinyInteger('email_verificado')->default(0);
            $table->string('token_verificacion', 64)->nullable();
            $table->string('token_reset', 64)->nullable();
            $table->dateTime('token_reset_expiry')->nullable();
            $table->timestamps();
        });

        // ── Correos baneados ──────────────────────────────────
        Schema::create('correos_baneados', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255)->unique();
            $table->string('motivo', 100)->default('manual');
            $table->timestamps();
        });

        // ── Infracciones ──────────────────────────────────────
        Schema::create('infracciones', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('usuario_id');
            $table->text('mensaje');
            $table->enum('sancion', ['advertencia','bloqueo_temporal','baneo_permanente']);
            $table->timestamps();
        });

        // ── Conversaciones ────────────────────────────────────
        Schema::create('conversaciones', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('usuario_id');
            $table->enum('rol', ['user','assistant']);
            $table->text('contenido');
            $table->timestamp('created_at')->useCurrent();
            $table->index('usuario_id');
        });

        // ── Memorias del chat ─────────────────────────────────
        Schema::create('memorias_chat', function (Blueprint $table) {
            $table->id();
            $table->string('owner_key', 80);
            $table->string('contenido', 500);
            $table->timestamps();
            $table->index('owner_key');
        });

        // ── Mayte fotos ───────────────────────────────────────
        Schema::create('mayte_fotos', function (Blueprint $table) {
            $table->id();
            $table->string('ruta', 255);
            $table->integer('semana_activa')->unique();
            $table->timestamps();
        });

        // ── Palabras prohibidas ───────────────────────────────
        Schema::create('palabras_prohibidas', function (Blueprint $table) {
            $table->id();
            $table->string('palabra', 100);
            $table->string('idioma', 10)->default('all');
            $table->unique(['palabra', 'idioma']);
        });

        // ── Sesiones ──────────────────────────────────────────
        Schema::create('sesiones', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('usuario_id');
            $table->string('token', 64)->unique();
            $table->dateTime('expiry');
            $table->timestamps();
            $table->index('usuario_id');
        });

        // ── Suscripciones VIP ─────────────────────────────────
        Schema::create('suscripciones_vip', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('usuario_id');
            $table->string('stripe_sub_id', 255)->unique();
            $table->tinyInteger('activo')->default(1);
            $table->dateTime('vence_at')->nullable();
            $table->timestamps();
        });

        // ── Wallpapers ────────────────────────────────────────
        Schema::create('wallpapers', function (Blueprint $table) {
            $table->id();
            $table->enum('tipo', ['foto','video']);
            $table->enum('categoria', ['casual','elegante','divertido','nocturno','especial']);
            $table->enum('nivel', ['free','premium']);
            $table->string('ruta', 255);
            $table->dateTime('disponible_hasta')->nullable();
            $table->tinyInteger('activo')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallpapers');
        Schema::dropIfExists('suscripciones_vip');
        Schema::dropIfExists('sesiones');
        Schema::dropIfExists('palabras_prohibidas');
        Schema::dropIfExists('mayte_fotos');
        Schema::dropIfExists('memorias_chat');
        Schema::dropIfExists('conversaciones');
        Schema::dropIfExists('infracciones');
        Schema::dropIfExists('correos_baneados');
        Schema::dropIfExists('users');
    }
};
