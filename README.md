# RadEssential

Radiology quick reference for radessential.com: classifications, decision trees, calculators and teaching cases.

The site is plain HTML, CSS and JavaScript. There is no framework and no database. A small build step turns the case files in `content/cases/` into the data the site reads.

## What's where

| Path | What it holds | How you edit it |
|---|---|---|
| `content/cases/*.yml` | Teaching cases, one file per case | Pages CMS (point and click), see below |
| `media/cases/` | Case images | Uploaded through Pages CMS |
| `assets/app.js` | Reference entries, decision trees, calculators, site behaviour | Ask Claude, or edit on GitHub |
| `assets/styles.css` | Colours, fonts, layout | Ask Claude, or edit on GitHub |
| `img/` | Section covers, flowcharts, figures, logo | Add files on GitHub |
| `index.html` | Page shell and header | Rarely needs changes |
| `scripts/build.mjs` | Build step: copies the site to `dist/` and compiles cases | Leave as is |
| `.pages.yml` | Pages CMS form for cases | Leave as is unless you add case fields |

## One-time setup

You need three free accounts: GitHub (stores the files), Cloudflare (serves the site) and Pages CMS (editing, signs in with GitHub). Your domains stay registered at GoDaddy.

### 1. Put the project on GitHub

1. Sign in at github.com and create a new repository named `radessential`. Private is fine.
2. On the empty repository page, choose **uploading an existing file**.
3. Drag in everything inside this folder, including the hidden `.pages.yml` and `.gitignore` files. On a Mac, press Cmd+Shift+. in Finder to show hidden files.
4. Commit.

### 2. Deploy on Cloudflare Pages

1. Sign up at dash.cloudflare.com on the Free plan.
2. Go to **Workers & Pages → Create → Pages → Connect to Git** and pick the `radessential` repository.
3. Set the build settings:
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. In about a minute the site is live at a `radessential.pages.dev` address. Check it there before touching your domain.

### 3. Point radessential.com at Cloudflare

1. In Cloudflare, choose **Add a domain**, enter `radessential.com`, and pick the Free plan.
2. Cloudflare scans your current DNS records. **If you use email on this domain, check that the MX records came across.**
3. Cloudflare shows two nameservers. Copy them.
4. In GoDaddy, go to **Domain Portfolio → radessential.com → DNS → Nameservers → Change nameservers**. Choose to enter your own and paste the two Cloudflare nameservers.
5. Wait for Cloudflare to report the domain as active. This usually takes under an hour and can take up to a day.
6. In your Pages project, go to **Custom domains** and add `radessential.com`, then `www.radessential.com`.

For `radessential.org`, the simplest option is GoDaddy's domain forwarding to `https://radessential.com`. You can also add it to Cloudflare the same way and set a redirect rule.

Once the new site is live on your domain, you can cancel the GoDaddy Website Builder plan. Keep the domain registrations.

## Editing cases (Pages CMS)

1. Go to app.pagescms.org and sign in with GitHub.
2. When asked, install the Pages CMS GitHub app on the `radessential` repository.
3. Open the repository and choose **Cases**.
4. Add a case: title, section, images with captions, history, findings, diagnosis, discussion, references.
5. Save. The site rebuilds automatically and the case appears in about a minute.

Rules that keep the site working:

- **De-identify everything.** Strip names, MRNs, accession numbers, dates of birth and burned-in annotations before uploading. The site is public.
- Keep the diagnosis out of the title so the case works as an unknown. The diagnosis stays hidden until the reader reveals it.
- Tick **Draft** to save a case without showing it. `example-case.yml` is a draft template you can copy or delete.

## Editing reference content

The reference entries live in `assets/app.js`. Each entry is one `add({ ... })` block with a title, section, summary, tables and sources.

The easiest way to change them is to ask Claude. Connect this GitHub repository in Claude, then describe the change, for example "add the Bethesda thyroid cytology categories under Head & Neck with the 2023 citation". Claude edits the file and the site rebuilds when the change lands on GitHub.

For a small text fix, open the file on github.com, press the pencil icon, edit and commit.

To add a figure to an entry, upload the image to `img/` and reference it from the entry with `ILLUS(['image-name-without-extension', 'Caption'])`.

## Preview on your own computer (optional)

With Node.js installed:

```
npm install
npm run preview
```

Then open the address it prints.

## Image credits and licence

Several figures are from Radiopaedia.org under CC BY-NC-SA: dental numbering (Francis Deng), cervical node levels and Weber (Frank Gaillard), and Rockwood (Andrew Murphy). Credits appear in their captions. That licence allows use only on a non-commercial site. If you add advertising, paid tiers or sponsorship, replace those images first.
