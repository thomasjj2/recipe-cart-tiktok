// Netlify function: sends a prompt to Gemini and returns the image.
// Needs GEMINI_API_KEY in Netlify. Optional: MAKER_PASSCODE, GEMINI_MODEL.
export default async (req) => {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const need = process.env.MAKER_PASSCODE;
  if (need && req.headers.get('x-passcode') !== need) return json({ error: 'Wrong passcode' }, 401);
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'GEMINI_API_KEY is not set in Netlify' }, 500);
  let prompt = '';
  try { ({ prompt } = await req.json()); } catch {}
  prompt = String(prompt || '').slice(0, 900);
  if (!prompt) return json({ error: 'No prompt' }, 400);
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } }
    })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: (d.error && d.error.message) || 'Gemini error ' + r.status }, r.status === 429 ? 429 : 502);
  const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
  const p = parts.find(x => x.inlineData || x.inline_data);
  if (!p) return json({ error: 'Gemini returned no image (the prompt may have been blocked)' }, 502);
  const b = p.inlineData || p.inline_data;
  return json({ image: `data:${b.mimeType || b.mime_type || 'image/png'};base64,${b.data}` });
};

