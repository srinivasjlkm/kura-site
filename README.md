# Kura Design website

Static site built with Astro. All content comes from a folder laid out like this (the Google Drive folder "Kura Project Site" uses the same layout):

    Projects/<Project name>/info.txt + images
    Site/home.txt, studio.txt, contact.txt, people/*.txt

Commands:

    npm install
    CONTENT_DIR=/path/to/content npm run build   # reads the folder, resizes images, writes dist/
    npm test                                     # tests for the text-file reader

`scripts/ingest.mjs` reads the folder. `docs/DESIGN.md` is the style guide.

Publishing: `scripts/fetch-drive.mjs` downloads the Drive folder when `CONTENT_URL` and `CONTENT_KEY` are set (the host's build does this). `apps-script/Code.gs` runs in the Google account that owns the folder: it serves the files to the build and calls the host's deploy hook when the folder changes.

Not yet connected or tested live: the Apps Script deployment and the Cloudflare Pages project.
