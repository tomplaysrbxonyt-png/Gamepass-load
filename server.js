import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ⚠️ Met ici le cookie .ROBLOSECURITY d’un compte ayant accès aux jeux privés
const ROBLOSECURITY = process.env.ROBLOSECURITY || "TON_COOKIE_ICI";

// Cache simple
const cache = new Map();
const CACHE_TIME = 5 * 60 * 1000; // 5 min

function robloxFetch(url) {
    return fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Cookie": `.ROBLOSECURITY=${ROBLOSECURITY}`,
            "Accept": "application/json"
        }
    });
}

// Récupère tous les jeux de l’utilisateur (privés inclus)
async function getUserGames(userId) {
    const res = await robloxFetch(
        `https://games.roblox.com/v2/users/${userId}/games?accessFilter=All&limit=50&sortOrder=Asc`
    );
    if (!res.ok) throw new Error(`Failed to get user games (${res.status})`);
    const data = await res.json();
    return data.data || [];
}

// Récupère le universeId à partir d’un placeId
async function getUniverseId(placeId) {
    const res = await robloxFetch(
        `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
    );
    if (!res.ok) throw new Error(`Failed to get universeId (${res.status})`);
    const data = await res.json();
    return data[0]?.universeId || null;
}

// Récupère tous les gamepasses d’un univers
async function getGamepasses(universeId) {
    const res = await robloxFetch(
        `https://games.roblox.com/v1/universes/${universeId}/game-passes?limit=100`
    );
    if (!res.ok) throw new Error(`Failed to get gamepasses (${res.status})`);
    const data = await res.json();
    return data.data ? data.data.map(g => g.id) : [];
}

// Récupère les vêtements du joueur
async function getClothing(username) {
    let clothing = [];
    for (const sub of ["55", "56", "57"]) {
        const res = await robloxFetch(
            `https://catalog.roblox.com/v1/search/items/details?Category=3&Subcategory=${sub}&Limit=30&CreatorName=${username}`
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.data) clothing.push(...data.data.map(i => i.id));
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
        const games = await getUserGames(userId);
        let gamepasses = [];

        // Récupération des gamepasses de chaque univers
        for (const game of games) {
            const placeId = game.rootPlace?.id;
            if (!placeId) continue;

            const universeId = await getUniverseId(placeId);
            if (!universeId) continue;

            const passes = await getGamepasses(universeId);
            gamepasses.push(...passes);
        }

        const clothing = await getClothing(username);

        const result = { gamepasses, clothing };
        cache.set(cacheKey, { time: Date.now(), data: result });

        res.json(result);

    } catch (err) {
        console.error("ASSETS ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
