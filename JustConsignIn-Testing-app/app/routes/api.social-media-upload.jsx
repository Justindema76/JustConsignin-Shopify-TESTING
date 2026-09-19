import { authenticate } from '../shopify.server';

const STAGED_UPLOAD_MUTATION = `#graphql
  mutation PrepareSocialMediaUpload($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE_MUTATION = `#graphql
  mutation CreateSocialMediaFile($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        __typename
        id
        fileStatus
        alt
        ... on MediaImage {
          image { url width height }
        }
        ... on Video {
          status
          preview { image { url width height } }
          originalSource { url mimeType format width height }
          sources { url mimeType format width height }
        }
      }
      userErrors { field message }
    }
  }
`;

const FILE_STATUS_QUERY = `#graphql
  query SocialMediaFileStatus($id: ID!) {
    node(id: $id) {
      __typename
      ... on MediaImage {
        id
        fileStatus
        image { url width height }
      }
      ... on Video {
        id
        fileStatus
        status
        preview { image { url width height } }
        originalSource { url mimeType format width height }
        sources { url mimeType format width height }
      }
    }
  }
`;

function assertNoErrors(payload, operation) {
  const errors = payload?.userErrors || [];
  if (errors.length) {
    throw new Error(`${operation}: ${errors.map((error) => error.message).join(', ')}`);
  }
}

async function adminGraphql(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(', '));
  }
  return payload.data;
}

function safeFilename(value, kind) {
  const fallback = kind === 'video' ? 'social-video.mp4' : 'social-image.jpg';
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
}

function normalizeFile(file, kind) {
  if (!file) return null;

  if (kind === 'video') {
    const original = file.originalSource || file.sources?.[0] || null;
    return {
      id: file.id,
      type: 'video',
      status: file.fileStatus || file.status || null,
      url: original?.url || null,
      previewUrl: file.preview?.image?.url || null,
    };
  }

  return {
    id: file.id,
    type: 'image',
    status: file.fileStatus || null,
    url: file.image?.url || null,
    previewUrl: file.image?.url || null,
  };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Unsupported operation' }, { status: 405 });
    }

    const body = await request.json().catch(() => ({}));
    const operation = String(body.operation || '');

    if (operation === 'prepare') {
      const kind = body.kind === 'video' ? 'video' : 'image';
      const mimeType = String(body.mimeType || '');
      const size = Number(body.size || 0);
      const filename = safeFilename(body.filename, kind);

      if (kind === 'image' && !mimeType.startsWith('image/')) {
        return Response.json({ error: 'Choose an image file.' }, { status: 400 });
      }
      if (kind === 'video' && !mimeType.startsWith('video/')) {
        return Response.json({ error: 'Choose a video file.' }, { status: 400 });
      }
      if (!size || size < 1) {
        return Response.json({ error: 'The selected media file is empty.' }, { status: 400 });
      }

      const input = {
        resource: kind === 'video' ? 'VIDEO' : 'IMAGE',
        filename,
        mimeType,
        httpMethod: 'POST',
      };
      if (kind === 'video') input.fileSize = String(size);

      const stagedData = await adminGraphql(admin, STAGED_UPLOAD_MUTATION, {
        input: [input],
      });
      assertNoErrors(stagedData.stagedUploadsCreate, 'Could not prepare the social media upload');

      const target = stagedData.stagedUploadsCreate.stagedTargets?.[0];
      if (!target) throw new Error('Shopify did not return a media upload target.');

      return Response.json({
        uploadUrl: target.url,
        resourceUrl: target.resourceUrl,
        parameters: target.parameters || [],
      });
    }

    if (operation === 'finalize') {
      const kind = body.kind === 'video' ? 'video' : 'image';
      const resourceUrl = String(body.resourceUrl || '');
      const filename = safeFilename(body.filename, kind);
      const alt = String(body.alt || 'Consignment item social media').slice(0, 512);

      if (!resourceUrl) {
        return Response.json({ error: 'The staged media URL is missing.' }, { status: 400 });
      }

      const fileData = await adminGraphql(admin, FILE_CREATE_MUTATION, {
        files: [{
          originalSource: resourceUrl,
          contentType: kind === 'video' ? 'VIDEO' : 'IMAGE',
          filename,
          alt,
          duplicateResolutionMode: 'APPEND_UUID',
        }],
      });
      assertNoErrors(fileData.fileCreate, 'Could not save the social media file in Shopify');

      const file = fileData.fileCreate.files?.[0];
      if (!file?.id) throw new Error('Shopify did not return the saved media file.');

      return Response.json(normalizeFile(file, kind));
    }

    if (operation === 'status') {
      const id = String(body.id || '');
      if (!id) return Response.json({ error: 'Media file ID is required.' }, { status: 400 });

      const statusData = await adminGraphql(admin, FILE_STATUS_QUERY, { id });
      const file = statusData.node;
      if (!file) return Response.json({ error: 'The uploaded media file was not found.' }, { status: 404 });

      const kind = file.__typename === 'Video' ? 'video' : 'image';
      return Response.json(normalizeFile(file, kind));
    }

    return Response.json({ error: 'Unknown media upload operation.' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not upload social media.' },
      { status: 500 },
    );
  }
}
