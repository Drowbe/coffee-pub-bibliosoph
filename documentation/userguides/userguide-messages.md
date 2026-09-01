# Sending Messages

**Audience:** any player or GM using Bibliosoph's Messages window to talk at the table.

How to hold a conversation in Foundry: starting one, formatting a message, reacting to one, keeping the ones you care about to hand, and controlling how loudly the module tells you something arrived.

Conversations are kept in journals rather than in the chat log, so they survive a chat wipe and are still there next session.

## Open the window

Click **Messages** on the toolbar, or the Messages tool on the menubar. Either opens the full window: a tray of your conversations down one side, and the conversation you are reading beside it.

The tray shows three kinds of row. The party conversation, which everyone is in. Group conversations, which are private to the people in them. And one row per other player, for a one-to-one.

## Say something to the party

Pick the party conversation and type in the box at the bottom.

**ENTER sends. SHIFT+ENTER starts a new line.** In the full window there is a send button as well, and a toggle if you would rather ENTER made a new line instead.

## Start a private conversation

Click a player's row in the tray to talk to just them. Nothing is created until you send the first message, so opening a row to look at it costs nothing.

For more than one person, start a new conversation and choose the members. A group conversation is a private one with more than one recipient; you can give it a name and an icon so it is recognisable in the tray.

Privacy comes from Foundry's own document permissions -- someone who is not a member cannot read the conversation, whatever they do. The one exception is the GM, who can turn on **GM Sees All Conversations** to list every conversation including ones they are not in. Ask your table how they want that set before you rely on it.

## Write a better-looking message

Messages take markdown: `**bold**`, `*italic*`, `#` headings, `-` bullets, `>` quotes, and `---` for a horizontal rule.

You can also:

- **Paste or drop an image** straight into the box, and it uploads and appears inline.
- **Drop a document** -- an actor, item, journal or scene -- to post a link to it that anyone can click.
- **Mention someone** by typing their user or character name. Partial names match. The person you mention gets a highlighted name and an alert.
- **Pick a tone** from the tone bar, in the full window, if you want the message to carry one.

## React, reply, edit, delete

Right-click any message for its menu: reply to it, edit your own, delete your own, or send it to the Foundry chat log so the rest of the table sees it outside Bibliosoph.

**Reactions are in the full window only.** The popout has no reaction chips and no React entry in its menu.

While somebody is typing, everyone else in the conversation sees an indicator.

## Float a conversation over the map

Hover a conversation in the tray and click the popout icon. That conversation opens in a small window that floats over the canvas and follows your Light, Dark or Glass tool theme.

**Popouts stack.** One per conversation, each remembering its own position and theme, so you can watch the party channel and a private thread side by side while you play. Opening a conversation that already has a popout focuses it instead of making a second.

Nothing closes anything else: popping out leaves the full window open, and closing a popout closes only that popout.

A popout keeps everything you need to hold a conversation -- markdown, mentions, images, document drops, the right-click menu, the typing indicator -- and drops the tray, the member picker, the tone bar and reactions.

## Keep a conversation to hand

Click the star to favourite a conversation. In the popout the star is in the title bar; in the full window it is on the tray row.

**Right-click the Messages tool on the menubar** to get your favourites as a menu, and click one to open it as a popout without opening the full window first. Favourites follow you to another browser or machine.

## Know when something arrives

Three things can tell you about a message, and they do different jobs:

- **An on-screen alert**, carrying the sender's portrait. Click it to open the conversation. **Direct Message Alert** and **Group Message Alert** turn these on and off separately, and **Alerts Open the Popout** decides whether clicking one opens the popout or the full window.
- **A menubar notification**, per conversation, which stays until you read it.
- **An unread count** in the tray.

You only get an alert for a conversation you are not currently looking at. With **Auto Open Messages** on, the window opens by itself when a message arrives and nothing at all is open.

If you would rather have silence, mute the message sounds. That is your own setting and affects nobody else.

## Take a break

The Messages window header carries four buttons -- **Beverage Break**, **Bio Break**, **Insult** and **Praise**. Each rolls a table the GM configured and announces the result to everyone as an on-screen toast. Any player can press them.

If the GM sets one of those tables to None, its button does nothing.

## What the GM controls

- **Messages Enabled** switches the whole feature off, which also removes its toolbar button.
- **Message History Limit** caps how many messages are kept per conversation; older ones are trimmed as new ones arrive.
- **Excluded Users** leaves named users out of Messages entirely -- no one-to-one row, not selectable for a group, not added to the party conversation. This is only about Messages and does not hide anything else.
- **Hide Messages Journal Folder** keeps the conversations folder out of everyone's journal sidebar.

One thing worth knowing if your table uses a camera or streaming account: party and group alerts can be allowed through to it, but **direct message alerts never can**. A private message is not something the module will put on a shared screen.
