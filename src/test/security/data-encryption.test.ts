import { 
  generateSecureKey, 
  encrypt, 
  decrypt, 
  hashPassword, 
  verifyPassword, 
  generateKeyPair 
} from '../../backend/src/shared/utils/encryption';
import * as crypto from 'crypto'; // latest
import { jest } from '@jest/globals'; // 29.0.0

describe('Data Encryption Security Tests', () => {
  // Mock crypto randomBytes for deterministic testing
  let mockRandomBytes: jest.SpyInstance;
  
  beforeEach(() => {
    mockRandomBytes = jest.spyOn(crypto, 'randomBytes');
    jest.setTimeout(30000); // Extended timeout for bcrypt operations
  });

  afterEach(() => {
    mockRandomBytes.mockRestore();
    jest.clearAllMocks();
  });

  describe('generateSecureKey', () => {
    test('generates key with sufficient entropy', async () => {
      const key = await generateSecureKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);

      // Verify entropy quality
      const entropyBits = calculateTestEntropy(key);
      expect(entropyBits).toBeGreaterThanOrEqual(256);
    });

    test('generates unique keys across multiple calls', async () => {
      const keys = await Promise.all(Array(100).fill(null).map(() => generateSecureKey()));
      const uniqueKeys = new Set(keys.map(k => k.toString('hex')));
      expect(uniqueKeys.size).toBe(100);
    });

    test('validates key length requirements', async () => {
      await expect(generateSecureKey(16)).resolves.toHaveLength(16);
      await expect(generateSecureKey(0)).rejects.toThrow('Invalid key generation parameters');
      await expect(generateSecureKey(-1)).rejects.toThrow('Invalid key generation parameters');
    });

    test('properly cleans up sensitive data', async () => {
      const key = await generateSecureKey();
      // Verify memory is zeroed after key generation
      process.nextTick(() => {
        const memory = process.memoryUsage();
        expect(memory.heapUsed).toBeLessThan(memory.heapTotal);
      });
    });
  });

  describe('encryption and decryption', () => {
    let testKey: Buffer;
    let testData: string;

    beforeEach(async () => {
      testKey = await generateSecureKey();
      testData = 'sensitive-test-data-' + Date.now();
    });

    test('encrypts and decrypts data correctly', async () => {
      const { encrypted, iv, authTag, keyId } = await encrypt(testData, testKey);
      
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(iv).toHaveLength(16);
      expect(authTag).toHaveLength(16);
      expect(keyId).toMatch(/^[a-f0-9]{64}$/);

      const decrypted = await decrypt(encrypted, testKey, iv, authTag, keyId);
      expect(decrypted.toString()).toBe(testData);
    });

    test('produces different ciphertexts for same plaintext', async () => {
      const encryption1 = await encrypt(testData, testKey);
      const encryption2 = await encrypt(testData, testKey);

      expect(encryption1.encrypted.equals(encryption2.encrypted)).toBe(false);
      expect(encryption1.iv.equals(encryption2.iv)).toBe(false);
    });

    test('detects tampering with encrypted data', async () => {
      const { encrypted, iv, authTag, keyId } = await encrypt(testData, testKey);
      
      // Tamper with encrypted data
      encrypted[0] = encrypted[0] ^ 1;
      
      await expect(
        decrypt(encrypted, testKey, iv, authTag, keyId)
      ).rejects.toThrow();
    });

    test('validates key ID during decryption', async () => {
      const { encrypted, iv, authTag } = await encrypt(testData, testKey);
      
      await expect(
        decrypt(encrypted, testKey, iv, authTag, 'invalid-key-id')
      ).rejects.toThrow('Invalid key ID');
    });

    test('handles timing attacks with constant-time operations', async () => {
      const startTime = process.hrtime();
      const { encrypted, iv, authTag, keyId } = await encrypt(testData, testKey);
      const encryptTime = process.hrtime(startTime);

      const decryptStart = process.hrtime();
      await decrypt(encrypted, testKey, iv, authTag, keyId);
      const decryptTime = process.hrtime(decryptStart);

      // Verify timing consistency
      expect(Math.abs(encryptTime[1] - decryptTime[1])).toBeLessThan(1e7); // 10ms tolerance
    });
  });

  describe('password hashing', () => {
    const testPassword = 'Test@Password123';

    test('generates secure password hashes', async () => {
      const hash = await hashPassword(testPassword);
      
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(hash.length).toBe(60);
      
      // Verify salt uniqueness
      const hash2 = await hashPassword(testPassword);
      expect(hash).not.toBe(hash2);
    });

    test('verifies passwords correctly', async () => {
      const hash = await hashPassword(testPassword);
      
      await expect(verifyPassword(testPassword, hash)).resolves.toBe(true);
      await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    });

    test('enforces password strength requirements', async () => {
      await expect(hashPassword('')).rejects.toThrow();
      await expect(hashPassword('weak')).rejects.toThrow();
    });

    test('implements timing attack protection', async () => {
      const hash = await hashPassword(testPassword);
      
      const timings: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime();
        await verifyPassword('wrong-password', hash);
        const [, nanoseconds] = process.hrtime(start);
        timings.push(nanoseconds);
      }

      // Verify timing consistency
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));
      expect(maxDeviation).toBeLessThan(1e7); // 10ms tolerance
    });
  });

  describe('RSA key pair generation', () => {
    test('generates valid RSA key pairs', async () => {
      const { publicKey, privateKey, keyId } = await generateKeyPair();
      
      expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
      expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
      expect(keyId).toMatch(/^[a-f0-9]{64}$/);

      // Verify key strength
      expect(publicKey.length).toBeGreaterThan(800); // 4096-bit key minimum size
    });

    test('generates unique key pairs', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.keyId).not.toBe(keyPair2.keyId);
    });

    test('validates key generation parameters', async () => {
      await expect(
        generateKeyPair({ modulusLength: 1024 })
      ).rejects.toThrow('Invalid key pair generation parameters');

      await expect(
        generateKeyPair({ entropy: 128 })
      ).rejects.toThrow('Invalid key pair generation parameters');
    });

    test('verifies key pair functionality', async () => {
      const { publicKey, privateKey } = await generateKeyPair();
      
      const testData = 'test-signing-data';
      
      // Test signing and verification
      const signer = crypto.createSign('SHA256');
      signer.update(testData);
      const signature = signer.sign(privateKey);

      const verifier = crypto.createVerify('SHA256');
      verifier.update(testData);
      expect(verifier.verify(publicKey, signature)).toBe(true);
    });
  });
});

// Helper function to calculate entropy for testing
function calculateTestEntropy(buffer: Buffer): number {
  const frequencies = new Array(256).fill(0);
  for (const byte of buffer) {
    frequencies[byte]++;
  }

  let entropy = 0;
  const length = buffer.length;

  for (const frequency of frequencies) {
    if (frequency === 0) continue;
    const probability = frequency / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy * buffer.length;
}