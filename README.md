# CiaoCiao

CiaoCiao is an iPhone-first, game-style Italian flashcard app for English speakers. It teaches 150 high-frequency conversation and business phrases across 8 worlds, with levels, boss levels, coins, stars and unlimited retries. Reviews follow a spaced repetition schedule. The app ships as one self-contained HTML file with all of its audio embedded.

## Features

- 150 high-frequency Italian conversation and business phrases in 8 worlds
- Levels and boss levels, with coins and stars as rewards
- Unlimited retries
- Spaced repetition using Leitner intervals of 1, 2, 4, 8, 16 and 32 days
- Recorded voices for every phrase: Sara (woman) and Nicola (man), with a slow mode
- Asks for the user's name on first launch
- Appearance setting: Auto, Light or Dark
- Progress saved in the browser's localStorage

## Project layout

```
ciaociao/
├── src/
│   └── app.html            Source app; phrase data is the WORLDS array
├── audio/
│   ├── f_<id>.mp3          Sara clips, one per phrase
│   ├── m_<id>.mp3          Nicola clips, one per phrase
│   └── phrases.json        Phrase list generated from src/app.html
├── dist/
│   └── ciaociao.html       Built, self-contained app
├── models/                 Kokoro model files (gitignored)
├── scripts/
│   ├── extract_phrases.js  Writes audio/phrases.json from WORLDS
│   ├── gen_audio.py        Generates the MP3 clips with Kokoro
│   └── build.py            Inlines the MP3s into dist/ciaociao.html
└── tests/
    └── e2e.js              Playwright end-to-end test
```

## Setup

Prerequisites:

- Node.js, for the phrase extractor and the browser tests
- Python 3 with `pip install kokoro-onnx soundfile`
- ffmpeg on your PATH
- Playwright with Chromium, for `tests/e2e.js`
- Kokoro model files: download `kokoro.onnx` and `voices.bin` from the `model-files-v1.0` release of kokoro-onnx on GitHub and place them in `models/`

The clips are already in `audio/`, so the Kokoro setup is only needed to regenerate audio. `gen_audio.py` renders each phrase at speed 0.92 and encodes it as a 24 kHz mono MP3.

## Edit, build and test

To change a phrase:

1. Edit the `WORLDS` array in `src/app.html`. The Italian text is the first element of each phrase entry.
2. Run `node scripts/extract_phrases.js` to rewrite `audio/phrases.json`.
3. Run `python3 scripts/gen_audio.py --only 2-4` to regenerate both voices for those phrases. IDs are `world-phrase`, both 0-based, so `2-4` is the fifth phrase of the third world. Separate several IDs with commas.
4. Run `python3 scripts/build.py` to rebuild `dist/ciaociao.html`.
5. Run `node tests/e2e.js` to test the build.

The test loads a copy of `dist/ciaociao.html` (written to `tests/_test.html`) in Chromium with iPhone 13 emulation. It checks the welcome screen, confirms that all 300 clips (150 phrases in two voices) decode, checks the voice toggles and slow mode, and plays through the levels.

## How the learning works

- Each new phrase opens on a learn card that autoplays the Italian audio, with Listen and Slow buttons.
- Practice tasks are multiple choice with four options. Choice tasks ask for the Italian for an English phrase. Listen tasks play the Italian and ask for the English meaning.
- A wrong answer shows a feedback sheet with a replay button. Retries are unlimited.
- Coins and stars reward progress through levels, and boss levels close out each world.
- Phrases are scheduled for review on Leitner intervals of 1, 2, 4, 8, 16 and 32 days.

## Home-screen app (GitHub Pages)

`python3 scripts/build.py` also writes `docs/`: the same app wrapped as a standalone iPhone web app (`docs/index.html`, `manifest.webmanifest`, app icons from `scripts/make_icon.py`).

To publish: in the repository's Settings, open Pages, set Source to "Deploy from a branch", pick `main` and `/docs`, and save. The app is then served at `https://leastmarble.github.io/CiaoCiao/`. On an iPhone, open that address in Safari and tap Share, then Add to Home Screen. Progress is stored on each phone. Home-screen apps are exempt from iOS's 7-day clean-up of website data.

Test the Pages build with `TARGET=pages node tests/e2e.js`.
