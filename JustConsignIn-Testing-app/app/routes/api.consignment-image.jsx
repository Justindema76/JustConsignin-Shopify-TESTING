import { authenticate } from '../shopify.server';

const STAGED_UPLOAD_MUTATION = `#graphql
  mutation PrepareImageUpload($input: [StagedUploadInput!]!) {
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
  mutation CreateShopifyFile($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage {
          image { url }
        }
      }
      userErrors { field message }
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

function safeFilename(value) {
  const normalized = String(value || 'consignment-photo.jpg')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized.endsWith('.jpg') || normalized.endsWith('.jpeg') || normalized.endsWith('.png')
    ? normalized
    : `${normalized || 'consignment-photo'}.jpg`;
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  try {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Unsupported operation' }, { status: 405 });
    }

    const body = await request.formData();
    const image = body.get('image');
    const alt = String(body.get('alt') || 'Consignment item');

    if (!(image instanceof File) || !image.type.startsWith('image/')) {
      return Response.json({ error: 'Choose a JPG, PNG, HEIC, or other image file.' }, { status: 400 });
    }
    if (image.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'The image must be smaller than 10 MB.' }, { status: 400 });
    }

    const filename = safeFilename(image.name);
    const stagedData = await adminGraphql(admin, STAGED_UPLOAD_MUTATION, {
      input: [{
        resource: 'IMAGE',
        filename,
        mimeType: image.type || 'image/jpeg',
        httpMethod: 'POST',
      }],
    });
    assertNoErrors(stagedData.stagedUploadsCreate, 'Could not prepare the image upload');

    const target = stagedData.stagedUploadsCreate.stagedTargets?.[0];
    if (!target) throw new Error('Shopify did not return an image upload target.');

    const uploadBody = new FormData();
    for (const parameter of target.parameters) {
      uploadBody.append(parameter.name, parameter.value);
    }
    uploadBody.append('file', image, filename);

    const uploadResponse = await fetch(target.url, {
      method: 'POST',
      body: uploadBody,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Image transfer failed (${uploadResponse.status}).`);
    }

    const fileData = await adminGraphql(admin, FILE_CREATE_MUTATION, {
      files: [{
        originalSource: target.resourceUrl,
        contentType: 'IMAGE',
        filename,
        alt: alt.slice(0, 512),
        duplicateResolutionMode: 'APPEND_UUID',
      }],
    });
    assertNoErrors(fileData.fileCreate, 'Could not save the image in Shopify');

    const file = fileData.fileCreate.files?.[0];
    if (!file?.id) throw new Error('Shopify did not return the saved image.');

    return Response.json({
      id: file.id,
      url: file.image?.url || null,
      status: file.fileStatus,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
