# Writing Your Own Injuries

**Audience:** a GM who wants injuries written for their own table rather than the ones Bibliosoph ships.

How to add an injury, what each field on the injury sheet means, and a prompt you can paste into an AI to draft one.

Bibliosoph ships a starter pack of injuries, but the system is content-driven: nothing about a wound is hardcoded, so anything you write behaves exactly like the ones that came with it. This is GM-only work.

## Make a compendium of your own first

Copy the shipped injuries into a compendium in your own world, then point **Injury Compendium** at your copy.

Do this before writing anything. A compendium that ships with the module is replaced when the module updates, so injuries you author inside it -- and any GM notes you add to the shipped ones -- are lost on the next release. A compendium in your own world is yours and survives updates.

Bibliosoph looks up injuries by the journal's name, which is the damage type, and picks a page from it at random. So the structure to keep is one journal per damage type, with one page per injury inside it.

## Add an injury

Open your injuries compendium, open the journal for the damage type you want, and add a page. Set the page type to Injury and you get the injury sheet rather than a text editor.

The page's name is the injury's name, and it is what appears on the token when the wound lands. Keep it under 25 characters and make sure no two injuries in the same journal share a name.

### Filling in the sheet

**Damage Type** is the journal it belongs in -- one of the thirteen damage types, or General. General is the fallback for damage that is untyped or evenly mixed, which is the most common case in play, so it is worth stocking.

**Severity** is minor, moderate or major. It sets how hard the injury is to treat and it bounds how much damage it may do, so be honest: major means a serious, campaign-affecting wound.

**Image** is the artwork, chosen for this specific injury. There is no per-category default, so every injury names its own. Reusing one another injury already uses is fine. Match the element -- no snowstorms on necrotic wounds.

**Caption** is a short evocative line shown under the art, under five words. Suggest the mood; do not describe the picture.

**Description** is what the character experiences, in second person, present tense, three to five sentences. Describe how it hampers them. Do not name a specific monster, character, or place -- this injury will come up again in a different scene.

**Treatment** is one to three sentences on how a healer would tend it. This is your own adjudication text, so make it actionable rather than mystical.

**Damage (% of max HP, one time)** is taken once, the moment the injury lands. It is a percentage, not hit points, so the same wound is the same wound at level 1 and level 15. Keep minor to 0-5, moderate to 6-10, and major to 11-18. Zero is fine and often right: plenty of injuries hamper without wounding further. An injury can take a character to 1 hit point and never past it.

**Duration (seconds, 0 = permanent)** is how long it lasts. Zero means permanent until somebody treats it. As guidance, minor runs a minute to half an hour, moderate up to a couple of hours, and major from half an hour to a day, or permanent. Pick a length that fits the fiction rather than a round number.

**Condition** applies one real condition for as long as the injury lasts, or none. Most injuries should be none -- apply one only when the fiction plainly demands it. Conditions that take a creature's whole turn away (paralyzed, incapacitated, unconscious, petrified) are reserved for major injuries, and stunned wants moderate or worse. Losing every action to a scratch is not a fun surprise.

**Recurring damage (% of max HP per turn)** bleeds a little at the start of the victim's turn. Use it rarely, and only for an ongoing physical process -- still bleeding, still burning, poison working through you. "It hurts" is a penalty, not a bleed. Keep it small: minor up to 2, moderate up to 3, major up to 5.

**When the duration ends** decides what happens when the clock runs out. *Heals on its own* removes the injury; most wounds close by themselves. *Stops ticking, but stays until treated* ends the bleeding and lifts the penalties while leaving the wound to be tended, which is what a serious bleeding wound actually wants.

**Flavour status (no mechanics)** is a label like "Confused" or "Clumsy Fingers" for injuries whose effect is pure roleplay. It applies nothing and shows only when Condition is none.

**Odds (1-100, higher is commoner)** is how often this comes up compared to the other injuries in the same damage type. Nastier injuries get lower odds. As a rough ladder, minor around 40, moderate around 20, major around 10.

**Modifiers** are real penalties applied to rolls: pick a statistic, a value, and how many rounds. Leaving the rounds at zero means the penalty lasts as long as the injury, which is usually what you want. Keep penalties within 1 for a minor, 2 for a moderate and 5 for a major, and stop at three -- a wound that stacks four penalties is a spreadsheet, not a story.

**Treatment DC** is optional and overrides the usual difficulty, which comes from severity: 10 for minor, 15 for moderate, 20 for major. Leave it blank unless the injury is deliberately unusual.

**Running This Injury** is your own notes on how to run it at the table. Players never see it -- it shows as a tooltip for GMs only and is never written into the chat card.

## A prompt for drafting one

Paste this into an AI, fill in the two lines at the bottom, and paste the result into the sheet field by field. Treat what comes back as a draft: check the damage and duration against the guidance above before you use it, and change anything that does not sound like your table.

    You are a dungeon master with a sharp wit, writing lingering injuries
    for a D&D 5e campaign in Foundry VTT. An injury is what remains after a
    hit lands hard. It should complicate a character's life, be fun to
    roleplay, and carry a little humour without undercutting the danger.

    Generate one injury as a JSON object matching the template below.
    Follow every rule.

    category - one of: acid, bludgeoning, cold, fire, force, general,
    lightning, necrotic, piercing, poison, psychic, radiant, slashing,
    thunder. Use general for injuries not tied to a damage type.

    title - under 25 characters. Evocative, a little playful.

    image - a Foundry icon path from the core icon library that suits this
    specific injury. Every injury has its own; there is no category
    default. Match the element - no snowstorms on necrotic wounds.

    imagetitle - a short caption, under five words, shown beneath the art.
    Suggest the mood without describing the artwork.

    description - three to five sentences, second person ("your leg", "you
    feel"), present tense. Describe what the character experiences and how
    it hampers them. Never name a specific monster, character, or place.

    treatment - one to three sentences on how it can be tended: what a
    healer would do, what rest or supplies it needs. Actionable, not
    mystical.

    severity - minor, moderate, or major. This sets how hard it is to
    treat, so be honest: major means a serious, campaign-affecting wound.

    damage - an integer PERCENTAGE OF MAXIMUM HIT POINTS, lost once when
    the injury lands. minor 0-5, moderate 6-10, major 11-18. Use 0 freely
    for injuries that hamper without wounding further. It is a percentage,
    never a flat hit point total.

    duration - an integer, in seconds. 0 means permanent until treated.
    Guidance: minor 60-1800, moderate 60-7200, major 1800-86400 or 0.
    Choose a duration that fits the fiction, not a round number.

    statuseffect - exactly one of these lowercase ids, or "none": blinded,
    deafened, silenced, poisoned, diseased, bleeding, burning, prone,
    grappled, restrained, stunned, paralyzed, incapacitated, unconscious,
    exhaustion, frightened, charmed, petrified. Most injuries should be
    "none". Reserve stunned, paralyzed, incapacitated, unconscious and
    petrified for major. Never invent a value; if nothing fits, use "none"
    and let the description carry the flavour.

    odds - an integer 1-100 for how commonly this comes up within its
    category. Nastier injuries get lower odds: minor 5-75, moderate 5-40,
    major 1-20.

    Return only the JSON object, with numbers unquoted:

    {
      "category": "CATEGORY",
      "title": "TITLE",
      "image": "IMAGE",
      "imagetitle": "IMAGETITLE",
      "description": "DESCRIPTION",
      "treatment": "TREATMENT",
      "severity": "SEVERITY",
      "damage": 0,
      "duration": 0,
      "statuseffect": "none",
      "odds": 50
    }

    Now generate an injury with:
    - category: [CATEGORY]
    - additional direction: [ANYTHING SPECIFIC]

The prompt deliberately leaves out recurring damage, expiry, flavour and modifiers. Those are judgement calls about how the wound behaves over time, and they are quicker to set on the sheet than to describe in a prompt.

## Checking your work

Deal the injury to a token from the picker and look at the card. The mechanics you set should read back as plain English, the artwork and caption should look right at card size, and the condition should appear on the token. Then open **Check-Up** on that character and treat it, to confirm the wound and its condition both clear.
