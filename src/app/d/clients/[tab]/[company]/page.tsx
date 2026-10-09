import { notFound } from 'next/navigation';

// Read on every request. The client table writes, and a page built once at
// deploy time would keep showing the row where it used to be.
export const dynamic = 'force-dynamic';
import { DOMAIN_BY_SLUG } from '@/lib/nav';
import { companyDetail } from '@/components/views/clients';
import { loadAll } from '@/lib/data/bundle';

/**
 * One client.
 *
 * Sits under the tab it was opened from, so the tab strip keeps its place and
 * "back" means the list you came from rather than a generic index. This route
 * is more specific than /d/[domain]/[[...tab]], so Next matches it first.
 */
export async function generateMetadata({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const b = await loadAll();
  const row = b.companies.find((c) => c.id === company);
  return { title: row ? `${row.name} — Big Tribe Builders` : 'Client — Big Tribe Builders' };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ tab: string; company: string }>;
}) {
  const { tab, company } = await params;
  const domain = DOMAIN_BY_SLUG.get('clients');
  if (!domain) notFound();

  const b = await loadAll();
  const row = b.companies.find((c) => c.id === company);
  if (!row) notFound();

  return (
    <>
      {companyDetail(row, b)}
    </>
  );
}
