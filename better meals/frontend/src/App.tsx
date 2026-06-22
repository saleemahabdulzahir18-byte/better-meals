import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

interface Profile {
  diets: string[];
  allergies: string[];
  conditions: string[];
  exclusions: string[];
}

interface FoodItem {
  id: string;
  name: string;
  category: string;
  labels: string[];
  allergens: string[];
  conditions: string[];
}

interface Recipe {
  id: string;
  title: string;
  image: string;
  diets: string[];
  ingredients: string[];
  instructions: string[];
  tags: string[];
}

const dietOptions = [
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Keto',
  'Halal',
  'Kosher'
];

const allergyOptions = ['Peanuts', 'Tree Nuts', 'Dairy', 'Gluten', 'Soy', 'Shellfish'];
const conditionOptions = ['Diabetes', 'Low-Sodium'];

const createTags = (items: string[]) => items.map((item) => item.toLowerCase()).join(', ');

const App = () => {
  const [profile, setProfile] = useState<Profile>({ diets: [], allergies: [], conditions: [], exclusions: [] });
  const [foods, setFoods] = useState<{ allowed: FoodItem[]; avoid: FoodItem[] }>({ allowed: [], avoid: [] });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [alert, setAlert] = useState<string | null>(null);

  // UI state for stores & pricing (scaffold)
  const [showStoresModal, setShowStoresModal] = useState(false);
  const [storeZip, setStoreZip] = useState('');
  const [storesResults, setStoresResults] = useState<any[]>([]);
  const [priceEstimates, setPriceEstimates] = useState<Record<string, any>>({});
  const isPro = true; // toggle for scaffolded Pro features

  const [profileInput, setProfileInput] = useState({
    diets: [] as string[],
    allergies: [] as string[],
    conditions: [] as string[],
    exclusions: ''
  });

  const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: `${API_BASE}/api` });
    instance.interceptors.request.use((config) => {
      if (authToken && config.headers) {
        config.headers.Authorization = `Bearer ${authToken}`;
      }
      return config;
    });
    return instance;
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    const fetchAll = async () => {
      try {
        const [profileRes, foodsRes, recipesRes, favoritesRes] = await Promise.all([
          api.get('/profile'),
          api.get('/foods'),
          api.get('/recipes'),
          api.get('/favorites')
        ]);

        setProfile(profileRes.data.profile);
        setFoods(foodsRes.data);
        setRecipes(recipesRes.data.recipes);
        setFavorites(favoritesRes.data.favorites);

        setProfileInput({
          diets: profileRes.data.profile.diets,
          allergies: profileRes.data.profile.allergies,
          conditions: profileRes.data.profile.conditions,
          exclusions: profileRes.data.profile.exclusions.join(', ')
        });
      } catch (error) {
        setAlert('Unable to load your dashboard. Please sign in again.');
      }
    };

    fetchAll();
  }, [authToken, api]);

  const setLocalAlert = (message: string) => {
    setAlert(message);
    setTimeout(() => setAlert(null), 4000);
  };

  const handleLogin = async () => {
    try {
      const response = await api.post('/auth/login', { email: userEmail, password: userPassword });
      setAuthToken(response.data.token);
      setUserName('');
      setUserPassword('');
      setUserEmail('');
    } catch (error) {
      setLocalAlert('Login failed. Please check your credentials.');
    }
  };

  const handleSignup = async () => {
    try {
      const response = await api.post('/auth/signup', { name: userName, email: userEmail, password: userPassword });
      setAuthToken(response.data.token);
      setUserName('');
      setUserPassword('');
      setUserEmail('');
    } catch (error) {
      setLocalAlert('Sign up failed. Try again with another email.');
    }
  };

  const handleProfileSave = async () => {
    const exclusions = profileInput.exclusions
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const response = await api.post('/profile', {
        diets: profileInput.diets,
        allergies: profileInput.allergies,
        conditions: profileInput.conditions,
        exclusions
      });
      setProfile(response.data.profile);
      setProfileInput({ ...profileInput, exclusions: exclusions.join(', ') });
      const foodsRes = await api.get('/foods');
      const recipesRes = await api.get('/recipes');
      setFoods(foodsRes.data);
      setRecipes(recipesRes.data.recipes);
      setLocalAlert('Dietary profile saved. Your recommendations are updated.');
    } catch (error) {
      setLocalAlert('Unable to save profile. Try again.');
    }
  };

  const handleToggleFavorite = async (recipeId: string) => {
    try {
      const response = await api.post('/favorites', { recipeId });
      setFavorites(response.data.favorites);
      setLocalAlert('Favorites updated.');
    } catch (error) {
      setLocalAlert('Could not update favorites.');
    }
  };

    const getPriceTier = (recipe: Recipe) => {
      const n = (recipe.ingredients || []).length;
      if (n <= 5) return '$';
      if (n <= 9) return '$$';
      return '$$$';
    };

    const fetchPriceEstimate = async (recipeId: string) => {
      try {
        const resp = await api.post('/price/estimate', { recipeId });
        setPriceEstimates((p) => ({ ...p, [recipeId]: resp.data }));
      } catch (err) {
        setLocalAlert('Price estimate failed.');
      }
    };

    const fetchStores = async () => {
      try {
        const resp = await api.post('/stores/suggest', { location: { zip: storeZip, city: storeZip }, profile: profileInput });
        setStoresResults(resp.data.stores || []);
      } catch (err) {
        setLocalAlert('Store lookup failed.');
      }
    };

  const visibleRecipe = selectedRecipe || recipes[0] || null;

  if (!authToken) {
    return (
      <div className="landing-shell">
        <header className="landing-nav">
          <div className="brand">
            <span className="brand-mark">🍃</span>
            <span className="brand-name">better meals</span>
          </div>
          <div className="nav-links">
            <button className="nav-link" type="button">
              Build my plan
            </button>
            <button className="nav-link" type="button" onClick={() => setMode('login')}>
              Log in
            </button>
            <button className="primary-button nav-cta" type="button" onClick={() => setMode('signup')}>
              Get started
            </button>
          </div>
        </header>

        <main className="landing-hero">
          <div className="hero-copy">
            <span className="eyebrow">Eat better, freely.</span>
            <h1>Food that fits your body — not the other way around.</h1>
            <p>Tell us your dietary restrictions. We'll hand back a clear list of what you can & can't eat — plus a fresh set of global recipes you can actually cook tonight.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => setMode('signup')}>
                Build my plan
              </button>
              <button className="secondary-button" type="button" onClick={() => setMode('signup')}>
                Create an account
              </button>
              <button className="pill" type="button" onClick={() => setMode('login')}>
                Scanner
              </button>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="auth-card landing-card">
              <h2>{mode === 'login' ? 'Welcome back' : 'Create your profile'}</h2>
              <p>{mode === 'login' ? 'Sign in to access your saved plan, recipes, and dietary profile.' : 'Sign up to save your dietary preferences and favorite recipes.'}</p>

              <div className="toggle-row">
                <button
                  className={mode === 'login' ? 'pill pill-active' : 'pill'}
                  onClick={() => setMode('login')}
                  type="button"
                >
                  Login
                </button>
                <button
                  className={mode === 'signup' ? 'pill pill-active' : 'pill'}
                  onClick={() => setMode('signup')}
                  type="button"
                >
                  Sign Up
                </button>
              </div>

              {mode === 'signup' && (
                <label className="field-label">
                  Name
                  <input value={userName} onChange={(event) => setUserName(event.target.value)} placeholder="Your name" />
                </label>
              )}

              <label className="field-label">
                Email
                <input value={userEmail} onChange={(event) => setUserEmail(event.target.value)} type="email" placeholder="you@example.com" />
              </label>

              <label className="field-label">
                Password
                <input value={userPassword} onChange={(event) => setUserPassword(event.target.value)} type="password" placeholder="••••••••" />
              </label>

              <button className="primary-button" onClick={mode === 'login' ? handleLogin : handleSignup} type="button">
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              {alert && <div className="toast">{alert}</div>}
            </div>
          </aside>
        </main>

        <section className="landing-content">
          <div className="landing-copy">
            <h2>Eating shouldn’t feel like a guessing game.</h2>
            <p>Better Meals was built for everyone who’s ever held a food package in the grocery aisle, squinting at tiny print, hoping the next ingredient won’t be the one that lands them in the hospital — or just ruins their week.</p>
            <p>We believe restrictions should never mean restriction of joy. So we built a place where you tell us your story once — every allergy, every condition, every ingredient that doesn’t love you back — and we hand you a clear, personal map of food you can trust.</p>
            <p>Lists of what to enjoy. Lists of what to skip. Fresh global recipes that respect every line of your profile. And a scanner in your pocket for the moments the answer needs to come in five seconds, not five minutes.</p>
          </div>

          <div className="info-cards">
            <article className="info-card">
              <span className="info-card-number">01</span>
              <h3>Confidence</h3>
              <p>Every suggestion is filtered through your full profile — no second-guessing.</p>
            </article>
            <article className="info-card">
              <span className="info-card-number">02</span>
              <h3>Curiosity</h3>
              <p>Discover meals from cuisines you didn’t know were already safe for you.</p>
            </article>
            <article className="info-card">
              <span className="info-card-number">03</span>
              <h3>Freedom</h3>
              <p>Eat out, travel, host friends — without the dread.</p>
            </article>
          </div>
        </section>

        <footer className="landing-footer">
          <span>© 2026 better meals</span>
          <span>Made by Saleemah Abdul-zahir</span>
          <span>Crafted for every body.</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero-section">
        <div>
          <span className="eyebrow">Organic, global meal planning</span>
          <h1>Eat with confidence through every dietary restriction.</h1>
          <p>Build a profile that covers common diets, allergies, medical conditions, and custom exclusions. Then save recipes that match your preferences.</p>
        </div>
        <button className="secondary-button" onClick={() => setAuthToken(null)} type="button">
          Sign Out
        </button>
      </header>

      <section className="dashboard-grid">
        <section className="card profile-card">
          <h2>Saved profile</h2>
          <div className="profile-summary">
            <p><strong>Diets</strong>: {profile.diets.length ? createTags(profile.diets) : 'None selected'}</p>
            <p><strong>Allergies</strong>: {profile.allergies.length ? createTags(profile.allergies) : 'None selected'}</p>
            <p><strong>Conditions</strong>: {profile.conditions.length ? createTags(profile.conditions) : 'None selected'}</p>
            <p><strong>Custom Exclusions</strong>: {profile.exclusions.length ? createTags(profile.exclusions) : 'None'}</p>
          </div>
        </section>

        <section className="card favorites-card">
          <h2>Favorited recipes</h2>
          {favorites.length ? (
            <div className="favorites-list">
              {favorites.map((recipe) => (
                <div key={recipe.id} className="favorite-item">
                  <button className="link-button" onClick={() => setSelectedRecipe(recipe)} type="button">
                    {recipe.title}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p>No saved favorites yet. Favorite a recipe from the list below.</p>
          )}
        </section>
      </section>

      <section className="card form-card">
        <h2>Dietary restriction form</h2>
        <div className="field-group">
          <label className="field-label">Diets</label>
          <div className="chips-row">
            {dietOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={profileInput.diets.includes(option) ? 'chip chip-selected' : 'chip'}
                onClick={() => {
                  const selected = profileInput.diets.includes(option)
                    ? profileInput.diets.filter((value) => value !== option)
                    : [...profileInput.diets, option];
                  setProfileInput({ ...profileInput, diets: selected });
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Allergies</label>
          <div className="chips-row">
            {allergyOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={profileInput.allergies.includes(option) ? 'chip chip-selected' : 'chip'}
                onClick={() => {
                  const selected = profileInput.allergies.includes(option)
                    ? profileInput.allergies.filter((value) => value !== option)
                    : [...profileInput.allergies, option];
                  setProfileInput({ ...profileInput, allergies: selected });
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">Medical conditions</label>
          <div className="chips-row">
            {conditionOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={profileInput.conditions.includes(option) ? 'chip chip-selected' : 'chip'}
                onClick={() => {
                  const selected = profileInput.conditions.includes(option)
                    ? profileInput.conditions.filter((value) => value !== option)
                    : [...profileInput.conditions, option];
                  setProfileInput({ ...profileInput, conditions: selected });
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">
            Custom exclusions
            <input
              value={profileInput.exclusions}
              onChange={(event) => setProfileInput({ ...profileInput, exclusions: event.target.value })}
              placeholder="eg. mushrooms, sugar, shellfish"
            />
          </label>
        </div>

        <button className="primary-button" onClick={handleProfileSave} type="button">
          Save Profile
        </button>
      </section>

      <section className="cards-pair">
        <section className="card list-card">
          <h2>Foods You Can Eat</h2>
          <div className="food-list">
            {foods.allowed.length ? (
              foods.allowed.map((food) => (
                <div key={food.id} className="food-item">
                  <span>{food.name}</span>
                  <small>{food.category}</small>
                </div>
              ))
            ) : (
              <p>No matching foods found. Try adjusting your profile.</p>
            )}
          </div>
        </section>

        <section className="card list-card avoid-card">
          <h2>Foods to Avoid</h2>
          <div className="food-list">
            {foods.avoid.length ? (
              foods.avoid.map((food) => (
                <div key={food.id} className="food-item">
                  <span>{food.name}</span>
                  <small>{food.category}</small>
                </div>
              ))
            ) : (
              <p>Everything looks compatible with your current profile.</p>
            )}
          </div>
        </section>
      </section>

      <section className="recipe-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">AI-inspired recipe ideas</span>
            <h2>Recipe suggestions for your diet</h2>
          </div>
          <p>Browse a curated selection of recipes built for your restrictions and favorite what you want to keep.</p>
        </div>

        <div className="recipe-cards">
          {recipes.map((recipe) => (
            <article key={recipe.id} className="recipe-card">
              <img src={recipe.image} alt={recipe.title} />
              <div className="recipe-card-body">
                <h3>{recipe.title}</h3>
                <p>{recipe.tags.join(' • ')}</p>
                <p className="price-chip">{priceEstimates[recipe.id]?.ai?.tier || getPriceTier(recipe)} {priceEstimates[recipe.id]?.ai?.median ? `• est $${priceEstimates[recipe.id].ai.median}` : ''}</p>
                <div className="recipe-card-actions">
                  <button className="link-button" onClick={() => setSelectedRecipe(recipe)} type="button">
                    View details
                  </button>
                  <button className="pill" onClick={() => handleToggleFavorite(recipe.id)} type="button">
                    {favorites.some((item) => item.id === recipe.id) ? 'Unfavorite' : 'Favorite'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {visibleRecipe && (
        <section className="card recipe-detail-card">
          <h2>{visibleRecipe.title}</h2>
          <div className="detail-grid">
            <img src={visibleRecipe.image} alt={visibleRecipe.title} />
            <div>
              <p className="detail-pill">{visibleRecipe.diets.join(' • ')}</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className="primary-button" onClick={() => { if (isPro) setShowStoresModal(true); else setLocalAlert('Stores finder is Pro only'); }} type="button">Find nearest stores</button>
                <button className="secondary-button" onClick={() => fetchPriceEstimate(visibleRecipe.id)} type="button">Estimate price</button>
              </div>
              <h3>Ingredients</h3>
              <ul>
                {visibleRecipe.ingredients.map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
              <h3>Instructions</h3>
              <ol>
                {visibleRecipe.instructions.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {showStoresModal && (
        <div className="modal-overlay">
          <div className="modal">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Find stores near you (mock)</h3>
              <button onClick={() => setShowStoresModal(false)} type="button">Close</button>
            </header>
            <div style={{ marginTop: 8 }}>
              <label>ZIP or City
                <input value={storeZip} onChange={(e) => setStoreZip(e.target.value)} placeholder="e.g. 94103 or San Francisco" />
              </label>
              <div style={{ marginTop: 8 }}>
                <button className="primary-button" onClick={fetchStores} type="button">Search</button>
              </div>
              <div style={{ marginTop: 12 }}>
                {storesResults.length ? (
                  <ul>
                    {storesResults.map((s) => (
                      <li key={s.id} style={{ marginBottom: 8 }}>
                        <strong>{s.name}</strong> — {s.address} — {s.distance_miles} mi — confidence {s.confidence}
                        <div><a target="_blank" rel="noreferrer" href={s.url}>Directions</a></div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No stores yet. Enter a ZIP/city and click Search.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {alert && <div className="toast">{alert}</div>}
    </div>
  );
};

export default App;
