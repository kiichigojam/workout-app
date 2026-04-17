import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type AuthMode = 'idle' | 'signup' | 'login'
type QuantityMode = 'servings' | 'grams'

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

type NutritionDay = {
  consumedOn: string
  totalCalories: number
  entries: NutritionEntry[]
}

type WorkoutEntry = {
  id: string
  habitId: string
  habitTitle: string
  checkinDate: string
  createdAt: string
}

type WorkoutDay = {
  date: string
  totalWorkouts: number
  workouts: WorkoutEntry[]
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
  const [nutritionHistory, setNutritionHistory] = useState<NutritionDay[]>([])
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutDay[]>([])
  const [nutritionQuery, setNutritionQuery] = useState('banana')
  const [nutritionDate, setNutritionDate] = useState(today)
  const [servingsDrafts, setServingsDrafts] = useState<Record<string, string>>({})
  const [quantityModes, setQuantityModes] = useState<Record<string, QuantityMode>>({})
  const [activity, setActivity] = useState<string[]>(['Frontend booting...'])
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' })
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [habitForm, setHabitForm] = useState({ title: '', notes: '' })
  const [manualEntryForm, setManualEntryForm] = useState({
    id: '',
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
      setNutritionHistory([])
      setWorkoutHistory([])
      setQuantityModes({})
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
    await Promise.allSettled([
      loadCurrentUser(),
      loadHabits(),
      loadNutritionEntries(nutritionDate),
      loadNutritionHistory(),
      loadWorkoutHistory(),
    ])
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

  async function loadNutritionHistory() {
    if (!token) {
      return
    }

    try {
      const response = await api<NutritionDay[]>('/nutrition/entries/grouped?days=7')
      setNutritionHistory(response)
    } catch (error) {
      log(`Loading grouped calorie history failed: ${getErrorMessage(error)}`)
    }
  }

  async function loadWorkoutHistory() {
    if (!token) {
      return
    }

    try {
      const response = await api<WorkoutDay[]>('/habits/checkins/grouped?days=7')
      setWorkoutHistory(response)
    } catch (error) {
      log(`Loading grouped workout history failed: ${getErrorMessage(error)}`)
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
      setQuantityModes(
        Object.fromEntries(results.map((result) => [resultKey(result), defaultQuantityMode(result)]))
      )
      setServingsDrafts(
        Object.fromEntries(results.map((result) => [resultKey(result), defaultQuantityAmount(result)]))
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
    const mode = quantityModes[key] ?? defaultQuantityMode(result)
    const amount = Number.parseFloat(servingsDrafts[key] ?? defaultQuantityAmount(result))
    if (Number.isNaN(amount) || amount <= 0) {
      log(mode === 'grams' ? 'Grams must be greater than 0.' : 'Servings must be greater than 0.')
      return
    }

    const servings = quantityToServings(result, amount, mode)

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
        mode === 'grams'
          ? `Logged ${amount.toFixed(0)} g of ${result.description}.`
          : `Logged ${servings.toFixed(2)} serving(s) of ${result.description}.`,
      )
      await loadNutritionEntries(nutritionDate)
      await loadNutritionHistory()
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
      await api(manualEntryForm.id ? `/nutrition/entries/${manualEntryForm.id}` : '/nutrition/entries', {
        method: manualEntryForm.id ? 'PATCH' : 'POST',
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
      log(
        `${manualEntryForm.id ? 'Updated' : 'Logged'} custom entry "${manualEntryForm.foodName}" for ${formatNumber(calories * servings)} calories.`,
      )
      setManualEntryForm({ id: '', foodName: '', calories: '', servings: '1' })
      await loadNutritionEntries(nutritionDate)
      await loadNutritionHistory()
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
      await loadNutritionHistory()
    } catch (error) {
      log(`Deleting calorie entry failed: ${getErrorMessage(error)}`)
    } finally {
      setEntryActionKey('')
    }
  }

  async function handleDeleteNutritionDay(date: string) {
    setEntryActionKey(`day-${date}`)
    try {
      await api(`/nutrition/entries?date=${encodeURIComponent(date)}`, { method: 'DELETE' })
      log(`Deleted calorie entries for ${date}.`)
      await loadNutritionEntries(nutritionDate)
      await loadNutritionHistory()
    } catch (error) {
      log(`Deleting calorie day failed: ${getErrorMessage(error)}`)
    } finally {
      setEntryActionKey('')
    }
  }

  function handleQuantityModeChange(result: NutritionResult, nextMode: QuantityMode) {
    const key = resultKey(result)
    const currentMode = quantityModes[key] ?? defaultQuantityMode(result)
    const currentAmount = Number.parseFloat(servingsDrafts[key] ?? defaultQuantityAmount(result))

    setQuantityModes((current) => ({
      ...current,
      [key]: nextMode,
    }))

    if (Number.isNaN(currentAmount) || currentMode === nextMode) {
      setServingsDrafts((current) => ({
        ...current,
        [key]: defaultQuantityAmountForMode(nextMode),
      }))
      return
    }

    const nextAmount = convertQuantityAmount(result, currentAmount, currentMode, nextMode)
    setServingsDrafts((current) => ({
      ...current,
      [key]: formatDraftAmount(nextAmount, nextMode),
    }))
  }

  function loadEntryIntoEditor(entry: NutritionEntry) {
    setNutritionDate(entry.consumedOn)
    setManualEntryForm({
      id: entry.id,
      foodName: entry.foodName,
      calories: `${entry.servings ? entry.calories / entry.servings : entry.calories}`,
      servings: `${entry.servings}`,
    })
    log(`Loaded ${entry.foodName} into the calorie editor.`)
  }

  function handleLogout() {
    persistToken('')
    setCurrentUser(null)
    setHabits([])
    setNutritionResults([])
    setNutritionEntries([])
    setDailyCalories(0)
    setNutritionHistory([])
    setWorkoutHistory([])
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
            <h2>Daily Nutrition Groups</h2>
            <button className="ghost-button" type="button" onClick={() => void loadNutritionHistory()}>
              Refresh
            </button>
          </div>
          <div className="list-grid">
            {!token && <article className="empty-state">Sign in to see nutrition grouped by day.</article>}
            {token && nutritionHistory.length === 0 && (
              <article className="empty-state">No grouped calorie history yet.</article>
            )}
            {nutritionHistory.map((day) => (
              <article key={day.consumedOn} className="card list-card">
                <div className="panel-header">
                  <h3>{day.consumedOn}</h3>
                  <span className="pill ok">{formatNumber(day.totalCalories)} cal</span>
                </div>
                <div className="meta-row">{day.entries.length} entr{day.entries.length === 1 ? 'y' : 'ies'}</div>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void handleDeleteNutritionDay(day.consumedOn)}
                  disabled={entryActionKey === `day-${day.consumedOn}`}
                >
                  {entryActionKey === `day-${day.consumedOn}` ? 'Deleting day...' : 'Delete day'}
                </button>
                <div className="group-list">
                  {day.entries.map((entry) => (
                    <div key={entry.id} className="group-item">
                      <strong>{entry.foodName}</strong>
                      <div className="group-actions">
                        <span>{formatNumber(entry.calories)} cal</span>
                        <button className="ghost-button" type="button" onClick={() => loadEntryIntoEditor(entry)}>
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Daily Workout Groups</h2>
            <button className="ghost-button" type="button" onClick={() => void loadWorkoutHistory()}>
              Refresh
            </button>
          </div>
          <div className="list-grid">
            {!token && <article className="empty-state">Sign in to see workouts grouped by day.</article>}
            {token && workoutHistory.length === 0 && (
              <article className="empty-state">No workouts grouped by day yet. Add habit check-ins first.</article>
            )}
            {workoutHistory.map((day) => (
              <article key={day.date} className="card list-card">
                <div className="panel-header">
                  <h3>{day.date}</h3>
                  <span className="pill ok">{day.totalWorkouts} workout{day.totalWorkouts === 1 ? '' : 's'}</span>
                </div>
                <div className="group-list">
                  {day.workouts.map((workout) => (
                    <div key={workout.id} className="group-item">
                      <strong>{workout.habitTitle}</strong>
                      <span>{new Date(workout.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
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
              const mode = quantityModes[key] ?? defaultQuantityMode(result)
              const amount = servingsDrafts[key] ?? defaultQuantityAmount(result)
              const disabled = result.calories == null || entryActionKey === key
              const amountValue = Number.parseFloat(amount) || 0
              const projectedCalories = result.calories == null
                ? null
                : result.calories * quantityToServings(result, amountValue, mode)
              const supportsGramMode = canUseGramMode(result)
              const gramsPerServing = getGramsPerServing(result)

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
                  <div className="meta-row">Serving: {formatServing(result.servingSize, result.servingSizeUnit, result.dataType)}</div>
                  <div className="meta-row">FDC ID: {result.fdcId ?? 'n/a'}</div>
                  {supportsGramMode && (
                    <div className="meta-row">1 serving = {formatServing(gramsPerServing, 'g')}</div>
                  )}
                  {result.caloriesBasis === 'per_100g' && (
                    <div className="meta-row">USDA did not provide a serving size, so this result is handled as grams.</div>
                  )}
                  <div className="entry-controls">
                    {supportsGramMode && (
                      <label>
                        <span>Input mode</span>
                        <select
                          value={mode}
                          onChange={(event) => handleQuantityModeChange(result, event.target.value as QuantityMode)}
                        >
                          <option value="servings">Servings</option>
                          <option value="grams">Grams</option>
                        </select>
                      </label>
                    )}
                    <label>
                      <span>{mode === 'grams' ? 'Grams' : 'Servings'}</span>
                      <input
                        type="number"
                        min={mode === 'grams' ? '1' : '0.25'}
                        step={mode === 'grams' ? '1' : '0.25'}
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
              {entryActionKey === 'manual' ? (manualEntryForm.id ? 'Saving...' : 'Adding...') : (manualEntryForm.id ? 'Save edit' : 'Add custom calories')}
            </button>
            {manualEntryForm.id && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setManualEntryForm({ id: '', foodName: '', calories: '', servings: '1' })}
              >
                Cancel edit
              </button>
            )}
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

function formatServing(size: number | null, unit: string | null, dataType?: string | null) {
  if (size == null && !unit && dataType === 'SR Legacy') {
    return '100.0 g'
  }
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
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function resultKey(result: NutritionResult) {
  return `${result.fdcId ?? 'na'}-${result.description}`
}

function defaultQuantityMode(result: NutritionResult): QuantityMode {
  return result.caloriesBasis === 'per_100g' ? 'grams' : 'servings'
}

function defaultQuantityAmount(result: NutritionResult) {
  return defaultQuantityMode(result) === 'grams' ? '100' : '1'
}

function defaultQuantityAmountForMode(mode: QuantityMode) {
  return mode === 'grams' ? '100' : '1'
}

function canUseGramMode(result: NutritionResult) {
  return result.caloriesBasis === 'per_100g' || getGramsPerServing(result) != null
}

function getGramsPerServing(result: NutritionResult) {
  if (result.caloriesBasis === 'per_100g') {
    return 100
  }
  return result.servingSize != null && result.servingSizeUnit?.toLowerCase() === 'g'
    ? result.servingSize
    : null
}

function quantityToServings(result: NutritionResult, amount: number, mode: QuantityMode) {
  if (mode === 'grams') {
    if (result.caloriesBasis === 'per_100g') {
      return amount / 100
    }
    const gramsPerServing = getGramsPerServing(result)
    return gramsPerServing ? amount / gramsPerServing : amount
  }
  return amount
}

function convertQuantityAmount(
  result: NutritionResult,
  amount: number,
  currentMode: QuantityMode,
  nextMode: QuantityMode,
) {
  if (currentMode === nextMode) {
    return amount
  }

  if (currentMode === 'servings' && nextMode === 'grams') {
    if (result.caloriesBasis === 'per_100g') {
      return amount * 100
    }
    const gramsPerServing = getGramsPerServing(result)
    return gramsPerServing ? amount * gramsPerServing : amount
  }

  if (currentMode === 'grams' && nextMode === 'servings') {
    if (result.caloriesBasis === 'per_100g') {
      return amount / 100
    }
    const gramsPerServing = getGramsPerServing(result)
    return gramsPerServing ? amount / gramsPerServing : amount
  }

  return amount
}

function formatDraftAmount(amount: number, mode: QuantityMode) {
  if (mode === 'grams') {
    return `${Math.round(amount)}`
  }
  return amount.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0$/, '$1')
}

export default App
