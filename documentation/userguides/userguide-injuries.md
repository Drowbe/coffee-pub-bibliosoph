# Injuries at the Table

**Audience:** a GM running injuries, and a player whose character has one.

What an injury does to a character, how one is dealt, what the recipient sees, and how to get rid of it. Writing your own injuries is a separate job -- see [writing your own injuries](userguide-authoring-injuries.md).

An injury is what remains after a hit lands hard. It takes hit points once, may apply a condition, may impose real penalties on rolls, and may bleed a little each turn until somebody treats it.

## What an injury does to your character

When one lands you get a card in chat naming the wound, its artwork, what it does, and how it might be treated. Applying it puts a real effect on the token, and a burst plays on the canvas so the whole table sees it happen.

From then on the character carries:

- **Damage, once.** A percentage of their maximum hit points, so the same wound hurts a level 1 character and a level 15 one comparably.
- **A condition, sometimes.** Blinded, prone, poisoned and so on -- a real condition, applied the way Foundry applies any other, so it shows on the token and in every module that reads conditions.
- **Penalties, sometimes.** A minus to attacks, damage, AC, checks or saves, applied as a genuine effect rather than a note somebody has to remember.
- **A bleed, rarely.** A small amount of damage at the start of your turn, for wounds that are an ongoing physical process.

**An injury will never drop you below 1 hit point.** Not the initial damage, not the bleed. Injuries maim; dying is what death saves are for.

Most injuries heal on their own when their duration runs out. Some are written to stop bleeding but stay until somebody tends them, and some are permanent until treated.

## Deal an injury by hand

GM only. Click **Injuries** on the toolbar to open the picker, which lists the damage types down one side and the injuries in each.

| What you click | What happens |
|---|---|
| An injury, or the droplet beside it | Deals that exact wound, with no roll |
| The die on a damage type | Rolls a random injury of that type, weighted so nasty ones are rare |
| The hand on a damage type | Asks the target's own player to roll for it |
| The feather on an injury | Opens its journal page so you can read it. The picker stays open |

The wound lands on the token you have targeted, falling back to the one you have selected. You must own the target's actor, and a token never gets the same injury twice.

The hand icon is worth knowing about: it sends the injured player a prompt they click to roll their own wound, which is the same prompt automation sends. Some tables prefer the player to be the one who turns the card over.

## Let injuries happen on their own

GM only, and off by default. Set **Automation** for injuries and a character who takes a single hit worth at least **Injury Threshold (% of Max HP)** of their maximum hit points gets an injury matching the damage type that caused it.

The Automation setting is a ladder:

- **Off** -- no detection, and the toolbar button is hidden.
- **Manual** -- the toolbar button only. No detection, no prompts.
- **Automated Detection** -- a hit crosses the threshold, and the owner gets a prompt with a button to roll the injury.
- **Fully Automated** -- the injury is rolled and posted the moment the hit lands.

**Triggered By** limits this to players, to monsters, or to everyone, judged by who was injured. **Automatically Apply Injury** goes one step further and puts the wound straight onto the character, so the card arrives already applied instead of carrying a button.

Healing never triggers an injury, and the damage an injury deals cannot trigger another one.

This needs a recent Blacksmith. On an older build nothing fires and nothing complains; the picker still works.

## Treat an injury

GM only to start. Target or select a character and click **Check-Up**.

You get a card describing how the patient is doing and listing everything currently afflicting them, grouped: injuries, criticals, fumbles, and then everything else -- plain conditions, other modules' effects, anything stale. Each row has a treat control, and hovering a row shows what the injury actually says.

**Who can press treat:** the GM, always, on anyone. A player, on a character they own.

With **Player Treatment Rolls** on, treating becomes a Medicine check against the injury's difficulty, which comes from its severity -- 10 for a minor wound, 15 for a moderate one, 20 for a major one.

| Situation | What changes |
|---|---|
| The healer has a healer's kit | Advantage, and the difficulty drops by 2 |
| You are treating yourself | Disadvantage |
| Both | A normal roll, and the difficulty still drops by 2 |
| Natural 20 | It heals regardless of the difficulty, and restores 5 hit points |
| Natural 1 | It fails, and costs the patient 5 hit points |

The natural 20 and natural 1 rules are the **Treatment Crits and Fumbles** setting, and can be switched off.

**One attempt per character per injury.** **Retry Treatment After** decides when that resets -- after a long rest, after any rest, or never. **DC Rise Per Failed Attempt** can make an injury harder each time somebody fails on it; set to zero, retries are free.

**Consume Kit Uses** decides whether an attempt spends a use of the kit. **Healer's Kit Item Names** is where you add your own kits, or a translated name, so they count.

Treating a wound ends the affliction and lifts the condition it applied. **It does not give back the hit points the injury cost.** Treatment stops the ongoing problem; healing is a separate job.

## Getting rid of one any other way

The condition an injury applied is cleaned up **however the injury leaves** -- treated from the card, deleted from the character sheet, removed from the token, or simply expiring. You do not have to use the Check-Up card for the character to end up in a clean state.

If two injuries both made you prone, curing one leaves you prone, because the other one still says so. That is deliberate.

## If something looks stuck

A lingering wound shows what it does per turn but no countdown while it is bleeding. That is a known gap in the display, not a stuck effect -- the phase does end on time. Known issues lists it.
