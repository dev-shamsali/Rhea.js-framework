# Installation

Requirements: Node.js 22.13 or newer (22 LTS, 24 or 26) and npm 10 or newer. Generated projects use Vitest 5, ESLint 10 and Vite 8, which need Node.js 22.12/22.13 or newer; Node.js 20 reached end of life in April 2026. The runtime packages (`@rheajs/core`, `@rheajs/auth`) still declare `node >=20`, but only Node.js 22 and 24 are tested. npm 10, 11 and 12 are tested.

**Install scripts (npm 12).** npm 12 blocks dependency install scripts unless `package.json` lists them in `allowScripts`. TypeScript projects need one: esbuild (a dependency of `tsx`) installs its platform binary in a postinstall script. The generated `package.json` already contains `"allowScripts": { "esbuild": true }`, so `npm install` and `npm ci` work without a prompt and without changing any global setting. Older npm versions ignore the field. Review the list at any time with `npm install-scripts ls`.

> Rhea.js 1.x is published to npm. Semantic versioning applies: see [Stability and versioning](introduction.html#stability-and-versioning).

```bash
npx create-rhea my-api
```

`create` asks four questions. Use the arrow keys (or number keys) and Enter:

1. **Language**: TypeScript (recommended) or JavaScript.
2. **Module system**: ES Modules (`import`/`export`, recommended) or CommonJS (`require`/`module.exports`).
3. **Database**: None, MongoDB or MySQL.
4. **Install dependencies now?** Yes or No.

Then:

```bash
cd my-api
npm install        # skip if you answered Yes
npm run dev
```

Open `http://localhost:5000/api/rhea`.

## Skip the questions

Every question has a flag, so scripts and CI never block:

| Flag                         | Meaning                                               |
| ---------------------------- | ----------------------------------------------------- |
| `--ts` / `--js`              | TypeScript or JavaScript (default TypeScript)         |
| `--esm` / `--cjs`            | ES Modules or CommonJS (default ES Modules)           |
| `--db none\|mongodb\|mysql`  | Database (default none)                               |
| `--auth` / `--no-auth`       | Add register, login and JWT routes (needs a database) |
| `--install` / `--no-install` | Run `npm install` after creating                      |
| `--no-git`                   | Do not create a git repository                        |
| `--github-private`           | Also create a private GitHub repository and push      |
| `--github`                   | Also create a public GitHub repository and push       |
| `--no-github`                | Never create a GitHub repository                      |
| `--yes`, `-y`                | Accept defaults for anything not given, ask nothing   |

```bash
npx create-rhea my-api --js --cjs --db mongodb --install
```

## Git and GitHub

Like `create-next-app`, `create` turns the new folder into a git repository on the `main` branch with one commit, `Initial commit from Create Rhea`. It is made after `npm install`, so `package-lock.json` is in that commit. Your `.env` is never committed: `.gitignore` excludes it.

- It skips this when the folder is already inside a git repository (so a monorepo keeps one history), when git is not installed, or when you pass `--no-git`.
- If git does not know who you are, the repository is still created and `create` tells you the two `git config` commands to run, then `git add -A && git commit`. It never invents an identity.

To connect the project to GitHub, `create` can use the [GitHub CLI](https://cli.github.com) (`gh`). If it is installed and signed in, an interactive run asks "Create a GitHub repository now?" (default No), then Private or Public, and runs `gh repo create <name> --source=. --remote=origin --push` for you. With `--github-private` or `--github` it does that without asking. Without `gh`, or when you decline, `create` prints the command to run later. `--yes` and runs without a terminal never contact GitHub on their own. `create` never reads or stores a GitHub token: `gh` holds your sign-in. If GitHub refuses (for example the name is taken), the project is still created and the message says how to retry.

When there is no terminal (a CI job, a pipe) `create` behaves as if `--yes` was passed. It refuses to write into a non-empty directory.

Check your setup at any time:

```bash
npx rhea doctor
npx rhea info
```
