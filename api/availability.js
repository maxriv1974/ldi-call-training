export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.PRACTICEQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const endDate = end.toISOString().split('T')[0];

  try {
    const pages = await Promise.all([1, 2].map(page =>
      fetch(`https://intakeq.com/api/v1/appointments?startDate=${startDate}&endDate=${endDate}&page=${page}`, {
        headers: { 'X-Auth-Key': apiKey }
      }).then(r => r.ok ? r.json() : [])
    ));

    const appointments = pages.flat();

    const byEmail = {};
    for (const appt of appointments) {
      if (appt.Status === 'Cancelled' || appt.Status === 'No Show') continue;
      const email = (appt.PractitionerEmail || '').toLowerCase();
      if (!email) continue;
      if (!byEmail[email]) byEmail[email] = { thisWeek: 0, nextAppt: null };
      byEmail[email].thisWeek++;

      if (appt.StartDate) {
        const ts = typeof appt.StartDate === 'number' ? appt.StartDate : Number(appt.StartDate);
        if (!byEmail[email].nextAppt || ts < byEmail[email].nextAppt) {
          byEmail[email].nextAppt = ts;
        }
      }
    }

    return res.status(200).json({
      success: true,
      startDate,
      endDate,
      totalAppointments: appointments.length,
      byEmail
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
