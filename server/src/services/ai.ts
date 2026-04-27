import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn('[ai] WARNING: GEMINI_API_KEY is not set. Smart search will fall back to basic keyword search.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const SYSTEM_PROMPT = `You are a search assistant for a vintage marketplace. Convert natural language queries into structured search filters for a MongoDB database.

Searchable fields on a Post:
- category: one of [clothing, accessories, jewelry, furniture, art, electronics, books, other]
- condition: one of [like_new, excellent, good, fair, poor]
- price: a number in USD
- year: an integer — the decade/year the physical item originates from (e.g. 1975)
- brand: a string (e.g. "Levi's", "Nike", "Chanel")
- style: a string (e.g. "casual", "formal", "bohemian", "streetwear")
- keywords: free text matched against the post title and description

Return ONLY a single valid JSON object with this exact shape:
{
  "filters": {
    "category"?: "clothing"|"accessories"|"jewelry"|"furniture"|"art"|"electronics"|"books"|"other",
    "condition"?: "like_new"|"excellent"|"good"|"fair"|"poor",
    "minPrice"?: number,
    "maxPrice"?: number,
    "yearFrom"?: number,
    "yearTo"?: number,
    "brand"?: string,
    "style"?: string,
    "keywords"?: string
  },
  "explanation": string
}

Rules:
- Omit any field that the query does not address — do not include null or empty values.
- "explanation" must be a concise human-readable sentence summarising the applied filters.
- Decade expressions: "70s" → yearFrom:1970, yearTo:1979. "mid-century" → yearFrom:1950, yearTo:1969.
- Price expressions: "under $50" → maxPrice:50. "between $20 and $80" → minPrice:20, maxPrice:80.
- Condition expressions: "perfect" / "mint" → like_new. "worn" / "used" → fair or poor.
- Use lowercase for all enum values (category, condition).
- keywords should contain the core descriptive terms not covered by other fields.`;

// gemini-2.5-flash-lite: free-tier model confirmed working with this API key.
// gemini-2.0-flash has free-tier quota = 0 on this key and returns 429 on every call.
const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
        responseMimeType: 'application/json',
    },
});

export interface SearchFilters {
    category?: string;
    condition?: string;
    minPrice?: number;
    maxPrice?: number;
    yearFrom?: number;
    yearTo?: number;
    brand?: string;
    style?: string;
    keywords?: string;
}

export interface SearchPlan {
    filters: SearchFilters;
    explanation: string;
}

export async function buildSearchPlan(prompt: string): Promise<SearchPlan> {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        console.error('[ai] Gemini returned non-JSON response:', text.slice(0, 200));
        throw new Error('AI returned invalid JSON');
    }

    if (!parsed || typeof parsed !== 'object' || typeof (parsed as any).explanation !== 'string') {
        console.error('[ai] Gemini returned unexpected structure:', JSON.stringify(parsed).slice(0, 200));
        throw new Error('AI returned unexpected structure');
    }

    return {
        filters: (parsed as any).filters ?? {},
        explanation: (parsed as any).explanation,
    };
}
