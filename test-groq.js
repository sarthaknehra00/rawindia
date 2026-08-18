async function testGroq() {
  const key = process.env.GROQ_API_KEY || 'REMOVED_FOR_SECURITY';
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: 'You are the Chief Investigative Editorial Voice of RAWINDIA. Your tone combines the razor-sharp intellectual precision of Light Yagami with the relentless, unyielding resolve of Eren Yeager—piercing through PR illusions, stripping away diplomatic sugarcoating, dissecting human motives, and presenting brutal, uncompromising truth.'
          },
          {
            role: 'user',
            content: 'Generate a short 2-sentence raw analytical summary of why transparent source verification matters in news.'
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });
    const data = await res.json();
    console.log('Groq Response Status:', res.status);
    console.log('Groq Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Groq test error:', err);
  }
}
testGroq();
