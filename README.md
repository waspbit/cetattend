# CET Attendance & Penalty Portal

Students enter their **Student ID** and **Course** to see their attendance, cleanup-drive penalty hours, and privilege/exemption status. Records are read live from your Google Sheet.

- **Frontend** (Vercel): `index.html`, `style.css`, `script.js`, `assets/`
- **Backend** (Google Apps Script): `Code.gs`
- **Database**: your existing Google Sheet (stays private)

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure (login + dashboard) |
| `style.css` | Maroon and gold theme, light and dark mode |
| `script.js` | Page logic. **Contains `API_URL`** |
| `assets/tau_logo.png` | TAU logo (you add this file) |
| `assets/cet_logo.png` | CET logo (you add this file) |
| `Code.gs` | Backend. Paste into Apps Script, not Vercel |

## 1. Spreadsheet

Tab name: `Attendance Summary`. Header row (row 1), exact spelling:

`StudentID | FullName | Course | TotalAttendance | NonAttendance | TotalPenaltyHours | Privilege | PenaltyExempt | RequiredPenaltyHours`

- Total Events = `TotalAttendance + NonAttendance`. Attendance Rate = Attendance ÷ Total Events.
- `TotalPenaltyHours` is read from the sheet (`=E2*0.5`). If blank, it is calculated as `NonAttendance × 0.5`.
- Exemption is decided from the `Privilege` column, so `PenaltyExempt` and `RequiredPenaltyHours` are not read.
- The **Course dropdown is built from the Course column**. Keep course names consistent.
- Optional tab `Privileges`: header in A1, one exempting privilege per row from A2 (e.g. Athlete/Player, Golden Harvest, CAASUC, Student Council). If missing, the defaults in `Code.gs` are used.

## 2. Deploy the backend (Apps Script)

1. In the sheet: **Extensions → Apps Script**. Paste `Code.gs`. Delete any `Index` HTML file.
2. Set `SPREADSHEET_ID` in `CONFIG` (the part of the sheet URL between `/d/` and `/edit`).
3. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Authorize.
4. Copy the Web app URL (ends in `/exec`).
5. Test: open `YOUR_URL?action=courses`. You should see your courses as JSON.
6. After any code change: **Manage deployments → pencil → New version → Deploy**.

## 3. Deploy the frontend (Vercel)

1. Open `script.js` and set `API_URL` to your `/exec` URL.
2. Add `tau_logo.png` and `cet_logo.png` to the `assets/` folder (same names; delete `PUT-LOGOS-HERE.txt`).
3. Upload the whole folder (without `Code.gs` and this README if you prefer) to a GitHub repository, then at vercel.com choose **Add New → Project**, select it, and **Deploy**. No build settings are needed.
4. Open the Vercel link.

If a logo file is missing, that logo is hidden and the portal still works.

## Testing

| Test | Expected |
|---|---|
| Valid ID + course | Dashboard matches the sheet row |
| Wrong ID | "Student record not found. Please check your Student ID and course." |
| Duplicate row (same ID + course) | "Contact the administrator" message, no record shown |
| Empty ID or course | Inline validation message |
| Student with `CAASUC, Student Council` | Fully Exempt, total penalty shown, required hours 0 |
| 0 attendance and 0 non-attendance | "No events recorded", no error |
| Log out | Dashboard clears and the login page returns |

## Troubleshooting

- **"Loading courses…" or "Could not load courses":** `API_URL` is wrong, the deployment isn't set to **Anyone**, or you haven't deployed a new version. Check `YOUR_URL?action=courses` in the browser.
- **"No courses found":** wrong tab name or `Course` header, or the Course column is empty.
- **"Could not read the records":** check `SPREADSHEET_ID`, the tab name, and headers. See **Executions** in Apps Script for the exact error.
- **Edits don't show:** redeploy Apps Script as a new version, and re-upload changed frontend files to Vercel. Hard-refresh with Ctrl+Shift+R.
- **Student not found, but the row exists:** check for typos or extra characters in the ID cell. Spaces are ignored, dashes are not.

## Privacy limitation

Student ID + Course is a **convenience lookup, not secure authentication**. Anyone who knows another student's ID and course can view that record. Only the single matching record is returned, and the full sheet never reaches the browser. The `/exec` URL is visible in the page source, so anyone can call the backend directly. This suits a basic demonstration or low-risk directory-style portal, not sensitive records.

Keep the sheet private, and limit editing to authorized personnel. Students cannot change privileges or penalties through the website.
