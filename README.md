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

Needs Claude Code **2.1.299 or newer**. Check with `claude --version`, and run
`claude update` if yours is older.

In Claude Code:

```
/plugin marketplace add Ashikur540/tadhkir-loop-claude-plugin
/plugin install tadhkir-loop@tadhkir-loop
```

## Settings

Open `/config` and look for Tadhkir Loop:

- **Show hadith**: the hadith under the spinner and the hadith of the day
  card. On by default.
- **Show meaning**: the meaning after each zikr or name. On by default.

For a cleaner look, turn off **Show tips** in `/config`. That hides Claude
Code's own tip line, which otherwise sits between the spinner and the hadith.

In a narrow window the plugin makes room on its own: the meaning is left out
when the line would wrap, and the hadith is hidden under 60 columns.

## What is inside

- 12 zikr, written in English letters, with their meaning
- The 99 names of Allah, with their meaning
- 27 hadith from Sahih al-Bukhari, each checked by hand against
  [sunnah.com](https://sunnah.com)

Every hadith shows its narrator and its number, so you can read it in full
on sunnah.com, for example `https://sunnah.com/bukhari:2446`.

## Safety

- No network requests. All content ships inside the plugin.
- Reads only its own content file. It never reads your project files.
- No telemetry. It collects nothing about you.
- No third-party code at runtime.

## Content sources and credits

- Hadith text: [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api).
  The English translation of Sahih al-Bukhari is by **Muhammad Muhsin Khan**.
- Hadith numbers and links: [sunnah.com](https://sunnah.com).
- The 99 names: [aladhan.com](https://aladhan.com/asma-al-husna-api), with
  spelling and meaning edited by hand.

## Suggest a hadith or report a mistake

Open an issue with the sunnah.com link of the hadith and what you would like
changed. Mistakes in religious text are taken seriously and fixed first.

## License

The code is under the [MIT License](LICENSE). The license covers the code
only, not the bundled hadith translations or other quoted text, which belong
to their translators and sources above.
