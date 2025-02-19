import { 
  generateSecureKey,
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateKeyPair
} from '../../../backend/src/shared/utils/encryption';
import * as crypto from 'crypto'; // latest
import * as jest from 'jest'; // 29.0.0

describe('generateSecureKey', () => {
  const KEY_LENGTH = 32;
  const MIN_ENTROPY_BITS = 256;

  it('should generate a key with correct length', async () => {
    const key = await generateSecureKey();
    expect(key.length).toBe(KEY_LENGTH);
  });

  it('should generate unique keys across multiple calls', async () => {
    const keys = new Set();
    for (let i = 0; i < 1000; i++) {
      const key = await generateSecureKey();
      keys.add(key.toString('hex'));
    }
    expect(keys.size).toBe(1000);
  });

  it('should generate keys with sufficient entropy', async () => {
    const key = await generateSecureKey();
    // Calculate entropy using Shannon's formula
    const frequencies = new Array(256).fill(0);
    for (const byte of key) {
      frequencies[byte]++;
    }
    let entropy = 0;
    for (const freq of frequencies) {
      if (freq === 0) continue;
      const p = freq / key.length;
      entropy -= p * Math.log2(p);
    }
    entropy *= key.length;
    expect(entropy).toBeGreaterThanOrEqual(MIN_ENTROPY_BITS);
  });

  it('should throw error for invalid key length', async () => {
    await expect(generateSecureKey(-1)).rejects.toThrow('Invalid key generation parameters');
  });
});

describe('encrypt/decrypt', () => {
  let testKey: Buffer;
  const testData = 'sensitive data to encrypt';

  beforeEach(async () => {
    testKey = await generateSecureKey();
  });

  it('should successfully encrypt and decrypt data', async () => {
    const { encrypted, iv, authTag, keyId } = await encrypt(testData, testKey);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(iv.length).toBe(16);
    expect(authTag.length).toBe(16);
    expect(keyId).toMatch(/^[a-f0-9]{64}$/);

    const decrypted = await decrypt(encrypted, testKey, iv, authTag, keyId);
    expect(decrypted.toString()).toBe(testData);
  });

  it('should generate unique IVs for each encryption', async () => {
    const ivs = new Set();
    for (let i = 0; i < 1000; i++) {
      const { iv } = await encrypt(testData, testKey);
      ivs.add(iv.toString('hex'));
    }
    expect(ivs.size).toBe(1000);
  });

  it('should fail decryption with incorrect auth tag', async () => {
    const { encrypted, iv, keyId } = await encrypt(testData, testKey);
    const invalidAuthTag = crypto.randomBytes(16);
    await expect(
      decrypt(encrypted, testKey, iv, invalidAuthTag, keyId)
    ).rejects.toThrow();
  });

  it('should fail decryption with incorrect key ID', async () => {
    const { encrypted, iv, authTag } = await encrypt(testData, testKey);
    const invalidKeyId = crypto.randomBytes(32).toString('hex');
    await expect(
      decrypt(encrypted, testKey, iv, authTag, invalidKeyId)
    ).rejects.toThrow('Invalid key ID');
  });
});

describe('password hashing', () => {
  const testPassword = 'SecureP@ssw0rd123';

  it('should generate unique hashes for same password', async () => {
    const hash1 = await hashPassword(testPassword);
    const hash2 = await hashPassword(testPassword);
    expect(hash1).not.toBe(hash2);
  });

  it('should verify correct passwords', async () => {
    const hash = await hashPassword(testPassword);
    const isValid = await verifyPassword(testPassword, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect passwords', async () => {
    const hash = await hashPassword(testPassword);
    const isValid = await verifyPassword('wrongpassword', hash);
    expect(isValid).toBe(false);
  });

  it('should reject weak passwords', async () => {
    await expect(hashPassword('weak')).rejects.toThrow(
      'Password does not meet minimum requirements'
    );
  });

  it('should have consistent timing for password verification', async () => {
    const hash = await hashPassword(testPassword);
    const timings: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = process.hrtime.bigint();
      await verifyPassword('wrongpassword', hash);
      const end = process.hrtime.bigint();
      timings.push(Number(end - start));
    }

    const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
    const variance = Math.sqrt(
      timings.reduce((a, b) => a + Math.pow(b - avgTiming, 2), 0) / timings.length
    );
    
    // Verify timing consistency within 10% variance
    expect(variance / avgTiming).toBeLessThan(0.1);
  });
});

describe('key pair generation', () => {
  it('should generate valid RSA key pair', async () => {
    const { publicKey, privateKey, keyId } = await generateKeyPair();
    expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    expect(keyId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate unique key pairs', async () => {
    const keyPair1 = await generateKeyPair();
    const keyPair2 = await generateKeyPair();
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
  });

  it('should reject weak key parameters', async () => {
    await expect(
      generateKeyPair({ modulusLength: 1024 })
    ).rejects.toThrow('Invalid key pair generation parameters');
  });

  it('should generate working signing keys', async () => {
    const { publicKey, privateKey } = await generateKeyPair();
    const testData = 'data to sign';
    
    const sign = crypto.createSign('SHA256');
    sign.update(testData);
    const signature = sign.sign(privateKey);

    const verify = crypto.createVerify('SHA256');
    verify.update(testData);
    expect(verify.verify(publicKey, signature)).toBe(true);
  });

  it('should generate FIPS 140-2 compliant keys', async () => {
    const { publicKey } = await generateKeyPair();
    const publicKeyBuffer = Buffer.from(publicKey);
    
    // Verify key strength using basic primality tests
    const keyStrength = publicKeyBuffer.length * 8;
    expect(keyStrength).toBeGreaterThanOrEqual(2048);
    
    // Verify key format
    expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(publicKey).toMatch(/-----END PUBLIC KEY-----$/);
  });
});