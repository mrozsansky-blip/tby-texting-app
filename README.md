# TBY Texting App

A Render-ready starter app for a school texting interface powered by Airtable, Textgrid, and AI.

## What is included

- Next.js app with a polished texting-style UI
- Inbox screen with family context
- Groups screen for bussing, class, grade, and smart groups
- AI compose endpoint
- AI group-suggestion endpoint
- Confirm-before-send API route
- Textgrid send adapter
- Textgrid inbound webhook route
- Airtable logging and group lookup helpers
- Render deployment blueprint
- Airtable schema guide

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Render setup

1. Push this folder to a GitHub repository.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Add the environment variables from `.env.example`.
4. Deploy.

## Important safety rule

The send route rejects any request without `confirmed: true`. The app should always preview exact recipients before sending.

## Textgrid adapter

Public search did not surface a reliable current Textgrid API reference. The app uses `TEXTGRID_SEND_URL` and `TEXTGRID_API_KEY` so the exact Textgrid endpoint can be configured from your dashboard or support-provided docs without changing the app architecture.

## AI behavior

AI can draft messages and suggest groups, but it must never send on its own. Human review is required.
