import { getBrainSources, isSupabaseConfigured } from '@/lib/data';
import { PageHead, Widget, Row, Rows, Badge } from '@/components/ui';
import { accentAt, DOMAINS, DOMAIN_BY_SLUG } from '@/lib/nav';
import { adminClient, currentUser, ADMIN_ENV, authEnabled } from '@/lib/auth';
import { Users, type UserRow } from '@/components/Users';

export const metadata = { title: 'Settings — Big Tribe Builders' };

/**
 * Settings.
 *
 * Mostly a status page right now, and honest about it. The two things worth
 * seeing: whether Supabase is behind the dashboard yet, and which intelligence
 * sources are actually reachable.
 */
export default async function Settings() {
  const { rows: sources } = await getBrainSources();

  // Who can sign in. Listing needs the service role key; without it the
  // section says so rather than showing an empty table as if nobody exists.
  const admin = adminClient();
  const me = await currentUser();
  let users: UserRow[] = [];
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    users = (data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at ?? null,
      lastSignIn: u.last_sign_in_at ?? null,
      invitedAt: u.invited_at ?? null,
      confirmed: Boolean(u.email_confirmed_at),
    }));
  }

  return (
    <main className="content content--wide stack">
      <PageHead title="Settings" blurb="What is connected, and what it would take to connect the rest." />

      <Widget title="Users" accent="violet">
        <p className="muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          {authEnabled
            ? 'Sign-in is on: every page needs an account.'
            : 'Sign-in is off (LIFEWORK_AUTH is not "on" in Vercel), so the app is open. Accounts can still be made here first.'}
        </p>
        <Users rows={users} me={me?.email ?? null} missing={admin ? null : ADMIN_ENV} />
      </Widget>

      <section className="grid">
        <div className="col-6">
          <Widget title="Database" accent={isSupabaseConfigured ? 'green' : 'orange'}>
            <p className="row__title" style={{ fontSize: 15 }}>
              {isSupabaseConfigured ? 'Supabase is connected' : 'Running on bundled seed data'}
            </p>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
              {isSupabaseConfigured
                ? 'Every reader is hitting your Supabase project. The seed stays in the repo as a fallback if a query fails.'
                : 'Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run the migration in supabase/migrations. Nothing in the UI changes — the row shapes are identical.'}
            </p>
          </Widget>
        </div>

        <div className="col-6">
          <Widget title="Timezone and dates" accent="violet">
            <p className="row__title" style={{ fontSize: 15 }}>Europe/Brussels</p>
            <p className="muted" style={{ marginTop: 6, lineHeight: 1.6 }}>
              Every date on this dashboard resolves against Brussels, matching how your tasks are
              captured. “Today” means today where you are, not where the server is.
            </p>
          </Widget>
        </div>
      </section>

      <section className="grid">
        <div className="col-12">
          <Widget title="Intelligence sources" accent="orange" flush>
            <Rows>
              {sources.map((s, i) => (
                <Row
                  key={s.id}
                  accent={accentAt(i)}
                  icon="brain"
                  title={s.name}
                  sub={`${s.reach} · feeds ${s.feeds.map((f) => DOMAIN_BY_SLUG.get(f)?.label ?? f).join(', ')}`}
                  href="/d/brain/sources"
                  aside={
                    <Badge tone={s.state === 'connected' ? 'green' : s.state === 'needs_auth' ? 'orange' : undefined}>
                      {s.state === 'needs_auth' ? 'needs authorising' : s.state}
                    </Badge>
                  }
                />
              ))}
            </Rows>
          </Widget>
        </div>
      </section>

      <section className="grid">
        <div className="col-12">
          <Widget title="Navigation" accent="green" flush>
            <Rows>
              {DOMAINS.map((d, i) => (
                <Row
                  key={d.slug}
                  accent={accentAt(i)}
                  icon={d.icon}
                  title={d.label}
                  sub={`${d.group} · ${d.tabs.length} tabs · ${d.blurb}`}
                  href={`/d/${d.slug}/${d.tabs[0].slug}`}
                />
              ))}
            </Rows>
            <div className="widget__foot">
              <p className="muted">
                The rail and the tabs are one config file — <code>src/lib/nav.ts</code>. Renaming a
                domain or reordering the groups is an edit there, and the palette follows automatically.
              </p>
            </div>
          </Widget>
        </div>
      </section>
    </main>
  );
}
