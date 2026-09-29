import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !['pt', 'en'].includes(locale)) {
    // Try to read preferredLocale cookie from server-side request
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get('preferredLocale')?.value;
    if (cookieValue && ['pt', 'en'].includes(cookieValue)) {
      locale = cookieValue;
    } else {
      locale = 'pt';
    }
  }

  return {
    locale,
    messages: (await import(`../../locales/${locale}/common.json`)).default,
  };
});
