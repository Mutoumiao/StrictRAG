/**
 * 不可逆口令哈希（Node 标准库 scrypt）。
 * 不引入身份框架；本切片只写库，不提供验密 HTTP。
 */

import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEY_LEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(plain, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}
