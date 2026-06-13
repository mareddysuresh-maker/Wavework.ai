# WaveWork.ai (FlowUp) — Agent Rules & Constraints

## APP IDENTITY
- Product Name: WaveWork.ai
- Internal Codename: FlowUp
- When referring to the app in code, UI, or configs — use "WaveWork.ai"

## PRIME DIRECTIVE
You are working on an existing production codebase called WaveWork.ai.
Your job is to implement ONLY what is asked in the prompt.
Nothing more. Nothing less.

---

## STRICT RULES

### 1. SCOPE CONTROL
- Only modify files that are DIRECTLY related to the current task
- If a file is not mentioned in the prompt, DO NOT touch it
- If you think another file needs changing, ASK first — do not assume

### 2. NEVER BREAK EXISTING FEATURES
- Feature A must still work after you implement Feature B
- Before modifying any file, check what other features depend on it
- If a function is used in multiple places, do NOT change its signature

### 3. NO REFACTORING UNLESS ASKED
- Do not rename variables, functions, or files
- Do not restructure folders or move files
- Do not change coding style or formatting of existing code
- Do not "clean up" or "improve" code that is not part of the task

### 4. NO ASSUMPTIONS
- If the prompt is unclear, ask a clarifying question
- Do not guess what the user wants and implement it silently
- Do not add extra features that "seem useful"

### 5. IMPORTS & DEPENDENCIES
- Only add new packages that are required for the current task
- Do not upgrade or remove existing packages
- Do not change package.json beyond what is needed

### 6. DATABASE & SCHEMA
- Do not modify existing Prisma models unless explicitly told to
- Only ADD new models or fields — never remove or rename existing ones
- Always create a new migration file, never edit existing migrations

### 7. ENV VARIABLES
- Do not remove or rename existing .env variables
- Only ADD new variables required for the current task
- Always update .env.example when adding new variables

### 8. GIT DISCIPLINE
- Make small, focused changes
- One feature = one logical change
- Do not bundle multiple features into one implementation

### 9. BRANDING RULE
- The app is called WaveWork.ai — never rename it or change branding
- Do not change any logo, color scheme, or UI text unless specifically asked

---

## BEFORE YOU WRITE ANY CODE

Ask yourself:
- [ ] Am I only touching files related to this task?
- [ ] Will existing features still work after my change?
- [ ] Am I adding anything that was NOT asked for?
- [ ] Am I changing any existing function signatures?
- [ ] Am I touching any branding or UI text not related to my task?

If any answer is wrong — STOP and re-read the prompt.

---

## WHEN IN DOUBT
Do less, not more.
Ask, don't assume.
Touch less files, not more.