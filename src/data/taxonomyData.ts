import type { TaxonomyVertical } from '../types';

export const TAXONOMY_DATA: TaxonomyVertical[] = [
  {
    id: 1,
    number: '1',
    name: 'India / National',
    nameHi: 'भारत / राष्ट्रीय',
    slug: 'india-national',
    description: 'Governance, Union Ministries, Parliament, Supreme Court, Defense, National Law & Order.',
    badgeColor: '#D92D20',
    iconName: 'Landmark',
    subCategories: [
      {
        id: '1.1',
        number: '1.1',
        name: 'Government & Administration',
        nameHi: 'सरकार और प्रशासन',
        slug: 'government-administration',
        subSubCategories: [
          { id: '1.1.1', name: 'Union Cabinet & Ministries', nameHi: 'केंद्रीय मंत्रिमंडल व मंत्रालय', slug: 'union-cabinet' },
          { id: '1.1.2', name: 'President & Vice President', nameHi: 'राष्ट्रपति और उपराष्ट्रपति', slug: 'president-vp' },
          { id: '1.1.3', name: 'PMO & Executive Orders', nameHi: 'पीएमओ और कार्यकारी आदेश', slug: 'pmo' },
          { id: '1.1.4', name: 'NITI Aayog & Policy Bodies', nameHi: 'नीति आयोग व नीति निकाय', slug: 'niti-aayog' },
          { id: '1.1.5', name: 'Civil Services & Bureaucracy', nameHi: 'सिविल सेवा और नौकरशाही', slug: 'civil-services' },
          { id: '1.1.6', name: 'Government Schemes / Yojanas', nameHi: 'सरकारी योजनाएं', slug: 'yojanas' }
        ]
      },
      {
        id: '1.2',
        number: '1.2',
        name: 'Politics & Elections',
        nameHi: 'राजनीति और चुनाव',
        slug: 'politics-elections',
        subSubCategories: [
          { id: '1.2.1', name: 'Lok Sabha & Rajya Sabha', nameHi: 'लोकसभा और राज्यसभा', slug: 'parliament' },
          { id: '1.2.2', name: 'State Assemblies', nameHi: 'विधानसभाएं', slug: 'state-assemblies' },
          { id: '1.2.3', name: 'National Parties (BJP, Congress, AAP, CPI)', nameHi: 'राष्ट्रीय दल', slug: 'national-parties' },
          { id: '1.2.4', name: 'Regional Parties & Coalitions', nameHi: 'क्षेत्रीय दल व गठबंधन', slug: 'regional-parties' },
          { id: '1.2.5', name: 'Election Commission & Polls', nameHi: 'चुनाव आयोग व ओपिनियन पोल', slug: 'eci-polls' },
          { id: '1.2.6', name: 'Political Controversies & Defections', nameHi: 'राजनीतिक विवाद', slug: 'controversies' }
        ]
      },
      {
        id: '1.3',
        number: '1.3',
        name: 'Judiciary & Law',
        nameHi: 'न्यायपालिका और कानून',
        slug: 'judiciary-law',
        subSubCategories: [
          { id: '1.3.1', name: 'Supreme Court Verdicts', nameHi: 'सुप्रीम कोर्ट के फैसले', slug: 'supreme-court' },
          { id: '1.3.2', name: 'High Courts Ledger', nameHi: 'उच्च न्यायालय', slug: 'high-courts' },
          { id: '1.3.3', name: 'Legal Reforms & New Codes', nameHi: 'कानूनी सुधार (BNS/BNSS)', slug: 'legal-reforms' },
          { id: '1.3.4', name: 'Public Interest Litigations (PILs)', nameHi: 'जनहित याचिकाएं (PIL)', slug: 'pils' },
          { id: '1.3.5', name: 'Tribunals (NGT, NCLT, CAT)', nameHi: 'अधिकरण', slug: 'tribunals' }
        ]
      },
      {
        id: '1.4',
        number: '1.4',
        name: 'Crime & Law and Order',
        nameHi: 'अपराध और कानून व्यवस्था',
        slug: 'crime-law-order',
        subSubCategories: [
          { id: '1.4.1', name: 'Investigation Agencies (CBI, ED, NIA)', nameHi: 'केंद्रीय जांच एजेंसियां', slug: 'agencies-cbi-ed-nia' },
          { id: '1.4.2', name: 'Cybercrime & Financial Scams', nameHi: 'साइबर अपराध व वित्तीय धोखाधड़ी', slug: 'cybercrime-scams' },
          { id: '1.4.3', name: 'Women Safety & Violent Crime', nameHi: 'महिला सुरक्षा व गंभीर अपराध', slug: 'women-safety' },
          { id: '1.4.4', name: 'Narcotics & Trafficking (NCB)', nameHi: 'मादक पदार्थ व तस्करी', slug: 'narcotics-ncb' },
          { id: '1.4.5', name: 'Prisons & Correctional Reforms', nameHi: 'जेल और सुधारात्मक प्रणाली', slug: 'prisons' }
        ]
      },
      {
        id: '1.5',
        number: '1.5',
        name: 'Defence & National Security',
        nameHi: 'रक्षा और राष्ट्रीय सुरक्षा',
        slug: 'defence-security',
        subSubCategories: [
          { id: '1.5.1', name: 'Indian Army, Navy & Air Force', nameHi: 'थल, नौ व वायु सेना', slug: 'armed-forces' },
          { id: '1.5.2', name: 'Border Security (LoC / LAC / Maritime)', nameHi: 'सीमा सुरक्षा (LoC/LAC)', slug: 'border-security' },
          { id: '1.5.3', name: 'Defence Deals & Indigenisation', nameHi: 'रक्षा सौदे व स्वदेशीकरण', slug: 'defence-procurement' },
          { id: '1.5.4', name: 'Counter-Terrorism & Intelligence (RAW/IB)', nameHi: 'आतंकवाद विरोधी व खुफिया', slug: 'intelligence' }
        ]
      },
      {
        id: '1.6',
        number: '1.6',
        name: 'Society & Social Issues',
        nameHi: 'समाज और सामाजिक मुद्दे',
        slug: 'society-issues',
        subSubCategories: [
          { id: '1.6.1', name: 'Caste Census & Reservation', nameHi: 'जाति गणना व आरक्षण', slug: 'caste-reservation' },
          { id: '1.6.2', name: 'Communal Relations & Harmony', nameHi: 'धार्मिक व सांप्रदायिक संबंध', slug: 'communal-relations' },
          { id: '1.6.3', name: 'Gender Equality & LGBTQ+', nameHi: 'लैंगिक समानता', slug: 'gender-rights' },
          { id: '1.6.4', name: 'Migrant Labour & Urban Poor', nameHi: 'प्रवासी मजदूर व शहरी निर्धन', slug: 'migrant-labour' }
        ]
      },
      {
        id: '1.7',
        number: '1.7',
        name: 'Infrastructure & Mobility',
        nameHi: 'बुनियादी ढांचा और गतिशीलता',
        slug: 'infrastructure',
        subSubCategories: [
          { id: '1.7.1', name: 'Highways & Expressways (NHAI)', nameHi: 'हाईवे व एक्सप्रेसवे', slug: 'highways' },
          { id: '1.7.2', name: 'Indian Railways (Vande Bharat/Bullet Train)', nameHi: 'भारतीय रेल', slug: 'railways' },
          { id: '1.7.3', name: 'Airports & Aviation Infra', nameHi: 'हवाई अड्डे व उड्डयन', slug: 'aviation-infra' },
          { id: '1.7.4', name: 'Ports & Inland Waterways', nameHi: 'बंदरगाह व जलमार्ग', slug: 'ports' }
        ]
      },
      {
        id: '1.8',
        number: '1.8',
        name: 'Disasters & NDRF Ops',
        nameHi: 'आपदाएं और एनडीआरएफ राहत',
        slug: 'disasters-emergencies',
        subSubCategories: [
          { id: '1.8.1', name: 'Floods & Monsoon Landslides', nameHi: 'बाढ़ व भूस्खलन', slug: 'floods-landslides' },
          { id: '1.8.2', name: 'Cyclones & Coastal Warnings', nameHi: 'चक्रवात', slug: 'cyclones' },
          { id: '1.8.3', name: 'Earthquakes & Industrial Safety', nameHi: 'भूकंप व औद्योगिक दुर्घटनाएं', slug: 'earthquakes' }
        ]
      }
    ]
  },
  {
    id: 2,
    number: '2',
    name: 'States & Union Territories',
    nameHi: 'राज्य और केंद्र शासित प्रदेश',
    slug: 'states-uts',
    description: 'Granular local governance, state assemblies, city hubs, local infrastructure, crime & culture across all 36 States/UTs.',
    badgeColor: '#027A48',
    iconName: 'MapPin',
    subCategories: [
      {
        id: '2.M',
        number: '2.M',
        name: 'Dedicated Metro Hubs',
        nameHi: 'प्रमुख महानगर हब',
        slug: 'metro-hubs',
        subSubCategories: [
          { id: '2.M.1', name: 'Delhi-NCR Hub', nameHi: 'दिल्ली-एनसीआर', slug: 'delhi-ncr' },
          { id: '2.M.2', name: 'Mumbai Metropolitan Region', nameHi: 'मुंबई महानगर', slug: 'mumbai-mmr' },
          { id: '2.M.3', name: 'Bengaluru Urban Hub', nameHi: 'बेंगलुरु', slug: 'bengaluru' },
          { id: '2.M.4', name: 'Hyderabad Greater Region', nameHi: 'हैदराबाद', slug: 'hyderabad' },
          { id: '2.M.5', name: 'Chennai Hub', nameHi: 'चेन्नई', slug: 'chennai' },
          { id: '2.M.6', name: 'Kolkata Metropolitan', nameHi: 'कोलकाता', slug: 'kolkata' },
          { id: '2.M.7', name: 'Pune Hub', nameHi: 'पुणे', slug: 'pune' },
          { id: '2.M.8', name: 'Ahmedabad-Gandhinagar', nameHi: 'अहमदाबाद-गांधीनगर', slug: 'ahmedabad' }
        ]
      },
      {
        id: '2.N',
        number: '2.N',
        name: 'North Indian States',
        nameHi: 'उत्तर भारतीय राज्य',
        slug: 'north-india',
        subSubCategories: [
          { id: '2.N.1', name: 'Uttar Pradesh', nameHi: 'उत्तर प्रदेश', slug: 'uttar-pradesh' },
          { id: '2.N.2', name: 'Bihar', nameHi: 'बिहार', slug: 'bihar' },
          { id: '2.N.3', name: 'Punjab', nameHi: 'पंजाब', slug: 'punjab' },
          { id: '2.N.4', name: 'Haryana', nameHi: 'हरियाणा', slug: 'haryana' },
          { id: '2.N.5', name: 'Rajasthan', nameHi: 'राजस्थान', slug: 'rajasthan' },
          { id: '2.N.6', name: 'Himachal Pradesh', nameHi: 'हिमाचल प्रदेश', slug: 'himachal-pradesh' },
          { id: '2.N.7', name: 'Uttarakhand', nameHi: 'उत्तराखंड', slug: 'uttarakhand' },
          { id: '2.N.8', name: 'Jammu & Kashmir (UT)', nameHi: 'जम्मू और कश्मीर', slug: 'jammu-kashmir' },
          { id: '2.N.9', name: 'Ladakh (UT)', nameHi: 'लद्दाख', slug: 'ladakh' },
          { id: '2.N.10', name: 'Chandigarh (UT)', nameHi: 'चंडीगढ़', slug: 'chandigarh' }
        ]
      },
      {
        id: '2.S',
        number: '2.S',
        name: 'South Indian States',
        nameHi: 'दक्षिण भारतीय राज्य',
        slug: 'south-india',
        subSubCategories: [
          { id: '2.S.1', name: 'Karnataka', nameHi: 'कर्नाटक', slug: 'karnataka' },
          { id: '2.S.2', name: 'Tamil Nadu', nameHi: 'तमिलनाडु', slug: 'tamil-nadu' },
          { id: '2.S.3', name: 'Telangana', nameHi: 'तेलंगाना', slug: 'telangana' },
          { id: '2.S.4', name: 'Andhra Pradesh', nameHi: 'आंध्र प्रदेश', slug: 'andhra-pradesh' },
          { id: '2.S.5', name: 'Kerala', nameHi: 'केरल', slug: 'kerala' },
          { id: '2.S.6', name: 'Puducherry (UT)', nameHi: 'पुदुचेरी', slug: 'puducherry' },
          { id: '2.S.7', name: 'Lakshadweep (UT)', nameHi: 'लक्षद्वीप', slug: 'lakshadweep' }
        ]
      },
      {
        id: '2.W',
        number: '2.W',
        name: 'West & Central States',
        nameHi: 'पश्चिम व मध्य भारत',
        slug: 'west-central-india',
        subSubCategories: [
          { id: '2.W.1', name: 'Maharashtra', nameHi: 'महाराष्ट्र', slug: 'maharashtra' },
          { id: '2.W.2', name: 'Gujarat', nameHi: 'गुजरात', slug: 'gujarat' },
          { id: '2.W.3', name: 'Madhya Pradesh', nameHi: 'मध्य प्रदेश', slug: 'madhya-pradesh' },
          { id: '2.W.4', name: 'Chhattisgarh', nameHi: 'छत्तीसगढ़', slug: 'chhattisgarh' },
          { id: '2.W.5', name: 'Goa', nameHi: 'गोवा', slug: 'goa' },
          { id: '2.W.6', name: 'Dadra & Nagar Haveli and Daman & Diu', nameHi: 'दादरा एवं नगर हवेली', slug: 'daman-diu' }
        ]
      },
      {
        id: '2.E',
        number: '2.E',
        name: 'East & North-East States',
        nameHi: 'पूर्व व उत्तर-पूर्व भारत',
        slug: 'east-northeast-india',
        subSubCategories: [
          { id: '2.E.1', name: 'West Bengal', nameHi: 'पश्चिम बंगाल', slug: 'west-bengal' },
          { id: '2.E.2', name: 'Odisha', nameHi: 'ओडिशा', slug: 'odisha' },
          { id: '2.E.3', name: 'Jharkhand', nameHi: 'झारखंड', slug: 'jharkhand' },
          { id: '2.E.4', name: 'Assam', nameHi: 'असम', slug: 'assam' },
          { id: '2.E.5', name: 'Arunachal Pradesh', nameHi: 'अरुणाचल प्रदेश', slug: 'arunachal-pradesh' },
          { id: '2.E.6', name: 'Manipur', nameHi: 'मणिपुर', slug: 'manipur' },
          { id: '2.E.7', name: 'Meghalaya', nameHi: 'मेघालय', slug: 'meghalaya' },
          { id: '2.E.8', name: 'Mizoram', nameHi: 'मिजोरम', slug: 'mizoram' },
          { id: '2.E.9', name: 'Nagaland', nameHi: 'नागालैंड', slug: 'nagaland' },
          { id: '2.E.10', name: 'Tripura', nameHi: 'त्रिपुरा', slug: 'tripura' },
          { id: '2.E.11', name: 'Sikkim', nameHi: 'सिक्किम', slug: 'sikkim' },
          { id: '2.E.12', name: 'Andaman & Nicobar Islands (UT)', nameHi: 'अंडमान और निकोबार', slug: 'andaman-nicobar' }
        ]
      }
    ]
  },
  {
    id: 3,
    number: '3',
    name: 'World (India Lens)',
    nameHi: 'विदेश (भारतीय दृष्टिकोण)',
    slug: 'world-india-lens',
    description: 'Geopolitics, bilateral ties, Diaspora, trade treaties, and multilateral forums.',
    badgeColor: '#026AA2',
    iconName: 'Globe',
    subCategories: [
      {
        id: '3.1',
        number: '3.1',
        name: 'Strategic Bilaterals',
        nameHi: 'द्विपक्षीय संबंध',
        slug: 'strategic-bilaterals',
        subSubCategories: [
          { id: '3.1.1', name: 'India–US Relations', nameHi: 'भारत-अमेरिका', slug: 'india-us' },
          { id: '3.1.2', name: 'India–China Geopolitics', nameHi: 'भारत-चीन', slug: 'india-china' },
          { id: '3.1.3', name: 'India–Russia Dynamics', nameHi: 'भारत-रूस', slug: 'india-russia' },
          { id: '3.1.4', name: 'India–Middle East & Gulf', nameHi: 'भारत-खाड़ी देश', slug: 'india-middle-east' },
          { id: '3.1.5', name: 'India–Europe & UK', nameHi: 'भारत-यूरोप व यूके', slug: 'india-europe' }
        ]
      },
      {
        id: '3.2',
        number: '3.2',
        name: 'Neighbourhood Watch',
        nameHi: 'पड़ोसी देश',
        slug: 'neighbourhood',
        subSubCategories: [
          { id: '3.2.1', name: 'Bangladesh & Sri Lanka', nameHi: 'बांग्लादेश व श्रीलंका', slug: 'bangladesh-srilanka' },
          { id: '3.2.2', name: 'Pakistan & Afghanistan', nameHi: 'पाकिस्तान व अफगानिस्तान', slug: 'pakistan-afghanistan' },
          { id: '3.2.3', name: 'Nepal, Bhutan & Maldives', nameHi: 'नेपाल, भूटान व मालदीव', slug: 'nepal-maldives' }
        ]
      },
      {
        id: '3.3',
        number: '3.3',
        name: 'Indian Diaspora (NRI)',
        nameHi: 'प्रवासी भारतीय (NRI)',
        slug: 'diaspora',
        subSubCategories: [
          { id: '3.3.1', name: 'USA & Canada Indian Community', nameHi: 'अमेरिका व कनाडा', slug: 'diaspora-us-canada' },
          { id: '3.3.2', name: 'Gulf & West Asia Remittances', nameHi: 'खाड़ी देश', slug: 'diaspora-gulf' },
          { id: '3.3.3', name: 'UK, Europe & Australia', nameHi: 'यूके, यूरोप व ऑस्ट्रेलिया', slug: 'diaspora-europe-aus' }
        ]
      },
      {
        id: '3.4',
        number: '3.4',
        name: 'Global Forums & Quad/BRICS',
        nameHi: 'वैश्विक मंच व ब्रिक्स/क्वाड',
        slug: 'global-forums',
        subSubCategories: [
          { id: '3.4.1', name: 'G20, G7 & UN Reforms', nameHi: 'जी20 व संयुक्त राष्ट्र', slug: 'g20-un' },
          { id: '3.4.2', name: 'BRICS & SCO Summits', nameHi: 'ब्रिक्स व एससीओ', slug: 'brics-sco' },
          { id: '3.4.3', name: 'Quad & Indo-Pacific Strategy', nameHi: 'क्वाड व हिंद-प्रशांत', slug: 'quad-indo-pacific' }
        ]
      }
    ]
  },
  {
    id: 4,
    number: '4',
    name: 'Business & Economy',
    nameHi: 'व्यापार और अर्थव्यवस्था',
    slug: 'business-economy',
    description: 'Macro indicators, Dalal Street, Startups, Corporate governance, RBI policy, Agriculture.',
    badgeColor: '#B54708',
    iconName: 'TrendingUp',
    subCategories: [
      {
        id: '4.1',
        number: '4.1',
        name: 'Macroeconomy & Policy',
        nameHi: 'समष्टि अर्थशास्त्र व नीतियां',
        slug: 'macroeconomy',
        subSubCategories: [
          { id: '4.1.1', name: 'GDP, Inflation (CPI/WPI) & Deficit', nameHi: 'जीडीपी व महंगाई', slug: 'gdp-inflation' },
          { id: '4.1.2', name: 'RBI Monetary Policy & Repo Rates', nameHi: 'आरबीआई मौद्रिक नीति', slug: 'rbi-policy' },
          { id: '4.1.3', name: 'Union Budget & Tax Reforms (GST)', nameHi: 'केंद्रीय बजट व जीएसटी', slug: 'budget-taxes' }
        ]
      },
      {
        id: '4.2',
        number: '4.2',
        name: 'Markets (Dalal Street)',
        nameHi: 'शेयर बाजार व म्यूचुअल फंड',
        slug: 'markets',
        subSubCategories: [
          { id: '4.2.1', name: 'Nifty, Sensex & Daily Trading', nameHi: 'निफ्टी व सेंसेक्स', slug: 'nifty-sensex' },
          { id: '4.2.2', name: 'IPOs & Primary Market', nameHi: 'आईपीओ व लिस्टिंग', slug: 'ipos' },
          { id: '4.2.3', name: 'Mutual Funds, SIPs & Forex', nameHi: 'म्यूचुअल फंड व एसआईपी', slug: 'mutual-funds' }
        ]
      },
      {
        id: '4.3',
        number: '4.3',
        name: 'Corporate & Conglomerates',
        nameHi: 'कॉर्पोरेट व बड़े उद्योग समूह',
        slug: 'corporate',
        subSubCategories: [
          { id: '4.3.1', name: 'Tata, Reliance, Adani, Birla', nameHi: 'प्रमुख समूह', slug: 'top-conglomerates' },
          { id: '4.3.2', name: 'Corporate Governance & Scams', nameHi: 'कॉर्पोरेट खुलासे व घोटाले', slug: 'governance-scandals' },
          { id: '4.3.3', name: 'Mergers & Acquisitions (M&A)', nameHi: 'विलय और अधिग्रहण', slug: 'mergers-acquisitions' }
        ]
      },
      {
        id: '4.4',
        number: '4.4',
        name: 'Startups & Venture Capital',
        nameHi: 'स्टार्टअप और वीसी फंडिंग',
        slug: 'startups-vc',
        subSubCategories: [
          { id: '4.4.1', name: 'Funding Rounds & Unicorns', nameHi: 'फंडिंग व यूनिकॉर्न', slug: 'unicorns' },
          { id: '4.4.2', name: 'Fintech, SaaS & Deeptech', nameHi: 'फिनटेक व डीपटेक', slug: 'fintech-saas' },
          { id: '4.4.3', name: 'Layoffs, Hiring & ESOPs', nameHi: 'छंटनी व नियुक्तियां', slug: 'startup-jobs' }
        ]
      },
      {
        id: '4.5',
        number: '4.5',
        name: 'Agriculture & Rural Economy',
        nameHi: 'कृषि और ग्रामीण अर्थव्यवस्था',
        slug: 'agriculture',
        subSubCategories: [
          { id: '4.5.1', name: 'Crop Prices, MSP & Mandis', nameHi: 'फसल मूल्य व एमएसपी', slug: 'msp-mandis' },
          { id: '4.5.2', name: 'Monsoon Impact & Irrigation', nameHi: 'मानसून असर व सिंचाई', slug: 'monsoon-agri' },
          { id: '4.5.3', name: 'Fertilizers, Subsidies & Agri-Tech', nameHi: 'उर्वरक व एग्री-टेक', slug: 'agritech' }
        ]
      }
    ]
  },
  {
    id: 5,
    number: '5',
    name: 'Technology',
    nameHi: 'प्रौद्योगिकी और नवाचार',
    slug: 'technology',
    description: 'AI breakthrough, Semiconductor mission, Cyber Defense, Consumer gadgets, ISRO missions.',
    badgeColor: '#6941C6',
    iconName: 'Cpu',
    subCategories: [
      {
        id: '5.1',
        number: '5.1',
        name: 'Artificial Intelligence & DeepTech',
        nameHi: 'आर्टिफिशियल इंटेलिजेंस (AI)',
        slug: 'ai-deeptech',
        subSubCategories: [
          { id: '5.1.1', name: 'IndiaAI Mission & Sovereign Compute', nameHi: 'इंडिया-एआई मिशन', slug: 'india-ai-mission' },
          { id: '5.1.2', name: 'Generative AI & LLMs in Indic Languages', nameHi: 'भारतीय भाषाओं में एलएलएम', slug: 'indic-llms' },
          { id: '5.1.3', name: 'AI Ethics, Bias & Governance', nameHi: 'एआई नैतिकता व नियम', slug: 'ai-ethics' }
        ]
      },
      {
        id: '5.2',
        number: '5.2',
        name: 'Semiconductors & Electronics',
        nameHi: 'सेमीकंडक्टर और हार्डवेयर',
        slug: 'semiconductors',
        subSubCategories: [
          { id: '5.2.1', name: 'Mega-Fabs (Dholera, Sanand, Morigaon)', nameHi: 'सेमीकंडक्टर फैब यूनिट्स', slug: 'fab-projects' },
          { id: '5.2.2', name: 'Mobile & Electronics Manufacturing', nameHi: 'स्मार्टफोन निर्माण', slug: 'electronics-mfg' }
        ]
      },
      {
        id: '5.3',
        number: '5.3',
        name: 'Space & ISRO',
        nameHi: 'अंतरिक्ष व इसरो',
        slug: 'isro-space',
        subSubCategories: [
          { id: '5.3.1', name: 'Gaganyaan & Chandrayaan Progress', nameHi: 'गगनयान व चंद्रयान मिशन', slug: 'gaganyaan' },
          { id: '5.3.2', name: 'Private Space Tech (Skyroot, Agnikul)', nameHi: 'निजी अंतरिक्ष कंपनियां', slug: 'private-space' }
        ]
      },
      {
        id: '5.4',
        number: '5.4',
        name: 'Cybersecurity & Digital Public Infra',
        nameHi: 'साइबर सुरक्षा व डीपीआई',
        slug: 'cybersecurity-dpi',
        subSubCategories: [
          { id: '5.4.1', name: 'UPI, ONDC & Aadhaar Ecosystem', nameHi: 'यूपीआई व ओएनडीसी', slug: 'upi-dpi' },
          { id: '5.4.2', name: 'Data Breaches & DPDP Act 2023', nameHi: 'डेटा सुरक्षा कानून', slug: 'dpdp-act' }
        ]
      }
    ]
  },
  {
    id: 6,
    number: '6',
    name: 'Science & Environment',
    nameHi: 'विज्ञान और पर्यावरण',
    slug: 'science-environment',
    description: 'Air pollution indexes, Climate change, Renewable solar/wind, Wildlife conservation.',
    badgeColor: '#05603A',
    iconName: 'Leaf',
    subCategories: [
      {
        id: '6.1',
        number: '6.1',
        name: 'Pollution & Air Quality',
        nameHi: 'प्रदूषण व वायु गुणवत्ता (AQI)',
        slug: 'pollution-aqi',
        subSubCategories: [
          { id: '6.1.1', name: 'Delhi-NCR & North India Stubble/Smog', nameHi: 'दिल्ली-एनसीआर वायु प्रदूषण', slug: 'delhi-smog' },
          { id: '6.1.2', name: 'River Cleanliness (Ganga/Yamuna/Cauvery)', nameHi: 'नदी स्वच्छता', slug: 'river-cleaning' }
        ]
      },
      {
        id: '6.2',
        number: '6.2',
        name: 'Renewable Energy & EV Transition',
        nameHi: 'नवीकरणीय ऊर्जा व ग्रीन मोबिलिटी',
        slug: 'green-energy',
        subSubCategories: [
          { id: '6.2.1', name: 'Solar Parks & Green Hydrogen Mission', nameHi: 'सौर ऊर्जा व ग्रीन हाइड्रोजन', slug: 'solar-hydrogen' },
          { id: '6.2.2', name: 'EV Policy, Battery Cells & Subsidies', nameHi: 'ईवी बैटरी व नीतियां', slug: 'ev-policy' }
        ]
      }
    ]
  },
  {
    id: 7,
    number: '7',
    name: 'Sports',
    nameHi: 'खेल जगत',
    slug: 'sports',
    description: 'Cricket (BCCI, Team India, IPL), Football (ISL), Kabaddi, Chess, Olympics & Wrestling.',
    badgeColor: '#175CD3',
    iconName: 'Trophy',
    subCategories: [
      {
        id: '7.1',
        number: '7.1',
        name: 'Cricket Hub',
        nameHi: 'क्रिकेट हब',
        slug: 'cricket',
        subSubCategories: [
          { id: '7.1.1', name: 'Team India (Men & Women)', nameHi: 'भारतीय टीम', slug: 'team-india' },
          { id: '7.1.2', name: 'Indian Premier League (IPL)', nameHi: 'आईपीएल (IPL)', slug: 'ipl' },
          { id: '7.1.3', name: 'BCCI Governance & Domestic (Ranji)', nameHi: 'बीसीसीआई व रणजी', slug: 'bcci-domestic' }
        ]
      },
      {
        id: '7.2',
        number: '7.2',
        name: 'Olympic & Multi-Sports',
        nameHi: 'ओलंपिक व अन्य खेल',
        slug: 'olympics-other',
        subSubCategories: [
          { id: '7.2.1', name: 'Chess (Gukesh, Pragg, Humpy)', nameHi: 'शतरंज', slug: 'chess' },
          { id: '7.2.2', name: 'Badminton & Athletics', nameHi: 'बैडमिंटन व एथलेटिक्स', slug: 'badminton-athletics' },
          { id: '7.2.3', name: 'Kabaddi & Football (ISL)', nameHi: 'कबड्डी व फुटबॉल', slug: 'kabaddi-football' }
        ]
      }
    ]
  },
  {
    id: 8,
    number: '8',
    name: 'Entertainment',
    nameHi: 'मनोरंजन व सिनेमा',
    slug: 'entertainment',
    description: 'Bollywood, South Indian Cinema, OTT Web Series, Box Office Ledger, Music.',
    badgeColor: '#C01048',
    iconName: 'Film',
    subCategories: [
      {
        id: '8.1',
        number: '8.1',
        name: 'Indian Cinema & Box Office',
        nameHi: 'सिनेमा व बॉक्स ऑफिस',
        slug: 'cinema-box-office',
        subSubCategories: [
          { id: '8.1.1', name: 'Verified Box Office Collections', nameHi: 'सटीक बॉक्स ऑफिस आंकड़े', slug: 'box-office' },
          { id: '8.1.2', name: 'Bollywood Reviews & Inside Stories', nameHi: 'बॉलीवुड समीक्षाएं', slug: 'bollywood' },
          { id: '8.1.3', name: 'Telugu, Tamil, Malayalam, Kannada', nameHi: 'दक्षिण भारतीय सिनेमा', slug: 'south-cinema' }
        ]
      },
      {
        id: '8.2',
        number: '8.2',
        name: 'Streaming & Web Series (OTT)',
        nameHi: 'ओटीटी व वेब सीरीज',
        slug: 'ott-streaming',
        subSubCategories: [
          { id: '8.2.1', name: 'Netflix, Prime, JioHotstar Releases', nameHi: 'ओटीटी रिलीज', slug: 'ott-releases' },
          { id: '8.2.2', name: 'Censorship & IT Rules on OTT', nameHi: 'ओटीटी नियम व विवाद', slug: 'ott-censorship' }
        ]
      }
    ]
  },
  {
    id: 9,
    number: '9',
    name: 'Lifestyle & Wellness',
    nameHi: 'लाइफस्टाइल व स्वास्थ्य',
    slug: 'lifestyle',
    description: 'Mental health, public health alerts, nutrition, domestic travel, regional food heritage.',
    badgeColor: '#0E9384',
    iconName: 'HeartPulse',
    subCategories: [
      {
        id: '9.1',
        number: '9.1',
        name: 'Health & Public Wellness',
        nameHi: 'स्वास्थ्य और जन-आरोग्य',
        slug: 'health-wellness',
        subSubCategories: [
          { id: '9.1.1', name: 'Disease Surveillance & ICMR Alerts', nameHi: 'आईसीएमआर स्वास्थ्य अलर्ट', slug: 'disease-alerts' },
          { id: '9.1.2', name: 'Ayurveda & Evidence-Based Medicine', nameHi: 'आयुर्वेद व आधुनिक चिकित्सा', slug: 'ayurveda-medicine' }
        ]
      }
    ]
  },
  {
    id: 10,
    number: '10',
    name: 'Education & Careers',
    nameHi: 'शिक्षा और करियर',
    slug: 'education-careers',
    description: 'UPSC/JEE/NEET exams, Paper leak investigations, UGC reforms, Govt & Private job trends.',
    badgeColor: '#4E5BA6',
    iconName: 'GraduationCap',
    subCategories: [
      {
        id: '10.1',
        number: '10.1',
        name: 'Competitive Exams & Paper Leaks',
        nameHi: 'प्रतियोगी परीक्षाएं व पेपर लीक जांच',
        slug: 'competitive-exams',
        subSubCategories: [
          { id: '10.1.1', name: 'UPSC Civil Services & State PSCs', nameHi: 'यूपीएससी व राज्य लोक सेवा आयोग', slug: 'upsc-psc' },
          { id: '10.1.2', name: 'NTA Exams (NEET, JEE, CUET)', nameHi: 'एनटीए परीक्षाएं (NEET/JEE)', slug: 'nta-exams' },
          { id: '10.1.3', name: 'Paper Leak Anti-Cheating Laws', nameHi: 'पेपर लीक विरोधी कानून', slug: 'anti-cheating' }
        ]
      }
    ]
  },
  {
    id: 11,
    number: '11',
    name: 'Automobile',
    nameHi: 'ऑटोमोबाइल',
    slug: 'automobile',
    description: 'Car & Bike launches, Crash test Bharat NCAP, Electric vehicles, High-speed expressways.',
    badgeColor: '#E04F16',
    iconName: 'Car',
    subCategories: [
      {
        id: '11.1',
        number: '11.1',
        name: 'EVs & Bharat NCAP Safety',
        nameHi: 'ईवी व भारत एनसीएपी सुरक्षा',
        slug: 'ev-safety',
        subSubCategories: [
          { id: '11.1.1', name: 'Bharat NCAP Crash Test Ratings', nameHi: 'सुरक्षा रेटिंग्स', slug: 'bharat-ncap' },
          { id: '11.1.2', name: 'Electric 2-Wheelers & Cars', nameHi: 'इलेक्ट्रिक वाहन', slug: 'electric-vehicles' }
        ]
      }
    ]
  },
  {
    id: 12,
    number: '12',
    name: 'Real Estate & Infrastructure',
    nameHi: 'रियल एस्टेट व शहरी विकास',
    slug: 'real-estate',
    description: 'RERA rulings, Circle rates, Metro expansions, Housing affordability in top 8 cities.',
    badgeColor: '#363F72',
    iconName: 'Building',
    subCategories: [
      {
        id: '12.1',
        number: '12.1',
        name: 'Property Trends & RERA',
        nameHi: 'प्रॉपर्टी ट्रेंड्स व रेरा',
        slug: 'property-rera',
        subSubCategories: [
          { id: '12.1.1', name: 'RERA Consumer Redressal', nameHi: 'रेरा उपभोक्ता शिकायतें', slug: 'rera' },
          { id: '12.1.2', name: 'City-wise Price Indices', nameHi: 'शहर-वार आवास मूल्य', slug: 'housing-prices' }
        ]
      }
    ]
  },
  {
    id: 13,
    number: '13',
    name: 'Religion & Spirituality',
    nameHi: 'धर्म और अध्यात्म',
    slug: 'religion-spirituality',
    description: 'Heritage temple projects, Interfaith dialogue, Kumbh, Char Dham, Sufi & Sikh shrines.',
    badgeColor: '#9E77ED',
    iconName: 'Sun',
    subCategories: [
      {
        id: '13.1',
        number: '13.1',
        name: 'Heritage & Pilgrimage',
        nameHi: 'धरोहर व तीर्थ स्थल',
        slug: 'heritage-pilgrimage',
        subSubCategories: [
          { id: '13.1.1', name: 'Temple Corridors & Pilgrim Infra', nameHi: 'तीर्थ कॉरिडोर व विकास', slug: 'pilgrim-infra' },
          { id: '13.1.2', name: 'Interfaith Dialogues & Harmony', nameHi: 'सर्वधर्म संवाद व सद्भाव', slug: 'interfaith' }
        ]
      }
    ]
  },
  {
    id: 14,
    number: '14',
    name: 'Opinion & Analysis',
    nameHi: 'विचार और विश्लेषण (Debates)',
    slug: 'opinion-analysis',
    description: 'Signed, accountable perspectives, Data explainers, Side-by-side Point vs Counterpoint debates.',
    badgeColor: '#7A271A',
    iconName: 'Scale',
    subCategories: [
      {
        id: '14.1',
        number: '14.1',
        name: 'Debate & Counterpoint Series',
        nameHi: 'पक्ष-विपक्ष आमने-सामने',
        slug: 'debates-counterpoint',
        subSubCategories: [
          { id: '14.1.1', name: 'National Policy Debates', nameHi: 'राष्ट्रीय नीति बहस', slug: 'policy-debates' },
          { id: '14.1.2', name: 'Economic Perspectives', nameHi: 'आर्थिक दृष्टिकोण', slug: 'economic-debates' }
        ]
      },
      {
        id: '14.2',
        number: '14.2',
        name: 'Data Investigations & Explainers',
        nameHi: 'डेटा इन्वेस्टिगेशन व व्याख्या',
        slug: 'data-investigations',
        subSubCategories: [
          { id: '14.2.1', name: 'Deep-Dive Investigative Reports', nameHi: 'गहन पड़ताल', slug: 'deep-dives' }
        ]
      }
    ]
  },
  {
    id: 17,
    number: '17',
    name: 'Specials & Major Hubs',
    nameHi: 'विशेष कवरेज हब',
    slug: 'specials',
    description: 'Live coverage hubs for Elections, Union Budget, Border Milestones, and Disaster Relief.',
    badgeColor: '#5925DC',
    iconName: 'Sparkles',
    subCategories: [
      {
        id: '17.1',
        number: '17.1',
        name: 'Event Micro-Hubs',
        nameHi: 'इवेंट माइक्रो-हब',
        slug: 'event-hubs',
        subSubCategories: [
          { id: '17.1.1', name: 'General & Assembly Elections', nameHi: 'चुनाव विशेष', slug: 'elections-special' },
          { id: '17.1.2', name: 'Union Budget Comprehensive', nameHi: 'केंद्रीय बजट विशेष', slug: 'budget-special' },
          { id: '17.1.3', name: 'Disaster Rapid Response Hub', nameHi: 'आपदा त्वरित राहत हब', slug: 'disaster-hub' }
        ]
      }
    ]
  },
  {
    id: 18,
    number: '18',
    name: 'Media Formats',
    nameHi: 'मीडिया प्रारूप',
    slug: 'media-formats',
    description: 'Cross-cutting format filter: Live Blogs, Photo Visuals, Audio Briefs, Interactive Charts.',
    badgeColor: '#475467',
    iconName: 'LayoutGrid',
    subCategories: [
      {
        id: '18.1',
        number: '18.1',
        name: 'Rich Formats',
        nameHi: 'विभिन्न प्रारूप',
        slug: 'rich-formats',
        subSubCategories: [
          { id: '18.1.1', name: 'Live Blogs (Breaking)', nameHi: 'लाइव ब्लॉग्स', slug: 'live-blogs' },
          { id: '18.1.2', name: 'Data Infographics & Visuals', nameHi: 'इन्फोग्राफिक्स', slug: 'infographics' },
          { id: '18.1.3', name: 'Audio Narratives & Podcasts', nameHi: 'ऑडियो पॉडकास्ट', slug: 'podcasts' }
        ]
      }
    ]
  }
];

export const STATES_AND_UTS_LIST = [
  { name: 'Andhra Pradesh', type: 'State', capital: 'Amaravati' },
  { name: 'Arunachal Pradesh', type: 'State', capital: 'Itanagar' },
  { name: 'Assam', type: 'State', capital: 'Dispur' },
  { name: 'Bihar', type: 'State', capital: 'Patna' },
  { name: 'Chhattisgarh', type: 'State', capital: 'Raipur' },
  { name: 'Goa', type: 'State', capital: 'Panaji' },
  { name: 'Gujarat', type: 'State', capital: 'Gandhinagar' },
  { name: 'Haryana', type: 'State', capital: 'Chandigarh' },
  { name: 'Himachal Pradesh', type: 'State', capital: 'Shimla' },
  { name: 'Jharkhand', type: 'State', capital: 'Ranchi' },
  { name: 'Karnataka', type: 'State', capital: 'Bengaluru' },
  { name: 'Kerala', type: 'State', capital: 'Thiruvananthapuram' },
  { name: 'Madhya Pradesh', type: 'State', capital: 'Bhopal' },
  { name: 'Maharashtra', type: 'State', capital: 'Mumbai' },
  { name: 'Manipur', type: 'State', capital: 'Imphal' },
  { name: 'Meghalaya', type: 'State', capital: 'Shillong' },
  { name: 'Mizoram', type: 'State', capital: 'Aizawl' },
  { name: 'Nagaland', type: 'State', capital: 'Kohima' },
  { name: 'Odisha', type: 'State', capital: 'Bhubaneswar' },
  { name: 'Punjab', type: 'State', capital: 'Chandigarh' },
  { name: 'Rajasthan', type: 'State', capital: 'Jaipur' },
  { name: 'Sikkim', type: 'State', capital: 'Gangtok' },
  { name: 'Tamil Nadu', type: 'State', capital: 'Chennai' },
  { name: 'Telangana', type: 'State', capital: 'Hyderabad' },
  { name: 'Tripura', type: 'State', capital: 'Agartala' },
  { name: 'Uttar Pradesh', type: 'State', capital: 'Lucknow' },
  { name: 'Uttarakhand', type: 'State', capital: 'Dehradun' },
  { name: 'West Bengal', type: 'State', capital: 'Kolkata' },
  { name: 'Andaman & Nicobar Islands', type: 'UT', capital: 'Port Blair' },
  { name: 'Chandigarh', type: 'UT', capital: 'Chandigarh' },
  { name: 'Dadra & Nagar Haveli and Daman & Diu', type: 'UT', capital: 'Daman' },
  { name: 'Delhi (NCT)', type: 'UT', capital: 'New Delhi' },
  { name: 'Jammu & Kashmir', type: 'UT', capital: 'Srinagar / Jammu' },
  { name: 'Ladakh', type: 'UT', capital: 'Leh / Kargil' },
  { name: 'Lakshadweep', type: 'UT', capital: 'Kavaratti' },
  { name: 'Puducherry', type: 'UT', capital: 'Puducherry' }
];

export const METRO_HUBS = [
  { name: 'Delhi-NCR', tag: 'NCR', activeIssues: 24, pop: '33M' },
  { name: 'Mumbai MMR', tag: 'MMR', activeIssues: 19, pop: '21M' },
  { name: 'Bengaluru', tag: 'BLR', activeIssues: 17, pop: '14M' },
  { name: 'Hyderabad', tag: 'HYD', activeIssues: 12, pop: '11M' },
  { name: 'Chennai', tag: 'MAA', activeIssues: 10, pop: '12M' },
  { name: 'Kolkata', tag: 'CCU', activeIssues: 14, pop: '15M' },
  { name: 'Pune', tag: 'PNQ', activeIssues: 9, pop: '7.5M' },
  { name: 'Ahmedabad', tag: 'AMD', activeIssues: 8, pop: '8.6M' }
];
