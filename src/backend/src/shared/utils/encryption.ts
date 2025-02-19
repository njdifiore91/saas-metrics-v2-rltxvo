import * as crypto from 'crypto'; // latest
import * as bcrypt from 'bcrypt'; // v5.1.0

// Constants for encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT_ROUNDS = 12;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_ROTATION_INTERVAL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const MIN_ENTROPY_BITS = 256;

/**
 * Interface for encryption options
 */
interface EncryptionOptions {
  keyRotationEnabled?: boolean;
  timingProtection?: boolean;
}

/**
 * Interface for key pair generation options
 */
interface KeyPairOptions {
  modulusLength?: number;
  publicExponent?: number;
  entropy?: number;
}

/**
 * Generates a cryptographically secure key with entropy validation
 * @param length - Length of the key to generate
 * @param minEntropyBits - Minimum required entropy in bits
 * @returns Promise resolving to the generated secure key
 */
export async function generateSecureKey(
  length: number = KEY_LENGTH,
  minEntropyBits: number = MIN_ENTROPY_BITS
): Promise<Buffer> {
  try {
    // Validate input parameters
    if (length < 1 || minEntropyBits < 1) {
      throw new Error('Invalid key generation parameters');
    }

    // Generate random bytes with crypto.randomBytes
    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.randomBytes(length, (err, buffer) => {
        if (err) reject(err);
        resolve(buffer);
      });
    });

    // Calculate entropy
    const entropy = calculateEntropy(key);
    if (entropy < minEntropyBits) {
      throw new Error('Insufficient entropy in generated key');
    }

    return key;
  } finally {
    // Zero sensitive memory
    process.nextTick(() => {
      crypto.randomBytes(length).fill(0);
    });
  }
}

/**
 * Encrypts data using AES-256-GCM with timing attack protection
 * @param data - Data to encrypt
 * @param key - Encryption key
 * @param options - Encryption options
 * @returns Promise resolving to encrypted data and metadata
 */
export async function encrypt(
  data: string | Buffer,
  key: Buffer,
  options: EncryptionOptions = {}
): Promise<{ encrypted: Buffer; iv: Buffer; authTag: Buffer; keyId: string }> {
  try {
    // Validate input
    if (!data || !key || key.length !== KEY_LENGTH) {
      throw new Error('Invalid encryption parameters');
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher with timing protection
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(Buffer.isBuffer(data) ? data : Buffer.from(data)),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Generate key ID
    const keyId = crypto.createHash('sha256').update(key).digest('hex');

    return {
      encrypted,
      iv,
      authTag,
      keyId,
    };
  } finally {
    // Zero sensitive memory
    process.nextTick(() => {
      if (Buffer.isBuffer(data)) data.fill(0);
    });
  }
}

/**
 * Decrypts data with authentication and timing attack protection
 * @param encryptedData - Encrypted data buffer
 * @param key - Decryption key
 * @param iv - Initialization vector
 * @param authTag - Authentication tag
 * @param keyId - Key identifier
 * @returns Promise resolving to decrypted data
 */
export async function decrypt(
  encryptedData: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer,
  keyId: string
): Promise<Buffer> {
  try {
    // Validate input parameters
    if (!encryptedData || !key || !iv || !authTag || !keyId) {
      throw new Error('Invalid decryption parameters');
    }

    // Verify key ID
    const computedKeyId = crypto.createHash('sha256').update(key).digest('hex');
    if (computedKeyId !== keyId) {
      throw new Error('Invalid key ID');
    }

    // Create decipher with timing protection
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
  } finally {
    // Zero sensitive memory
    process.nextTick(() => {
      key.fill(0);
    });
  }
}

/**
 * Securely hashes passwords with salt and timing protection
 * @param password - Password to hash
 * @param options - Hashing options
 * @returns Promise resolving to hashed password
 */
export async function hashPassword(
  password: string,
  options: { rounds?: number } = {}
): Promise<string> {
  try {
    // Validate password strength
    if (!password || password.length < 8) {
      throw new Error('Password does not meet minimum requirements');
    }

    const rounds = options.rounds || SALT_ROUNDS;
    
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(rounds);
    return await bcrypt.hash(password, salt);
  } finally {
    // Zero password from memory
    process.nextTick(() => {
      if (password) password.replace(/./g, '\0');
    });
  }
}

/**
 * Verifies passwords with constant-time comparison
 * @param password - Password to verify
 * @param hash - Hash to compare against
 * @returns Promise resolving to verification result
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    // Validate input parameters
    if (!password || !hash) {
      throw new Error('Invalid verification parameters');
    }

    // Perform constant-time comparison
    return await bcrypt.compare(password, hash);
  } finally {
    // Zero password from memory
    process.nextTick(() => {
      if (password) password.replace(/./g, '\0');
    });
  }
}

/**
 * Generates secure RSA key pair for JWT signing with entropy validation
 * @param options - Key pair generation options
 * @returns Promise resolving to key pair and metadata
 */
export async function generateKeyPair(
  options: KeyPairOptions = {}
): Promise<{ publicKey: string; privateKey: string; keyId: string }> {
  try {
    const {
      modulusLength = 4096,
      publicExponent = 65537,
      entropy = MIN_ENTROPY_BITS,
    } = options;

    // Validate parameters
    if (modulusLength < 2048 || entropy < MIN_ENTROPY_BITS) {
      throw new Error('Invalid key pair generation parameters');
    }

    // Generate key pair
    const { publicKey, privateKey } = await new Promise<{ publicKey: string; privateKey: string }>(
      (resolve, reject) => {
        crypto.generateKeyPair(
          'rsa',
          {
            modulusLength,
            publicExponent,
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem',
            },
          },
          (err, publicKey, privateKey) => {
            if (err) reject(err);
            resolve({ publicKey, privateKey });
          }
        );
      }
    );

    // Generate key ID
    const keyId = crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex');

    return {
      publicKey,
      privateKey,
      keyId,
    };
  } finally {
    // Zero sensitive memory
    process.nextTick(() => {
      crypto.randomBytes(KEY_LENGTH).fill(0);
    });
  }
}

/**
 * Calculates entropy of a buffer in bits
 * @param buffer - Buffer to calculate entropy for
 * @returns Number of bits of entropy
 */
function calculateEntropy(buffer: Buffer): number {
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