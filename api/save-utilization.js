export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, id, utilization } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid id' });
  }

  if (!utilization || typeof utilization !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid utilization object' });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = 'maxriv1974';
  const repo = 'ldi-call-training';
  const path = 'therapists.json';
  const apiBase = 'https://api.github.com';

  try {
    const getRes = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!getRes.ok) {
      return res.status(500).json({ error: 'Could not fetch therapists.json from GitHub' });
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;
    const therapists = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

    const idx = therapists.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: `No clinician found with id "${id}"` });
    }

    therapists[idx].utilization = {
      ...utilization,
      lastUpdated: utilization.lastUpdated || new Date().toISOString(),
    };

    const content = Buffer.from(JSON.stringify(therapists, null, 2)).toString('base64');

    const putRes = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Bot update: utilization for ${id}`,
        content,
        sha,
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return res.status(500).json({ error: 'GitHub save failed', detail: err });
    }

    return res.status(200).json({ success: true, id, updated: therapists[idx].utilization });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
