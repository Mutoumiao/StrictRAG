import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@strict-rag/ui/theme.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'StrictRAG',
  description: '严厉企业知识库 RAG — 用户端问答',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
