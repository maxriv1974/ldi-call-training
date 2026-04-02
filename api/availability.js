export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.PRACTICEQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const today = new Date();
  const dow = today.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monThis = new Date(today);
  monThis.setDate(today.getDate() + diffToMon);
  monThis.setHours(0, 0, 0, 0);

  const monLast = new Date(monThis); monLast.setDate(monThis.getDate() - 7);  const monNext = new Date(monThis);
  monNext.setDate(monThis.getDate() + 7);
  const friNext = new Date(monNext);
  friNext.setDate(monNext.getDate() + 6);

  const fmt = d => d.toISOString().split('T')[0];
  const startDate = fmt(monLast);
  const endDate = fmt(friNext);

  const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const getPeriod = h => h < 12 ? 'am' : h < 14 ? 'mid' : h < 17 ? 'aft' : 'eve';

  try {
    const pages = await Promise.all([1,2,3].map(page =>
      fetch('https://intakeq.com/api/v1/appointments?startDate='+startDate+'&endDate='+endDate+'&page='+page, {
        headers: { 'X-Auth-Key': apiKey }
      }).then(r => r.ok ? r.json() : [])
    ));
    const appointments = pages.flat();
    const byEmail = {};

    for (const appt of appointments) {
      if (appt.Status === 'Cancelled' || appt.Status === 'No Show') continue;
      const email = (appt.PractitionerEmail || '').toLowerCase();
      if (!email) continue;
      const localDt = appt.StartDateLocal || '';
      if (!localDt) continue;
      const [datePart, timePart] = localDt.split('T');
      const hour = parseInt((timePart || '0').split(':')[0], 10);
      const jsDate = new Date(datePart + 'T12:00:00');
      const dayAbbr = DAY_ABBR[jsDate.getDay()];
      const period = getPeriod(hour);
      const week = jsDate.getTime() < monThis.getTime() ? 'last' : jsDate.getTime() < monNext.getTime() ? 'this' : 'next';

      if (!byEmail[email]) byEmail[email] = { sessions:[], lastWeek:0, thisWeek:0, nextWeek:0, lastWorkDays:[], thisWorkDays:[], nextWorkDays:[], lastWorkPeriods:[], thisWorkPeriods:[], nextWorkPeriods:[] };
      const rec = byEmail[email];
      rec.sessions.push({ date: datePart, dayAbbr, hour, period, week });
      if (week === 'last') { rec.lastWeek++; if (!rec.lastWorkDays.includes(dayAbbr)) rec.lastWorkDays.push(dayAbbr); if (!rec.lastWorkPeriods.includes(period)) rec.lastWorkPeriods.push(period); } else if (week === 'this') {
        rec.thisWeek++;
        if (!rec.thisWorkDays.includes(dayAbbr)) rec.thisWorkDays.push(dayAbbr);
        if (!rec.thisWorkPeriods.includes(period)) rec.thisWorkPeriods.push(period);
      } else {
        rec.nextWeek++;
        if (!rec.nextWorkDays.includes(dayAbbr)) rec.nextWorkDays.push(dayAbbr);
        if (!rec.nextWorkPeriods.includes(period)) rec.nextWorkPeriods.push(period);
      }
    }

    return res.status(200).json({ success:true, startDate, endDate, thisWeekStart:fmt(monThis), nextWeekStart:fmt(monNext), totalAppointments:appointments.length, byEmail });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
