import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import geocodeRouter from './routes/geocode.js';
import observedRouter from './routes/observed.js';
import nativeRouter from './routes/native.js';
import enrichRouter from './routes/enrich.js';
import ecosystemRouter from './routes/ecosystem.js';
import catalogRouter from './routes/catalog.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import { cacheService } from './services/cacheService.js';

const app = new Hono();

app.use('*', cors({ origin: '*' }));

// Mount routes
app.route('/api/geocode', geocodeRouter);
app.route('/api/species/observed', observedRouter);
app.route('/api/species/native', nativeRouter);
app.route('/api/species/enrich', enrichRouter);
app.route('/api/ecosystem', ecosystemRouter);
app.route('/api/catalog', catalogRouter);
app.route('/api/auth', authRouter);
app.route('/api/projects', projectsRouter);

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ message: 'Internal server error' }, 500);
});

// 404 handler
app.notFound((c) => c.json({ message: 'Not found' }, 404));

// Initialize cache and start server
cacheService.clear();

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Ecosystem Builder Backend running on port ${port}`);
});

export { app };
