<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transfer_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('transfer_header_id')->constrained('transfer_headers')->onDelete('cascade');
    $table->string('handling_unit'); // Menyimpan nomor Handling Unit
    $table->string('description')->nullable(); // Deskripsi HU dari SAP
    $table->integer('quantity')->default(1); // Kuantitas HU selalu 1
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transfer_items');
    }
};
