# FitVerse: Production-Ready Checklist

This is the interactive roadmap to transition FitVerse from a local-storage prototype to a scalable, production-ready application using Supabase.

## Phase 1: Backend Architecture & Security (The Foundation)
*Before writing frontend code, we need a secure, scalable database.*

### 1. Database Schema Design (PostgreSQL)
*Migrate TypeScript interfaces (`types/user.ts`) into actual SQL tables.*
- [x] Create `profiles` table: Extends the default Supabase auth user with custom fields (name, dorm, age, goals, gym, etc.).
- [x] Create `friendships` table: A relational table for friend requests (sender_id, receiver_id, status: pending/accepted/rejected).
- [x] Create `posts`, `comments`, `likes` tables: For the social feed.
- [x] Create `messages`, `chats` tables: For real-time messaging.

### 2. Authentication & Authorization Setup
- [x] **Supabase Auth Integration**: Set up email/password authentication via Supabase Auth.
- [x] **University Email Validation**: Add a backend trigger or edge function that automatically rejects signups if the email doesn't end in `@nd.edu`.

### 3. Middleware & Security: Row Level Security (RLS)
*Use Row Level Security (RLS) directly in the database instead of traditional middleware.*
- [x] **Rule 1**: Users can only read profiles of verified users.
- [x] **Rule 2**: Users can ONLY update their own profile row.
- [x] **Rule 3**: Users can only read DMs (direct messages) where their `user_id` is a participant.

---

## Phase 2: Connecting the Backend to the App
*Replace `lib/storage.ts` entirely.*

### 1. Supabase Client Configuration
- [x] Finalize `lib/supabase.ts`. Ensure it safely uses environment variables (`.env`) for the API URL and Anon Key.
- [x] Configure `AsyncStorage` caching so users don't have to log in every time they open the app.

### 2. Context Providers & Global State
- [x] Refactor `AuthContext.tsx`: Update `signIn`, `login`, and `signOut` to call `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`, etc.
- [x] Listen for Auth State Changes: Use `supabase.auth.onAuthStateChange` to automatically redirect the user to `/(tabs)` or the Auth screen when their session expires or is initiated.

---

## Phase 3: Migrating Features to the Cloud
*Swap out the "mock" stores with real API calls.*

### 1. Profile & Social Stores
- [x] Update `SocialStore.ts`: Replace `AsyncStorage` searches with Supabase text-search queries (e.g., `supabase.from('profiles').select('*').ilike('name', '%${query}%')`).
- [x] Implement Real-time Friending: Use Supabase subscriptions to listen to the `friendships` table. When someone sends a request, the app updates instantly without pulling to refresh.

### 2. Real-time Chat
- [x] Replace any mock chat logic with Supabase Realtime channels.
- [x] Subscribe to `INSERT` events on the `messages` table so messages appear instantly on screen (like iMessage).

### 3. Image Storage (Avatars / Feed)
- [x] Set up Supabase Storage buckets for user avatars and feed pictures.
- [x] Enforce Storage RLS rules (e.g., you can only upload images less than 5MB, and only authenticated users can view/upload).

---

## Phase 4: Frontend Polish & Optimization (Productionizing)
*Focus on React Native specific production concerns.*

### 1. Navigation Restructuring
- [x] Move the `LoginScreen` and `SignupScreen` fully into the Expo Router paradigm (e.g., an `app/(auth)` folder) instead of manually toggling them in `AuthScreen.tsx`.

### 2. Pagination & Infinite Scrolling
- [x] Implement pagination for stores that currently load everything at once (e.g., fetch 10 posts, then fetch 10 more when the user scrolls to the bottom of the `FlatList`).

### 3. Caching & Offline Support
- [ ] Consider integrating React Query (`@tanstack/react-query`) or Zustand to cache data (like the leaderboard), enabling instantaneous tab switching and background refetching.

### 4. Push Notifications
- [x] Integrate Expo Notifications.
- [x] Set up a Supabase Edge Function that runs when a new chat message or friend request is inserted into the DB, pinging the Expo push server to deliver a notification to the target device.

---

## Phase 5: Testing & Deployment

### 1. Environment Management
- [ ] Set up minimum two environments in Supabase and Expo: `development` and `production`.

### 2. Error Tracking & Analytics
- [ ] Integrate a crash reporting tool like Sentry to track remote line-of-code crashes on users' phones.

### 3. EAS Build & App Store Deployment
- [ ] Implement Expo Application Services (EAS) configuration (`eas.json`).
- [ ] Build optimized production binaries (AAB for Android, IPA for iOS) and submit to TestFlight / Google Play Beta for real-world user testing.
