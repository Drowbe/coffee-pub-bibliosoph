# Getting Started with Bibliosoph

**Audience:** a GM or player who has just installed Bibliosoph and wants to use it at the table.

The first five minutes: what appears on screen, what each toolbar button does, and who is allowed to press it.

Bibliosoph requires Coffee Pub Blacksmith, which must be installed and enabled alongside it.

## What changes the moment you enable it

A Coffee Pub toolbar appears in the scene controls with up to eight buttons on it. Every feature can be switched off independently, so you can take only the parts you want, and a feature that is off hides its button.

| Button | Who can use it | What it does |
|---|---|---|
| Messages | Anyone | Opens the conversation window for talking to other players in character |
| Investigation | Anyone | Searches the area: rolls for coins and items and posts what was found |
| Critical Hit | GM | Draws a critical from your criticals deck and posts it |
| Fumble | GM | Draws a fumble and posts it |
| Injuries | GM | Opens the injury picker, to deal a wound to a token |
| Check-Up | GM | Shows everything currently afflicting a character, and lets you treat it |
| Inspiration | Anyone | The GM deals a card to someone; a player draws one at random |
| Quick Encounter | GM | Builds an encounter from a habitat and a difficulty, then deploys it |

Players see only the settings that are genuinely theirs -- toolbar buttons, message alerts, dice animations. Everything else belongs to the GM.

## Send a message to another player

Click **Messages**. The window lists your conversations: the party channel, which everybody sees, and any private or group conversations you are part of.

Pick a conversation and type. To start a new one, choose the people you want and send -- a group conversation is a private one with more than one recipient.

Conversations are kept in journals, so they survive a reload and are still there next session. **Message History Limit** decides how many messages are kept per conversation.

When somebody messages you and the window is closed, an alert appears on screen. **Direct Message Alert** and **Group Message Alert** control whether you get one, and **Alerts Open the Popout** decides whether clicking it opens the small window or the full one. If you would rather have silence, turn off the message sounds -- they are yours alone, and turning them off affects nobody else.

The GM can enable **GM Sees All Conversations**, which lets them read private conversations. Ask your table how they want that set before playing.

## Search a room

Click **Investigation**. Your character rolls, and a card is posted saying what turned up: a short piece of narration, any coins, and any items. Anything found is added to your character sheet automatically.

Two rolls happen, independently -- one for coins and one for items -- so a search can turn up money and nothing else, or the other way round.

The GM controls the odds through **Odds of Finding Items** and **Odds of Finding Coins**, the most items a single search can yield through **Upper Limit of Items**, and how much money is possible through the five **Max ... Amount** settings. Items come from roll tables the GM supplies, one per rarity; a rarity with no table set simply never comes up.

If the GM turns on **Use Player Skill Bonus**, your character's Intelligence and proficiency improve the odds, so a trained investigator genuinely finds more.

## Land a critical or a fumble

The GM clicks **Critical Hit** or **Fumble** and a card is drawn and posted. Criticals and fumbles ship as decks of authored cards rather than roll tables, so each one carries real mechanics: damage, a condition, roll penalties, and how long they last.

The card says who it applies to. Some cards name the creature that was hit, some name the roller, some ask you to pick one or more party members, and some apply to everyone at once.

**A player can press Apply on a card their own roll produced.** The GM can apply anything. Buttons that ask you to select a creature on the canvas stay GM-only, because they act on whatever the person clicking has selected. Once a card has been applied it says so and cannot be applied twice.

You need a criticals deck and a fumbles deck configured for these buttons to do anything. Bibliosoph ships both; **Criticals Source** and **Fumbles Source** point at them, and you can point them at your own instead.

## Wound a character, and heal them again

Click **Injuries** to open the picker. Then either:

- click an injury to deal that exact wound,
- click the die on a category to roll a random injury of that type, or
- click the hand on a category to ask that character's player to roll it themselves.

Injuries can also happen on their own. With **Automation** set to detect them, a character who takes a single hit worth more than **Injury Threshold (% of Max HP)** of their maximum hit points gets an injury matching the damage type. **Triggered By** decides whether that applies to players, to monsters, or to everyone.

An injury takes some hit points immediately, may apply a condition, may impose a penalty on rolls, and may bleed a little each turn. It never drops a character below 1 hit point.

To treat one, the GM targets or selects the character and clicks **Check-Up**. The card lists everything afflicting them, with a treat control on each row. With **Player Treatment Rolls** on, treating becomes a Medicine check the player rolls themselves: a healer's kit helps, treating yourself is harder, and rolling a 1 or a 20 makes it notably worse or better. Treating a wound ends the affliction; it does not restore the hit points it cost. Healing is healing's job.

## Give somebody an inspiration card

Click **Inspiration**. A GM gets a dialog showing every card in the deck and can hand over a specific one, or deal at random. A player clicking the same button draws a random card for their own character.

**The card is the currency.** It arrives in the character's inventory as a real item, and it stays there until it is played -- hours, sessions, or a whole arc. Bibliosoph does not touch your character sheet's inspiration marker, so whatever your table already uses that for keeps working.

To play a card, use the item on your character sheet. That raises the card in chat with buttons on it; nothing is spent until you click one, so opening a card and thinking better of it costs nothing. Clicking a button runs the card's effect and discards it.

## Build an encounter

Click **Quick Encounter**. Choose a habitat and a difficulty and you get a suggested monster list, which you can adjust. Post it as a card, and deploy it to the canvas when the party arrives. A monster can also be dragged from the card straight onto the scene.

The first use needs a monster cache: click **Refresh cache** and let it read your installed compendiums. The setting beside it tells you how many monsters it currently knows about.

## Turning things off

Every feature has an enable setting and, where relevant, an **Automation** setting. Turning a feature off hides its toolbar button as well, so the toolbar only ever shows what you are actually using.
