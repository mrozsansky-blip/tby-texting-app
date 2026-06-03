# TBY texting app system plan

This app is now being built as a custom Next.js app deployed on Vercel, with Airtable as the live school database and TextGrid added later as the SMS/MMS/voice provider.

Current safety rule: the app stays in planning/preview mode until `SMS_SEND_ENABLED=true` and TextGrid credentials are intentionally added. Recipient preview and Airtable records are allowed; real SMS sending is not.

## Architecture

| Layer | Tool | Purpose |
| --- | --- | --- |
| Staff app | Next.js on Vercel | Texting-style inbox, groups, campaign drafting, recipient preview, confirmation screens. |
| Database | Airtable | Families, students, people, phone numbers, groups, campaigns, queue, delivery/audit logs. |
| AI | OpenAI API | Compose help and group finder using only real Airtable groups. |
| Messaging provider | TextGrid, later | SMS/MMS, inbound replies, delivery callbacks, opt-out handling, and eventually voice. |
| Deployments | GitHub to Vercel | GitHub is the source of truth; Vercel deploys from GitHub. |

## Existing live Airtable tables

The live base is `TBY Database 2026`. These tables are the core texting data model:

- `Families`: household / dedupe unit.
- `Students`: source for grade, class, division, bus, and student-based group rules.
- `People`: parents and household members.
- `Phone Numbers`: source of truth for phone numbers and SMS/voice eligibility.
- `Communication Groups`: reusable saved group definitions.
- `Message Campaigns`: staff draft/broadcast campaign records.
- `Message Queue`: operational preview/send queue rows.
- `Outbound Messages`: final delivery and audit log.

## Families

Families are the dedupe unit. A family may have multiple students, multiple parents, and multiple phone numbers, but a family broadcast should normally create one family recipient row unless staff explicitly choose more than one phone type.

Important fields:

- `Family Display Name`
- `FamilyKey`
- `Parents`
- `Students`
- `Phone Numbers`
- `Communication Groups`
- `Message Campaigns`
- `Message Queue`
- `Outbound Messages`
- `Office Notes`

## Students

Students drive grade/class/division/bus rules.

Important fields:

- `Student Name`
- `FamilyKey`
- `Grade`
- `Grade Sort`
- `ClassKey`
- `Registration Status`
- `Student Status`
- Bus-related fields

Group preview should resolve student records back to their linked families, then dedupe by family.

## People

People are parents/guardians/household members. People should be used when deciding whether a number belongs to mother, father, guardian, or another contact.

Important fields:

- `Full Name`
- `PersonKey`
- `FamilyKey`
- `Role`
- `Title`
- `Phone Numbers`

## Phone Numbers

Phone Numbers is the source of truth for whether a number may be used.

Important fields:

- `FamilyKey`
- `PersonKey`
- `Phone Type`
- `Phone Number`
- `Phone E164`
- `SMS Allowed`
- `Voice Allowed`
- `Primary for Family`
- `Do Not Contact`
- `Invalid / Bad Number`
- `SMS Opt-In`
- `Active`

### Required sending filters

A phone number can be included in SMS preview only when:

- `Phone E164` is present.
- `SMS Allowed` is checked.
- `Do Not Contact` is not checked.
- `Invalid / Bad Number` is not checked.

For voice later, use `Voice Allowed` instead of `SMS Allowed`.

## Recipient phone choices per group/campaign

The app must let office staff choose which phone types to include every time they preview or send a group.

Required choices:

- Mother cell
- Father cell
- Home phone
- Primary family phone
- All eligible parent cells
- Custom/manual number

Recommended UI wording:

> Send this group to: Mother cell, Father cell, Home phone, Primary family phone

The staff should be able to select one or more choices. Examples:

- Snow notice: Mother cell + Father cell
- Bus delay: Primary family phone, or Mother cell + Father cell
- Tuition or office follow-up: Primary family phone
- Emergency/urgent notice: Mother cell + Father cell + Home phone
- Test send: Custom/manual number only

### Recipient selection logic

Recipient selection should happen after group membership is calculated.

1. Resolve group to families.
2. Look up each family’s Phone Numbers.
3. Filter out disallowed numbers.
4. Apply the staff-selected phone choices.
5. Dedupe by phone number so the same E.164 number is never messaged twice in one campaign.
6. Dedupe by family only when the campaign mode says one phone per family, such as `Primary family phone`.
7. Return counts and skipped reasons before anything is sent.

### Airtable fields to add later

To make this durable, add these fields when ready:

#### Communication Groups

- `Default Recipient Phone Choices` — multiple select: Mother Cell, Father Cell, Home Phone, Primary Family Phone, All Eligible Parent Cells.
- `Default Dedupe Mode` — single select: One Per Family, One Per Phone, Selected Phone Types.

#### Message Campaigns

- `Recipient Phone Choices` — multiple select: Mother Cell, Father Cell, Home Phone, Primary Family Phone, All Eligible Parent Cells, Manual Numbers.
- `Dedupe Mode` — single select: One Per Family, One Per Phone, Selected Phone Types.
- `Preview Recipient Count`
- `Preview Skipped Count`
- `Preview Notes`

#### Message Queue

- `Recipient Phone Choice` — single select: Mother Cell, Father Cell, Home Phone, Primary Family Phone, Manual.
- `Family`
- `Phone Number Record`
- `To`
- `Body`
- `Status`

Do not add these fields blindly if similar fields already exist. Inspect Airtable first, then add only what is missing.

## Communication Groups

Groups are saved definitions. The current starter groups are:

- All Families
- Grade 4
- Grade 8
- Primary
- Test Office Group

Important fields:

- `Group Name`
- `Group Type`
- `Families`
- `Students`
- `Active`
- `Description`
- `Office Notes`

Recommended group behavior:

- If `Families` are linked, use those families.
- If `Students` are linked, resolve students to families.
- If the starter group is `All Families` and no families are linked, preview all families.
- If the starter group is a grade group and no families are linked, match students by `Grade`, resolve to families, and dedupe.
- If a manual group has no links, return zero recipients and explain why.

## Message Campaigns

Message Campaigns are staff-facing draft/broadcast records.

Important fields:

- `Campaign Name`
- `Message Body`
- `Send Mode`
- `Audience Type`
- `Communication Groups`
- `Selected Families`
- `Confirmed to Send`
- `Status`
- `Scheduled Time`
- `Preview Recipient Count`
- `Preview Skipped Count`
- `Preview Notes`
- `Internal Notes`
- `Message Queue`
- `Outbound Messages`

Campaign records may be created while in planning mode. They must not send SMS unless the separate send confirmation and environment safety gate are both enabled.

## Message Queue

Message Queue is where preview rows and eventual send rows belong. Manual phone numbers entered in the Planning Inbox should eventually create queue preview rows instead of being saved only in notes.

Recommended statuses:

- Preview
- Draft
- Queued
- Sending
- Sent
- Failed
- Canceled
- Skipped

Recommended flow:

1. Staff drafts a campaign.
2. Staff chooses group/families/manual numbers.
3. Staff chooses phone choices: mother cell, father cell, home, primary, etc.
4. App creates or returns preview rows.
5. Staff reviews counts and skipped reasons.
6. Staff confirms.
7. Only when SMS sending is explicitly enabled, queue rows are sent through TextGrid.

## Outbound Messages

Outbound Messages is the delivery/audit history. It should receive final records after a message is actually sent or skipped.

Important fields:

- `Campaign`
- `Family`
- `Phone Number Record`
- `To`
- `From`
- `Body`
- `Status`
- TextGrid provider ID
- callback payload/status fields

## Incoming replies

TextGrid inbound webhooks should later create inbound records and match replies back to families by `Phone E164`.

Recommended future table if not already created:

### Incoming Messages

- `From`
- `From Phone Number Record`
- `Matched Family`
- `Body`
- `Media URLs`
- `Received At`
- `Status`: New, Needs Reply, Handled, Closed
- `Assigned To`
- `Related Campaign`

## Form/document collection

The pasted prior plan included form and document collection by SMS/MMS and email. Keep this in the roadmap, but build it after safe SMS preview is solid.

Future tables:

### Submission Requests

- Request name
- Form/document type
- Due date
- Related campaign
- Active

### Submissions

- Submission request
- Family
- Student, optional
- Status: Missing, Received, Needs Review, Accepted
- Attachments
- Source: SMS/MMS, Email, Manual Upload
- Related incoming message

## Compliance and opt-out handling

The app must respect these fields before sending:

- `SMS Allowed`
- `SMS Opt-In`
- `Do Not Contact`
- `Invalid / Bad Number`
- `Voice Allowed`

Later TextGrid webhook handling should automatically process STOP/START/HELP behavior and update Airtable where appropriate.

## Voice broadcast roadmap

Voice should come after SMS preview, SMS sending, inbound replies, and delivery callbacks are stable.

Voice features to keep in the plan:

- Text-to-speech calls
- Uploaded audio
- Record-from-phone workflow
- Voice Allowed filtering
- Call status tracking
- Optional keypress confirmation later

## Current next build order

1. Add group recipient preview API. Done: `/api/groups/[id]/preview`.
2. Extend preview API to accept recipient phone choices such as `mother_cell`, `father_cell`, `home`, and `primary_family`.
3. Add UI controls on the Groups/Planning Inbox screens for phone choice selection.
4. Create Message Queue preview rows for campaigns/manual numbers.
5. Add a review/confirm screen that shows counts, skipped reasons, and selected phone choices.
6. Only later connect TextGrid and enable real sending with `SMS_SEND_ENABLED=true`.

## Non-negotiable safety rules

- Never send SMS while planning mode is on.
- Never require TextGrid for preview.
- Never send to a number blocked by Do Not Contact or Invalid / Bad Number.
- Never send to a number without SMS Allowed for SMS.
- Always show preview counts before sending.
- Always require human confirmation before sending.
- Keep GitHub as the source of truth and let Vercel deploy from GitHub.
