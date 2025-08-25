<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use SAPNWRFC\Connection as SapConnection;
use SAPNWRFC\Exception as SapException;

class SAPService
{
    /**
     * Properti untuk menyimpan instance koneksi SAP dalam satu request.
     * @var SapConnection|null
     */
    protected $sapConnection = null;

    /**
     * Membuat koneksi ke SAP dan menyimpannya di session jika berhasil.
     *
     * @param string $user
     * @param string $password
     * @return bool
     * @throws \Exception
     */
    public function login(string $user, string $password): bool
    {
        $config = [
            'ashost' => env('192.168.254.154'),
            'sysnr'  => env('01'),
            'client' => env('300'),
            'user'   => $user,
            'passwd' => $password,
            'lang'   => 'EN',
        ];

        try {
            // Coba buat koneksi untuk memvalidasi kredensial
            $connection = new SapConnection($config);
            $connection->ping();
            $connection->close(); // Tutup koneksi setelah validasi berhasil

            // Simpan kredensial yang dienkripsi ke session
            session([
                'sap_user' => $user,
                'sap_password_encrypted' => Crypt::encryptString($password)
            ]);

            return true; // Login berhasil

        } catch (SapException $e) {
            Log::error("SAP Login Exception for user {$user}: " . $e->getMessage());
            // Lempar exception agar bisa ditangkap oleh Controller
            throw new \Exception('SAP Connection Failed: Invalid credentials or connection issue.');
        }
    }

    /**
     * Menghapus kredensial SAP dari session.
     */
    public function logout(): void
    {
        session()->forget(['sap_user', 'sap_password_encrypted']);
    }

    /**
     * Helper untuk mendapatkan koneksi SAP yang valid.
     * Membuat koneksi baru jika belum ada, menggunakan kredensial dari session.
     *
     * @return SapConnection
     * @throws \Exception
     */
    private function getConnection(): SapConnection
    {
        // Jika koneksi sudah ada di request ini, gunakan yang sudah ada.
        if ($this->sapConnection !== null) {
            return $this->sapConnection;
        }

        // Cek apakah kredensial ada di session
        if (!session('sap_user') || !session('sap_password_encrypted')) {
            throw new \Exception("Not logged in to SAP.");
        }

        try {
            $config = [
                'ashost' => env('192.168.254.154'),
                'sysnr'  => env('01'),
                'client' => env('300'),
                'user'   => session('sap_user'),
                'passwd' => Crypt::decryptString(session('sap_password_encrypted')),
                'lang'   => 'EN',
            ];

            // Buat dan simpan koneksi untuk digunakan di request ini
            $this->sapConnection = new SapConnection($config);
            return $this->sapConnection;

        } catch (SapException $e) {
            Log::error("SAP Re-connection Exception: " . $e->getMessage());
            throw new \Exception('Failed to establish SAP connection: ' . $e->getMessage());
        }
    }

    /**
     * Mengambil data Handling Unit dari SAP berdasarkan barcode.
     *
     * @param string $barcode
     * @return array|null
     */
    public function getHandlingUnitByBarcode(string $barcode)
    {
        try {
            $connection = $this->getConnection();
            // TODO: Implementasikan logika pemanggilan RFC untuk mendapatkan data HU
            // Contoh:
            // $function = $connection->getFunction('ZRFC_GET_HU_DATA');
            // $result = $function->invoke(['I_BARCODE' => $barcode]);
            // return $result['E_HU_DATA']; // Sesuaikan dengan struktur balikan RFC Anda

            // Data dummy untuk contoh
            return ['handling_unit' => $barcode, 'description' => 'Dummy Material Description', 'sloc' => '1000'];

        } catch (\Exception $e) {
            Log::error("getHandlingUnitByBarcode failed: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Memposting stock transfer ke SAP.
     *
     * @param array $data
     * @return array
     * @throws \Exception
     */
    public function postStockTransfer(array $data): array
    {
        $connection = $this->getConnection();

        // TODO: Implementasikan logika pemanggilan RFC ZRFC_HU_GOODS_MOVEMENT
        // Contoh:
        // $function = $connection->getFunction('ZRFC_HU_GOODS_MOVEMENT');
        // $params = [
        //     'IT_ITEMS' => array_map(function($item) {
        //         return ['HU_NUMBER' => $item['handling_unit']];
        //     }, $data['items']),
        //     'I_SOURCE_SLOC' => $data['source_sloc'],
        //     'I_DEST_SLOC' => $data['destination_sloc'],
        // ];
        // $result = $function->invoke($params);

        // if (!empty($result['E_ERROR_MESSAGE'])) {
        //     return ['error' => $result['E_ERROR_MESSAGE']];
        // }
        // return ['sap_document_number' => $result['E_DOC_NUMBER']];

        // Data dummy untuk contoh
        return ['sap_document_number' => 'DOC' . rand(1000, 9999)];
    }

    /**
     * Mengambil daftar Storage Location dari SAP.
     *
     * @return array
     */
    public function getStorageLocations(): array
    {
         try {
            $connection = $this->getConnection();
            // TODO: Implementasikan logika untuk mengambil data Sloc

            // Data dummy untuk contoh
            return [
                ['id' => '1000', 'name' => 'Main Warehouse'],
                ['id' => '1001', 'name' => 'Production Area'],
                ['id' => '1002', 'name' => 'Shipping Area'],
            ];
        } catch (\Exception $e) {
            Log::error("getStorageLocations failed: " . $e->getMessage());
            return [];
        }
    }
}
