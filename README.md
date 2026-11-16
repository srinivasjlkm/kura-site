# Kura Design website

Static site built with Astro. All content comes from a folder laid out like this (the Google Drive folder "Kura Project Site" uses the same layout):

    Projects/<Project name>/info.txt + images
    Site/home.txt, studio.txt, contact.txt, people/*.txt

Commands:

    npm install
    CONTENT_DIR=/path/to/content npm run build   # reads the folder, resizes images, writes dist/
    npm test                                     # tests for the text-file reader

`scripts/ingest.mjs` reads the folder. `docs/DESIGN.md` is the style guide.

Publishing (no Google sign-in involved; the Drive folder is shared as "Anyone with the link can view"):

- `scripts/fetch-drive.mjs` downloads the folder before a build when `GOOGLE_API_KEY` and `DRIVE_FOLDER_ID` are set. Google Docs in the folder are saved as text files.
- `worker/watcher.js` is a Cloudflare Worker that checks the folder every 5 minutes and calls the Cloudflare Pages deploy hook once a change has settled.
