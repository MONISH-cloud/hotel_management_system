import { route } from '@/lib/api';
import { pool } from '@/lib/db';
import { redisAlive } from '@/lib/cache';
import { graphAlive, graphCounts } from '@/lib/graph';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const mysql = await pool.query('SELECT 1').then(() => true).catch(() => false);
  const [redis, neo4j] = await Promise.all([redisAlive(), graphAlive()]);
  return { status: mysql ? 'ok' : 'degraded', mysql, redis, neo4j, graph: neo4j ? await graphCounts() : null };
});
