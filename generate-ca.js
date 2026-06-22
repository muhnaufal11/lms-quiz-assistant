const certManager = require('./cert-manager');

console.log('[CA Generator] Generating Root CA certificate...\n');

const result = certManager.init();

if (result.generated) {
    console.log('Root CA certificate berhasil dibuat!\n');
} else {
    console.log('Root CA certificate sudah ada (tidak di-generate ulang).\n');
}

console.log(`File CA cert : ${certManager.CA_CERT_PATH}`);
console.log('');
console.log('=== LANGKAH INSTALL (Windows) ===');
console.log('');
console.log('1. Buka file ca-cert.pem (double-click)');
console.log('2. Klik "Install Certificate..."');
console.log('3. Pilih "Current User" → Next');
console.log('4. Pilih "Place all certificates in the following store"');
console.log('5. Browse → pilih "Trusted Root Certification Authorities"');
console.log('6. Next → Finish → Yes (konfirmasi)');
console.log('');
console.log('Atau via command line (run as Administrator):');
console.log(`  certutil -addstore -user Root "${certManager.CA_CERT_PATH}"`);
console.log('');
console.log('Setelah CA terinstall, jalankan proxy:');
console.log('  npm start');
