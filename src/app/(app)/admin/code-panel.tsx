'use client';

import { useActionState, useState } from 'react';
import { regenerateAllCodesAction, regenerateCodeAction } from './actions';
import { initialAdminState } from '@/lib/action-state';
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from '@/lib/roles';
import { Button, Card, CardTitle, Notice, fmtDateTime } from '@/components/ui';

export function CodePanel({
  codes,
}: {
  codes: { role: Role; code: string; label: string; updatedAt: Date | string }[];
}) {
  const [state, formAction, pending] = useActionState(regenerateCodeAction, initialAdminState);
  const [, allAction, allPending] = useActionState(regenerateAllCodesAction, initialAdminState);
  const [copied, setCopied] = useState<string | null>(null);

  const byRole = new Map(codes.map((c) => [c.role, c]));

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <Card>
      <CardTitle
        title="Access codes"
        subtitle="Each role is granted by one shared code. Regenerating a code immediately stops the old one from working — but does not sign out anyone already logged in."
        right={
          <form action={allAction}>
            <Button type="submit" variant="secondary" size="sm" disabled={allPending}>
              {allPending ? 'Reissuing…' : 'Regenerate all'}
            </Button>
          </form>
        }
      />

      {state.error && <div className="mb-3"><Notice tone="error">{state.error}</Notice></div>}
      {state.message && <div className="mb-3"><Notice tone="success">{state.message}</Notice></div>}

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Code</th>
              <th className="py-2 pr-3 font-medium">Last changed</th>
              <th className="py-2 pr-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => {
              const row = byRole.get(role);
              return (
                <tr key={role} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 pr-3 align-top">
                    <span className="font-medium text-ink">{ROLE_LABELS[role]}</span>
                    <span className="mt-0.5 block max-w-[380px] text-[11.5px] leading-snug text-ink-faint">
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <code className="rounded bg-canvas px-1.5 py-1 font-mono text-[12.5px] text-ink">
                      {row?.code ?? '—'}
                    </code>
                  </td>
                  <td className="py-2.5 pr-3 align-top text-[12px] text-ink-soft">
                    {row ? fmtDateTime(row.updatedAt) : '—'}
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => row && copy(row.code)}
                      >
                        {copied === row?.code ? 'Copied' : 'Copy'}
                      </Button>
                      <form action={formAction}>
                        <input type="hidden" name="role" value={role} />
                        <Button type="submit" variant="danger" size="sm" disabled={pending}>
                          Regenerate
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
        PROTOTYPE NOTE: codes are stored in plaintext so this screen can display them for re-issue.
        A production build would hash them and show each code only once, at generation time.
      </p>
    </Card>
  );
}
