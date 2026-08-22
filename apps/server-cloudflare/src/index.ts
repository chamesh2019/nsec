import { Hono } from 'hono';
import { cors } from 'hono/cors';
import crypto from 'node:crypto';
import {
  RegisterUserInputSchema,
  AddMemberInputSchema,
  UploadSecretsInputSchema,
  type ProjectDTO,
  type UserDTO,
  type SecretsResponseDTO,
  type ServiceTokenDTO
} from '@nsec/core';
import { D1DatabaseAdapter, type D1Database } from '@nsec/server';
import { verifyAuthHeaders, hashToken } from '@nsec/server';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all origins
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'nullsec-cloudflare-server', version: '0.1.1' });
});

// 1. POST /api/v1/auth/register - Register user public keys
app.post('/api/v1/auth/register', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const body = await c.req.json();
  const parseResult = RegisterUserInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'ValidationError', message: parseResult.error.message }, 400);
  }

  const { email, publicKeys } = parseResult.data;
  const existing = await db.getUserByEmail(email);
  if (existing) {
    existing.publicKeys = publicKeys;
    await db.saveUser(existing);
    return c.json(existing, 200);
  }

  const newUser: UserDTO = {
    id: `usr_${crypto.randomBytes(8).toString('hex')}`,
    email,
    publicKeys,
    createdAt: new Date().toISOString()
  };

  await db.saveUser(newUser);
  return c.json(newUser, 201);
});

// 2. GET /api/v1/users/:idOrEmail - Lookup public keys
app.get('/api/v1/users/:idOrEmail', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const idOrEmail = c.req.param('idOrEmail');
  const user = (await db.getUserById(idOrEmail)) || (await db.getUserByEmail(idOrEmail));

  if (!user) {
    return c.json({ error: 'NotFoundError', message: 'User not found' }, 404);
  }
  return c.json(user, 200);
});

// 3. POST /api/v1/projects - Create project
app.post('/api/v1/projects', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const body = await c.req.json();
  const auth = await verifyAuthHeaders(c.req.header(), body, db);

  if (!auth.authenticated || !auth.user) {
    return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
  }

  if (!body.name) {
    return c.json({ error: 'ValidationError', message: 'Project name is required' }, 400);
  }

  const projectId = `proj_${crypto.randomBytes(8).toString('hex')}`;
  const environments = body.environments || ['development', 'staging', 'production'];

  const newProject: ProjectDTO = {
    id: projectId,
    name: body.name,
    environments,
    members: [
      {
        userId: auth.user.id,
        email: auth.user.email,
        role: 'admin',
        environments,
        joinedAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.saveProject(newProject);
  return c.json(newProject, 201);
});

// 4. GET /api/v1/projects/:id - Get project metadata
app.get('/api/v1/projects/:id', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const auth = await verifyAuthHeaders(c.req.header(), null, db);
  if (!auth.authenticated) {
    return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
  }

  const projectId = c.req.param('id');
  const project = await db.getProject(projectId);
  if (!project) {
    return c.json({ error: 'NotFoundError', message: `Project ${projectId} not found` }, 404);
  }
  return c.json(project, 200);
});

// 5. PUT /api/v1/projects/:id/environments/:env/secrets - Upload encrypted secrets & project keys
app.put('/api/v1/projects/:id/environments/:env/secrets', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const body = await c.req.json();
  const auth = await verifyAuthHeaders(c.req.header(), body, db);

  if (!auth.authenticated || !auth.user) {
    return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
  }

  const projectId = c.req.param('id');
  const env = c.req.param('env');
  const project = await db.getProject(projectId);
  if (!project) {
    return c.json({ error: 'NotFoundError', message: `Project ${projectId} not found` }, 404);
  }

  const parseResult = UploadSecretsInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'ValidationError', message: parseResult.error.message }, 400);
  }

  const { secretsPayload, projectKeys } = parseResult.data;
  const existing = await db.getSecrets(projectId, env);
  const version = existing ? existing.version + 1 : 1;

  await db.saveSecrets({
    projectId,
    environment: env,
    secretsPayload,
    projectKeys,
    version,
    updatedAt: new Date().toISOString()
  });

  return c.json({ success: true, version }, 200);
});

// 6. GET /api/v1/projects/:id/environments/:env/secrets - Fetch encrypted secrets & user's key
app.get('/api/v1/projects/:id/environments/:env/secrets', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const auth = await verifyAuthHeaders(c.req.header(), null, db);

  if (!auth.authenticated) {
    return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
  }

  const projectId = c.req.param('id');
  const env = c.req.param('env');
  const secretsRecord = await db.getSecrets(projectId, env);

  if (!secretsRecord) {
    return c.json({
      error: 'NotFoundError',
      message: `No secrets found for project ${projectId} in environment ${env}`
    }, 404);
  }

  let encryptedKey: { encryptedKey: string; algorithm: 'RSA-OAEP-4096' } | undefined;

  if (auth.user) {
    encryptedKey = secretsRecord.projectKeys[auth.user.id];
  } else if (auth.serviceToken) {
    if (auth.serviceToken.projectId !== projectId || auth.serviceToken.environment !== env) {
      return c.json({ error: 'Forbidden', message: 'Service token not authorized for this environment' }, 403);
    }
    encryptedKey = secretsRecord.projectKeys[auth.serviceToken.id];
  }

  if (!encryptedKey) {
    return c.json({
      error: 'Forbidden',
      message: `User does not have access to decrypt secrets for environment ${env}. An admin must share the project key.`
    }, 403);
  }

  const response: SecretsResponseDTO = {
    projectId,
    environment: env,
    secretsPayload: secretsRecord.secretsPayload,
    encryptedProjectKey: encryptedKey,
    version: secretsRecord.version,
    updatedAt: secretsRecord.updatedAt
  };

  return c.json(response, 200);
});

// 7. POST /api/v1/projects/:id/members - Add member with key sharing
app.post('/api/v1/projects/:id/members', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const body = await c.req.json();
  const auth = await verifyAuthHeaders(c.req.header(), body, db);

  if (!auth.authenticated || !auth.user) {
    return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
  }

  const projectId = c.req.param('id');
  const project = await db.getProject(projectId);
  if (!project) {
    return c.json({ error: 'NotFoundError', message: `Project ${projectId} not found` }, 404);
  }

  const parseResult = AddMemberInputSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'ValidationError', message: parseResult.error.message }, 400);
  }

  const { email, role, environments, environmentKeys } = parseResult.data;
  const targetUser = await db.getUserByEmail(email);
  if (!targetUser) {
    return c.json({ error: 'NotFoundError', message: `User with email ${email} not registered` }, 404);
  }

  await db.addProjectMember(projectId, {
    userId: targetUser.id,
    email: targetUser.email,
    role,
    environments,
    joinedAt: new Date().toISOString()
  });

  for (const [env, encKey] of Object.entries(environmentKeys)) {
    const secretsRec = await db.getSecrets(projectId, env);
    if (secretsRec) {
      secretsRec.projectKeys[targetUser.id] = encKey;
      await db.saveSecrets(secretsRec);
    }
  }

  const updated = await db.getProject(projectId);
  return c.json(updated, 200);
});

// 8. POST /api/v1/projects/:id/tokens - Create CI/CD Service Token
app.post('/api/v1/projects/:id/tokens', async (c) => {
  const db = new D1DatabaseAdapter(c.env.DB);
  const body = await c.req.json();
  const auth = await verifyAuthHeaders(c.req.header(), body, db);

  if (!auth.authenticated || !auth.user) {
    return c.json({ error: 'AuthenticationError', message: auth.error || 'Unauthorized' }, 401);
  }

  const projectId = c.req.param('id');
  const project = await db.getProject(projectId);
  if (!project) {
    return c.json({ error: 'NotFoundError', message: `Project ${projectId} not found` }, 404);
  }

  if (!body.environment || !body.name) {
    return c.json({ error: 'ValidationError', message: 'Environment and name are required' }, 400);
  }

  const tokenId = `tok_${crypto.randomBytes(8).toString('hex')}`;
  const rawSecret = crypto.randomBytes(32).toString('hex');
  const fullToken = `zv_st_${tokenId}_${rawSecret}`;
  const tokenHash = hashToken(fullToken);

  await db.saveServiceToken({
    id: tokenId,
    projectId,
    environment: body.environment,
    name: body.name,
    tokenHash,
    expiresAt: body.expiresAt,
    createdAt: new Date().toISOString()
  });

  const response: ServiceTokenDTO = {
    id: tokenId,
    projectId,
    environment: body.environment,
    name: body.name,
    token: fullToken,
    expiresAt: body.expiresAt,
    createdAt: new Date().toISOString()
  };

  return c.json(response, 201);
});

export default app;
