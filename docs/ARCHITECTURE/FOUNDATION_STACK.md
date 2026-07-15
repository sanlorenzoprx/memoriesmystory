# Foundation Stack

**Status:** Approved technical starting point from the supplied foundation note

Memories: My Story is a Cloudflare-first web application. It is not an Android application. This stack is the approved starting point for the fresh repository.

| Concern | Foundation choice |
| --- | --- |
| Frontend/full-stack framework | React Router v8 + React + TypeScript + Vite |
| Runtime | Cloudflare Workers |
| Application API | React Router actions/loaders; Hono only for isolated services where it adds demonstrated value |
| Structured data | Cloudflare D1 |
| Original and derived media | Cloudflare R2 |
| Live Memory Circle room state | Cloudflare Durable Objects |
| Background processing | Cloudflare Queues + Workflows |
| Remote video | WebRTC through Cloudflare Realtime/SFU |
| Initial transcription | Cloudflare Workers AI Whisper-class transcription with a higher-quality fallback boundary |
| Qualified on-device transcription | Transformers.js / ONNX Runtime Web or equivalent, after device qualification |
| Image processing | Browser camera APIs + OpenCV.js/Wasm where useful; Cloudflare Images for delivery variants |
| Search | D1 metadata first; Vectorize later if semantic archive retrieval proves valuable |
| Localization | BCP 47 profiles, message catalogs, language detection, and right-to-left-ready layout |
| Installable experience | Progressive Web App |

## Constraint

This stack is subordinate to the Product Invariants. A technology choice that risks original preservation, attribution, accessibility, truthful save status, or archive portability must be changed even if it is otherwise convenient.
