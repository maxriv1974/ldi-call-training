export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  const owner = 'maxriv1974';
  const repo = 'ldi-call-training';
  const path = 'priorities.json';
  const apiBase = 'https://api.github.com';

  try {
    const getRes = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!getRes.ok) {
      return res.status(200).json({});
    }

    const fileData = await getRes.json();
    const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
    return res.status(200).json(content);
  } catch (e) {
    return res.status(200).json({});
  }
}
