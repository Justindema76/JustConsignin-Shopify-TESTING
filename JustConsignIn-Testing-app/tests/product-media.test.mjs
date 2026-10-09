import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadImage } from '../app/components/consignment/productMedia.client.js';

function mockUpload(t, replies) {
  const calls = [];
  t.mock.method(globalThis, 'setTimeout', (callback) => { callback(); return 0; });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    const reply = replies.shift();
    assert.ok(reply, 'Unexpected extra request');
    return Response.json(reply.body, { status: reply.status || 200 });
  });
  return calls;
}
const image = () => new File(['image'], 'coat.png', { type: 'image/png' });

test('an image without a URL is checked until Shopify provides the finished image', async (t) => {
  const calls = mockUpload(t, [
    { body: { id: 'gid://shopify/MediaImage/1', status: 'PROCESSING', url: null } },
    { body: { status: 'PROCESSING', url: null } },
    { body: { status: 'READY', url: 'https://cdn.shopify.com/coat.png' } },
  ]);
  const result = await uploadImage(image(), 'Coat');
  assert.deepEqual(result, { id: 'gid://shopify/MediaImage/1', url: 'https://cdn.shopify.com/coat.png', alt: 'Coat' });
  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, '/api/social-media-upload');
  assert.deepEqual(JSON.parse(calls[1].options.body), { operation: 'status', id: result.id });
});

test('ready images do not need additional status requests', async (t) => {
  const calls = mockUpload(t, [{ body: { id: 'image-1', url: 'https://cdn.shopify.com/coat.png', status: 'READY' } }]);
  assert.equal((await uploadImage(image(), 'Coat')).url, 'https://cdn.shopify.com/coat.png');
  assert.equal(calls.length, 1);
});

test('failed Shopify processing reports an error instead of accepting an empty image', async (t) => {
  mockUpload(t, [
    { body: { id: 'image-1', status: 'PROCESSING' } },
    { body: { status: 'FAILED' } },
  ]);
  await assert.rejects(uploadImage(image(), 'Coat'), /could not process/);
});

test('status request errors are reported to the uploader', async (t) => {
  mockUpload(t, [
    { body: { id: 'image-1', status: 'PROCESSING' } },
    { status: 500, body: { error: 'Status unavailable' } },
  ]);
  await assert.rejects(uploadImage(image(), 'Coat'), /Status unavailable/);
});

test('processing timeout reports an error instead of committing a grey image', async (t) => {
  const calls = mockUpload(t, Array.from({ length: 41 }, () => ({ body: { id: 'image-1', status: 'PROCESSING' } })));
  await assert.rejects(uploadImage(image(), 'Coat'), /still processing/);
  assert.equal(calls.length, 41);
});
