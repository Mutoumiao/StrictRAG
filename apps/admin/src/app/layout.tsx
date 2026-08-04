import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@strict-rag/ui/theme.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'StrictRAG Admin',
  description: '严厉企业知识库 RAG — 管理端空壳',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
