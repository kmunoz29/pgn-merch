# PGN Merchandise Store

The first merchandise website for the Phi Gamma Nu chapter at James Madison University — an inventory and ordering system that replaced a manual, drop-based process for 100+ members.

## The Problem

Merchandise had been accumulating for several semesters with no record of what was actually in stock. As Merchandise Chairs, we didn't know our own inventory, and neither did the members we asked.

That created two problems at once. Unsold merchandise piled up because nobody knew it existed, and members who wanted something had to wait for a scheduled merch drop or for end-of-semester giveaways. Supply and demand were both there — there was just no way for them to find each other.

## What It Does

- **Shows live inventory.** Members can see what's currently in stock instead of guessing or waiting.
- **Takes orders directly.** Anyone in the chapter can order available items on their own schedule rather than waiting for a drop.
- **Collects item suggestions.** Members can request designs or products they'd actually buy, which gives the Merchandise Chairs real demand signal before committing to an order.

## How It Works

The front end is public to chapter members. Everything behind it — inventory counts, order records, and suggestions — writes to a private Google Sheet visible only to the Merchandise Chairs.

Keeping the data layer restricted matters for accuracy: order placements are verified against a single source of truth, so stock counts and fulfillment don't drift the way they did under the old manual process.

## Built With

- **Python** — core logic
- **Google Apps Script** — connects the site to the backing spreadsheet
- **Google Sheets** — inventory, order, and suggestion records
- **VS Code**

## Status

Live and in use by the chapter. Ongoing work is focused on routing all merchandise — including apparel produced through our vendor partnership — through the site, so future Merchandise Chairs inherit a working system instead of rebuilding the process each year.

## Authors

Built by:
Abrar Ahmed & Kennedy Munoz,
The Merchandise Chairs of Phi Gamma Nu at James Madison University.
