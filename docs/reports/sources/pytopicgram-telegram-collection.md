# pytopicgram: A library for data extraction and topic modeling from Telegram channels

- **URL:** https://www.sciencedirect.com/science/article/pii/S2352711025001086
- **Publisher / venue:** SoftwareX (Elsevier), 2025
- **Retrieved:** 2026-09-26
- **Cited in:** 2026-09-26-narrative-early-warning-prior-art.md §7; concept.md §8

## What it was cited for

A Python library that packages Telegram channel collection and downstream topic modelling into a defined pipeline. Its stated motivation is directly relevant to us: collection built ad hoc on Telethon and custom scripts works but is cumbersome and hard to reproduce precisely, whereas a pipeline with explicit parameters can be re-run, which the authors argue materially improves reproducibility and methodological rigour. The library is open source and presents itself as operating within Telegram's terms and applicable data-protection rules, on publicly accessible data.

Cited for the reproducibility argument, which is the same argument our collect component makes, and for the practical rate limits recorded alongside it in secondary guidance: roughly one to two seconds between message-history requests is stable, while participant listing returns about 200 entries per call and reliably triggers flood errors after twenty to thirty calls per hour on a large group. Those numbers should be re-verified against current API behaviour before they are designed around.
