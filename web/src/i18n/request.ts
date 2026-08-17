import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !['pt', 'en'].includes(locale)) {
    locale = 'pt';
  }

  return {
    locale,
    messages: (await import(`../../locales/${locale}/common.json`)).default,
  };
});
