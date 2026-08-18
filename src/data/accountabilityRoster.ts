/**
 * RAWINDIA — Accountability Roster (Netaji Report Card)
 *
 * The curated allowlist of who/what actually gets a Netaji Report Card row.
 * Before this existed, institutionLedgerService.ts surfaced ANY name that
 * happened to get quoted, spin-decoded, or verdict-tagged — including one-off
 * defendants, PSU corporations, and generic case descriptions that aren't
 * really "a leader or institution accountable to the public." This file is
 * the fix: only a name/institution matching an entry here (by canonical name
 * or alias) ever shows up.
 *
 * Scope, deliberately: the President/VP/PM, cabinet-rank Union Ministers,
 * both Houses' Leaders of Opposition, the Speaker, the Chief Justice of
 * India, the RBI Governor, the Chief Election Commissioner, the CAG, every
 * state/UT Chief Minister, and MAIN national institutions (constitutional
 * bodies, key regulators). Deliberately excludes individual PSUs/
 * corporations, state police departments, and one-off case parties — those
 * aren't "main" leaders/institutions in the sense asked for, even though
 * they're real and accountable in their own right.
 *
 * Researched and cross-checked (2+ independent sources per fact, official
 * government sources preferred) as of 2026-08-18 — this is a snapshot, not a
 * static truth. Cabinet reshuffles, state elections, and appointments (CJI,
 * RBI Governor, CEC, CAG) will make entries here stale over time. That's
 * exactly why this file is only the SEED: the live source of truth is the
 * shared Upstash store it seeds once (see rosterService.ts), editable from
 * the admin dashboard's Roster tab without a redeploy.
 */

import { canonicalizeInstitutionName } from '../utils/routing';

export type RosterCategory = 'national-leader' | 'state-leader' | 'institution';

export interface RosterEntry {
  id: string;
  name: string;
  aliases: string[];
  category: RosterCategory;
  role: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Resolves a raw, as-extracted name (e.g. "Narendra Modi, Prime Minister" or "RBI") to its roster entry, if any. */
export function matchRosterEntry(rawName: string, roster: RosterEntry[]): RosterEntry | null {
  const canonical = norm(canonicalizeInstitutionName(rawName));
  if (!canonical) return null;
  return roster.find(r => norm(r.name) === canonical || r.aliases.some(a => norm(a) === canonical)) || null;
}

let n = 0;
const id = () => `roster-seed-${++n}`;

const nationalLeader = (name: string, role: string, aliases: string[] = []): RosterEntry =>
  ({ id: id(), name, aliases, category: 'national-leader', role });

const stateLeader = (name: string, state: string, aliases: string[] = []): RosterEntry =>
  ({ id: id(), name, aliases, category: 'state-leader', role: `Chief Minister of ${state}` });

const institution = (name: string, role: string, aliases: string[] = []): RosterEntry =>
  ({ id: id(), name, aliases, category: 'institution', role });

export const ACCOUNTABILITY_ROSTER: RosterEntry[] = [
  // ── National Leaders ────────────────────────────────────────────────────
  nationalLeader('Droupadi Murmu', 'President of India', ['President Murmu']),
  nationalLeader('C. P. Radhakrishnan', 'Vice President of India / Chairman, Rajya Sabha', ['C P Radhakrishnan', 'Vice President of India']),
  nationalLeader('Narendra Modi', 'Prime Minister of India', ['PM Modi', 'PM', 'Prime Minister']),
  nationalLeader('Amit Shah', 'Union Minister of Home Affairs & Cooperation', ['Home Minister', 'Ministry of Home Affairs', 'MHA']),
  nationalLeader('Nirmala Sitharaman', 'Union Minister of Finance & Corporate Affairs', ['Finance Minister', 'Ministry of Finance', 'MoF']),
  nationalLeader('Rajnath Singh', 'Union Minister of Defence', ['Defence Minister', 'Ministry of Defence', 'MoD']),
  nationalLeader('S. Jaishankar', 'Union Minister of External Affairs', ['Subrahmanyam Jaishankar', 'Jaishankar', 'EAM']),
  nationalLeader('Pralhad Joshi', 'Union Minister of Education'),
  nationalLeader('J. P. Nadda', 'Union Minister of Health & Family Welfare, Chemicals & Fertilizers', ['Jagat Prakash Nadda', 'Ministry of Health', 'MoHFW', 'Health Minister', 'Ministry of Health and Family Welfare']),
  nationalLeader('Ashwini Vaishnaw', 'Union Minister of Railways, Information & Broadcasting, Electronics & IT', ['Ministry of Railways', 'Railways Minister']),
  nationalLeader('Nitin Gadkari', 'Union Minister of Road Transport & Highways', ['MoRTH', 'National Highways', 'Road Transport Minister']),
  nationalLeader('Shivraj Singh Chouhan', 'Union Minister of Agriculture & Farmers Welfare, Rural Development', ['Ministry of Agriculture']),
  nationalLeader('Piyush Goyal', 'Union Minister of Commerce and Industry'),
  nationalLeader('Rahul Gandhi', 'Leader of Opposition, Lok Sabha', ['LoP']),
  nationalLeader('Om Birla', 'Speaker, Lok Sabha'),
  nationalLeader('Mallikarjun Kharge', 'Leader of Opposition, Rajya Sabha'),
  nationalLeader('Arvind Kejriwal', 'AAP National Convenor, Former Chief Minister of Delhi'),
  nationalLeader('Manish Sisodia', 'Former Deputy Chief Minister of Delhi, AAP'),
  nationalLeader('Surya Kant', 'Chief Justice of India', ['Justice Surya Kant', 'CJI', 'Chief Justice of India']),
  nationalLeader('Sanjay Malhotra', 'Governor, Reserve Bank of India', ['RBI Governor']),
  nationalLeader('Gyanesh Kumar', 'Chief Election Commissioner of India', ['CEC']),
  nationalLeader('K. Sanjay Murthy', 'Comptroller and Auditor General of India', ['CAG']),

  // ── State/UT Chief Ministers ────────────────────────────────────────────
  stateLeader('N. Chandrababu Naidu', 'Andhra Pradesh'),
  stateLeader('Pema Khandu', 'Arunachal Pradesh'),
  stateLeader('Himanta Biswa Sarma', 'Assam'),
  stateLeader('Samrat Choudhary', 'Bihar'),
  stateLeader('Vishnu Deo Sai', 'Chhattisgarh'),
  stateLeader('Rekha Gupta', 'Delhi'),
  stateLeader('Pramod Sawant', 'Goa'),
  stateLeader('Bhupendrabhai Patel', 'Gujarat', ['Bhupendra Patel']),
  stateLeader('Nayab Singh Saini', 'Haryana'),
  stateLeader('Sukhvinder Singh Sukhu', 'Himachal Pradesh'),
  stateLeader('Omar Abdullah', 'Jammu & Kashmir', ['Jammu and Kashmir']),
  stateLeader('Hemant Soren', 'Jharkhand'),
  stateLeader('D. K. Shivakumar', 'Karnataka', ['DK Shivakumar']),
  stateLeader('V. D. Satheesan', 'Kerala', ['VD Satheesan']),
  stateLeader('Mohan Yadav', 'Madhya Pradesh'),
  stateLeader('Devendra Fadnavis', 'Maharashtra'),
  stateLeader('Yumnam Khemchand Singh', 'Manipur'),
  stateLeader('Conrad Sangma', 'Meghalaya'),
  stateLeader('Lalduhoma', 'Mizoram'),
  stateLeader('Neiphiu Rio', 'Nagaland'),
  stateLeader('Mohan Charan Majhi', 'Odisha'),
  stateLeader('N. Rangasamy', 'Puducherry'),
  stateLeader('Bhagwant Mann', 'Punjab'),
  stateLeader('Bhajan Lal Sharma', 'Rajasthan'),
  stateLeader('Prem Singh Tamang', 'Sikkim'),
  stateLeader('C. Joseph Vijay', 'Tamil Nadu', ['Vijay', 'Thalapathy Vijay']),
  stateLeader('Revanth Reddy', 'Telangana', ['Government of Telangana']),
  stateLeader('Manik Saha', 'Tripura'),
  stateLeader('Yogi Adityanath', 'Uttar Pradesh'),
  stateLeader('Pushkar Singh Dhami', 'Uttarakhand'),
  stateLeader('Suvendu Adhikari', 'West Bengal'),

  // ── Institutions ────────────────────────────────────────────────────────
  institution('Parliament of India', 'Union Legislature', ['Parliament', 'Lok Sabha', 'Rajya Sabha']),
  institution('Supreme Court of India', 'Apex Judiciary', ['Supreme Court']),
  institution('Reserve Bank of India', 'Central Bank of India', ['RBI']),
  institution('Election Commission of India', 'Constitutional Election Authority', ['ECI']),
  institution('NITI Aayog', 'National Policy Think Tank'),
  institution('Securities and Exchange Board of India', 'Capital Markets Regulator', ['SEBI']),
  institution('Central Bureau of Investigation', 'National Investigation Agency', ['CBI']),
  institution('Office of the Comptroller and Auditor General of India', 'Supreme Audit Institution', ['CAG', 'Comptroller and Auditor General']),
  institution('Telecom Regulatory Authority of India', 'Telecom Sector Regulator', ['TRAI']),
  institution('Competition Commission of India', 'Antitrust Regulator', ['CCI']),
  institution('Ministry of Electronics and Information Technology', 'Central Ministry — IT & Electronics', ['MeitY']),
  institution('Union Cabinet', 'Central Decision-Making Body', ['Cabinet', 'Government of India', 'Union Government', 'Centre', 'CCEA', 'CCEA Spokesperson', 'Cabinet Committee on Economic Affairs']),
  institution('GST Council', 'Constitutional GST Rate-Setting Body', ['GST Council of India']),
  institution('Ministry of Jal Shakti', 'Central Ministry — Water Resources & Sanitation'),
  institution('Ministry of Housing and Urban Affairs', 'Central Ministry — Housing & Urban Development'),
  institution('Ministry of Rural Development', 'Central Ministry — Rural Development'),
  institution('Ministry of Skill Development and Entrepreneurship', 'Central Ministry — Skilling & Entrepreneurship'),
  institution('Ministry of Women and Child Development', 'Central Ministry — Women & Child Welfare'),
  institution('Ministry of Labour and Employment', 'Central Ministry — Labour & Employment'),
  institution('Ministry of Youth Affairs and Sports', 'Central Ministry — Youth Affairs & Sports'),
  institution('Ministry of Power', 'Central Ministry — Power & Electrification'),
  institution('Ministry of Heavy Industries', 'Central Ministry — Heavy Industries'),
  institution('Ministry of New and Renewable Energy', 'Central Ministry — Renewable Energy'),
  institution('Ministry of Panchayati Raj', 'Central Ministry — Panchayati Raj Institutions'),
  institution('Ministry of Agriculture and Farmers Welfare', 'Central Ministry — Agriculture & Farmers Welfare'),
  institution('Department of Investment and Public Asset Management', 'Central Government Department — Disinvestment', ['DIPAM']),
  institution('Office of the Registrar General of India', 'Census & Civil Registration Authority'),
  institution('Delimitation Commission', 'Constitutional Seat-Redrawing Body'),
];
