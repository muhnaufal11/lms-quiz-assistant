const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const CERTS_DIR = path.join(__dirname, 'certs');
const CA_CERT_PATH = path.join(CERTS_DIR, 'ca-cert.pem');
const CA_KEY_PATH = path.join(CERTS_DIR, 'ca-key.pem');

let caCert = null;
let caKey = null;
const certCache = new Map();

function generateCA() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
        { name: 'commonName', value: 'LMS SEB Proxy CA' },
        { name: 'organizationName', value: 'LMS Assistant' },
        { name: 'countryName', value: 'ID' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', keyCertSign: true, digitalSignature: true, cRLSign: true },
        { name: 'subjectKeyIdentifier' },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });
    fs.writeFileSync(CA_CERT_PATH, certPem);
    fs.writeFileSync(CA_KEY_PATH, keyPem);

    return { cert, key: keys.privateKey, certPem, keyPem };
}

function init() {
    if (fs.existsSync(CA_CERT_PATH) && fs.existsSync(CA_KEY_PATH)) {
        const certPem = fs.readFileSync(CA_CERT_PATH, 'utf8');
        const keyPem = fs.readFileSync(CA_KEY_PATH, 'utf8');
        caCert = forge.pki.certificateFromPem(certPem);
        caKey = forge.pki.privateKeyFromPem(keyPem);
        return { certPem, keyPem, generated: false };
    }

    const result = generateCA();
    caCert = result.cert;
    caKey = result.key;
    return { certPem: result.certPem, keyPem: result.keyPem, generated: true };
}

function getCert(hostname) {
    if (certCache.has(hostname)) return certCache.get(hostname);

    if (!caCert || !caKey) throw new Error('CA not initialized — call init() first');

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = Date.now().toString(16);
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    cert.setSubject([{ name: 'commonName', value: hostname }]);
    cert.setIssuer(caCert.subject.attributes);
    cert.setExtensions([
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true },
        {
            name: 'subjectAltName',
            altNames: [{ type: 2, value: hostname }],
        },
    ]);
    cert.sign(caKey, forge.md.sha256.create());

    const result = {
        cert: forge.pki.certificateToPem(cert),
        key: forge.pki.privateKeyToPem(keys.privateKey),
    };
    certCache.set(hostname, result);
    return result;
}

module.exports = { init, getCert, CA_CERT_PATH };
