# Optional garbage image classifier

An advisory, non-blocking feature. After a complaint is created, the uploaded image can be classified by a
TensorFlow model; the result fills `complaints.classified_label` and `complaints.classification_confidence`.
The citizen-chosen `category` is the source of truth and is never changed. If anything fails (python missing,
timeout, crash, bad output, model missing) one structured warning is logged and both columns stay `NULL`.
The HTTP response never waits for classification.

## Supplying the real model

1. Install Python deps: `pip install -r scripts/requirements.txt` (TensorFlow, Pillow, numpy).
2. Put your trained Keras model file somewhere (it is NOT in the repo; do not commit it), e.g. `D:\models\garbage_classifier.h5`.
3. Set in `.env`:
   - `GARBAGE_MODEL_PATH=D:\models\garbage_classifier.h5`
   - `GARBAGE_CLASS_LABELS=garbage_heap,litter,dumping_site` (same order as model outputs; for a 3-class model this is also the built-in default)
   - `CLASSIFIER_ENABLED=true` (optional, see below)
4. Restart the backend.

## Environment variables (read at call time)

| Variable | Default | Meaning |
|---|---|---|
| `CLASSIFIER_ENABLED` | unset | `true` enables; any other set value disables. Unset: enabled only if the model file exists. |
| `GARBAGE_MODEL_PATH` | `../garbage_classifier.h5` (relative to the backend dir's parent for the built-in default; a relative value in `.env` resolves from the process cwd) | Model file. |
| `PYTHON_EXECUTABLE` | `python` | Interpreter used to run the script. |
| `CLASSIFIER_SCRIPT` | `scripts/classify_garbage.py` | Script override (tests use `scripts/fake_classifier.js` with `PYTHON_EXECUTABLE=node`). |
| `CLASSIFIER_TIMEOUT_MS` | `20000` | Hard timeout; the child is killed (SIGKILL) on expiry. |
| `GARBAGE_CLASS_LABELS` | empty | Comma separated labels passed as `--labels`. |

When the model or script file is absent, nothing is spawned and the service returns its `fallback` result.

## Stdout contract

The script is run as `<python> -u scripts/classify_garbage.py --model M --image I --labels L` and must print one JSON
object (the last non-empty stdout line is used) and exit 0:

```json
{ "label": "litter", "category": "litter", "confidence": 0.9132 }
```

On failure it prints `{"error": "..."}` and exits 1. The Node side accepts the result only if `label` is a
non-empty string of at most 100 chars and `confidence` is a finite number in `[0, 1]`; anything else is rejected.
The temp image (`os.tmpdir()/garbage-*`) is always deleted.

## Verification without the model

```
node scripts/verify-classifier.js
```

Starts a second backend on `PORT=5056` using `scripts/fake_classifier.js` (knobs: `FAKE_CLASSIFIER_DELAY_MS`,
`FAKE_CLASSIFIER_MODE=ok|crash|garbage|hang`), creates a tagged temporary citizen in the DB (uses the backend
`.env` database), submits `complaint_test.png`, and asserts: fast HTTP 201, columns filled shortly after, category
unchanged, and for crash/garbage/hang: 201, columns `NULL`, no leaked child processes or temp files. It cleans up
all tagged rows and uploaded files, prints the leftover count (must be 0) and exits non-zero on any failure.
Unit tests: `npx jest tests/unit/classifier`.

This proves the wiring, timeout/kill, validation and cleanup. It does NOT test the Python script, TensorFlow or
real model accuracy; that requires the real model.
