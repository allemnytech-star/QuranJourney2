# Phase 2 Tilawa integration

The npm registry lists `@tilawa/core@0.4.0` as stable and `1.0.0-rc.1` as the official preview. Phase 2 pins `1.0.0-rc.1` and `onnxruntime-web@1.30.0`. This is the first official API with the browser tracking and issue transitions this integration uses. The 0.4.0 benchmark and its NPL-1.2 weights remain historical. [SDK](https://github.com/yazinsai/tilawa) · [npm](https://www.npmjs.com/package/@tilawa/core) · [Browser support](https://github.com/yazinsai/tilawa/blob/main/docs/support.md)

| Weights | Download and cached bytes | License |
| --- | ---: | --- |
| Lite, `spliced-clean-lite@1-int8` | 24,650,054 | CC BY 4.0 |
| Full, `spliced-clean@1-int8` | 67,759,744 | CC BY 4.0 |

Both downloads matched Tilawa's published SHA-256 hashes. The SDK and ONNX Runtime are MIT. The publisher permits redistribution of these weights with attribution and notes that some training sources lack explicit license tags. The app downloads original weights on request and ships the SDK notice. [Model licenses and provenance](https://github.com/yazinsai/tilawa/blob/main/docs/model-card.md) · [Attributions](https://github.com/yazinsai/tilawa/blob/main/NOTICE.md)

## Implemented

- Settings and Tasmee share one model manager. Lite is the initial option. Each tier is prepared explicitly with byte progress, cancellation, retry, cache deletion, and memory release. The app does not initialize a model at startup.
- A user tap opens the mic. An AudioWorklet sends mono PCM in 320 ms blocks with at most four blocks queued. Tilawa resamples to 16 kHz and runs single-threaded WASM SIMD in a worker. An overrun stops capture. Stop drains submitted audio and closes tracks and the audio context. The trailing partial block is not submitted. Session disposal releases take state. Worker termination releases the inference instance on cancellation, explicit release, and exit from a Tasmee screen that recorded a take.
- Free-start uses `startFreeRecitation()`. Constrained mode uses `startMemorization()` for the complete selected range in each surah. Cross-surah selections retain both endpoints and use explicit segment selection. The app rejects positions outside the selected segment.
- Ayah and flowing Mushaf views share the take and support visible, progressive and hidden text. Only matched normalized word spans in authoritative Hafs text receive exact word markers. Unmatched or ambiguous token boundaries are omitted.
- Reports retain metadata and SDK observations, including uncertain and resolved states, for the last 40 takes. The review UI can open the ayah, play its reference audio, retry, add an issue to existing weak spots, mark it reviewed or delete the history. There is no raw recording or phoneme retention, audio upload, or change to manual mastery.

## Partial coverage and constraints

- Weights and same-origin runtime/reference files use a versioned Cache API. The initialized engine works offline. A cold offline app load or restart also needs cached shell and Quran text. There is no shell service worker, and Tafsir and reference audio have their own availability.
- Each surah segment produces its own take and report. The in-app return action restores the prior learning route. Pause/resume, pronunciation scoring, adaptive learning and fixed printed page geometry remain outside this integration.
- The browser requires HTTPS or localhost, AudioWorklet, microphone access, WebAssembly SIMD and BigInt64Array. Tilawa documents a WebGPU warmup failure for these weights, so the app selects WASM directly. One thread uses standard Vercel headers.
- Vite generates the lazy worker, reference and WASM assets for Vercel. An optional `VITE_TILAWA_ASSET_BASE` selects an approved mirror with the same layout. Verify delivery and microphone access on the Vercel branch preview before promotion.

See [the performance and validation report](PERFORMANCE_REPORT.md).
