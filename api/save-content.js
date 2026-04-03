export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, pageId, html } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  if (!pageId || typeof html !== 'string') {
    return res.status(400).json({ error: 'Missing pageId or html' });
  }
  // Sanity check pageId
  const validPages = ['page-scenarios','page-scripts','page-exploration','page-insurance','page-pipeline','page-checklist','page-objections','page-callflow'];
  if (!validPages.includes(pageId)) {
    return res.status(400).json({ error: 'Invalid pageId: ' + pageId });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = 'maxriv1974';
  const repo = 'ldi-call-training';
  const path = 'content.json';
  const apiBase = 'https://api.github.com';

  try {
    // Get current content.json
    const getRes = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let current = {};
    let sha = null;
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      try {
        current = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
      } catch(e) { current = {}; }
    }

    // Merge the new page content
    current[pageId] = html;

    const content = Buffer.from(JSON.stringify(current, null, 2)).toString('base64');
    const putRes = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Admin update: page content (${pageId})`,
        content,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(500).json({ error: 'GitHub save failed', detail: err });
    }

    return res.status(200).json({ success: true, message: 'Saved! Changes will go live in ~30 seconds.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
