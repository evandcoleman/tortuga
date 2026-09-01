/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/newsletter/messages',
        destination: '/messages',
        permanent: true,
      },
      {
        source: '/newsletter/messages/history',
        destination: '/messages/history',
        permanent: true,
      },
      {
        source: '/newsletter/messages/history/:id',
        destination: '/messages/history/:id',
        permanent: true,
      },
      {
        source: '/newsletter/recipients',
        destination: '/people/recipients',
        permanent: true,
      },
      {
        source: '/messages/invites',
        destination: '/people/invites',
        permanent: true,
      },
      {
        source: '/settings/portal',
        destination: '/portal-settings',
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
