import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Petit cache mémoire
const cache = new Map();
const CACHE_TIME = 5 * 60 * 1000; // 5 min

async function robloxFetch(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        }
    });

    if (!res.ok) {
        throw new Error(`Roblox API error ${res.status}`);
    }

    return await res.json();
}

async function getGamepasses(userId) {
    // Subcategory 34 = Gamepasses
    const data = await robloxFetch(
        `https://catalog.roblox.com/v1/search/items/details?Category=3&Subcategory=34&Limit=50&CreatorTargetId=${userId}&CreatorType=User`
    );

    return data.data ? data.data.map(i => i.id) : [];
}

async function getClothing(username) {
    let clothing = [];

    for (const sub of ["55", "56", "57"]) {
        const data = await robloxFetch(
            `https://catalog.roblox.com/v1/search/items/details?Category=3&Subcategory=${sub}&Limit=30&CreatorName=${username}`
        );

        if (data.data) {
            clothing.push(...data.data.map(i => i.id));
        }
    }

    return clothing;
}

app.get("/assets/:userId/:username", async (req, res) => {
    const { userId, username } = req.params;

    const cacheKey = userId;

    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.time < CACHE_TIME) {
            return res.json(cached.data);
        }
    }

    try {
        const [gamepasses, clothing] = await Promise.all([
            getGamepasses(userId),
            getClothing(username)
        ]);

        const result = { gamepasses, clothing };

        cache.set(cacheKey, {
            time: Date.now(),
            data: result
        });

        res.json(result);

    } catch (err) {
        console.error("ASSETS ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
