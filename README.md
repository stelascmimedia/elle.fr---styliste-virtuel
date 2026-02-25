<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1DtGQEcmRxuk_NOPe81f5dSamFeboqZAM

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
   - Optional (recommended for cost tracking by environment):
     - `GEMINI_API_KEY_DEV=...`
     - `GEMINI_API_KEY_PROD=...`
     - `GEMINI_KEY_ALIAS=dev` (or `prod`)
   - Resolution order:
     - dev mode: `GEMINI_API_KEY_DEV` -> `GEMINI_API_KEY`
     - production mode: `GEMINI_API_KEY_PROD` -> `GEMINI_API_KEY`
3. Set TradeDoubler variables in `.env.local`:
   - `TD_TOKEN=...`
   - `TD_FID=...` (single feed) or `TD_FIDS=fid1,fid2,fid3` (multi-feed)
   - Optional: `TD_PAGE_SIZE=100`
   - Optional: `TD_MAX_PAGES=10`
   - Optional: `TD_START_PAGE=1`
   - Optional (targeted mode): `TD_TARGET_PAGE_SIZE=100`
   - Optional (targeted mode): `TD_TARGET_MAX_PAGES=3`
4. Default fallback catalog source used by the app: `catalogue/catalogue.json`
5. Run the app:
   `npm run dev`
