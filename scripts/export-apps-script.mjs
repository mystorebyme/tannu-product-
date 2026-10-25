#!/usr/bin/env node
/**
 * Apps Script code ko ek self-contained owner doc me export karta hai.
 *
 * Owner ko repo me file dhoondhne ki zaroorat nahi — `docs/00-overview/apps-script-code.md`
 * kholein, poora code wahin se copy karein. Code ka source of truth wahi
 * `scripts/google-apps-script/liksha-sheets.gs` file rehti hai; ye script usse
 * markdown banati hai (isliye dono kabhi alag nahi hote).
 *
 *   node scripts/export-apps-script.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "scripts/google-apps-script/liksha-sheets.gs");
const outPath = path.join(root, "docs/00-overview/apps-script-code.md");

const code = fs.readFileSync(sourcePath, "utf8").trimEnd();
const lineCount = code.split("\n").length;

const doc = `# Apps Script — poora code (copy-paste)

> Ye file \`scripts/google-apps-script/liksha-sheets.gs\` se **automatic** bani hai
> (\`node scripts/export-apps-script.mjs\`). Yahan se copy kariye, code hamesha latest rahega.

**Kya karta hai:** website ke sab events Google Sheet me likhta hai —

| Tab | Kya aata hai |
| --- | --- |
| **Settings** | phone, WhatsApp, email, UPI ID, UPI name, announcement, free shipping, GSTIN |
| **Orders** | har order + har status change (append-only timeline) |
| **Payments** | UTR submit, "payment hui hai" claim, verify, fail, reverse |
| **Checkout** | funnel: checkout khula → review → order placed → order fail (reason ke saath) |
| **Messages** | contact form |
| **Newsletter** | email subscribers |
| **Audit** | self-check / manual entries |

---

## Steps (ek baar, ~5 minute)

1. Google Sheet kholein → **Extensions → Apps Script**.
2. \`Code.gs\` ka default code poora delete kariye → neeche wala **poora code** paste kariye.
3. Sabse upar \`var TOKEN = 'CHANGE-ME-liksha-token';\` me apna lamba random word daaliye
   (jaise \`liksha-9f3k2m-r23\`). **Yahi token Vercel me daalna hai** — yaad rakhein.
4. **Ctrl+S** (save).
5. Editor me upar function dropdown → **\`setup\`** → **Run** → permission maange to
   **Review permissions → apna account → Advanced → Go to … (unsafe) → Allow**.
   Sheet me 7 tab ban jayenge.
6. **Deploy → New deployment → (cog) Web app**
   - Description: \`liksha v2\`
   - **Execute as: Me**
   - **Who has access: Anyone**
   - **Deploy** → **Web app URL** copy kariye (\`.../exec\` par khatam hota hai).
7. Test: browser me
   \`<Web app URL>?action=health&token=<TOKEN>\`
   → \`{"ok":true,"version":2,"spreadsheet":"…","sheets":[…]}\` aana chahiye.
   Phir editor me function **\`testAppend\`** → **Run** → Orders + Checkout tab me test row.
8. **Mujhe 2 value bhej dijiye:** Web app URL + TOKEN. Main Vercel
   (\`liksha-clothing\` → Settings → Environment Variables) me daal kar redeploy kar dunga:

   | Variable | Value |
   | --- | --- |
   | \`GOOGLE_SHEETS_WEBAPP_URL\` | aapka \`/exec\` URL |
   | \`GOOGLE_SHEETS_TOKEN\` | aapka token |
   | *(optional)* \`GOOGLE_SHEETS_SETTINGS_CSV_URL\` | Settings tab ka published CSV link |

9. Verify (main ya aap): \`node scripts/sheets-selfcheck.mjs "<URL>" "<TOKEN>"\`

---

## Code badalne par (yaad rakhiye)

Apps Script me code update karne ke baad **naya version deploy** karna padta hai:
**Deploy → Manage deployments → (pencil) Edit → Version: New version → Deploy**.
Warna purana code hi chalta rehta hai.

## Sheet ke rules

- **Header row (pehli row) na hataayein.** Script column ko **naam** se dhoondhta hai,
  isliye column ka order badalna theek hai; header ka naam badalna/hatana nahi.
- Naya column add karna theek hai (script khud bhi missing column add kar deta hai).
- \`Who has access: Anyone\` rakhein — website anonymous request bhejti hai. Data safe hai
  kyunki token ke bina script kuch read/write nahi karta.

---

## Poora code (${lineCount} lines)

\`\`\`javascript
${code}
\`\`\`
`;

fs.writeFileSync(outPath, doc);
console.log(`wrote ${path.relative(root, outPath)} (${lineCount} lines of code)`);
