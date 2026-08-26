# Tarkov Team Kill Leaderboard

Static GitHub Pages site for tracking Escape From Tarkov team-kill incidents.

## Public site
- `index.html` is the public leaderboard.
- Dashboard, Leaderboard, and Incidents tabs are functional.
- Incident data is loaded from `data/teamkills.json`.

## Admin page
Open `admin.html` to add incidents without editing JSON manually.

The admin page uses the GitHub Contents API to read and update `data/teamkills.json` in `ATritle/tkleaderboard`.

### GitHub token
Create a fine-grained GitHub Personal Access Token limited to this repository:
- Repository access: `ATritle/tkleaderboard`
- Repository permissions: **Contents → Read and write**

The token is entered into the admin page at runtime and is not stored by the site.

## Files
- `index.html` — public site
- `admin.html` — admin/data-entry page
- `app.js` — public site logic
- `admin.js` — GitHub-backed admin logic
- `styles.css` — shared styling
- `data/teamkills.json` — source-of-truth incident data
- `assets/eft-logo.png` — EFT header logo
- `assets/repository-logo.png` — repository link image
