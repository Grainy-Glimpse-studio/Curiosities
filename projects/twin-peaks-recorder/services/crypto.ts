/**
 * Crypto Service - 使用 Web Crypto API 加密/解密 API Keys
 *
 * 流程：
 * 1. 用户密码 + salt → PBKDF2 派生密钥
 * 2. 派生密钥 + AES-GCM → 加密 API key
 * 3. 存储：salt + iv + ciphertext（Base64 编码）
 */

// 将 ArrayBuffer 转为 Base64 字符串
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 将 Base64 字符串转为 Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// 从密码派生加密密钥
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // 将密码转为 key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 使用 PBKDF2 派生 AES-GCM 密钥
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000, // 迭代次数，越高越安全但越慢
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedData {
  salt: string;      // Base64 encoded
  iv: string;        // Base64 encoded
  ciphertext: string; // Base64 encoded
}

/**
 * 加密字符串
 * @param plaintext 要加密的明文（如 API key）
 * @param password 用户密码
 * @returns 加密后的数据（可以直接存入数据库）
 */
export async function encrypt(plaintext: string, password: string): Promise<EncryptedData> {
  // 生成随机 salt 和 iv
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 派生密钥
  const key = await deriveKey(password, salt);

  // 加密
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * 解密字符串
 * @param encryptedData 加密的数据
 * @param password 用户密码
 * @returns 解密后的明文
 */
export async function decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
  const salt = base64ToUint8Array(encryptedData.salt);
  const iv = base64ToUint8Array(encryptedData.iv);
  const ciphertext = base64ToUint8Array(encryptedData.ciphertext);

  // 派生密钥（使用相同的 salt）
  const key = await deriveKey(password, salt);

  // 解密
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * 加密多个 API keys
 */
export interface ApiKeysPlaintext {
  deepgram?: string;
  aliyunAccessKeyId?: string;
  aliyunAccessKeySecret?: string;
  aliyunAppKey?: string;
  openai?: string;
}

export interface ApiKeysEncrypted {
  deepgram?: EncryptedData;
  aliyunAccessKeyId?: EncryptedData;
  aliyunAccessKeySecret?: EncryptedData;
  aliyunAppKey?: EncryptedData;
  openai?: EncryptedData;
}

/**
 * 加密所有 API keys
 */
export async function encryptApiKeys(
  keys: ApiKeysPlaintext,
  password: string
): Promise<ApiKeysEncrypted> {
  const result: ApiKeysEncrypted = {};

  if (keys.deepgram) {
    result.deepgram = await encrypt(keys.deepgram, password);
  }
  if (keys.aliyunAccessKeyId) {
    result.aliyunAccessKeyId = await encrypt(keys.aliyunAccessKeyId, password);
  }
  if (keys.aliyunAccessKeySecret) {
    result.aliyunAccessKeySecret = await encrypt(keys.aliyunAccessKeySecret, password);
  }
  if (keys.aliyunAppKey) {
    result.aliyunAppKey = await encrypt(keys.aliyunAppKey, password);
  }
  if (keys.openai) {
    result.openai = await encrypt(keys.openai, password);
  }

  return result;
}

/**
 * 解密所有 API keys
 */
export async function decryptApiKeys(
  encryptedKeys: ApiKeysEncrypted,
  password: string
): Promise<ApiKeysPlaintext> {
  const result: ApiKeysPlaintext = {};

  try {
    if (encryptedKeys.deepgram) {
      result.deepgram = await decrypt(encryptedKeys.deepgram, password);
    }
    if (encryptedKeys.aliyunAccessKeyId) {
      result.aliyunAccessKeyId = await decrypt(encryptedKeys.aliyunAccessKeyId, password);
    }
    if (encryptedKeys.aliyunAccessKeySecret) {
      result.aliyunAccessKeySecret = await decrypt(encryptedKeys.aliyunAccessKeySecret, password);
    }
    if (encryptedKeys.aliyunAppKey) {
      result.aliyunAppKey = await decrypt(encryptedKeys.aliyunAppKey, password);
    }
    if (encryptedKeys.openai) {
      result.openai = await decrypt(encryptedKeys.openai, password);
    }
  } catch (error) {
    console.error('Failed to decrypt API keys:', error);
    throw new Error('Decryption failed. Wrong password?');
  }

  return result;
}
