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
        Schema::create('transfer_headers', function (Blueprint $table) {
    $table->id();
    $table->string('source_sloc_id');
    $table->string('destination_sloc_id');
    $table->foreignId('user_id')->constrained('users');
    $table->string('sap_document_number')->nullable(); // No. dok material dari SAP
    $table->timestamps();
});
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transfer_headers');
    }
};
