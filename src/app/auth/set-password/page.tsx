import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { PasswordForm } from '@/components/PasswordForm';

export const metadata = { title: 'Choose a password — Big Tribe Builders' };

export default async function SetPassword() {
  const me = await currentUser();
  if (!me) redirect('/login?note=session');
  return (
    <main className="gate">
      <section className="card gate__card">
        <span className="sidebar__mark">BTB</span>
        <h1 className="page-title" style={{ fontSize: 22, marginTop: 14 }}>Welcome</h1>
        <p className="muted" style={{ marginTop: 4 }}>Choose a password for {me.email}.</p>
        <PasswordForm />
      </section>
    </main>
  );
}
