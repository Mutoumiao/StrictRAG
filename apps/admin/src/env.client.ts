/** 浏览器可读环境（禁止密钥） */
export function getAdminClientEnv() {
  return {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000',
  };
}
