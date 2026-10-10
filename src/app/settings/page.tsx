import { getBrainSources, getDomainSettings, getCollectionOrder, isSupabaseConfigured } from '@/lib/data';
import { PageHead, Widget, Row, Rows, Badge } from '@/components/ui';
import { accentAt, DOMAIN_BY_SLUG, resolveNav, overrideMap } from '@/lib/nav';
import { adminClient, currentUser, ADMIN_ENV, authEnabled } from '@/lib/auth';
import { Users, type UserRow } from '@/components/Users';
import { NavSettings } from '@/components/NavSettings';

export const metadata = { title: 'Settings — Big Tribe Builders' };

/**
 * Settings, opened from the cog at the top right of every space.
 *
 * First the spaces: every collection and space in the rail, with what she
 * can change about each. Then who can sign in, and what is connected.
 */
export default async function Settings() {
  const [{ rows: sources }, { rows: domainSettings }, { rows: collections }] = await Promise.all([
    getBrainSources(), getDomainSettings(), getCollectionOrder(),
  ]);
  const sections = resolveNav(overrideMap(domainSettings), collections);

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
      <PageHead title="Settings" blurb="The spaces in the rail and their tabs, who can sign in, and what is connected." />

      <div id="spaces">
        <Widget title="Spaces" accent="green">
          <p className="muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
            Every collection and space in the rail, in the order it is drawn. Move them with the arrows, pick a space&apos;s collection,
            change its name, icon and colour, or hide it from the rail. Under each space are its tabs: untick one to hide it from the
            tab strip, or type a new name. Nothing is deleted; whatever is hidden comes back when it is shown again.
          </p>
          <NavSettings sections={sections} />
        </Widget>
      </div>

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

    </main>
  );
}
