/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === '1';
const distDir = process.env.NEXT_DIST_DIR || '.next';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: isStaticExport ? 'export' : undefined,
    distDir,
    images: {
        unoptimized: true
    }
};

export default nextConfig;
