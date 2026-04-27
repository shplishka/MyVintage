import { Request, Response } from 'express';
import Post from '../models/Post';
import { buildSearchPlan, SearchFilters } from '../services/ai';

const VALID_CATEGORIES = ['clothing', 'accessories', 'jewelry', 'furniture', 'art', 'electronics', 'books', 'other'];
const VALID_CONDITIONS  = ['like_new', 'excellent', 'good', 'fair', 'poor'];
const GEMINI_TIMEOUT_MS = 30_000;

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitiseFilters(raw: unknown): SearchFilters {
    if (!raw || typeof raw !== 'object') return {};
    const f = raw as Record<string, unknown>;
    const out: SearchFilters = {};

    if (typeof f.category === 'string' && VALID_CATEGORIES.includes(f.category))
        out.category = f.category;

    if (typeof f.condition === 'string' && VALID_CONDITIONS.includes(f.condition))
        out.condition = f.condition;

    if (typeof f.minPrice === 'number' && isFinite(f.minPrice) && f.minPrice >= 0)
        out.minPrice = f.minPrice;

    if (typeof f.maxPrice === 'number' && isFinite(f.maxPrice) && f.maxPrice >= 0)
        out.maxPrice = f.maxPrice;

    if (typeof f.yearFrom === 'number' && Number.isInteger(f.yearFrom) && f.yearFrom > 0)
        out.yearFrom = f.yearFrom;

    if (typeof f.yearTo === 'number' && Number.isInteger(f.yearTo) && f.yearTo > 0)
        out.yearTo = f.yearTo;

    if (typeof f.brand === 'string' && f.brand.trim().length > 0 && f.brand.length <= 100)
        out.brand = f.brand.trim();

    if (typeof f.style === 'string' && f.style.trim().length > 0 && f.style.length <= 100)
        out.style = f.style.trim();

    if (typeof f.keywords === 'string' && f.keywords.trim().length > 0 && f.keywords.length <= 200)
        out.keywords = f.keywords.trim();

    return out;
}

function buildMongoQuery(filters: SearchFilters): Record<string, unknown> {
    const query: Record<string, unknown> = { status: 'active' };

    if (filters.category)  query.category = filters.category;
    if (filters.condition) query.condition = filters.condition;

    // Escape user-supplied strings before using in $regex to prevent ReDoS / injection
    if (filters.brand) query.brand = { $regex: escapeRegex(filters.brand), $options: 'i' };
    if (filters.style) query.style = { $regex: escapeRegex(filters.style), $options: 'i' };

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        const priceRange: Record<string, number> = {};
        if (filters.minPrice !== undefined) priceRange.$gte = filters.minPrice;
        if (filters.maxPrice !== undefined) priceRange.$lte = filters.maxPrice;
        query.price = priceRange;
    }

    if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
        const yearRange: Record<string, number> = {};
        if (filters.yearFrom !== undefined) yearRange.$gte = filters.yearFrom;
        if (filters.yearTo   !== undefined) yearRange.$lte = filters.yearTo;
        query.year = yearRange;
    }

    if (filters.keywords) {
        const esc = escapeRegex(filters.keywords);
        query.$or = [
            { title:       { $regex: esc, $options: 'i' } },
            { description: { $regex: esc, $options: 'i' } },
        ];
    }

    return query;
}

function buildFallbackQuery(prompt: string): Record<string, unknown> {
    const esc = escapeRegex(prompt.slice(0, 200));
    return {
        status: 'active',
        $or: [
            { title:       { $regex: esc, $options: 'i' } },
            { description: { $regex: esc, $options: 'i' } },
            { brand:       { $regex: esc, $options: 'i' } },
            { category:    { $regex: esc, $options: 'i' } },
        ],
    };
}

export const smartSearch = async (req: Request, res: Response): Promise<void> => {
    const prompt = (req.body?.prompt ?? '').trim();

    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ message: 'prompt is required' });
        return;
    }
    if (prompt.length > 500) {
        res.status(400).json({ message: 'prompt must be 500 characters or fewer' });
        return;
    }

    console.log(`[smartSearch] query: "${prompt}"`);

    let usedFallback = false;
    let query: Record<string, unknown>;
    let explanation: string;

    try {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS)
        );
        const plan = await Promise.race([buildSearchPlan(prompt), timeout]);
        const filters = sanitiseFilters(plan.filters);
        query = buildMongoQuery(filters);
        explanation = plan.explanation;
        console.log('[smartSearch] filters:', JSON.stringify(filters));
        console.log('[smartSearch] query:', JSON.stringify(query));
    } catch (err) {
        console.error('[smartSearch] Gemini failed, using fallback:', (err as Error).message);
        usedFallback = true;
        query = buildFallbackQuery(prompt);
        explanation = `Showing basic results for "${prompt}"`;
    }

    const posts = await Post.find(query)
        .populate('seller', 'username profilePicture')
        .sort({ createdAt: -1 })
        .limit(50);

    console.log(`[smartSearch] found ${posts.length} posts (fallback=${usedFallback})`);

    res.json({ posts, explanation, fallback: usedFallback });
};
