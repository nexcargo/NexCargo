import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['192.168.16.113'],
};

export default withNextIntl(nextConfig);
