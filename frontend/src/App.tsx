import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type AuthMode = 'idle' | 'signup' | 'login'

type User = {
  id: string
  email: string
  name: string
  createdAt: string
}

type Habit = {
  id: string
  title: string
  notes: string | null
  isActive: boolean
  createdAt: string
}

type NutritionResult = {
  fdcId: number | null
  description: string
  brandName: string | null
  dataType: string | null
  calories: number | null
  servingSize: number | null
  servingSizeUnit: string | null
  caloriesBasis: 'per_serving' | 'per_100g'
}

type NutritionEntry = {
  id: string
  foodName: string
  brandName: string | null
  fdcId: number | null
  consumedOn: string
  servings: number
  calories: number
  servingSize: number | null
  servingSizeUnit: string | null
  createdAt: string
}

type NutritionEntriesResponse = {
  consumedOn: string
  totalCalories: number
  entries: NutritionEntry[]
}

type AuthResponse = {
  token: string
}

const tokenStorageKey = 'habit-api-token'

function App() {
  const today = todayIso()
  const [token, setToken] = useState(() => localStorage.getItem(tokenStorageKey) ?? '')
  const [health, setHealth] = useState<'checking' | 'healthy' | 'offline'>('checking')
  const [authMode, setAuthMode] = useState<AuthMode>('idle')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [nutritionResults, setNutritionResults] = useState<NutritionResult[]>([])
  const [nutritionEntries, setNutritionEntries] = useState<NutritionEntry[]>([])
  const [dailyCalories, setDailyCalories] = useState(0)
  const [nutritionQuery, setNutritionQuery] = useState('banana')
  const [nutritionDate, setNutritionDate] = useState(today)
  const [servingsDrafts, setServingsDrafts] = useState<Record<string, string>>({})
  const [activity, setActivity] = useState<string[]>(['Frontend booting...'])
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' })
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [habitForm, setHabitForm] = useState({ title: '', notes: '' })
  const [manualEntryForm, setManualEntryForm] = useState({
    foodName: '',
    calories: '',
    servings: '1',
  })
  const [isLoadingUser, setIsLoadingUser] = useState(false)
  const [isLoadingHabits, setIsLoadingHabits] = useState(false)
  const [isSearchingNutrition, setIsSearchingNutrition] = useState(false)
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [entryActionKey, setEntryActionKey] = useState('')

  useEffect(() => {
    void checkHealth()
  }, [])

  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      setHabits([])
      setNutritionResults([])
      setNutritionEntries([])
      setDailyCalories(0)
      return
    }

    void refreshAuthenticatedData()
  }, [token])

  useEffect(() => {
    if (!token) {
      return
    }

    void loadNutritionEntries(nutritionDate)
  }, [token, nutritionDate])

  async function checkHealth() {
    try {
      await api('/health', { auth: false })
      setHealth('healthy')
      log('Health check passed.')
    } catch (error) {
      setHealth('offline')
      log(`Health check failed: ${getErrorMessage(error)}`)
    }
  }

  async function refreshAuthenticatedData() {
    await Promise.allSettled([loadCurrentUser(), loadHabits(), loadNutritionEntries(nutritionDate)])
  }

  async function loadCurrentUser() {
    if (!token) {
      return
    }

    setIsLoadingUser(true)
    try {
      const user = await api<User>('/users/me')
      setCurrentUser(user)
      log(`Loaded profile for ${user.email}.`)
    } catch (error) {
      log(`Loading current user failed: ${getErrorMessage(error)}`)
    } finally {
      setIsLoadingUser(false)
    }
  }

  async function loadHabits() {
    if (!token) {
      return
    }

    setIsLoadingHabits(true)
    try {
      const nextHabits = await api<Habit[]>('/habits')
      setHabits(nextHabits)
      log(`Loaded ${nextHabits.length} habit${nextHabits.length === 1 ? '' : 's'}.`)
    } catch (error) {
      log(`Loading habits failed: ${getErrorMessage(error)}`)
    } finally {
      setIsLoadingHabits(false)
    }
  }

  async function loadNutritionEntries(date: string) {
    if (!token) {
      return
    }

    setIsLoadingEntries(true)
    try {
      const response = await api<NutritionEntriesResponse>(`/nutrition/entries?date=${encodeURIComponent(date)}`)
      setNutritionEntries(response.entries)
      setDailyCalories(Number(response.totalCalories ?? 0))
    } catch (error) {
      log(`Loading calorie entries failed: ${getErrorMessage(error)}`)
    } finally {
      setIsLoadingEntries(false)
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMode('signup')

    try {
      const response = await api<AuthResponse>('/auth/signup', {
        method: 'POST',
        auth: false,
        body: signupForm,
      })
      persistToken(response.token)
      setSignupForm({ name: '', email: '', password: '' })
      log(`Signed up ${signupForm.email}.`)
    } catch (error) {
      log(`Signup failed: ${getErrorMessage(error)}`)
    } finally {
      setAuthMode('idle')
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMode('login')

    try {
      const response = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: loginForm,
      })
      persistToken(response.token)
      setLoginForm({ email: '', password: '' })
      log(`Logged in ${loginForm.email}.`)
    } catch (error) {
      log(`Login failed: ${getErrorMessage(error)}`)
    } finally {
      setAuthMode('idle')
    }
  }

  async function handleCreateHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      log('Sign in before creating habits.')
      return
    }

    try {
      await api<Habit>('/habits', {
        method: 'POST',
        body: {
          title: habitForm.title,
          notes: habitForm.notes.trim() || null,
        },
      })
      setHabitForm({ title: '', notes: '' })
      log(`Created habit "${habitForm.title}".`)
      await loadHabits()
    } catch (error) {
      log(`Create habit failed: ${getErrorMessage(error)}`)
    }
  }

  async function handleDeleteHabit(habitId: string) {
    try {
      await api(`/habits/${habitId}`, { method: 'DELETE' })
      setHabits((current) => current.filter((habit) => habit.id !== habitId))
      log(`Deleted habit ${habitId}.`)
    } catch (error) {
      log(`Delete habit failed: ${getErrorMessage(error)}`)
    }
  }

  async function handleNutritionSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      log('Sign in before searching nutrition.')
      return
    }

    if (nutritionQuery.trim().length < 2) {
      log('Nutrition search requires at least 2 characters.')
      return
    }

    setIsSearchingNutrition(true)
    try {
      const results = await api<NutritionResult[]>(
        `/nutrition/search?q=${encodeURIComponent(nutritionQuery.trim())}`,
      )
      setNutritionResults(results)
      setServingsDrafts(
        Object.fromEntries(results.map((result) => [resultKey(result), result.caloriesBasis === 'per_100g' ? '100' : '1']))
      )
      log(`Loaded ${results.length} nutrition result${results.length === 1 ? '' : 's'} for "${nutritionQuery}".`)
    } catch (error) {
      log(`Nutrition search failed: ${getErrorMessage(error)}`)
    } finally {
      setIsSearchingNutrition(false)
    }
  }

  async function handleAddNutritionEntry(result: NutritionResult) {
    if (!token) {
      log('Sign in before logging calories.')
      return
    }
    if (result.calories == null) {
      log(`Cannot log ${result.description} because USDA did not return calories.`)
      return
    }

    const key = resultKey(result)
    const amount = Number.parseFloat(servingsDrafts[key] ?? '1')
    if (Number.isNaN(amount) || amount <= 0) {
      log(result.caloriesBasis === 'per_100g' ? 'Grams must be greater than 0.' : 'Servings must be greater than 0.')
      return
    }

    const servings = result.caloriesBasis === 'per_100g' ? amount / 100 : amount

    setEntryActionKey(key)
    try {
      await api('/nutrition/entries', {
        method: 'POST',
        body: {
          foodName: result.description,
          brandName: result.brandName,
          fdcId: result.fdcId,
          consumedOn: nutritionDate,
          servings,
          caloriesPerServing: result.calories,
          servingSize: result.servingSize,
          servingSizeUnit: result.servingSizeUnit,
        },
      })
      log(
        result.caloriesBasis === 'per_100g'
          ? `Logged ${amount.toFixed(0)} g of ${result.description}.`
          : `Logged ${servings.toFixed(2)} serving(s) of ${result.description}.`,
      )
      await loadNutritionEntries(nutritionDate)
    } catch (error) {
      log(`Adding calorie entry failed: ${getErrorMessage(error)}`)
    } finally {
      setEntryActionKey('')
    }
  }

  async function handleManualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      log('Sign in before logging calories.')
      return
    }

    const calories = Number.parseFloat(manualEntryForm.calories)
    const servings = Number.parseFloat(manualEntryForm.servings)
    if (Number.isNaN(calories) || calories <= 0) {
      log('Manual calorie entry requires calories greater than 0.')
      return
    }
    if (Number.isNaN(servings) || servings <= 0) {
      log('Manual calorie entry requires servings greater than 0.')
      return
    }

    setEntryActionKey('manual')
    try {
      await api('/nutrition/entries', {
        method: 'POST',
        body: {
          foodName: manualEntryForm.foodName.trim(),
          brandName: null,
          fdcId: null,
          consumedOn: nutritionDate,
          servings,
          caloriesPerServing: calories,
          servingSize: null,
          servingSizeUnit: null,
        },
      })
      log(`Logged custom entry "${manualEntryForm.foodName}" for ${formatNumber(calories * servings)} calories.`)
      setManualEntryForm({ foodName: '', calories: '', servings: '1' })
      await loadNutritionEntries(nutritionDate)
    } catch (error) {
      log(`Adding manual calorie entry failed: ${getErrorMessage(error)}`)
    } finally {
      setEntryActionKey('')
    }
  }

  async function handleDeleteNutritionEntry(entryId: string) {
    setEntryActionKey(entryId)
    try {
      await api(`/nutrition/entries/${entryId}`, { method: 'DELETE' })
      log(`Deleted calorie entry ${entryId}.`)
      await loadNutritionEntries(nutritionDate)
    } catch (error) {
      log(`Deleting calorie entry failed: ${getErrorMessage(error)}`)
    } finally {
      setEntryActionKey('')
    }
  }

  function handleLogout() {
    persistToken('')
    setCurrentUser(null)
    setHabits([])
    setNutritionResults([])
    setNutritionEntries([])
    setDailyCalories(0)
    log('Signed out.')
  }

  function persistToken(nextToken: string) {
    setToken(nextToken)
    if (nextToken) {
      localStorage.setItem(tokenStorageKey, nextToken)
    } else {
      localStorage.removeItem(tokenStorageKey)
    }
  }

  function log(message: string) {
    const stamp = new Date().toLocaleTimeString()
    setActivity((current) => [`[${stamp}] ${message}`, ...current].slice(0, 14))
  }

  async function api<T>(path: string, options?: { method?: string; body?: unknown; auth?: boolean }) {
    const response = await fetch(path, {
      method: options?.method ?? 'GET',
      headers: {
        ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.auth === false || !token ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      if (response.status === 401) {
        persistToken('')
      }
      throw new Error(await extractError(response))
    }

    if (response.status === 204) {
      return null as T
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return (await response.text()) as T
    }

    return (await response.json()) as T
  }

  async function extractError(response: Response) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = await response.json()
      if (typeof payload?.message === 'string') {
        return payload.message
      }
      return JSON.stringify(payload)
    }
    return (await response.text()) || `${response.status} ${response.statusText}`
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Habit API Frontend</p>
          <h1>React frontend for habits and calorie tracking.</h1>
          <p className="lede">
            Search USDA foods, log servings to a specific day, and keep a running calorie total without leaving the app.
          </p>
        </div>

        <div className="hero-metrics">
          <article className="metric-card">
            <span>API</span>
            <strong className={health === 'healthy' ? 'ok' : health === 'offline' ? 'danger' : ''}>
              {health === 'checking' ? 'Checking...' : health === 'healthy' ? 'Healthy' : 'Offline'}
            </strong>
          </article>
          <article className="metric-card">
            <span>Auth</span>
            <strong className={token ? 'ok' : ''}>{token ? 'Signed in' : 'Signed out'}</strong>
          </article>
          <article className="metric-card">
            <span>Calories for {nutritionDate}</span>
            <strong className="ok">{formatNumber(dailyCalories)}</strong>
          </article>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel">
          <div className="panel-header">
            <h2>Account</h2>
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>

          <div className="form-grid">
            <form className="card form-card" onSubmit={handleSignup}>
              <h3>Create account</h3>
              <label>
                <span>Name</span>
                <input
                  value={signupForm.name}
                  onChange={(event) => setSignupForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Demo User"
                  required
                />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={signupForm.email}
                  onChange={(event) => setSignupForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="demo@example.com"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  minLength={8}
                  value={signupForm.password}
                  onChange={(event) => setSignupForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </label>
              <button type="submit" disabled={authMode !== 'idle'}>
                {authMode === 'signup' ? 'Signing up...' : 'Sign up'}
              </button>
            </form>

            <form className="card form-card" onSubmit={handleLogin}>
              <h3>Log in</h3>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="demo@example.com"
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </label>
              <button type="submit" disabled={authMode !== 'idle'}>
                {authMode === 'login' ? 'Logging in...' : 'Log in'}
              </button>
            </form>
          </div>

          <article className="card console-card">
            <div className="panel-header">
              <h3>Current user</h3>
              <button className="ghost-button" type="button" onClick={() => void loadCurrentUser()} disabled={isLoadingUser}>
                {isLoadingUser ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <pre>{currentUser ? JSON.stringify(currentUser, null, 2) : 'Sign in to load profile.'}</pre>
          </article>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Habits</h2>
            <button className="ghost-button" type="button" onClick={() => void loadHabits()} disabled={isLoadingHabits}>
              {isLoadingHabits ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <form className="card form-card inline-form" onSubmit={handleCreateHabit}>
            <label>
              <span>Title</span>
              <input
                value={habitForm.title}
                onChange={(event) => setHabitForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Workout"
                required
              />
            </label>
            <label>
              <span>Notes</span>
              <input
                value={habitForm.notes}
                onChange={(event) => setHabitForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Upper body on Mondays"
              />
            </label>
            <button type="submit">Create habit</button>
          </form>

          <div className="list-grid">
            {!token && <article className="empty-state">Sign in to load habits.</article>}
            {token && habits.length === 0 && <article className="empty-state">No habits yet. Create the first one.</article>}
            {habits.map((habit) => (
              <article key={habit.id} className="card list-card">
                <div className="panel-header">
                  <h3>{habit.title}</h3>
                  <span className={habit.isActive ? 'pill ok' : 'pill'}>{habit.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <p>{habit.notes || 'No notes'}</p>
                <div className="meta-row">Created: {new Date(habit.createdAt).toLocaleString()}</div>
                <button className="danger-button" type="button" onClick={() => void handleDeleteHabit(habit.id)}>
                  Delete habit
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Nutrition Search</h2>
            <label className="date-control">
              <span>Tracking date</span>
              <input type="date" value={nutritionDate} onChange={(event) => setNutritionDate(event.target.value)} />
            </label>
          </div>

          <form className="card form-card inline-form nutrition-form" onSubmit={handleNutritionSearch}>
            <label className="wide">
              <span>Food query</span>
              <input
                value={nutritionQuery}
                onChange={(event) => setNutritionQuery(event.target.value)}
                placeholder="banana"
                minLength={2}
                required
              />
            </label>
            <button type="submit" disabled={isSearchingNutrition}>
              {isSearchingNutrition ? 'Searching...' : 'Find calories'}
            </button>
          </form>

          <div className="list-grid">
            {!token && <article className="empty-state">Sign in before searching nutrition.</article>}
            {token && nutritionResults.length === 0 && (
              <article className="empty-state">Run a food search to see calories, serving size, and USDA IDs.</article>
            )}
            {nutritionResults.map((result) => {
              const key = resultKey(result)
              const amount = servingsDrafts[key] ?? (result.caloriesBasis === 'per_100g' ? '100' : '1')
              const disabled = result.calories == null || entryActionKey === key
              const amountValue = Number.parseFloat(amount) || 0
              const projectedCalories = result.calories == null
                ? null
                : result.caloriesBasis === 'per_100g'
                  ? result.calories * (amountValue / 100)
                  : result.calories * amountValue

              return (
                <article key={key} className="card list-card">
                  <div className="panel-header">
                    <h3>{result.description}</h3>
                    <span className="pill">{result.dataType || 'Unknown'}</span>
                  </div>
                  <div className="meta-row">Brand: {result.brandName || 'n/a'}</div>
                  <div className="meta-row">
                    Calories {result.caloriesBasis === 'per_100g' ? 'per 100 g' : 'per serving'}: {formatNumber(result.calories)}
                  </div>
                  <div className="meta-row">Serving: {formatServing(result.servingSize, result.servingSizeUnit)}</div>
                  <div className="meta-row">FDC ID: {result.fdcId ?? 'n/a'}</div>
                  {result.caloriesBasis === 'per_100g' && (
                    <div className="meta-row">USDA did not provide a serving size, so this result is handled as grams.</div>
                  )}
                  <div className="entry-controls">
                    <label>
                      <span>{result.caloriesBasis === 'per_100g' ? 'Grams' : 'Servings'}</span>
                      <input
                        type="number"
                        min={result.caloriesBasis === 'per_100g' ? '1' : '0.25'}
                        step={result.caloriesBasis === 'per_100g' ? '1' : '0.25'}
                        value={amount}
                        onChange={(event) =>
                          setServingsDrafts((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="meta-row">Entry calories: {formatNumber(projectedCalories)}</div>
                    <button type="button" disabled={disabled} onClick={() => void handleAddNutritionEntry(result)}>
                      {entryActionKey === key ? 'Adding...' : 'Add to log'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Calorie Log</h2>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void loadNutritionEntries(nutritionDate)}
              disabled={isLoadingEntries}
            >
              {isLoadingEntries ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <form className="card form-card inline-form" onSubmit={handleManualEntry}>
            <label>
              <span>Food name</span>
              <input
                value={manualEntryForm.foodName}
                onChange={(event) => setManualEntryForm((current) => ({ ...current, foodName: event.target.value }))}
                placeholder="Homemade smoothie"
                required
              />
            </label>
            <label>
              <span>Calories per serving</span>
              <input
                type="number"
                min="1"
                step="1"
                value={manualEntryForm.calories}
                onChange={(event) => setManualEntryForm((current) => ({ ...current, calories: event.target.value }))}
                placeholder="450"
                required
              />
            </label>
            <label>
              <span>Servings</span>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={manualEntryForm.servings}
                onChange={(event) => setManualEntryForm((current) => ({ ...current, servings: event.target.value }))}
                required
              />
            </label>
            <button type="submit" disabled={entryActionKey === 'manual'}>
              {entryActionKey === 'manual' ? 'Adding...' : 'Add custom calories'}
            </button>
          </form>
          <div className="card log-summary">
            <strong>{formatNumber(dailyCalories)} calories</strong>
            <span>{nutritionEntries.length} entr{nutritionEntries.length === 1 ? 'y' : 'ies'} on {nutritionDate}</span>
          </div>
          <div className="list-grid">
            {!token && <article className="empty-state">Sign in before tracking calories.</article>}
            {token && nutritionEntries.length === 0 && (
              <article className="empty-state">No calorie entries yet for this date. Add one from the search results.</article>
            )}
            {nutritionEntries.map((entry) => (
              <article key={entry.id} className="card list-card">
                <div className="panel-header">
                  <h3>{entry.foodName}</h3>
                  <span className="pill ok">{formatNumber(entry.calories)} cal</span>
                </div>
                <div className="meta-row">Brand: {entry.brandName || 'n/a'}</div>
                <div className="meta-row">Servings: {formatNumber(entry.servings)}</div>
                <div className="meta-row">Serving size: {formatServing(entry.servingSize, entry.servingSizeUnit)}</div>
                <div className="meta-row">Logged: {new Date(entry.createdAt).toLocaleString()}</div>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void handleDeleteNutritionEntry(entry.id)}
                  disabled={entryActionKey === entry.id}
                >
                  {entryActionKey === entry.id ? 'Deleting...' : 'Delete entry'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Activity</h2>
            <button className="ghost-button" type="button" onClick={() => setActivity([])}>
              Clear
            </button>
          </div>
          <article className="card console-card">
            <pre>{activity.join('\n') || 'No activity yet.'}</pre>
          </article>
        </section>
      </main>
    </div>
  )
}

function formatNumber(value: number | null) {
  return value == null || Number.isNaN(value) ? 'n/a' : value.toFixed(1)
}

function formatServing(size: number | null, unit: string | null) {
  if (size == null && !unit) {
    return 'n/a'
  }
  if (size == null) {
    return unit
  }
  return `${size.toFixed(1)} ${unit ?? ''}`.trim()
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function resultKey(result: NutritionResult) {
  return `${result.fdcId ?? 'na'}-${result.description}`
}

export default App
