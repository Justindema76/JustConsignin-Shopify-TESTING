export async function uploadImage(file, alt) {
  const body = new FormData();
  body.append('image', file, file.name || 'consignment-photo.jpg');
  body.append('alt', alt || 'Consignment item');

  const response = await fetch('/api/consignment-image', {
    method: 'POST',
    body,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Image upload failed (${response.status})`);
  }

  let ready = payload;
  for (let attempt = 0; !ready.url && attempt < 40; attempt += 1) {
    if (ready.status === 'FAILED') throw new Error('Shopify could not process the image. Try uploading it again.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const statusResponse = await fetch('/api/social-media-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'status', id: payload.id }),
    });
    ready = await statusResponse.json();
    if (!statusResponse.ok) throw new Error(ready.error || 'Could not check image processing.');
  }
  if (!ready.url) throw new Error('Shopify is still processing the image. Try uploading it again.');
  return { id: payload.id, url: ready.url, alt: alt || '' };
}
