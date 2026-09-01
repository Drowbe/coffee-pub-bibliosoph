# Inspiration Cards

**Audience:** a GM handing out inspiration, and a player holding a card.

How a card is dealt, where it lives, what playing it does, and why there is no inspiration point to keep track of.

## The card is the currency

An inspiration card is not a note in the chat log. It arrives in your character's inventory as a **real item**, and it stays there -- hours, sessions, a whole arc -- until you decide to use it. Holding it is the right to play it, and playing it spends it.

**Bibliosoph does not touch your character sheet's inspiration marker.** Whatever your table already uses that pip for keeps working. The one exception is a card whose stated effect is to hand over an inspiration point, which is the card doing what it says.

This is deliberate. Foundry's inspiration field is a yes-or-no flag, so a character holding four cards would have had one point between them, and playing any one card would have left the other three unplayable.

## Get a card

Click **Inspiration** on the toolbar.

- **A GM** gets a dialog showing every card in the deck, with its artwork and how likely it is to come up, plus **Deal a Random Card**. Use it to hand somebody a specific card -- "you get Smite for that".
- **A player** clicking the same button draws a random card for their own character straight away.

The GM is dealing; the player is drawing their own luck. Same button, and what each of them wants is one click.

A critical can also deal a card, if that is what the critical says it does.

The card appears on the character sheet as a one-use item, with the artwork, the prose, and a summary of what it does.

## Play a card

**Use the item on your character sheet.**

That does not spend it. Bibliosoph stops the item's normal use and raises the card in chat instead, with buttons on it. The charge, the item and the play are all still on the table, so opening a card and thinking better of it costs nothing.

Click a button and the effect runs and the card is discarded.

Which buttons you get depends on what the card does:

| The card | The buttons |
|---|---|
| Is narrative only | One -- **Play This Card** -- and the table resolves what happens |
| Gives you a long rest | One, naming you |
| Swaps health with somebody | One per other party member, plus Random |
| Harms a creature | One per creature you currently have targeted |
| Heals, sets hit points, or grants a point | You, the party, and anything you have targeted |

Targets are resolved on your own client, so "currently targeted" means what **you** have targeted. A card that reaches onto somebody else's sheet is performed by the GM's client, which checks you still hold the card before anything is written.

## What the automated cards actually do

Most cards are narrative and the table decides what they mean. A few are a plain state change with no judgement in them, and those resolve with a button:

- Restore a creature to full hit points.
- Set a creature to a specific number of hit points.
- Roll a formula for a percentage, and take that share of a creature's current hit points off it.
- Swap current hit points between two characters, with any overflow becoming temporary hit points.
- Take a genuine long rest, with Foundry's own summary as the receipt.
- Grant a dnd5e inspiration point.

Anything needing a decision stays in the prose deliberately. A button that guessed at "distribute 5 points among your attributes" would be worse than no button.

## Use your own deck

**Inspiration Cards Source** names the compendium cards are drawn from. It defaults to the one Bibliosoph ships. **It is the only source** -- set it to None and nothing can be drawn.

Ten cards ship, which is thin for a deck, so writing your own is expected. A card is a journal page with an editing sheet, the same way injuries work.

If a GM rewords a card, characters already holding one see the new wording when they play it.

## Things it deliberately does not do

- **A card can be drawn twice.** Draws are independent, and nothing tracks what has already come up. There is no discard pile and no shuffling.
- **A held card never expires.**
- **There is one deck.** Multiple decks -- boons, a Deck of Many Things, whatever your table invents -- is a wanted feature and not a built one.
