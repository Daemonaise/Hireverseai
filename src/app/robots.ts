import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/community', '/freelancer/'],
        disallow: [
          '/client/',
          '/freelancer/dashboard',
          '/freelancer/login',
          '/freelancer/signup',
        ],
      },
    ],
    sitemap: 'https://hireverse.ai/sitemap.xml',
  };
}
