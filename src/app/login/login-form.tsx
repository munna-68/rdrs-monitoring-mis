'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';
import { Button, Field, Input, Notice } from '@/components/ui';

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Notice tone="error">{state.error}</Notice>}

      <Field label="Full name">
        <Input name="name" required autoComplete="name" placeholder="e.g. Rahima Begum" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Designation">
          <Input name="designation" required placeholder="e.g. Monitoring Officer" />
        </Field>
        <Field label="Branch">
          <Input name="branch" required placeholder="e.g. Rangpur" />
        </Field>
      </div>

      <Field
        label="Access code"
        hint="Issued by RDRS. The code you hold determines your role for this session."
      >
        <Input
          name="code"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. USER-XXXX-XXXX"
          className="font-mono tracking-wide"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Checking code…' : 'Sign in'}
      </Button>

      <p className="text-[11.5px] leading-relaxed text-ink-faint">
        There is no self-service signup. Name, designation and branch are recorded against every
        entry you submit, so they must be accurate.
      </p>
    </form>
  );
}
