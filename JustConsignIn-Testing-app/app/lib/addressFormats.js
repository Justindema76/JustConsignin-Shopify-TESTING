// Country, province/state lists and address labels for consignor addresses.
//
// Countries are stored as ISO codes ("CA"); provinces/states are stored as
// their full name ("Ontario"), matching what consignors already have saved.
// Canada, the US and Australia get a dropdown; every other country types its
// region in.

const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
  + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '
  + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '
  + 'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
  + 'SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ '
  + 'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

const REGIONS = {
  CA: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon',
  ],
  US: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
    'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
    'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
    'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Puerto Rico', 'Rhode Island',
    'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  AU: [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland',
    'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
  ],
};

const LABELS = {
  CA: { region: 'Province', postal: 'Postal code' },
  US: { region: 'State', postal: 'ZIP code' },
  AU: { region: 'State/territory', postal: 'Postcode' },
  GB: { region: 'County', postal: 'Postcode' },
  IE: { region: 'County', postal: 'Eircode' },
  NZ: { region: 'Region', postal: 'Postcode' },
};

const DEFAULT_LABELS = { region: 'Region', postal: 'Postal code' };

let displayNames = null;
function names() {
  if (!displayNames) {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      displayNames = { of: (code) => code };
    }
  }
  return displayNames;
}

export function countryName(code) {
  if (!code) return '';
  try {
    return names().of(code) || code;
  } catch {
    return code;
  }
}

export function countryOptions() {
  return COUNTRY_CODES
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Accepts "CA", "ca" or "Canada" (as typed in a CSV) and returns "CA".
export function toCountryCode(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  const upper = input.toUpperCase();
  if (COUNTRY_CODES.includes(upper)) return upper;
  const lower = input.toLowerCase();
  return COUNTRY_CODES.find((code) => countryName(code).toLowerCase() === lower) || '';
}

// Returns the dropdown list for a country, or null when it's typed in.
export function regionsFor(code) {
  return REGIONS[code] || null;
}

export function addressLabels(code) {
  return LABELS[code] || DEFAULT_LABELS;
}
