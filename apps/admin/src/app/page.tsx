import { redirect } from 'next/navigation';

/** 管理端首页 → 文档列表（需登录时由 ops layout 拦到 /login） */
export default function HomePage() {
  redirect('/documents');
}
