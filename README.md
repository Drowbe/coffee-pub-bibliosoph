# Coffee Pub Bibliosoph

![Foundry v13](https://img.shields.io/badge/foundry-v13-green)
![Latest Release](https://img.shields.io/github/v/release/Drowbe/coffee-pub-bibliosoph)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/Drowbe/coffee-pub-bibliosoph/release.yml)
![GitHub all releases](https://img.shields.io/github/downloads/Drowbe/coffee-pub-bibliosoph/total)
![MIT License](https://img.shields.io/badge/license-MIT-blue)

Your players talk to each other in character, and the dice leave marks. Bibliosoph adds journal-backed messaging to your table, and turns critical hits, fumbles and lasting injuries into authored cards that apply real mechanics instead of prose somebody has to adjudicate.

## What it does

- **Messages.** A conversation window with party, group and private threads, kept in journals so they survive a chat wipe. Mentions, reactions, markdown, images, typing indicators, and floating popouts you can watch side by side.
- **Injuries that linger.** A hard hit leaves a wound that takes hit points, applies a condition, imposes real roll penalties, and may bleed each turn until somebody treats it with a Medicine check.
- **Criticals and fumbles with teeth.** Drawn from decks of authored cards rather than roll tables, so each one carries its own damage, condition, penalties and duration, and the Apply button does what the text describes.
- **Inspiration you can hold.** Cards are dealt into a character's inventory as real one-use items, so a player can sit on one for six sessions and cash it in at the right moment.
- **Search a room.** One click rolls for coins and for items across five rarity tables, adds what turned up to the character sheet, and posts a narrated card.
- **Build a fight at the table.** Pick a habitat and a difficulty, get a monster list scored against the party, roll for who noticed whom, and deploy straight to the canvas.
- **Write your own content.** Injuries, criticals, fumbles and inspiration cards are journal pages with an editing sheet. Nothing about them is hardcoded, so your table's wounds can be yours.

## Requirements

- Foundry VTT v13 or newer
- The D&D 5e system, 5.5 or newer
- **[Coffee Pub Blacksmith](https://github.com/Drowbe/coffee-pub-blacksmith) 13.17.0 or newer.** Bibliosoph will not run without it.

Nothing else in the suite is required.

## Install

Paste this manifest URL into Foundry's **Install Module** dialog:

```
https://github.com/Drowbe/coffee-pub-bibliosoph/releases/latest/download/module.json
```

## Where to read more

Everything is on [the wiki](https://github.com/Drowbe/coffee-pub-bibliosoph/wiki).

- [Getting started](https://github.com/Drowbe/coffee-pub-bibliosoph/wiki/userguide-getting-started) -- the first five minutes: what each toolbar button does and who may press it
- [Writing your own injuries](https://github.com/Drowbe/coffee-pub-bibliosoph/wiki/userguide-authoring-injuries) -- every field on the injury sheet, and a prompt for drafting one
- [The bursts API](https://github.com/Drowbe/coffee-pub-bibliosoph/wiki/api-bursts) -- for macro authors
- [Architecture](https://github.com/Drowbe/coffee-pub-bibliosoph/wiki/architecture-bibliosoph) -- for anyone changing the module
- [Known issues](https://github.com/Drowbe/coffee-pub-bibliosoph/wiki/known-issues)

## The Coffee Pub Suite

Bibliosoph is one module in a larger suite. Blacksmith is the core every other module builds on and the only one Bibliosoph requires; the rest stand alone, and you can run any combination of them.

| Module | What it does |
|---|---|
| [Blacksmith](https://github.com/Drowbe/coffee-pub-blacksmith) | **Required.** The core: quality of life, gameplay frameworks, automation, and the shared APIs the suite is built on |
| [Artificer](https://github.com/Drowbe/coffee-pub-artificer) | A crafting, recipe, and blueprint system |
| **Bibliosoph** | Player messaging, injuries, encounters, and inspiration (this module) |
| [Cartographer](https://github.com/Drowbe/coffee-pub-cartographer) | Party strategic planning and sketching |
| [Crier](https://github.com/Drowbe/coffee-pub-crier) | Combat turn announcements: turn cards, round announcements, and combat status |
| [Curator](https://github.com/Drowbe/coffee-pub-curator) | Image management: token and portrait replacement, and tile or map placement |
| [Herald](https://github.com/Drowbe/coffee-pub-herald) | Streaming and broadcast view, with a cameraman user and automatic token following |
| [Librarian](https://github.com/Drowbe/coffee-pub-librarian) | Campaign knowledge: a codex of people, places, factions and artifacts, and the quests running through them |
| [Minstrel](https://github.com/Drowbe/coffee-pub-minstrel) | Music, environment, and one-shot management |
| [Monarch](https://github.com/Drowbe/coffee-pub-monarch) | Save and load sets of enabled modules |
| [Regent](https://github.com/Drowbe/coffee-pub-regent) | Optional AI tools: Consult the Regent, plus lookup, character, assistant, encounter and narrative worksheets |
| [Scribe](https://github.com/Drowbe/coffee-pub-scribe) | Enhanced journal and chat card formatting for snippets of narrative |
| [Squire](https://github.com/Drowbe/coffee-pub-squire) | A customizable character tray, with party tools and item transfer |
| [Vault](https://github.com/Drowbe/coffee-pub-vault) | Optional assets for the suite |

<!-- global:ai-assistance -->
## AI Assistance and the Illusion of Good Code

I started writing Foundry modules for use at my own table back in 2020. There were already a ton of amazing modules out there, but they either didn't quite do what I wanted or didn't deliver the kind of user experience I was looking for.

I've been a design leader for more than 20 years, but I spent the first half of my career as a developer, so building my own modules seemed like a fun way to kill some time. I'm a pretty good designer. I'm a decent developer. But, over time, my hand-written code and hacks got a little messy (and memory-leaky, and a little buggy. Feels good to say it out loud.).

Today, the Coffee Pub suite of modules is developed with AI assistance, primarily Claude and Cursor, for documentation, refactoring, debugging, and other development work. Every change is reviewed and committed by me, and nothing reaches a release that I haven't crawled and run at my own table. I can't seem to give up my IDE. The UX design, architecture, and ideas still come from my own fever dreams and chronic lack of sleep.

Testing and verifying a change means running it in Foundry so I can watch the console, break things, fix them, and hone the experience. The repositories carry a set of tools for testing the things that are difficult to catch through review and manual testing alone. They help ensure styles don't conflict, shared coding and documentation standards stay consistent, and the suite of modules continues to work well as a system without silently breaking.

Those checks are there because AI-assisted development can move very quickly, and without oversight, engagement, and planning, it can also go confidently off the rails and deliver the illusion of good code. The AI helps me build faster. It doesn't decide what gets built, its architecture, or how it should work. You can blame this human for that.

If the idea of AI-assisted development keeps you up at night or just isn't your jam, no worries at all. I get it. You do you.
<!-- /global:ai-assistance -->

## License and credits

Licensed under the [MIT License](LICENSE). Built by Coffee Pub. Issues and enhancement requests are welcome.
