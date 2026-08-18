import type { Article } from '../types';

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-1',
    title: 'Union Cabinet Clears ₹76,000 Cr Semiconductor Phase-2: 3 New Mega-Fabs Approved with 50% Fiscal Support',
    subtitle: 'Government signs off on 28nm and 14nm node fabrication units in Gujarat and Assam; joint ventures involve TSMC supply-chain partners and domestic conglomerates.',
    slug: 'cabinet-clears-semiconductor-phase-2-mega-fabs',
    verticalId: 5,
    verticalName: 'Technology',
    subCategory: 'Semiconductors & Electronics',
    subSubCategory: 'Mega-Fabs (Dholera, Sanand, Morigaon)',
    state: 'Gujarat',
    city: 'Dholera',
    contentType: 'NEWS',
    publishedAt: '2026-08-15T10:30:00+05:30',
    updatedAt: '2026-08-15T11:45:00+05:30',
    readTime: '4 min read',
    isBreaking: true,
    tags: ['Semiconductors', 'Cabinet Decision', 'Make in India', 'Electronics', 'Dholera', 'Tech'],
    author: {
      name: 'Aditya Rajvardhan',
      role: 'Chief Tech & Industrial Policy Editor',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'Investigative technology policy reporter with 14 years covering electronics supply chains, telecom infrastructure, and industrial ministries.',
      articlesCount: 428,
      accuracyScore: 99.2
    },
    heroImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: 'Silicon wafer fabrication facility layout under the India Semiconductor Mission (ISM) Phase-2 expansion.',
    factBlock: {
      title: 'What Actually Happened (The Raw Fact Layer)',
      summary: 'The Union Cabinet chaired by the Prime Minister approved Phase-2 of the India Semiconductor Mission (ISM) with a revised total outlay of ₹76,000 Crore on August 15, 2026.',
      bullets: [
        'Total Outlay: ₹76,000 Crore under modified Scheme for Setting Up of Semiconductor Fabs in India.',
        '50% Central Fiscal Support on par-pari-passu basis across all technology nodes (commercial 28nm down to 14nm).',
        'Locations Approved: Dholera Special Investment Region (Gujarat), Sanand ATMP cluster (Gujarat), and Morigaon packaging unit (Assam).',
        'Employment Projection: Estimated 34,000 direct high-tech engineering jobs and 1,10,000 indirect supply chain roles over 48 months.',
        'Timeline: Groundbreaking scheduled within 90 days; commercial production targeted for Q3 2028.'
      ],
      primarySources: [
        'Press Information Bureau (PIB) Cabinet Communiqué #ISM-2026-AUG',
        'Ministry of Electronics and Information Technology (MeitY) Official Gazette Notification',
        'ISM High-Powered Committee Project Evaluation Report'
      ],
      keyNumbers: [
        { label: 'Fiscal Outlay', value: '₹76,000 Cr' },
        { label: 'Central Subsidy', value: '50% Flat' },
        { label: 'Direct High-Tech Jobs', value: '34,000+' },
        { label: 'Target First Chip Out', value: 'Q3 2028' }
      ]
    },
    sourceTransparency: [
      {
        id: 'src-1',
        type: 'Official statement',
        name: 'Union Cabinet Press Briefing & PIB Gazette',
        description: 'Verbatim ministerial press release and gazetted subsidy terms reviewed by RAWINDIA desk.',
        verified: true,
        reliabilityScore: 100,
        url: 'https://pib.gov.in'
      },
      {
        id: 'src-2',
        type: 'Document',
        name: 'MeitY ISM Phase-2 Financial Expenditure Memo',
        description: 'Official budget allocation documentation cross-checked against Department of Expenditure sanction records.',
        verified: true,
        reliabilityScore: 98
      },
      {
        id: 'src-3',
        type: 'Wire / Verified Reporter',
        name: 'RAWINDIA Gujarat Bureau Ground Verification',
        description: 'On-site verification of land boundary allocation at Dholera SIR and power sub-station readiness.',
        verified: true,
        reliabilityScore: 95
      }
    ],
    correctionLog: [
      {
        timestamp: '2026-08-15 11:45 IST',
        note: 'Clarified that the 50% central fiscal incentive is calculated on project capital expenditure, excluding land procurement costs.',
        editor: 'Senior Copy Desk'
      }
    ],
    bodyParagraphs: [
      'In a decisive push to establish sovereign chip-making capabilities, the Union Cabinet today formally sanctioned Phase-2 of the India Semiconductor Mission (ISM). The decision commits ₹76,000 Crore in cumulative central incentives to accelerate the establishment of three additional commercial fabrication and advanced packaging plants.',
      'Unlike Phase-1 which focused predominantly on Assembly, Testing, Marking, and Packaging (ATMP) units, Phase-2 shifts strategic weight towards sub-28 nanometer logic nodes. These chips power automotive ECUs, 5G telecom base stations, smart meters, and defense avionics.',
      'According to documents accessed by RAWINDIA, the fiscal support model offers an unconditional 50% capital subsidy from the Union Government, matched by state-level top-ups between 15% and 20% in power tariff waivers, water infrastructure, and stamp duty exemptions.',
      'Industry experts note that while capital allocation is historic, the real test lies in cleanroom equipment procurement timelines and establishing ultra-pure industrial chemical supplies (such as electronic-grade hydrofluoric acid and nitrogen) currently dominated by East Asian conglomerates.'
    ],
    quoteHighlight: {
      quote: 'India is moving from semiconductor consumer to a tier-1 silicon producer. Node maturity matters more than bleeding-edge bragging rights for our automotive and telecom sovereignty.',
      speaker: 'Union Cabinet',
      context: 'During the official media interaction following the Cabinet meeting.'
    },
    communityStance: {
      accurate: 1420,
      needsContext: 112,
      disputed: 23
    }
  },
  {
    id: 'art-2',
    title: 'Supreme Court Constitution Bench Strikes Down Discretionary Bail Limits in New Criminal Procedure Code',
    subtitle: '5-Judge Bench rules that Section 479 restrictions violate Article 21 rights; underlines that "Bail is the rule, Jail is the exception" remains unbroken constitutional bedrock.',
    slug: 'supreme-court-bail-ruling-bns-bnss',
    verticalId: 1,
    verticalName: 'India / National',
    subCategory: 'Judiciary & Law',
    subSubCategory: 'Supreme Court Verdicts',
    contentType: 'GROUND REPORT',
    publishedAt: '2026-08-15T09:15:00+05:30',
    readTime: '6 min read',
    tags: ['Supreme Court', 'Judiciary', 'BNSS', 'Bail Law', 'Constitution', 'Article 21'],
    author: {
      name: 'Adv. Meenakshi Sundaram',
      role: 'Senior Legal & Constitutional Correspondent',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      bio: 'Practicing advocate and veteran Supreme Court reporter analyzing landmark verdicts, constitutional benches, and judicial administration.',
      articlesCount: 612,
      accuracyScore: 99.7
    },
    heroImage: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: 'Supreme Court of India, New Delhi. Constitution Bench judgment delivered on writ petitions challenging BNSS custody clauses.',
    factBlock: {
      title: 'What Actually Happened (The Raw Fact Layer)',
      summary: 'A 5-judge Constitution Bench headed by the Chief Justice of India unanimously ruled on August 15, 2026, reading down Section 479 of the Bharatiya Nagarik Suraksha Sanhita (BNSS).',
      bullets: [
        'The Bench declared unconstitutional any automatic refusal of bail for undertrials who have served one-third of their maximum sentence for first-time offences.',
        'Judicial discretion cannot be fettered by statutory timelines that invert the presumption of innocence.',
        'Prisons nationwide directed to submit digitized lists of eligible undertrials to District Legal Services Authorities within 30 days.',
        'State Governments ordered to prevent arbitrary delays in filing charge sheets merely to extend police custody.'
      ],
      primarySources: [
        'Supreme Court of India Judgment Record (Writ Petition Civil No. 892/2025)',
        'Bench Oral Pronouncement Transcript',
        'National Legal Services Authority (NALSA) Undertrial Dashboard'
      ]
    },
    sourceTransparency: [
      {
        id: 'src-sc-1',
        type: 'Document',
        name: 'Supreme Court Signed Judgment (142 Pages)',
        description: 'Full certified copy of the Constitution Bench verdict analyzed by RAWINDIA legal desk.',
        verified: true,
        reliabilityScore: 100
      },
      {
        id: 'src-sc-2',
        type: 'Eyewitness',
        name: 'In-Court Reporting by RAWINDIA Legal Desk',
        description: 'Direct transcription of oral observations by the 5-judge Bench during pronouncement in Courtroom 1.',
        verified: true,
        reliabilityScore: 99
      }
    ],
    correctionLog: [],
    bodyParagraphs: [
      'In a landmark reaffirmation of fundamental civil liberties, the Supreme Court today held that statutory barriers to bail cannot override the constitutional guarantee of life and personal liberty under Article 21.',
      'Writing for the unanimous bench, the Court observed that prolonged incarceration without trial represents a systemic breakdown of the criminal justice architecture. Over 74% of India\'s prison population currently comprises undertrials.',
      'The verdict directly curtails police tendencies to repeatedly seek remand extensions without presenting conclusive forensic evidence.',
      'Trial courts have been instructed to process default bail applications within 48 hours of eligibility, warning judicial officers against mechanical dismissals.'
    ],
    quoteHighlight: {
      quote: 'Liberty is not a gift conferred by statutory benevolence; it is an inalienable constitutional guarantee that no procedural statute can dilute.',
      speaker: 'Surya Kant, Chief Justice of India',
      context: 'Pronouncing the lead opinion on behalf of the 5-judge Constitution Bench.'
    },
    communityStance: {
      accurate: 980,
      needsContext: 45,
      disputed: 12
    }
  },
  {
    id: 'art-3',
    title: 'DEBATE: "One Nation One Election" vs Federal Autonomy — The Constitutional Crossfire',
    subtitle: 'Two veteran legal scholars debate the economic efficiency, logistical feasibility, and regional political impact of simultaneous elections.',
    slug: 'debate-one-nation-one-election-federalism',
    verticalId: 14,
    verticalName: 'Opinion & Analysis',
    subCategory: 'Debate & Counterpoint Series',
    subSubCategory: 'National Policy Debates',
    contentType: 'OPINION',
    publishedAt: '2026-08-15T08:00:00+05:30',
    readTime: '8 min read',
    tags: ['ONOE', 'Debate', 'Elections', 'Constitution', 'Federalism', 'Counterpoint'],
    author: {
      name: 'RAWINDIA Editorial Board & Guest Contributors',
      role: 'Point-Counterpoint Series',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: 'Curated opposing viewpoints published unedited to provide complete balance without editorial spin.',
      articlesCount: 154,
      accuracyScore: 98.9
    },
    heroImage: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: 'Parliament House and the ballot box: the high-stakes debate over synchronizing state and general elections.',
    factBlock: {
      title: 'What Actually Happened (The Policy Context)',
      summary: 'The High-Level Committee on Simultaneous Elections submitted recommendations for amending Article 83 and Article 172 to align tenure terms for Lok Sabha and State Legislative Assemblies.',
      bullets: [
        'Proposal requires constitutional amendment bills with special majority in Parliament and ratification by at least half of the state legislatures.',
        'Economic argument: Saves an estimated ₹12,000 to ₹15,000 Crore in cumulative election cycle expenditure.',
        'Counter-argument: Curtails state assembly tenures artificially and risks subsuming regional issues under national presidential-style campaigns.'
      ],
      primarySources: [
        'Report of High-Level Committee on Simultaneous Elections (Vol 1-3)',
        'Law Commission of India Draft Working Paper on Simultaneous Polls'
      ]
    },
    sourceTransparency: [
      {
        id: 'src-deb-1',
        type: 'Document',
        name: 'Kovind Committee Official Report',
        description: 'Official 18,000-page report and public feedback annexures.',
        verified: true,
        reliabilityScore: 100
      }
    ],
    correctionLog: [],
    isCounterpoint: true,
    counterpoint: {
      debateTitle: 'Is "One Nation One Election" Essential for India\'s Growth or Harmful to Federalism?',
      stanceA: {
        author: 'Dr. Vivek Swaminathan',
        authorRole: 'Former Constitutional Adviser & Public Policy Chair',
        authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        title: 'CASE FOR SIMULTANEOUS POLLS: Ending Perpetual Campaign Paralysis',
        summary: 'Perpetual election cycles trap governance in a constant Model Code of Conduct, stalling vital infrastructure and diverting civil servants and security forces 200+ days every year.',
        keyArguments: [
          'Governance Continuity: Overcomes policy freeze where state and municipal elections halt capital approvals every few months.',
          'Fiscal Prudence: Eliminates repeated security mobilization costs and reduces black money circulation during fragmented election cycles.',
          'Voter Fatigue: Consolidates democratic participation into structured intervals, boosting overall civic turnout.'
        ],
        declarationOfIndependence: 'Author declares no current political party affiliations or government advisory retainer.'
      },
      stanceB: {
        author: 'Prof. Ananya Sen-Roy',
        authorRole: 'Professor of Comparative Constitutional Law, National Law School',
        authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        title: 'CASE AGAINST: The Threat to Regional Autonomy and Democratic Accountability',
        summary: 'Frequent elections are not an economic burden; they are the primary mechanism by which citizens hold elected representatives accountable for local failures.',
        keyArguments: [
          'Federal Asymmetry: Cutting short or artificially extending an elected state assembly’s mandate strikes at the heart of state autonomy.',
          'Subsuming Local Issues: National media narratives and overarching slogans inevitably drown out regional developmental grievances.',
          'Mid-Term Collapse Dilemma: If a ruling coalition loses majority at the Centre in Year 2, forcing states into fresh elections violates democratic mandate.'
        ],
        declarationOfIndependence: 'Author receives no funding from political trusts or lobby organizations.'
      }
    },
    bodyParagraphs: [
      'The debate over simultaneous elections represents one of the most consequential constitutional crossroads since the 42nd Amendment.',
      'RAWINDIA presents the two foundational arguments side by side with zero editorial filter. Read both cases below to form your own judgment based on constitutional law, fiscal data, and democratic principles.'
    ],
    communityStance: {
      accurate: 2100,
      needsContext: 340,
      disputed: 510
    }
  },
  {
    id: 'art-4',
    title: 'Reserve Bank of India Keeps Repo Rate Steady at 6.50%: Inflation Forecast Revised Downward to 4.2%',
    subtitle: 'Governor cites stabilizing food grain prices and strong monsoon recovery; MPC retains "Withdrawal of Accommodation" stance with 5-1 majority.',
    slug: 'rbi-monetary-policy-repo-rate-inflation',
    verticalId: 4,
    verticalName: 'Business & Economy',
    subCategory: 'Macroeconomy & Policy',
    subSubCategory: 'RBI Monetary Policy & Repo Rates',
    contentType: 'ANALYSIS',
    publishedAt: '2026-08-15T11:00:00+05:30',
    readTime: '4 min read',
    tags: ['RBI', 'Economy', 'Repo Rate', 'Inflation', 'Monetary Policy', 'Banking'],
    author: {
      name: 'Rohan Deshmukh',
      role: 'Macroeconomic & Financial Markets Analyst',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      bio: 'Former financial institutional analyst covering central banks, sovereign bond yields, and commercial banking trends for 12 years.',
      articlesCount: 520,
      accuracyScore: 99.4
    },
    heroImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: 'Reserve Bank of India headquarters in Mumbai during the Monetary Policy Committee statement.',
    factBlock: {
      title: 'What Actually Happened (The Raw Fact Layer)',
      summary: 'The RBI Monetary Policy Committee (MPC) announced its bi-monthly policy resolution maintaining the benchmark policy repo rate unchanged at 6.50%.',
      bullets: [
        'Repo Rate: Maintained at 6.50% by 5 out of 6 MPC members.',
        'Standing Deposit Facility (SDF) rate remains at 6.25%; Marginal Standing Facility (MSF) rate at 6.75%.',
        'GDP Growth Forecast for FY27 retained at robust 7.2%.',
        'Headline CPI Inflation for FY27 projected down to 4.2% from earlier 4.5% estimate.',
        'Core inflation (excluding food and fuel) remains benign at 3.4%.'
      ],
      primarySources: [
        'Reserve Bank of India Governor Statement #MPC-2026-08',
        'Minutes of the Monetary Policy Committee (RBI Bulletin)',
        'National Statistical Office (NSO) Consumer Price Index Bulletin'
      ],
      keyNumbers: [
        { label: 'Repo Rate', value: '6.50%' },
        { label: 'GDP Growth Projected', value: '7.2%' },
        { label: 'Inflation Target', value: '4.2%' },
        { label: 'MPC Vote Split', value: '5-1' }
      ]
    },
    sourceTransparency: [
      {
        id: 'src-rbi-1',
        type: 'Official statement',
        name: 'RBI MPC Official Press Release',
        description: 'Official document released at 10:00 AM IST on the RBI portal.',
        verified: true,
        reliabilityScore: 100,
        url: 'https://rbi.org.in'
      }
    ],
    correctionLog: [],
    bodyParagraphs: [
      'The Reserve Bank of India opted for institutional stability today, holding benchmark borrowing rates steady while telegraphing a possible rate-cut window in early Q4 should monsoon spatial distribution sustain robust agricultural output.',
      'Borrowers with floating-rate home and auto loans will see no immediate change in monthly EMIs, while fixed deposit savers continue to enjoy attractive real returns over 300 basis points above core inflation.',
      'Governor noted that while global geopolitical tensions continue to introduce volatility into shipping freight and crude oil, domestic macroeconomic fundamentals—anchored by strong tax revenues and capex spending—remain insulated.'
    ],
    communityStance: {
      accurate: 730,
      needsContext: 24,
      disputed: 8
    }
  },
  {
    id: 'art-5',
    title: 'LIVE BLOG: ISRO Gaganyaan-3 Orbital Integration Tests Underway at Sriharikota',
    subtitle: 'Continuous minute-by-minute verified reporting from Satish Dhawan Space Centre on crew module pressure tests and life-support simulation.',
    slug: 'live-isro-gaganyaan-3-orbital-tests',
    verticalId: 5,
    verticalName: 'Technology',
    subCategory: 'Space & ISRO',
    subSubCategory: 'Gaganyaan & Chandrayaan Progress',
    state: 'Andhra Pradesh',
    city: 'Sriharikota',
    contentType: 'NEWS',
    publishedAt: '2026-08-15T07:30:00+05:30',
    updatedAt: '2026-08-15T12:20:00+05:30',
    readTime: 'Live Feed',
    isLiveBlog: true,
    tags: ['ISRO', 'Gaganyaan', 'Space', 'Human Spaceflight', 'Sriharikota', 'Live'],
    author: {
      name: 'Dr. Pallavi S. Nambiar',
      role: 'Aerospace & Science Correspondent',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      bio: 'Aerospace engineering graduate and space desk chief embedded with launch centers across India.',
      articlesCount: 380,
      accuracyScore: 99.8
    },
    heroImage: 'https://images.unsplash.com/photo-1517976487588-8742460ce402?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: 'Satish Dhawan Space Centre (SDSC-SHAR) cleanroom facility during crew module mating checks.',
    factBlock: {
      title: 'What Actually Happened (The Raw Fact Layer)',
      summary: 'ISRO engineers at SDSC-SHAR are conducting full-stack integration and Environmental Control and Life Support System (ECLSS) dry-run tests for the upcoming uncrewed Gaganyaan-3 orbital mission.',
      bullets: [
        'Mission objective: 3-day orbit at 400 km low earth orbit (LEO) with Vyommitra humanoid robot.',
        'Cryogenic stage C32 static pressure tests validated within 0.2% of nominal engineering tolerance.',
        'Indian Navy recovery teams rehearsing Arabian Sea splashdown extraction protocols off Goa coast.'
      ],
      primarySources: [
        'ISRO Official Mission Status Briefing #G3-SHAR',
        'SDSC Technical Flight Readiness Review (FRR) Memo'
      ]
    },
    sourceTransparency: [
      {
        id: 'src-isro-1',
        type: 'Official statement',
        name: 'ISRO Press Office & Flight Readiness Review',
        description: 'Direct mission updates confirmed by Mission Director desk.',
        verified: true,
        reliabilityScore: 100
      },
      {
        id: 'src-isro-2',
        type: 'Eyewitness',
        name: 'RAWINDIA Space Desk Sriharikota Correspondent',
        description: 'Accredited media viewing from SDSC Press Gallery.',
        verified: true,
        reliabilityScore: 99
      }
    ],
    correctionLog: [],
    liveUpdates: [
      {
        id: 'up-1',
        time: '12:15 IST',
        headline: 'Crew Module Seal Test Cleared with Zero Micro-Leakage',
        content: 'ISRO telemetry engineers confirm that the dual hermetic pressure seal on the Gaganyaan crew capsule sustained 1.5 atmospheric pressure over a continuous 4-hour hold cycle.',
        sourceType: 'Official statement',
        verified: true,
        author: 'Dr. Pallavi S. Nambiar'
      },
      {
        id: 'up-2',
        time: '10:45 IST',
        headline: 'LVM3 Heavy-Lift Rocket Core Stages Mated on Second Launch Pad',
        content: 'The two S200 solid rocket boosters and L110 liquid core stage have been mechanically aligned inside the Vehicle Assembly Building (VAB).',
        sourceType: 'Eyewitness',
        verified: true,
        author: 'Dr. Pallavi S. Nambiar'
      },
      {
        id: 'up-3',
        time: '08:30 IST',
        headline: 'Indian Navy & Coast Guard Deploy Fast Attack Craft for Splashdown Simulation',
        content: 'Special operations diving units carried out dry-runs in the Arabian Sea with a buoyant 1:1 scale mock capsule to test winch retrieval under high sea state conditions.',
        sourceType: 'Wire / Verified Reporter',
        verified: true,
        author: 'RAWINDIA Defence Bureau'
      }
    ],
    bodyParagraphs: [
      'India’s human spaceflight program reaches a critical milestone today as ISRO commences multi-system integrated trials for the Gaganyaan-3 mission at the Satish Dhawan Space Centre.',
      'Follow our verified, minute-by-minute updates below as each technical milestone is confirmed by launch controllers.'
    ],
    communityStance: {
      accurate: 1890,
      needsContext: 15,
      disputed: 3
    }
  },
  {
    id: 'art-6',
    title: 'Delhi-NCR Air Quality Action Plan 2026: Mandatory Dust Suppression Sensors for Construction Sites Over 500 Sqm',
    subtitle: 'Commission for Air Quality Management (CAQM) issues strict pre-winter mandate; non-compliant sites to face immediate power disconnection and daily ₹1 lakh penalty.',
    slug: 'delhi-ncr-air-quality-caqm-mandate',
    verticalId: 6,
    verticalName: 'Science & Environment',
    subCategory: 'Pollution & Air Quality',
    subSubCategory: 'Delhi-NCR & North India Stubble/Smog',
    state: 'Delhi (NCT)',
    city: 'New Delhi',
    contentType: 'GROUND REPORT',
    publishedAt: '2026-08-15T06:45:00+05:30',
    readTime: '5 min read',
    tags: ['Delhi NCR', 'Air Quality', 'Pollution', 'CAQM', 'Environment', 'Ground Report'],
    author: {
      name: 'Kavita Chawla',
      role: 'Environment & Urban Governance Bureau',
      avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
      bio: 'Investigating urban air pollution, municipal solid waste management, and river catchment ecology across northern India.',
      articlesCount: 290,
      accuracyScore: 99.1
    },
    heroImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
    heroImageCaption: 'Urban smog over Delhi NCR during winter months. CAQM issues preemptive enforcement orders.',
    factBlock: {
      title: 'What Actually Happened (The Raw Fact Layer)',
      summary: 'The Commission for Air Quality Management in NCR & Adjoining Areas (CAQM) issued statutory direction #84 mandating continuous particulate matter (PM2.5/PM10) sensors connected to the Central Pollution Control Board (CPCB) server.',
      bullets: [
        'Applies to all private and governmental construction sites measuring 500 sq meters or larger across Delhi, Gurugram, Noida, Faridabad, and Ghaziabad.',
        'Mandatory anti-smog guns: 1 gun for every 5,000 sqm of plot area.',
        'Deadline for sensor calibration: September 30, 2026.',
        'Penalties: ₹1,00,000 per day of non-compliance and immediate sealing of site.'
      ],
      primarySources: [
        'CAQM Statutory Direction No. 84/2026',
        'Central Pollution Control Board (CPCB) Real-Time Server Integration Guidelines'
      ]
    },
    sourceTransparency: [
      {
        id: 'src-env-1',
        type: 'Official statement',
        name: 'CAQM Gazette Notification',
        description: 'Statutory direction document signed by CAQM Member Secretary.',
        verified: true,
        reliabilityScore: 100
      },
      {
        id: 'src-env-2',
        type: 'Eyewitness',
        name: 'RAWINDIA Ground Inspection of 12 Construction Sites',
        description: 'Physical audit of 12 active construction sites in Noida Sector 150 and Gurugram Golf Course Ext to verify current sensor compliance.',
        verified: true,
        reliabilityScore: 97
      }
    ],
    correctionLog: [],
    bodyParagraphs: [
      'With winter months approaching, northern India is preparing for its annual air quality crisis. The CAQM today mandated real-time digital surveillance of airborne particulate matter at construction projects.',
      'A ground investigation by RAWINDIA across 12 major residential projects in Noida and Gurugram revealed that only 3 had functional, calibrated PM sensors directly streaming telemetry to CPCB servers. Nine sites operated disconnected or dummy units.',
      'The new orders empower municipal enforcement flying squads to levy automated fines linked directly to sensor outages lasting over 2 hours.'
    ],
    communityStance: {
      accurate: 860,
      needsContext: 140,
      disputed: 30
    }
  }
];
