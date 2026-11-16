# Lane status files

One file per lane from `../V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md`. Each lane writes only its own file. The coordinator (lane L0) is the only writer of `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json`, `CHANGELOG.md`, `wrangler.jsonc` and `tests/unit/handoff-contract.test.ts`, and folds these files into them when a lane's pull request merges.

Each lane also has its own copy catalog in `app/localization/catalog/<lane>.ts` for Spanish wording and API error codes, so lanes never edit the same lines of `messages.ts` or `errors.ts`.
