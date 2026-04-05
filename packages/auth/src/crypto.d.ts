export declare function encrypt(plaintext: string): string;
export declare function decrypt(ciphertext: string): string;
export declare function encryptObject<T extends Record<string, unknown>>(obj: T, fields: string[]): T;
export declare function decryptObject<T extends Record<string, unknown>>(obj: T, fields: string[]): T;
export declare function hashToken(token: string): string;
export declare function secureCompare(a: string, b: string): boolean;
export declare function generateSecureId(): string;
//# sourceMappingURL=crypto.d.ts.map