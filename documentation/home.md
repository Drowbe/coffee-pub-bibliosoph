# Coffee Pub Bibliosoph

**Audience:** everyone -- players, GMs, and anyone changing the module.

In-game player messaging with journal-backed conversations, plus authored injuries, criticals and fumbles, inspiration cards, searching a room, and quick encounter building, for D&D 5e on Foundry VTT.

Bibliosoph is part of the Coffee Pub suite and requires [Coffee Pub Blacksmith](https://github.com/Drowbe/coffee-pub-blacksmith), which supplies the shared services it builds on.

What sets it apart is that its content is authored rather than hardcoded. Injuries, criticals, fumbles and inspiration cards are journal pages with real mechanics in validated fields -- damage, a condition, roll penalties, a duration -- so applying one puts the numbers on the token instead of leaving the GM to adjudicate a line of prose. And because they are just journal pages, you can write your own.

This page routes. Each section points at the document that answers the question rather than answering it here.

## Playing with Bibliosoph

[Getting started](userguides/userguide-getting-started.md) covers the first five minutes: what appears on screen, what each toolbar button does, and who is allowed to press it -- sending a message, searching a room, applying a critical, treating an injury, playing an inspiration card, and building an encounter.

[Writing your own injuries](userguides/userguide-authoring-injuries.md) is for a GM who wants wounds written for their own table: what every field on the injury sheet means, and a prompt you can paste into an AI to draft one.

## Building against Bibliosoph

[The bursts API](api/api-bursts.md) is the module's public surface: four functions any macro can call to play a canvas burst over a token.

## Working on Bibliosoph itself

[The architecture map](architecture/architecture-bibliosoph.md) is the entry point -- module shape, boot, Blacksmith integration, the toolbar, settings, typed pages and sockets. Each subsystem then has its own document:

- [Injuries](architecture/architecture-injuries.md) -- the schema, authoring pipeline, triggers, application, ticks, expiry, unwind, and treatment rolls
- [Outcomes](architecture/architecture-outcomes.md) -- criticals and fumbles: one schema, two kinds
- [Inspiration](architecture/architecture-inspiration.md) -- cards as real inventory items
- [Investigation](architecture/architecture-investigation.md) -- searching a room, and what reaches the sheet
- [Encounters](architecture/architecture-encounters.md) -- Quick Encounter: cache, habitats, detection levels, deployment
- [Messages](architecture/architecture-messages.md) -- journal-backed conversations and the Messages window
- [Toasts](architecture/architecture-toasts.md) -- channels, roll toasts, social toasts, and the socket relay

## Known issues

Defects that are real and unfixed are in [known issues](known-issues.md).
