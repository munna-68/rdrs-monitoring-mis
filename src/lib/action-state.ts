/**
 * Form-state shapes shared between server actions and the client components
 * that drive them through `useActionState`.
 *
 * These live here, and not next to the actions, because a `"use server"` module
 * may only export **async functions**. Exporting a plain object from one throws
 * at runtime with:
 *
 *     Error: A "use server" file can only export async functions, found object.
 *
 * which surfaces as an opaque "Application error: a server-side exception" in
 * the browser — the failure only appears when the action is actually invoked, so
 * it survives type-checking and a clean build.
 */

export type FormState = {
  ok: boolean;
  error: string | null;
  message: string | null;
};

export type EntryFormState = FormState;
export type EditFormState = FormState;
export type AdminState = FormState;

export const initialEntryState: EntryFormState = { ok: false, error: null, message: null };
export const initialEditState: EditFormState = { ok: false, error: null, message: null };
export const initialAdminState: AdminState = { ok: false, error: null, message: null };
