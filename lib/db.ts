import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/openmaic';

// Create connection pool
const client = postgres(connectionString, {
  max: 1, // For serverless/edge environments
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
