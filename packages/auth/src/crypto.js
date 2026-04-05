import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
function getKey(password) {
    const salt = process.env.ENCRYPTION_SALT || 'nexus-default-salt-change-in-prod';
    return scryptSync(password, salt, KEY_LENGTH);
}
export function encrypt(plaintext) {
    const key = getKey(process.env.ENCRYPTION_KEY || 'dev-key-change-in-production');
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
export function decrypt(ciphertext) {
    const key = getKey(process.env.ENCRYPTION_KEY || 'dev-key-change-in-production');
    const parts = ciphertext.split(':');
    const ivHex = parts[0];
    const authTagHex = parts[1];
    const encrypted = parts[2];
    if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid ciphertext format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
export function encryptObject(obj, fields) {
    const result = { ...obj };
    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = encrypt(result[field]);
        }
    }
    return result;
}
export function decryptObject(obj, fields) {
    const result = { ...obj };
    for (const field of fields) {
        if (result[field] && typeof result[field] === 'string') {
            try {
                result[field] = decrypt(result[field]);
            }
            catch {
            }
        }
    }
    return result;
}
export function hashToken(token) {
    return randomBytes(32).toString('hex') + token.slice(0, 8);
}
export function secureCompare(a, b) {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
export function generateSecureId() {
    return randomBytes(16).toString('hex');
}
//# sourceMappingURL=crypto.js.map