import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.js';
import { extractToken } from './auth.js';

const router = new Hono();

// Middleware — verify JWT and attach user to context
async function requireAuth(c, next) {
  const token = extractToken(c);
  if (!token) return c.json({ message: 'Not authenticated' }, 401);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return c.json({ message: 'Invalid or expired token' }, 401);

  c.set('user', data.user);
  c.set('token', token);
  await next();
}

/**
 * GET /api/projects
 * Returns all projects for the authenticated user.
 */
router.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const token = c.get('token');

  const client = supabase;
  const { data, error } = await client
    .from('projects')
    .select('id, name, city, state, country, lat, lng, radius_km, climate_profile, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return c.json({ message: error.message }, 500);
  return c.json({ projects: data });
});

/**
 * POST /api/projects
 * Creates a new project for the authenticated user.
 *
 * Body: {
 *   name?,
 *   city,
 *   state?,
 *   country?,
 *   lat?,
 *   lng?,
 *   radiusKm?,
 *   baseSpecies?,       ← full species array from /api/ecosystem
 *   addedSpecies?,      ← species user added from catalog
 *   removedSpeciesNames?, ← scientific names user removed from base
 *   climateProfile?
 * }
 */
router.post('/', requireAuth, async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const user = c.get('user');
  const {
    name = 'My Ecosystem',
    city,
    state,
    country,
    lat,
    lng,
    radiusKm = 50,
    baseSpecies = [],
    addedSpecies = [],
    removedSpeciesNames = [],
    climateProfile = null,
  } = body ?? {};

  if (!city) return c.json({ message: 'Missing required field: city' }, 400);

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      city,
      state: state ?? null,
      country: country ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      radius_km: radiusKm,
      base_species: baseSpecies,
      added_species: addedSpecies,
      removed_species_names: removedSpeciesNames,
      climate_profile: climateProfile,
    })
    .select()
    .single();

  if (error) return c.json({ message: error.message }, 500);
  return c.json({ project: normalizeProject(data) }, 201);
});

/**
 * GET /api/projects/:id
 * Returns a single project (full data including species).
 */
router.get('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return c.json({ message: 'Project not found' }, 404);
  return c.json({ project: normalizeProject(data) });
});

/**
 * PUT /api/projects/:id
 * Updates a project. Accepts any subset of project fields.
 */
router.put('/:id', requireAuth, async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const user = c.get('user');
  const { id } = c.req.param();

  // Only allow updating these fields
  const allowed = ['name', 'city', 'state', 'country', 'lat', 'lng',
    'radius_km', 'base_species', 'added_species', 'removed_species_names', 'climate_profile'];

  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.city !== undefined) updates.city = body.city;
  if (body.state !== undefined) updates.state = body.state;
  if (body.country !== undefined) updates.country = body.country;
  if (body.lat !== undefined) updates.lat = body.lat;
  if (body.lng !== undefined) updates.lng = body.lng;
  if (body.radiusKm !== undefined) updates.radius_km = body.radiusKm;
  if (body.baseSpecies !== undefined) updates.base_species = body.baseSpecies;
  if (body.addedSpecies !== undefined) updates.added_species = body.addedSpecies;
  if (body.removedSpeciesNames !== undefined) updates.removed_species_names = body.removedSpeciesNames;
  if (body.climateProfile !== undefined) updates.climate_profile = body.climateProfile;

  if (Object.keys(updates).length === 0) {
    return c.json({ message: 'No valid fields to update' }, 400);
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error || !data) return c.json({ message: 'Project not found or update failed' }, 404);
  return c.json({ project: normalizeProject(data) });
});

/**
 * DELETE /api/projects/:id
 * Deletes a project.
 */
router.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return c.json({ message: error.message }, 500);
  return c.json({ message: 'Project deleted' });
});

// Normalize DB column names to camelCase for the API response
function normalizeProject(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    radiusKm: row.radius_km,
    baseSpecies: row.base_species ?? [],
    addedSpecies: row.added_species ?? [],
    removedSpeciesNames: row.removed_species_names ?? [],
    climateProfile: row.climate_profile ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
