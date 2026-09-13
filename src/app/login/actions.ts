'use server';

import { redirect } from 'next/navigation';
import { loginWithCode, setSessionCookie, clearSessionCookie } from '@/lib/auth';

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const result = await loginWithCode({
    name: String(formData.get('name') ?? ''),
    designation: String(formData.get('designation') ?? ''),
    branch: String(formData.get('branch') ?? ''),
    code: String(formData.get('code') ?? ''),
  });

  if (!result.ok) return { error: result.error };

  await setSessionCookie(result.session);
  // redirect() throws a control-flow signal — must stay outside any try/catch.
  redirect(result.redirectTo);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/login');
}
