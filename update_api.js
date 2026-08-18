const fs = require('fs');
let content = fs.readFileSync('api/ledger.ts', 'utf8');

const seedBlockStart = content.indexOf('if (body.action === \\'seed\\') {');
const seedBlockEnd = content.indexOf('if (body.action === \\'append-verified\\') {');

const oldBlock = content.substring(seedBlockStart, seedBlockEnd);

const newBlock = \if (body.action === 'seed') {
      const [existingVerdicts, existingPromises] = await Promise.all([
        upstashGetJSON(VERDICTS_KEY, []),
        upstashGetJSON(PROMISES_KEY, []),
      ]);
      const verdicts = (Array.isArray(body.verdicts) ? body.verdicts : []);
      const promises = (Array.isArray(body.promises) ? body.promises : []);
      
      const seedVerdictIds = new Set(verdicts.map(v => v.id));
      const seedPromiseIds = new Set(promises.map(p => p.id));
      
      const keptVerdicts = existingVerdicts.filter(v => !seedVerdictIds.has(v.id));
      const keptPromises = existingPromises.filter(p => !seedPromiseIds.has(p.id));
      
      await Promise.all([
        upstashSetJSON(VERDICTS_KEY, [...keptVerdicts, ...verdicts]),
        upstashSetJSON(PROMISES_KEY, [...keptPromises, ...promises])
      ]);
      
      res.status(200).json({ ok: true, seeded: true, note: 'overwrote seed data' });
      return;
    }
    \;

fs.writeFileSync('api/ledger.ts', content.replace(oldBlock, newBlock));
console.log('API seed action updated to overwrite');
