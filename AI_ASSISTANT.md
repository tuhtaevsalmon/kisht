# Kisht assistant

The assistant explains the current field and proposes inputs. The existing NASA/FAO calculation remains the source of simulation results. Validated simulation crops are spring wheat, maize and potato (FAO-56 Table 11 profiles, not local cultivars). Other crops may be discussed in general terms only.

## Use

Open **Помощник / Assistant**, type a question or attach a soil/laboratory-result photo. General sowing/water/soil questions get an immediate answer without requiring a mapped field. The selected field (including whether the boundary is saved), model assumptions, available NASA summary, forecast and selected-day risks accompany the request. A photo stays attached for follow-up questions until removed. Conversation and images are held in page memory; closing the drawer preserves the conversation, refreshing the page starts a new one.

An answer may propose:
- **Compare with NASA**: opens the existing seasonal planner for the proposed dates. It fetches all three historical years and calculates irrigation. Apply the resulting plan from Recommendations to replay it in 3D.
- **Apply inputs**: displays proposed sowing date, soil assumption, irrigation method or weekly water limit. Explicit application updates these inputs and reloads real sources. Existing dated irrigation events remain dated; the assistant cannot invent a water calendar. The previous inputs can be restored.

The application rejects unsupported action fields, impossible dates and stale proposals after the field changes. A source-data or irrigation-calendar object from the model is never applied.

## Server configuration

Production values belong in Sites runtime secrets, never the frontend or hosting manifest. Local development uses ignored `.env.local`.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Required primary Google credential; secret |
| `GEMINI_MODELS` | Ordered comma-separated compatible model names; default `gemini-3.5-flash-lite,gemini-3.5-flash`. New Gemini keys often cannot call 2.5 models. |
| `OPENROUTER_API_KEY` | Optional independent provider credential; secret |
| `OPENROUTER_MODEL` | Explicit compatible backup model ID; configure with its credential |

The UI never receives keys. Both default Gemini models were returned by the configured account's models endpoint at setup. Available models and quotas can change. A second Google model may share exhausted project quotas; independent fallback needs a configured second provider with available capacity. Use a text-and-image model when enabling photo fallback. Provider-level billing limits must be configured in the provider account; bounded request sizes/retries are not a monetary spending cap.

The Worker returns one completed validated answer rather than splicing text from two providers. It reports which model answered and whether routing changed. Errors preserve the browser's draft/history and permit a retry. Refusals are not bypassed by switching models.

## Scientific limits

Photos provide tentative visual observations, not measured soil texture, pH, nutrients or available-water capacity. The assistant asks for simple texture observations or laboratory values where needed. Soil selection remains a user-reviewed assumption. Historical sowing comparisons are not future-season forecasts. Mortality and yield are not calculated.

## Verification

`npm test` covers proposal validation, stale-field checks, model fallback, request/image validation and the existing numerical model. `npm run build` builds the client and Worker. Keep production access private unless explicitly changing the audience and reviewing its API access/rate controls.

Official references: [Gemini images](https://ai.google.dev/gemini-api/docs/image-understanding), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [quotas](https://ai.google.dev/gemini-api/docs/rate-limits), [NRCS texture by feel](https://www.nrcs.usda.gov/sites/default/files/2023-12/Guide_to_Texture_by_Feel.pdf).
