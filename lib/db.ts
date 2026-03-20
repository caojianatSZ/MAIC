import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/drizzle/schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/openmaic';

export const db = drizzle(connectionString, { schema });
