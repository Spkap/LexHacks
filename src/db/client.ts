import { setDefaultResultOrder } from 'node:dns';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// The local network resolves Neon to IPv6 first but cannot reliably reach it over
// IPv6. Prefer the endpoint's IPv4 addresses, which Vercel can also use.
setDefaultResultOrder('ipv4first');

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
