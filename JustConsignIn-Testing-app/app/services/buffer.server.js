import crypto from 'node:crypto';
import db from '../db.server';

const BUFFER_AUTH_URL = 'https://auth.buffer.com/auth';
const BUFFER_TOKEN_URL = 'https://auth.buffer.com/token';
const BUFFER_API_URL = 'https://api.buffer.com';
const BUFFER_SCOPES = 'posts:read posts:write account:read offline_access';
const SOCIAL_DRAFT_SERVICES = new Set(['instagram', 'facebook', 'tiktok']);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function encryptionKey() {
  const secret = requiredEnv('BUFFER_TOKEN_ENCRYPTION_KEY');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(value) {
  if (!value) return null;
  const [version, ivValue, tagValue, encryptedValue] = String(value).split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Stored Buffer credential is invalid.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function bufferConfiguration() {
  const appUrl = String(process.env.SHOPIFY_APP_URL || '').replace(/\/$/, '');
  const oauthConfigured = Boolean(
    process.env.BUFFER_CLIENT_ID &&
    process.env.BUFFER_TOKEN_ENCRYPTION_KEY &&
    appUrl
  );
  const apiKeyConfigured = Boolean(process.env.BUFFER_API_KEY);

  return {
    configured: oauthConfigured || apiKeyConfigured,
    oauthConfigured,
    apiKeyConfigured,
    clientId: process.env.BUFFER_CLIENT_ID || '',
    clientSecret: process.env.BUFFER_CLIENT_SECRET || '',
    redirectUri: process.env.BUFFER_REDIRECT_URI || (appUrl ? `${appUrl}/buffer/callback` : ''),
  };
}

export function createPkcePair() {
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

export function createOAuthState() {
  return base64url(crypto.randomBytes(32));
}

export function buildBufferAuthorizationUrl({ state, challenge }) {
  const config = bufferConfiguration();
  if (!config.oauthConfigured) {
    throw new Error('Buffer OAuth is not configured on this server.');
  }

  const url = new URL(BUFFER_AUTH_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', BUFFER_SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export async function exchangeBufferCode({ code, verifier }) {
  const config = bufferConfiguration();
  if (!config.oauthConfigured) {
    throw new Error('Buffer OAuth is not configured on this server.');
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });

  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(BUFFER_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Buffer token exchange failed.');
  }
  return data;
}

async function refreshBufferTokens(refreshToken) {
  const config = bufferConfiguration();
  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(BUFFER_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Buffer token refresh failed.');
  }
  if (!data.access_token || !data.refresh_token) {
    throw new Error('Buffer did not return a complete refreshed token pair.');
  }
  return data;
}

async function bufferGraphql(accessToken, query, variables = {}) {
  const normalizedAccessToken = String(accessToken || '').trim();
  if (!normalizedAccessToken) {
    throw new Error('Buffer API key is missing.');
  }

  const response = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${normalizedAccessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();
  if (!response.ok || data.errors?.length) {
    const message = data.errors?.map((entry) => entry.message).join(', ');
    throw new Error(message || `Buffer API request failed (${response.status}).`);
  }
  return data.data;
}

export async function getBufferAccountSnapshot(accessToken) {
  const accountData = await bufferGraphql(
    accessToken,
    `query JustConsignInBufferAccount {
      account {
        id
        name
        email
        organizations {
          id
          name
        }
      }
    }`,
  );

  const organizations = accountData?.account?.organizations || [];
  const channelLists = await Promise.all(
    organizations.map(async (organization) => {
      const data = await bufferGraphql(
        accessToken,
        `query JustConsignInBufferChannels($organizationId: OrganizationId!) {
          channels(input: { organizationId: $organizationId }) {
            id
            name
            displayName
            service
            avatar
            isDisconnected
            isLocked
          }
        }`,
        { organizationId: organization.id },
      );
      return (data?.channels || []).map((channel) => ({
        ...channel,
        organizationId: organization.id,
        organizationName: organization.name,
      }));
    }),
  );

  return {
    account: accountData?.account || null,
    organizations,
    channels: channelLists.flat(),
  };
}

export async function saveBufferConnection({ shop, tokens, snapshot }) {
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
    : null;

  const firstOrganization = snapshot.organizations?.[0] || null;

  return db.bufferConnection.upsert({
    where: { shop },
    update: {
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
      expiresAt,
      scope: tokens.scope || '',
      accountId: snapshot.account?.id || null,
      accountName: snapshot.account?.name || snapshot.account?.email || null,
      organizationId: firstOrganization?.id || null,
      organizationName: firstOrganization?.name || null,
      channelsJson: JSON.stringify(snapshot.channels || []),
    },
    create: {
      shop,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
      expiresAt,
      scope: tokens.scope || '',
      accountId: snapshot.account?.id || null,
      accountName: snapshot.account?.name || snapshot.account?.email || null,
      organizationId: firstOrganization?.id || null,
      organizationName: firstOrganization?.name || null,
      channelsJson: JSON.stringify(snapshot.channels || []),
    },
  });
}

async function validBufferAccessToken(shop) {
  const connection = await db.bufferConnection.findUnique({ where: { shop } });
  if (!connection) {
    throw new Error('Buffer is not connected for this Shopify store.');
  }

  const accessToken = decryptSecret(connection.accessToken);
  const expiresSoon = connection.expiresAt
    ? connection.expiresAt.getTime() <= Date.now() + 60_000
    : false;

  if (!expiresSoon) return accessToken;
  if (!connection.refreshToken) {
    throw new Error('Buffer authorization expired. Reconnect Buffer in Social Media settings.');
  }

  const refreshed = await refreshBufferTokens(decryptSecret(connection.refreshToken));
  const expiresAt = refreshed.expires_in
    ? new Date(Date.now() + Number(refreshed.expires_in) * 1000)
    : null;

  await db.bufferConnection.update({
    where: { shop },
    data: {
      accessToken: encryptSecret(refreshed.access_token),
      refreshToken: encryptSecret(refreshed.refresh_token),
      expiresAt,
      scope: refreshed.scope || connection.scope || '',
    },
  });

  return refreshed.access_token;
}

export async function getBufferConnectionSummary(shop) {
  const connection = await db.bufferConnection.findUnique({ where: { shop } });

  if (!connection) {
    const apiKey = process.env.BUFFER_API_KEY;
    if (!apiKey) return null;

    const snapshot = await getBufferAccountSnapshot(apiKey);
    const firstOrganization = snapshot.organizations?.[0] || null;

    return {
      connected: true,
      mode: 'api-key',
      accountName: snapshot.account?.name || snapshot.account?.email || 'Buffer account',
      organizationName: firstOrganization?.name || null,
      channels: snapshot.channels || [],
      connectedAt: null,
      updatedAt: null,
    };
  }

  let channels = [];
  try {
    channels = JSON.parse(connection.channelsJson || '[]');
  } catch {
    channels = [];
  }

  return {
    connected: true,
    mode: 'oauth',
    accountName: connection.accountName,
    organizationName: connection.organizationName,
    channels,
    connectedAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export async function createBufferDrafts({ shop, channelIds, text, imageUrl }) {
  const connection = await db.bufferConnection.findUnique({ where: { shop } });
  const apiKey = process.env.BUFFER_API_KEY || '';

  let knownChannels = [];
  let accessToken = '';

  if (connection) {
    try {
      knownChannels = JSON.parse(connection.channelsJson || '[]');
    } catch {
      knownChannels = [];
    }
    accessToken = await validBufferAccessToken(shop);
  } else if (apiKey) {
    const snapshot = await getBufferAccountSnapshot(apiKey);
    knownChannels = snapshot.channels || [];
    accessToken = apiKey;
  } else {
    throw new Error('Connect Buffer before creating social drafts.');
  }

  const requestedIds = [...new Set((channelIds || []).map(String))];
  if (!requestedIds.length) {
    throw new Error('Select at least one social channel.');
  }

  const selectedChannels = requestedIds.map((channelId) => {
    const channel = knownChannels.find((entry) => String(entry.id) === channelId);
    if (!channel) throw new Error('One of the selected Buffer channels is no longer available.');
    if (channel.isDisconnected || channel.isLocked) {
      throw new Error(`${channel.displayName || channel.name} is not available for posting.`);
    }
    if (!SOCIAL_DRAFT_SERVICES.has(String(channel.service || '').toLowerCase())) {
      throw new Error(`${channel.service} posting is not enabled in this first JustConsignIn version.`);
    }
    if (['instagram', 'tiktok'].includes(String(channel.service).toLowerCase()) && !imageUrl) {
      throw new Error(`${channel.service} requires an item image.`);
    }
    return channel;
  });

  const mutation = `mutation JustConsignInCreateDraft($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess {
        post { id text }
      }
      ... on MutationError {
        message
      }
    }
  }`;

  const results = [];
  for (const channel of selectedChannels) {
    const input = {
      text: String(text || '').trim(),
      channelId: channel.id,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      saveToDraft: true,
      source: 'JustConsignIn',
      assets: imageUrl ? [{ image: { url: imageUrl } }] : [],
    };

    const data = await bufferGraphql(accessToken, mutation, { input });
    const payload = data?.createPost;
    if (!payload?.post?.id) {
      throw new Error(payload?.message || `Buffer could not create a draft for ${channel.displayName || channel.name}.`);
    }

    results.push({
      channelId: channel.id,
      channelName: channel.displayName || channel.name,
      service: channel.service,
      postId: payload.post.id,
    });
  }

  return results;
}

export async function deleteBufferConnection(shop) {
  await db.bufferConnection.deleteMany({ where: { shop } });
}
