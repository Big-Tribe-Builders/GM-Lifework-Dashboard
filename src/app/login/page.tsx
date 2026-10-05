import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Sign in — Lifework' };

export default async function Login({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const { note } = await searchParams;
  return (
    <main className="gate">
      <section className="card gate__card">
        <span className="sidebar__mark">GM</span>
        <h1 className="page-title" style={{ fontSize: 22, marginTop: 14 }}>Lifework</h1>
        <p className="muted" style={{ marginTop: 4 }}>Sign in to continue.</p>
        {note === 'link' ? (
          <p className="field__error" style={{ marginTop: 12 }}>That link has expired or was already used. Ask for a new invitation.</p>
        ) : null}
        <LoginForm />
      </section>
    </main>
  );
}
