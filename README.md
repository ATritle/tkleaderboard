# Tarkov Team Kill Leaderboard

Static GitHub Pages site for tracking Escape From Tarkov team-kill incidents.

## Data
All incidents live in `data/teamkills.json`.

Each record contains:
- `id`
- `killer`
- `victim`
- `date`
- `map`
- `notes`
- `clip`

There is intentionally no incident type field.

## Updating the leaderboard
Edit `data/teamkills.json`, commit the change, and GitHub Pages will publish the updated list.

## GitHub Pages
In the repository, go to **Settings → Pages** and choose:
- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/ (root)**

The site can later be attached to a custom domain without changing the app.

## Images
- `assets/repository-logo.png` is the supplied repository-link image.
- The current Escape from Tarkov header logo is loaded from PNGimg; it can later be replaced with a locally stored logo if desired.
