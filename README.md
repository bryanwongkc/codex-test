# Helper Planner PWA (iOS + Android)

A Progressive Web App for shared household coordination between you and your helper.

## What this version now includes

- **Real-time shared task checklist** (Firestore listeners)
- **Real-time shared grocery/things-to-buy checklist**
- **Shared weekly meal plan** by weekday
- **User authentication** (email/password)
- **Household ID scoping** so you and your helper use the same shared workspace
- **PWA installability** (manifest + service worker shell cache)

## Run locally

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Firebase setup (required for shared real-time)

1. Create a Firebase project.
2. Enable **Authentication > Email/Password**.
3. Enable **Cloud Firestore**.
4. In `app.js`, replace the placeholder `firebaseConfig` values.
5. Start the app and sign up/log in as owner + helper.
6. Use the same **Household ID** on both phones.

If you leave placeholders unchanged, the app runs in local-only fallback mode for basic offline usage.

## Suggested Firestore structure

- `households/{householdId}/tasks/{taskId}`
- `households/{householdId}/groceries/{groceryId}`
- `households/{householdId}/meta/meals`

## Basic Firestore security rules starter

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{householdId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Harden further with membership checks before production use.
