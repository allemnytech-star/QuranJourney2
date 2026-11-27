# Phase 2 performance and validation

## Executed recognition benchmark

Both SHA-256-verified 1-int8 weights ran with Tilawa 1.0.0-rc.1 and ONNX Runtime Node 1.30.0 on an Intel i5-6300U, Windows, Node 24.18.0. The 13 inputs per model covered Husary professional recitation, diagnostic edits from QDC word boundaries, two upstream recitation fixtures, and an inserted 800 ms silence. Edits are synthetic and are not teacher-reviewed or recordings of learner mistakes. The published SDK and Phase 1 benchmark numbers are separate from this run.

| Test input | Lite | Full |
| --- | --- | --- |
| Correct 1:2, correct 112:1–4, and longer 1:7 | Tracked all three, no confirmed issue | Same |
| Omitted word | Confirmed omission | Confirmed omission |
| Replaced word | Confirmed wrong word | No confirmed wrong word |
| Inserted different word and repeated word | Neither produced a confirmed addition | Same |
| Edited omission of 112:3 | Confirmed skipped passage | Same |
| Wrong declared passage | SDK proposed the actual out-of-scope ayah with no confirmed issue | Same. The app rejects these locations |
| Constructed self-correction | SDK resolved an omission observation | Same |
| Inserted pause | No confirmed issue | Same |
| Free-start Yasin fixture, 36:1–5 | First lock at 7.00 s audio, tracked 36:2–5 | First lock at 6.96 s, tracked 36:2–5 |
| Short upstream tlog fixture | No lock | No lock |

The tests identify concrete misses. They cannot establish a general accuracy or false-alert rate. Full did not consistently outperform Lite on this small set. Re-run the Node harness in `poc/tilawa/benchmark-v1.mjs` using the float32 fixture format from `poc/muaalem/export_cases.py`. Keep weights and audio outside the repository. The original 0.4.0 data and benchmark files are preserved. [Upstream model evaluation](https://github.com/yazinsai/tilawa/blob/main/docs/model-card.md)

## Measurements

| Measurement | Lite | Full |
| --- | ---: | ---: |
| ONNX weight bytes | 24,650,054 | 67,759,744 |
| Desktop Node initialization from local files | 2.95 s | 2.47 s |
| Whole-process RSS after initialization | 199.4 MiB | 648.5 MiB |
| Peak sampled whole-process RSS | 599.7 MiB | 759.3 MiB |
| Whole-process RSS after disposal | 531.2 MiB | 488.0 MiB |
| Compute time for 28.60 s Yasin fixture | 9.14 s | 12.52 s |

The CPU run loaded the tiers sequentially in one process. The Full run began at 531.4 MiB RSS, so RSS includes retained process allocations and cannot be used as the isolated size of either model. The combined same-origin reference and WASM files are 33,061,309 uncompressed bytes. They and the approximately 1.04 MB worker load on demand. No equivalent peak Android or browser memory measurement was taken.

On desktop Chrome at a 390 × 844 viewport, opening the home page fetched no inference worker, WASM, reference data or weights. Lite preparation took 34.50 s in one cold run with publisher delivery. A separate run using the same verified weights from a local test response took 15.86 s. The first mapped location from the upstream Yasin WAV appeared in 8.76 s and 7.05 s in two browser takes. The second take ran with network disabled after model initialization and a prior online take. Both returned 36:2, saved metadata, and stopped every captured track. The browser used a fixture as the microphone signal. Browser startup timing includes UI, permissions, and streaming latency. Offline Quran pages that had not been loaded previously could not fetch their text.

## Remaining validation

- Physical older Android and Galaxy J8-class devices need sustained sessions, download/storage pressure, memory and warmup checks, and cleanup checks. Physical iOS browsers and real microphone audio also need validation.
- An initialized worker ran offline. A cold offline shell after a browser restart, offline Tafsir, and reference audio availability are outside the verified coverage.
- Run `tsc --noEmit`, the Vite build, `preview.test.mjs`, `render.smoke.mjs`, and `tilawa.test.mjs` from the repository. The original S5 source generator needs historical Git object 59c6301. The migration fixture covers its safety invariant independently.
