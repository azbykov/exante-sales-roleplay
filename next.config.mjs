/** @type {import('next').NextConfig} */
const nextConfig = {
  // Рядом лежит чужой lockfile — фиксируем корень явно.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
