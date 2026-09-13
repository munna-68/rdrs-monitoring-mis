import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { homeFor } from '@/lib/roles';

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : '/login');
}
