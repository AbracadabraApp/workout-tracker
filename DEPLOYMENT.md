# Deployment Instructions - Fixed Gains App

## What Was Fixed

### 1. ✅ GitHub Sync Integration
- Data now saves to GitHub repo (never lost again!)
- Saves locally first (instant), then syncs in background
- Offline queueing with automatic retry
- Settings page for token management

### 2. ✅ Simultaneous Timer Bug Fix
- **OLD BUG**: Could start multiple timers at once (e.g., Exercise 1 Set 1 and Exercise 2 Set 1 both running)
- **FIX**: Only one timer can run at a time across entire workout
- All other "Go" buttons show "Wait..." when a timer is active
- Buttons re-enable when timer stops

### 3. ✅ Manual Start After Rest (Already Working)
- Rest overlay closes when timer ends
- User must manually click "Go" to start next set
- No auto-start

### 4. ✅ All Features Preserved
- Combined TUT progression algorithm
- Flagged progression (pending badges)
- Unilateral exercise support (Single-Arm Row)
- 5-second countdown with beeps
- Metrics tracking (rolling 4 weeks)
- History with inline editing
- Restart exercise functionality

## Files to Upload

You need to upload **6 files** to your GitHub repo:

1. **index.html** (this is the new fixed version)
2. **workout-data.json** (your workout history)
3. **github.js** (GitHub API client)
4. **tokenStorage.js** (token management)
5. **workoutData.js** (sync logic)
6. **settings.html** (settings page)

## Step-by-Step Deployment

### Step 1: Upload Files to GitHub

1. Go to: https://github.com/AbracadabraApp/workout-tracker
2. Click "Add file" → "Upload files"
3. Drag all 6 files into the upload area
4. Commit message: `Add GitHub sync + fix simultaneous timer bug`
5. Click "Commit changes"

### Step 2: Wait for GitHub Pages

- GitHub Pages will rebuild automatically (~30 seconds)
- Your app will be live at: https://abracadabraapp.github.io/workout-tracker/

### Step 3: Create GitHub Token

1. Go to: https://github.com/settings/tokens?type=beta
2. Click "Generate new token" (fine-grained)
3. Name: `Gains Workout Tracker`
4. Expiration: 90 days
5. Repository access: Only select `AbracadabraApp/workout-tracker`
6. Permissions:
   - Repository permissions → **Contents** → **Read and write**
7. Click "Generate token"
8. **COPY THE TOKEN** (starts with `github_pat_` or `ghp_`)

### Step 4: Configure in App

1. Open: https://abracadabraapp.github.io/workout-tracker/settings.html
2. Paste your token
3. Click "Save Token"
4. Click "Test Connection" → should say "✓ Token is valid"

### Step 5: Test Everything

**Test the simultaneous timer fix:**
1. Go to Workout A
2. Enter weight for Exercise 1
3. Click "Go" on Exercise 1 Set 1
4. Timer starts counting
5. Try clicking "Go" on Exercise 2 Set 1
6. ✅ Should say "Wait..." and be disabled

**Test GitHub sync:**
1. Complete an exercise
2. Go to: https://github.com/AbracadabraApp/workout-tracker/blob/main/workout-data.json
3. ✅ Should see your new workout data in the file

**Test data recovery:**
1. Clear browser data (Settings → Safari → Clear History and Website Data)
2. Reload app
3. Go to Settings
4. Re-enter your token
5. ✅ All your workout history should load from GitHub

## How the Timer Lock Works

```javascript
// When ANY timer starts:
- Disable all other "Go" buttons
- Change their text to "Wait..."

// When that timer stops:
- Re-enable all valid "Go" buttons
- Restore text to "Go" or "Enter Weight"

// Check performed:
- Object.keys(timers).length > 0 → timer is active
```

## Troubleshooting

### "Token is invalid or lacks write access"
- Regenerate token with **Contents: Read & Write** permission
- Make sure you selected the correct repository

### Buttons still not locking
- Check browser console for errors (F12 → Console tab)
- Make sure index.html uploaded correctly

### Data not syncing
- Check Settings page sync status
- Click "Test Connection" to verify token
- Check internet connection

### iOS cleared my data
- Just re-enter your token in Settings
- Data loads automatically from GitHub

## What Happens Next

Every time you complete an exercise:
1. Saves to localStorage immediately (instant)
2. Commits to GitHub in background
3. If offline/fails → queues for retry
4. Settings page shows sync status

Your workout data is now permanently safe in GitHub! 🎉

## Questions?

- Simultaneous timer bug: Should only allow ONE active timer
- GitHub sync: Check Settings page for status
- Token expired: Generate a new one (90 days later)
