import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

/** @type {Groq | null} */
let _groq = null;
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

async function complete(messages, options = {}) {
  try {
    const response = await getGroq().chat.completions.create({
      model: MODEL,
      messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.max_tokens ?? 1024,
    });
    return response.choices[0].message.content;
  } catch (err) {
    throw new Error(`Groq API error: ${err.message}`);
  }
}

export { complete };
