# Tadhkir Loop

A Claude Code plugin that turns waiting time into remembrance. While Claude
works, the spinner shows zikr and the 99 names of Allah with their meaning,
and a short authentic hadith sits under it.

## What you see

When you start Claude Code, a Bismillah line, and the hadith of the day just
above the prompt until you send your first message:

```
⏺ tadhkir-loop: Bismillah
  "A believer to another believer is like a building whose different parts
  enforce each other."
    ~ Abu Musa · Bukhari 2446                                          [-]
╭──────────────────────────────────────────────────────────────────────────╮
│ >                                                                        │
```

While Claude works, the word changes every 8 seconds, with a hadith for that
turn under it:

```
✻ SubhanAllah · Glory be to Allah… (12s · thinking)

    "Whoever prayed at night the whole month of Ramadan out of sincere Faith
    and hoping for a reward from Allah, then all his previous sins will be
    forgiven."
      ~ Abu Huraira · Bukhari 2009
```

When Claude is done:

```
✻ Alhamdulillah · 41s
```

## Install

It takes about a minute. You only need Claude Code. You do not need to
download or clone anything yourself.

### Step 1: Check your Claude Code version

Open your terminal and run:

```
claude --version
```

You need **2.1.310 or newer**. If yours is older, run `claude update` first.

### Step 2: Add this plugin's catalog

This tells Claude Code where to find the plugin (this GitHub repo). Run in
your terminal:

```
claude plugin marketplace add Ashikur540/tadhkir-loop-claude-plugin
```

### Step 3: Install the plugin

```
claude plugin install tadhkir-loop@tadhkir-loop
```

The first `tadhkir-loop` is the plugin, the one after `@` is the catalog
from Step 2. If it says "2 userConfig options not yet set", that is fine:
both switches are on by default, and you can change them later in `/config`.

### Step 4: Start Claude Code again

Close any Claude Code that is open, then start it again with `claude`. You
should see a **Bismillah** line, and a hadith just above the prompt. Send
any message and watch the spinner.

### Prefer to do it inside Claude Code?

Steps 2 and 3 also work as slash commands inside a running Claude Code:

```
/plugin marketplace add Ashikur540/tadhkir-loop-claude-plugin
/plugin install tadhkir-loop@tadhkir-loop
```

Then restart Claude Code, as in Step 4.

### Update to a new version

```
claude plugin marketplace update tadhkir-loop
claude plugin update tadhkir-loop@tadhkir-loop
```

Restart Claude Code to use the new version.

### Remove it

```
claude plugin uninstall tadhkir-loop@tadhkir-loop
claude plugin marketplace remove tadhkir-loop
```

### Not working?

- **Nothing changed after installing:** restart Claude Code. A plugin loads
  when Claude Code starts.
- **Still nothing:** run `claude --version` and make sure it is 2.1.310 or
  newer, then run `claude plugin list` and check that `tadhkir-loop` is there
  and enabled.
- **You use the Desktop app or VS Code:** zikr, the hadith and the
  Alhamdulillah line show only in the terminal for now. In the Desktop app
  you will see just the Bismillah line. Plugins do not load in WSL sessions
  of the Desktop app; Claude Code run in a WSL terminal works as normal.
- Still stuck? Open an issue on this repo with your `claude --version` and
  your operating system.

## Settings

Open `/config` and look for Tadhkir Loop:

- **Show hadith**: the hadith under the spinner and the hadith of the day
  card. On by default.
- **Show meaning**: the meaning after each zikr or name. On by default.

For a cleaner look, turn off **Show tips** in `/config`. That hides Claude
Code's own tip line, which otherwise sits between the spinner and the hadith.

In a narrow window the plugin makes room on its own: the meaning is left out
when the line would wrap, and the hadith under the spinner is hidden when the
window is narrower than 60 columns.

## What is inside

- 12 zikr, written in English letters, with their meaning
- The 99 names of Allah, with their meaning
- 26 hadith from Sahih al-Bukhari, each checked by hand against
  [sunnah.com](https://sunnah.com)

Every hadith shows its narrator and its number, so you can read it in full
on sunnah.com, for example `https://sunnah.com/bukhari:2446`.

## Safety

- No network requests. All content ships inside the plugin.
- Reads only its own content file. It never reads your project files.
- No telemetry. It collects nothing about you.
- No third-party code at runtime.

Claude Code plugins can run code on your machine, so only install ones you
trust. You can check what this one does yourself: after Step 2, run
`claude plugin validate ~/.claude/plugins/marketplaces/tadhkir-loop`. Its
`calls:` line lists only `$.clock` (timing) and `$.ui` (drawing) calls, no file,
shell or network access.

## Content sources and credits

- Hadith text: [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api).
  The English translation of Sahih al-Bukhari is by **Muhammad Muhsin Khan**.
- Hadith numbers and links: [sunnah.com](https://sunnah.com).
- The 99 names: [aladhan.com](https://aladhan.com/asma-al-husna-api), with
  spelling and meaning edited by hand.

## Suggest a hadith or report a mistake

Open an issue with the sunnah.com link of the hadith and what you would like
changed. Mistakes in religious text are taken seriously and fixed first.

## Like it?

If Tadhkir Loop helps you, please give the repo a star. It helps other
Muslim developers find it.

## License

The code is under the [MIT License](LICENSE). The license covers the code
only, not the bundled hadith translations or other quoted text, which belong
to their translators and sources above.
