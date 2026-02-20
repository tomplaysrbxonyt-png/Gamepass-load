import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Cache mémoire simple
const cache = new Map();
const CACHE_TIME = 5 * 60 * 1000; // 5 min

async function getUserGames(userId) {
    let allGames = [];

    // Jeux créés par l'utilisateur
    const userRes = await fetch(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50&sortOrder=Asc`);
    const userData = await userRes.json();
    if (userData.data) {
        allGames.push(...userData.data);
    }

    // Récupérer les groupes du user
    const groupsRes = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const groupsData = await groupsRes.json();

    if (groupsData.data) {
        for (const group of groupsData.data) {
            const groupId = group.group.id;

            const groupGamesRes = await fetch(`https://games.roblox.com/v2/groups/${groupId}/games?accessFilter=Public&limit=50&sortOrder=Asc`);
            const groupGamesData = await groupGamesRes.json();

            if (groupGamesData.data) {
                allGames.push(...groupGamesData.data);
            }
        }
    }

    return allGames;
}
async function getUniverseId(placeId) {
    const res = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
    const data = await res.json();
    return data[0]?.universeId;
}

async function getGamepasses(universeId) {
    const res = await fetch(`https://games.roblox.com/v1/universes/${universeId}/game-passes?limit=100&sortOrder=Asc`);
    const data = await res.json();
    return data.data || [];
}

async function getClothing(username, sub) {
    const res = await fetch(
        `https://catalog.roblox.com/v1/search/items/details?Category=3&Subcategory=${sub}&Limit=30&CreatorName=${username}`
    );
    const data = await res.json();
    return data.data || [];
}

app.get("/assets/:userId/:username", async (req, res) => {
    const { userId, username } = req.params;
    const cacheKey = `${userId}`;

    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.time < CACHE_TIME) {
            return res.json(cached.data);
        }
    }

    try {
        const games = await getUserGames(userId);
        let gamepasses = [];

        for (const game of games) {
            const placeId = game.rootPlace?.id;
            if (!placeId) continue;

            const universeId = await getUniverseId(placeId);
            if (!universeId) continue;

            const passes = await getGamepasses(universeId);
            gamepasses.push(...passes.map(p => p.id));
        }

        let clothing = [];
        for (const sub of ["55", "56", "57"]) {
            const items = await getClothing(username, sub);
            clothing.push(...items.map(i => i.id));
        }

        const result = { gamepasses, clothing };

        cache.set(cacheKey, {
            time: Date.now(),
            data: result
        });

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal error" });
    }
});

app.listen(PORT, () => {
    console.log("Server running on port", PORT);

});
