// NexCargo I-5 §3G/§3H — the document list shared by the booking and operation screens.
// Read-only on purpose: the documents INSERT policy admits platform_roles SHIPPER/TRANSPORTER rows that
// no longer exist and its booking branch is shipper-only, so a Transporter upload would be refused by the
// database. Download goes through the existing MOD-004 route, which re-checks the booking party itself.

import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import type { TransporterDocument } from './document-reads';
import { documentStatusLabelKey, documentTypeLabelKey, formatDate } from './presentation';

const TH = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
const TD = 'px-3 py-3 align-top text-sm text-zinc-600 dark:text-zinc-400';

export async function DocumentsCard({
  documents,
  locale,
}: {
  documents: TransporterDocument[];
  locale: string;
}) {
  const t = await getTranslations('TransporterDashboard');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('documents_heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="py-2 text-sm text-zinc-600 dark:text-zinc-400">{t('documents_empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E6E3] dark:border-zinc-800">
                  <th scope="col" className={TH}>{t('col_document_type')}</th>
                  <th scope="col" className={TH}>{t('col_document_status')}</th>
                  <th scope="col" className={`${TH} hidden md:table-cell`}>{t('col_uploaded')}</th>
                  <th scope="col" className={TH}>{t('col_action')}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => {
                  const typeKey = documentTypeLabelKey(document.documentType);
                  const statusKey = documentStatusLabelKey(document.status);
                  return (
                    <tr key={document.id} className="border-b border-[#E8E6E3] last:border-0 dark:border-zinc-800">
                      <td className={`${TD} font-medium text-[#0A1628] dark:text-white`}>
                        {typeKey ? t(typeKey) : document.documentType}
                      </td>
                      <td className={TD}>{statusKey ? t(statusKey) : document.status}</td>
                      <td className={`${TD} hidden md:table-cell`}>{formatDate(document.createdAt, locale)}</td>
                      <td className="px-3 py-3 align-top">
                        <a
                          href={`/api/documents/${document.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-[#1A5C9E] hover:underline dark:text-blue-400"
                        >
                          {t('document_download')}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t('documents_read_only_notice')}</p>
      </CardContent>
    </Card>
  );
}