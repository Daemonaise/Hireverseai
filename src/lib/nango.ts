import { Nango } from '@nangohq/node';

const secretKey = process.env.NANGO_SECRET_KEY;

if (!secretKey && process.env.NODE_ENV === 'production') {
  throw new Error('NANGO_SECRET_KEY is required for hub integrations');
}

export const nango = new Nango({ secretKey: secretKey || '' });
