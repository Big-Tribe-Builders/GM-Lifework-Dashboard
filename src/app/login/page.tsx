import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Sign in — Big Tribe Builders' };

/** What went wrong on the way here, by step, so a failure says which one. */
const NOTES: Record<string, string> = {
  link: 'That link has expired or was already used. Ask for a new invitation.',
  verify: 'The invitation link could not be verified: it has expired or was already used. Ask for a new one.',
  session: 'The link was accepted but the sign-in did not stick. Try the link once more; if it repeats, tell Giulia.',
  nolink: 'That address is missing its invitation token. Open the link from the email itself.',
  env: 'Supabase is not configured on this deployment.',
};

export default async function Login({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const { note } = await searchParams;
  return (
    <main className="gate">
      <section className="card gate__card">
        <span className="sidebar__mark">BTB</span>
        <h1 className="page-title" style={{ fontSize: 22, marginTop: 14 }}>Big Tribe Builders</h1>
        <p className="muted" style={{ marginTop: 4 }}>Sign in to continue.</p>
        {note ? <p className="field__error" style={{ marginTop: 12 }}>{NOTES[note] ?? NOTES.link}</p> : null}
        <LoginForm />
      </section>
    </main>
  );
}
