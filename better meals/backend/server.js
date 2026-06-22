import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = (fileName) => path.join(__dirname, 'data', fileName);
const JWT_SECRET = process.env.JWT_SECRET || 'better-meals-secret';
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const readJson = async (fileName) => {
  const content = await fs.readFile(dataPath(fileName), 'utf8');
  return JSON.parse(content);
};

const writeJson = async (fileName, data) => {
  await fs.writeFile(dataPath(fileName), JSON.stringify(data, null, 2));
};

const getProfileFromUser = (user) => user.profile || {
  diets: [],
  allergies: [],
  conditions: [],
  exclusions: []
};

const matchesRestriction = (food, profile) => {
  const restrictions = [
    ...profile.allergies.map((value) => value.toLowerCase()),
    ...profile.conditions.map((value) => value.toLowerCase()),
    ...profile.exclusions.map((value) => value.toLowerCase())
  ];

  const foodText = [food.name, ...(food.labels || []), ...(food.allergens || []), ...(food.conditions || [])]
    .map((token) => token.toLowerCase())
    .join(' ');
  return restrictions.some((term) => foodText.includes(term));
};

const matchesDiet = (food, profile) => {
  if (!profile.diets || profile.diets.length === 0) {
    return true;
  }

  const foodLabels = (food.labels || []).map((label) => label.toLowerCase());
  return profile.diets.every((diet) => {
    const normalized = diet.toLowerCase();
    if (normalized === 'vegetarian') {
      return foodLabels.includes('vegetarian') || foodLabels.includes('vegan');
    }
    if (normalized === 'vegan') {
      return foodLabels.includes('vegan');
    }
    if (normalized === 'gluten-free') {
      return foodLabels.includes('gluten-free');
    }
    if (normalized === 'dairy-free') {
      return foodLabels.includes('dairy-free');
    }
    if (normalized === 'nut-free') {
      return foodLabels.includes('nut-free');
    }
    if (normalized === 'keto') {
      return foodLabels.includes('keto');
    }
    if (normalized === 'halal') {
      return foodLabels.includes('halal');
    }
    if (normalized === 'kosher') {
      return foodLabels.includes('kosher');
    }
    return true;
  });
};

const profileToDietFilter = (profile) => {
  if (!profile) return () => true;
  return (item) => matchesDiet(item, profile) && !matchesRestriction(item, profile);
};

const buildFoodLists = (profile, foods) => {
  const allow = [];
  const avoid = [];

  foods.forEach((food) => {
    const isRestricted = matchesRestriction(food, profile);
    const isDietFriendly = matchesDiet(food, profile);
    if (isRestricted || !isDietFriendly) {
      avoid.push(food);
    } else {
      allow.push(food);
    }
  });

  return {
    allowed: allow.sort((a, b) => a.name.localeCompare(b.name)),
    avoid: avoid.sort((a, b) => a.name.localeCompare(b.name))
  };
};

const findRecipeMatches = (profile, recipes) => {
  const restrictions = [
    ...profile.allergies.map((value) => value.toLowerCase()),
    ...profile.conditions.map((value) => value.toLowerCase()),
    ...profile.exclusions.map((value) => value.toLowerCase())
  ];

  return recipes.filter((recipe) => {
    const labels = (recipe.diets || []).map((item) => item.toLowerCase());
    const matchesDiet = profile.diets.length === 0 || profile.diets.every((diet) => labels.includes(diet.toLowerCase()));
    if (!matchesDiet) {
      return false;
    }

    const ingredientText = recipe.ingredients.join(' ').toLowerCase();
    const hasExcludedIngredient = restrictions.some((term) => ingredientText.includes(term));
    return !hasExcludedIngredient;
  });
};

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  const token = header.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = await readJson('users.json');
    const user = users.find((item) => item.id === payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  const users = await readJson('users.json');
  const existing = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: uuidv4(),
    name,
    email,
    passwordHash,
    profile: {
      diets: [],
      allergies: [],
      conditions: [],
      exclusions: []
    },
    favorites: []
  };

  users.push(newUser);
  await writeJson('users.json', users);

  const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: newUser.id, name: newUser.name, email: newUser.email }, token });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = await readJson('users.json');
  const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
});

app.get('/api/profile', authenticate, async (req, res) => {
  const profile = getProfileFromUser(req.user);
  res.json({ profile });
});

app.post('/api/profile', authenticate, async (req, res) => {
  const { diets = [], allergies = [], conditions = [], exclusions = [] } = req.body;
  const users = await readJson('users.json');
  const updateIndex = users.findIndex((item) => item.id === req.user.id);
  if (updateIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[updateIndex].profile = {
    diets,
    allergies,
    conditions,
    exclusions
  };
  await writeJson('users.json', users);

  res.json({ profile: users[updateIndex].profile });
});

app.get('/api/foods', authenticate, async (req, res) => {
  const profile = getProfileFromUser(req.user);
  const foods = await readJson('foods.json');
  const foodLists = buildFoodLists(profile, foods);
  res.json(foodLists);
});

app.get('/api/recipes', authenticate, async (req, res) => {
  const profile = getProfileFromUser(req.user);
  const recipes = await readJson('recipes.json');
  const matches = findRecipeMatches(profile, recipes);
  res.json({ recipes: matches, all: recipes });
});

app.get('/api/recipes/:id', authenticate, async (req, res) => {
  const recipes = await readJson('recipes.json');
  const recipe = recipes.find((item) => item.id === req.params.id);
  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  res.json({ recipe });
});

app.get('/api/favorites', authenticate, async (req, res) => {
  const recipes = await readJson('recipes.json');
  const favoriteIds = req.user.favorites || [];
  const favorites = recipes.filter((recipe) => favoriteIds.includes(recipe.id));
  res.json({ favorites });
});

app.post('/api/favorites', authenticate, async (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) {
    return res.status(400).json({ error: 'Recipe ID is required' });
  }

  const users = await readJson('users.json');
  const updateIndex = users.findIndex((item) => item.id === req.user.id);
  if (updateIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const favorites = new Set(users[updateIndex].favorites || []);
  if (favorites.has(recipeId)) {
    favorites.delete(recipeId);
  } else {
    favorites.add(recipeId);
  }

  users[updateIndex].favorites = Array.from(favorites);
  await writeJson('users.json', users);

  const recipes = await readJson('recipes.json');
  const favoritesList = recipes.filter((recipe) => users[updateIndex].favorites.includes(recipe.id));
  res.json({ favorites: favoritesList });
});

// Mocked stores suggestion endpoint (scaffold)
app.post('/api/stores/suggest', async (req, res) => {
  try {
    const { location = {}, profile = {} } = req.body || {};
    // simple default coordinates (NYC) if none provided
    const lat = location.lat || 40.7128;
    const lng = location.lng || -74.0060;

    const sampleChains = [
      'Whole Foods Market',
      "Trader Joe's",
      'Sprouts Farmers Market',
      'Walmart Supercenter',
      'H Mart',
      'ALDI'
    ];

    const results = sampleChains.slice(0, 5).map((chain, idx) => {
      const offset = (idx + 1) * 0.01;
      const placeLat = lat + offset * (idx % 2 === 0 ? 1 : -1);
      const placeLng = lng + offset * (idx % 2 === 0 ? -1 : 1);
      return {
        id: `mock-${idx + 1}`,
        name: `${chain} (${location.zip || location.city || 'Local'})`,
        chain,
        address: `${100 + idx} Main St, ${location.city || 'City'}, ${location.region || 'State'}`,
        lat: placeLat,
        lng: placeLng,
        distance_miles: Math.round(((offset * 69) + Number.EPSILON) * 10) / 10,
        place_id: `mock_place_${idx + 1}`,
        rating: 4.0 - idx * 0.2,
        url: `https://maps.google.com/?q=${encodeURIComponent(chain)}`,
        confidence: Math.round((0.9 - idx * 0.08) * 100) / 100
      };
    });

    res.json({ stores: results });
  } catch (err) {
    res.status(500).json({ error: 'Unable to suggest stores' });
  }
});

// Mocked price estimation endpoint (scaffold)
app.post('/api/price/estimate', async (req, res) => {
  try {
    const { recipeId, ingredients = [], region = 'US' } = req.body || {};
    const recipes = await readJson('recipes.json');
    let target = null;
    if (recipeId) {
      target = recipes.find((r) => r.id === recipeId);
    }
    const sourceIngredients = target ? target.ingredients : ingredients;

    // AI heuristic: tier based on ingredient count
    const count = sourceIngredients.length || 4;
    const aiTier = count <= 5 ? '$' : count <= 9 ? '$$' : '$$$';
    const aiLow = Math.max(1, Math.round((count * 0.6) * 100) / 100);
    const aiMedian = Math.round((count * 1.1) * 100) / 100;
    const aiHigh = Math.round((count * 1.8) * 100) / 100;

    // Exact (mock): assume $0.8 per ingredient average with small variance
    const breakdown = (sourceIngredients || []).map((ing, i) => ({
      ingredient: ing,
      qty: 1,
      unitCost: Math.round((0.5 + (i % 3) * 0.4) * 100) / 100
    }));
    const exactMedian = breakdown.reduce((s, b) => s + b.unitCost, 0);
    const exactLow = Math.round((exactMedian * 0.85) * 100) / 100;
    const exactHigh = Math.round((exactMedian * 1.25) * 100) / 100;
    const exactTier = exactMedian <= 5 ? '$' : exactMedian <= 12 ? '$$' : '$$$';

    res.json({
      recipeId: recipeId || null,
      ai: { tier: aiTier, low: aiLow, median: aiMedian, high: aiHigh, assumptions: 'AI heuristic based on ingredient count and typical US prices' },
      exact: { tier: exactTier, low: exactLow, median: Math.round(exactMedian * 100) / 100, high: exactHigh, breakdown }
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to estimate price' });
  }
});

app.listen(port, () => {
  console.log(`Better Meals API running on http://localhost:${port}`);
});
