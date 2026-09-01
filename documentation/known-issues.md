# Known Issues

**Audience:** anyone using Bibliosoph who has hit something that looks broken.

Defects that are real and not yet fixed. What was fixed is in the CHANGELOG; what we intend to build is not here.

## Treatment rolls cannot be forced to advantage or disadvantage

A treatment roll should be made with advantage when the healer has a healer's kit, and with disadvantage when a character treats themselves. The roll request that Bibliosoph sends cannot compel either, so the required mode is stated in the request's title and the player is trusted to click the matching button.

**Workaround:** none needed for correctness -- the resolver reads what was actually rolled from the roll formula and logs a mismatch, so an accidental normal roll is recorded honestly rather than scored as though it had advantage. A GM who wants it enforced should watch the roll.

A fix starts on the Blacksmith side: the roll request API needs to accept a required roll mode.

## A lingering wound shows no countdown while it is bleeding

An injury set to stop ticking but stay until treated is applied as permanent, because that is what it is. During its bleeding phase, displays show the damage per turn but no time remaining, so there is no visible answer to "how much longer does this bleed for?"

**Workaround:** none. The phase does end on schedule; only the display of it is missing.

A fix needs a public duration formatter from Blacksmith. Re-deriving that wording locally is what produced two earlier display bugs, so it waits.

## A fumble that applies to the roller does not aim at the roller

An outcome marked as applying to self changes the Apply button's label but not what it targets. The applier still uses whatever is targeted, falling back to whatever is selected.

**Workaround:** the GM selects the fumbling token before clicking Apply.

A fix depends on the rolls API reporting the acting actor reliably on every path that can produce a fumble.

## Injury automation is dormant without a recent Blacksmith

Injuries triggered by damage rely on a damage event that older Blacksmith builds do not emit. On such a build nothing fires and nothing reports an error.

**Workaround:** update Blacksmith. The injury picker and every manual path work regardless.

## Investigation and Quick Encounter cards look different from the rest

Those two features still render through the older chat card path, while everything else builds from the shared structure. They are legible and correct; they simply do not match the others' styling in every detail.

**Workaround:** none needed.
