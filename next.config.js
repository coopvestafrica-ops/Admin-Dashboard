/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/admin/:path*',
        destination: 'https://coopvest-api-v3.onrender.com/api/admin/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'https://coopvest-api-v3.onrender.com/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
