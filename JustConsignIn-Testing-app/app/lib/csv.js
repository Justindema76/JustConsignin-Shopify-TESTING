import { downloadCsv } from './consignmentHelpers';

export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      field = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2)
    throw new Error('The CSV needs a header row and at least one data row.');
  const headers = rows[0].map((value) =>
    value.toLowerCase().replace(/\s+/g, '_'),
  );
  return rows
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] || '']),
      ),
    );
}

export function exportConsignors(consignors) {
  const headers = [
    'number',
    'first_name',
    'last_name',
    'phone',
    'email',
    'address',
    'city',
    'province',
    'postal_code',
    'date_joined',
    'commission_pct',
    'unsold_preference',
    'notes',
  ];
  const rows = consignors.map((c) => [
    c.number,
    c.firstName,
    c.lastName,
    c.phone,
    c.email,
    c.address,
    c.city,
    c.province,
    c.postalCode,
    c.dateJoined,
    c.commissionPct,
    c.unsoldPreference,
    c.notes,
  ]);
  downloadCsv(
    `consignors-${new Date().toISOString().slice(0, 10)}.csv`,
    headers,
    rows,
  );
}
