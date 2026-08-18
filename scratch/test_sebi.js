async function run() {
  const res = await fetch('https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0');
  const data = await res.text();
  const matches = data.match(/href=["']([^"']*?)["']/g) || [];
  const pdfs = matches.filter(m => m.toLowerCase().includes('.pdf'));
  const sebiData = matches.filter(m => m.includes('sebi_data'));
  console.log("PDF Links found:", pdfs.length);
  console.log("Sebi_data links found:", sebiData.slice(0, 5));
}
run();
