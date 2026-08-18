import type { SpinEvent } from '../services/persistenceService';

export const SEED_SPIN_EVENTS: Omit<SpinEvent, 'id'>[] = [
  {
    speaker: 'Narendra Modi',
    term: 'fiscal consolidation path',
    translation: 'spending cuts to reduce deficit',
    articleId: 'seed-external-research',
    articleTitle: 'Economic Strategy 2026',
    timestamp: '2026-08-15T12:00:00Z'
  },
  {
    speaker: 'Nirmala Sitharaman',
    term: 'rationalization of subsidies',
    translation: 'subsidy reductions and removals',
    articleId: 'seed-external-research',
    articleTitle: 'Budget Policy 2026',
    timestamp: '2026-08-16T10:00:00Z'
  },
  {
    speaker: 'Union Cabinet',
    term: 'personnel optimization',
    translation: 'job cuts and hiring freezes',
    articleId: 'seed-external-research',
    articleTitle: 'Government Workforce Restructuring',
    timestamp: '2026-08-10T14:30:00Z'
  },
  {
    speaker: 'Reserve Bank of India',
    term: 'calibrated tightening',
    translation: 'gradual interest rate increases',
    articleId: 'seed-external-research',
    articleTitle: 'Monetary Policy Updates',
    timestamp: '2026-08-05T09:15:00Z'
  },
  {
    speaker: 'Amit Shah',
    term: 'preventive detention',
    translation: 'jailing without trial under suspicion',
    articleId: 'seed-external-research',
    articleTitle: 'National Security Directives',
    timestamp: '2026-07-28T16:45:00Z'
  },
  {
    speaker: 'Ashwini Vaishnaw',
    term: 'rolling stock augmentation',
    translation: 'buying more trains because old ones are failing',
    articleId: 'seed-external-research',
    articleTitle: 'Railways Modernization Plan',
    timestamp: '2026-07-15T11:20:00Z'
  },
  {
    speaker: 'D. K. Shivakumar',
    term: 'administrative restructuring',
    translation: 'transferring or sidelining officials',
    articleId: 'seed-external-research',
    articleTitle: 'State Governance Changes',
    timestamp: '2026-08-01T13:00:00Z'
  },
  {
    speaker: 'Yogi Adityanath',
    term: 'proactive law enforcement',
    translation: 'aggressive policing tactics',
    articleId: 'seed-external-research',
    articleTitle: 'Law and Order Review',
    timestamp: '2026-08-12T15:30:00Z'
  },
  {
    speaker: 'Supreme Court of India',
    term: 'judicial restraint',
    translation: 'refusing to intervene in government policy',
    articleId: 'seed-external-research',
    articleTitle: 'Landmark Rulings 2026',
    timestamp: '2026-07-10T10:00:00Z'
  },
  {
    speaker: 'Election Commission of India',
    term: 'procedural rationalization',
    translation: 'changing rules that make voting harder',
    articleId: 'seed-external-research',
    articleTitle: 'Electoral Reforms 2026',
    timestamp: '2026-06-25T11:45:00Z'
  },
  {
    speaker: 'Ministry of Electronics and Information Technology',
    term: 'content moderation guidelines',
    translation: 'stricter internet censorship rules',
    articleId: 'seed-external-research',
    articleTitle: 'IT Rules 2026',
    timestamp: '2026-05-18T14:00:00Z'
  },
  {
    speaker: 'Nitin Gadkari',
    term: 'toll rationalization',
    translation: 'increasing highway usage fees',
    articleId: 'seed-external-research',
    articleTitle: 'Infrastructure Financing',
    timestamp: '2026-04-22T09:30:00Z'
  },
  {
    speaker: 'Shivraj Singh Chouhan',
    term: 'targeted welfare delivery',
    translation: 'reducing the number of eligible beneficiaries',
    articleId: 'seed-external-research',
    articleTitle: 'Agricultural Subsidy Review',
    timestamp: '2026-03-30T10:15:00Z'
  },
  {
    speaker: 'Rahul Gandhi',
    term: 'democratic backsliding',
    translation: 'government consolidating too much power',
    articleId: 'seed-external-research',
    articleTitle: 'Opposition Strategy Meet',
    timestamp: '2026-08-14T16:00:00Z'
  },
  {
    speaker: 'Piyush Goyal',
    term: 'import substitution strategy',
    translation: 'banning or taxing foreign goods heavily',
    articleId: 'seed-external-research',
    articleTitle: 'Trade Policy Announcement',
    timestamp: '2026-07-05T11:00:00Z'
  },
  {
    speaker: 'S. Jaishankar',
    term: 'strategic autonomy',
    translation: 'refusing to side with Western allies',
    articleId: 'seed-external-research',
    articleTitle: 'Foreign Policy Briefing',
    timestamp: '2026-06-12T14:45:00Z'
  },
  {
    speaker: 'Rajnath Singh',
    term: 'indigenization of defense procurement',
    translation: 'banning imports to force domestic military manufacturing',
    articleId: 'seed-external-research',
    articleTitle: 'Defense Sector Overhaul',
    timestamp: '2026-05-28T10:30:00Z'
  },
  {
    speaker: 'J. P. Nadda',
    term: 'healthcare infrastructure optimization',
    translation: 'closing underperforming rural clinics',
    articleId: 'seed-external-research',
    articleTitle: 'Public Health Initiatives',
    timestamp: '2026-04-15T12:15:00Z'
  },
  {
    speaker: 'Himanta Biswa Sarma',
    term: 'demographic rebalancing',
    translation: 'policies targeting specific minority groups',
    articleId: 'seed-external-research',
    articleTitle: 'State Security Review',
    timestamp: '2026-03-10T15:00:00Z'
  },
  {
    speaker: 'Bhagwant Mann',
    term: 'revenue augmentation measures',
    translation: 'raising state taxes and liquor prices',
    articleId: 'seed-external-research',
    articleTitle: 'Punjab State Budget',
    timestamp: '2026-02-25T11:30:00Z'
  }

  ,
  {
    speaker: 'Surya Kant',
    term: 'procedural irregularities',
    translation: 'police broke the law during the investigation',
    articleId: 'seed-external-research',
    articleTitle: 'Supreme Court Review',
    timestamp: '2026-08-10T12:00:00Z'
  },
  {
    speaker: 'Sanjay Malhotra',
    term: 'transitory price shocks',
    translation: 'inflation is high right now but we hope it drops',
    articleId: 'seed-external-research',
    articleTitle: 'RBI Monetary Policy Briefing',
    timestamp: '2026-08-12T10:00:00Z'
  },
  {
    speaker: 'S. Jaishankar',
    term: 'multi-aligned posture',
    translation: 'trading with everyone regardless of alliances',
    articleId: 'seed-external-research',
    articleTitle: 'MEA Press Conference',
    timestamp: '2026-08-15T14:30:00Z'
  },
  {
    speaker: 'Arvind Kejriwal',
    term: 'administrative friction',
    translation: 'bureaucrats refusing to clear our files',
    articleId: 'seed-external-research',
    articleTitle: 'Delhi Governance Update',
    timestamp: '2026-08-14T09:15:00Z'
  },
  {
    speaker: 'Securities and Exchange Board of India',
    term: 'market stabilization measures',
    translation: 'intervening to stop a stock market crash',
    articleId: 'seed-external-research',
    articleTitle: 'SEBI Market Circular',
    timestamp: '2026-08-01T16:45:00Z'
  },
  {
    speaker: 'Parliament of India',
    term: 'voice vote consensus',
    translation: 'passing a bill without counting individual votes',
    articleId: 'seed-external-research',
    articleTitle: 'Parliamentary Session Highlights',
    timestamp: '2026-07-28T11:20:00Z'
  }



];
