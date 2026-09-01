# Settings

**Audience:** a GM configuring Bibliosoph, and a player wondering which settings are theirs.

Every setting you can see, by its on-screen name, in the order it appears in the settings window.

Settings are grouped by feature, and **every feature can be switched off independently**, so you can take only the parts you want. Turning a feature off also hides its toolbar button.

**Players see only the handful of settings that are genuinely theirs** -- toolbar placement, message alerts, dice animations. Everything else is the GM's, and a setting you cannot see is one the GM controls for the whole world.

## General

**Show Dice Rolls** -- shows 3D dice when a card rolls something. This needs the Dice So Nice module; without it the setting does nothing.

## Messaging

The unified conversation window. See [sending messages](userguide-messages.md) for how to use it.

| Setting | What it does |
|---|---|
| **Messages Enabled** | Switches the Messages window on or off entirely |
| **Toolbar** | Which toolbar carries the Messages button. To remove the button, switch Messages off instead |
| **GM Sees All Conversations** | The GM's window lists every conversation, including ones they are not a member of. Off, the GM sees only their own |
| **Message History Limit** | How many messages are kept per conversation. Older ones are trimmed as new ones arrive |
| **Excluded Users** | Comma-separated user names left out of Messages entirely: no one-to-one row, not selectable for a group, not added to the party conversation. Matches the exact name or the start of it, case-insensitively. This is only about Messages and hides nothing else |
| **Hide Messages Journal Folder** | Hides the conversations folder from everyone's journal sidebar |
| **Auto Open Messages** | Opens the window by itself when a message arrives and nothing is open |
| **Direct Message Alert** | An on-screen alert for a direct message you are not looking at. Yours |
| **Group Message Alert** | The same for party and group conversations. Yours |
| **Alerts Open the Popout** | Clicking an alert opens the small popout. Off, it opens the full window. Yours |
| **Party Send-to-Chat Card Style** | The card theme when a party message is sent to the Foundry chat log |
| **Private Send-to-Chat Card Style** | The same, for a private or group message |

The five Messages sounds are the GM's, so one person picks the table's soundscape. Players still hear them; anyone who wants silence can mute them from the window itself.

### Random Toasts

The four buttons in the Messages window header. Each rolls a table and announces the result to everyone.

**Beverage Table**, **Bio Table**, **Insult Table** and **Praise Table** name the roll table each button uses. **Choosing None disables that button.**

## Critical Hits and Fumbles

See [criticals and fumbles](userguide-outcomes.md). The two sections are laid out identically.

**Configuration**

- **Automation** -- the ladder: *Off* (feature unused, button hidden), *Manual* (toolbar button only, no detection), *Automated Detection* (a prompt with a button to roll), *Fully Automated* (the card posts by itself). A change here needs a reload before the toolbar button appears or disappears.
- **Triggered By** -- *Everyone*, *Players*, or *NPCs and Monsters*. Criticals and fumbles share this one setting.

**Chat Card**

- **Chat Card Style** -- the card's theme, set separately for each kind.
- **Criticals Source** and **Fumbles Source** -- the compendium each kind is drawn from. **This is the only source**: set one to None and no cards of that kind are posted. There is no roll-table fallback.
- **Show Outcome Images (Criticals and Fumbles)** -- the artwork on the cards. One switch covering both kinds.

**Toast Design**

Ten settings shaping the announcement: **Title**, **Message**, **Button Text**, **Size**, **Animation**, **Sound**, **Border Color**, **Background Color** and **Background Image**.

The title and message accept codes: `{name}` who rolled, `{target}` who they hit, `{weapon}` what they used, `{d20}` the die face, `{total}` the attack total.

## Injuries

See [injuries at the table](userguide-injuries.md).

**Configuration**

- **Automation** -- the same four-step ladder. Automation fires when a single application of damage deals at least the threshold percentage of the target's maximum hit points, and the injury is rolled by the damage type that caused it.
- **Automatically Apply Injury** -- an automation-created card skips the Apply button and lands on the damaged character immediately.
- **Injury Threshold (% of Max HP)** -- how big a single hit has to be.
- **Triggered By** -- *Everyone*, *Players*, or *NPCs and Monsters*, judged by who was injured.
- **Apply Sound** and its **Sound Volume** -- plays when an injury lands, alongside the burst.

**Chat Card**

- **Injury Compendium** -- where injuries are drawn from. Defaults to the one Bibliosoph ships; point it at your own copy so your edits survive a module update.
- **Chat Card Style**, **Large Injury Images**, **Chat Card Sound** and its **Sound Volume**.

**Toast Design**

The same ten settings as criticals. The codes here are `{name}` who was injured, `{type}` the damage type, `{damage}` the damage taken, and `{percent}` the percentage of maximum hit points.

**Treatment**

| Setting | What it does |
|---|---|
| **Player Treatment Rolls** | Anyone may attempt a Medicine check against the injury's DC, one attempt per character per injury. A healer's kit grants advantage and lowers the DC by 2; treating yourself imposes disadvantage. The GM always treats instantly without rolling. Off, only the GM and the character's owner can treat, instantly |
| **Treatment Crits and Fumbles** | A natural 20 heals regardless of the DC and restores 5 hit points; a natural 1 fails and costs the patient 5 |
| **Consume Kit Uses** | Whether an attempt spends a use of the kit. Kits without limited uses are never consumed |
| **Healer's Kit Item Names** | Comma-separated item names counting as a healer's kit, so your own or translated kits grant the same benefit |
| **Retry Treatment After** | When a used-up attempt resets: after a long rest, after any rest, or never |
| **DC Rise Per Failed Attempt** | How much harder the injury gets after each failure. Zero makes retries free |
| **Treatment Sound** and **Sound Volume** | Plays when an affliction is successfully treated |

## Quick Encounters

See [building an encounter](userguide-encounters.md).

- **Quick Encounter enabled** -- shows the tool in the toolbar.
- **Max Recommendations** -- how many options the builder offers.
- **Variability** -- how far it may stray from a tidy answer.
- **Detection** -- the default detection level for a new encounter.
- **Toolbar** -- which toolbar carries the button.
- **Chat Card Style**.
- **Odds of Encounter** -- the chance a rolled encounter happens at all.
- **Encounter Sound**, **No Encounter Sound** and **Sound Volume**.

The window itself also carries **Refresh cache**, which rebuilds the list of monsters it knows about from your installed compendiums, and reports how many it found.

## Investigations

See [searching a room](userguide-investigation.md).

- **Investigations Enabled**, **Toolbar**, and **Chat Card Style**.
- **Use Player Skill Bonus** -- adds the character's Intelligence modifier and proficiency bonus to the roll to find items.

**Currency**

**Odds of Finding Coins** is the chance of finding money at all. **Max Platinum**, **Gold**, **Silver**, **Electrum** and **Copper Amount** cap each denomination; each rolls between zero and its maximum, and a maximum of zero means that coin never appears.

**Items**

- **Odds of Finding Items** -- the chance of finding anything.
- **Upper Limit of Items** -- the most a single search can yield. The actual count is rolled up to this.
- **Common**, **Uncommon**, **Rare**, **Very Rare** and **Legendary Roll Table Name** -- the table each rarity draws from. A rarity with no table never comes up.
- The matching **Weighting** for each -- a relative weight from 0 to 1000, normalised, so they need not add up to anything. Use a low value for tiers that should be genuinely rare.

## Inspiration

See [inspiration cards](userguide-inspiration.md).

- **Inspiration Enabled**, **Toolbar**, and **Chat Card Style**.
- **Inspiration Cards Source** -- the compendium cards are drawn from. **This is the only source**: set it to None and nothing can be drawn.

## Toasts, and camera or streaming accounts

Bibliosoph's announcements are toasts, and each one carries a **channel** naming what it is: Critical Hits, Fumbles, Injuries, Table Breaks, and Group Messages.

Channels matter for one reason. Blacksmith has a **Toast Excluded Users** setting that stops a user's client rendering toasts at all, which is right for a camera or stream account that cannot click a toast closed -- but some announcements are exactly what a broadcast exists to capture.

**This needs no setup.** A camera account sees criticals, fumbles, injuries and table breaks out of the box. To send it *less*, tick a narrower set in Blacksmith's **Channels Excluded Users Still See**, which lists the channels as labelled rows. Ticking only Critical Hits and Fumbles puts the dice moments on camera and keeps injuries and table gags off it.

**Direct message alerts carry no channel at all and can never reach an excluded account.** Putting something on a shared screen is a reasonable offer for the party channel and an unreasonable one for a private message.

Toasts with no channel -- local confirmations and warnings -- are always suppressed for an excluded user.

One thing to know: channel names are global rather than per-module, so if another module also declares a channel called `crit`, allowing it allows both. The checklist shows which module declared each row.
