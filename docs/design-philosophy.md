# Nightingale — Design Philosophy

**A small, approachable companion for the next step—not another system to learn.**

[English indoor demo](https://nightingale-indoor.web.app/?lang=en) · [Source code](https://github.com/Crystal32378/Nightingale)

## Care includes the everyday experience

In an ageing society, advances in medical technology can help treat illness. The experience around that care matters too: finding the next place, understanding what to do, and feeling able to ask again.

Nightingale explores a modest role for a personal agent. Rather than trying to replace the people who provide care, it asks whether small changes to everyday interactions could make a hospital visit feel easier to approach. The goal is not to display technological sophistication. It is to help someone take the next step without first having to learn a complicated system.

## One thing to attend to at a time

The guiding principle is simple: **one screen, one primary thing to understand or do.** A person should not have to sort through a dashboard, remember a long sequence, or decide which of several competing instructions matters now.

Nightingale therefore prioritizes the next step rather than presenting the whole journey at once. The main instruction should be short and prominent. Supporting information should remain secondary, and uncertainty should be stated plainly instead of being hidden behind confident-looking directions.

This is a design principle, not a literal claim that every current screen contains only one item. The prototype still includes supporting location and destination information, help, and settings alongside its main task.

## Large text and generous controls

The important words and actions should be easy to find. Large primary text and large buttons are deliberate choices, not decoration: the interface should ask for as little visual searching and precise tapping as possible.

The current indoor interface implements enlarged primary instructions and generous main buttons. This does not mean every label or note is equally large, or that accessibility has been established for all users and devices. Legibility, reach, comprehension, and error recovery still need evaluation with the people the product is intended to support.

## Speaking should be an alternative to typing

The design intention is that someone can speak rather than struggle with a keyboard. A voice interaction should remain understandable and controllable, with a way to review what was heard and use text when preferred.

There is an important implementation distinction: the separate **outdoor flow** supports recording a short utterance, turning it into a text draft, and letting the person review or edit it before sending. The current **indoor destination demo** still uses typed input. Its spoken help is audio output, not speech recognition. Voice-first indoor input remains a direction for future work, not a delivered feature of this demo.

## An approachable bird, not a high-tech machine

The simplified pixel-art bird is intended to feel familiar and approachable rather than sophisticated, intimidating, or clinical. It gives the interaction a recognizable companion without asking the person to understand what an AI system is doing behind the screen.

The bird is not a substitute for clear information. It should support the next instruction, stay present when the system is unsure, and never make uncertainty look like certainty.

## A voice that feels close, with a choice

Nightingale offers male and female help voices. The intended character is youthful and friendly—more like a younger person offering help than a distant, authoritative machine. The aim is to avoid creating a sense of distance or an intimidating “high-tech” experience for older adults.

That tone is a design intention, not an assumption that every older person prefers the same voice. Offering a choice matters. Whether the voices actually feel approachable, clear, and comfortable should be evaluated with users rather than inferred from the voice labels.

## A place where it is okay to ask again

Repeated questions are part of the experience Nightingale is designed to support, not a behavior to discourage. The hope is that a person can ask again without embarrassment or worry about taking up someone else's time.

**Nightingale is intended to complement volunteers and hospital staff, not replace them.** Its help card supports asking another person for assistance. The current demo does not summon a volunteer, connect the person to staff, or provide staffed support.

## Possible extensions beyond wayfinding

Future versions could explore helping a person arrange their next appointment, record medication times and schedule reminders, and keep nurse-provided instructions available after the visit. **These are unimplemented concepts, not capabilities of the current demo.**

The person would need to review and confirm appointment details, medication schedules, and any recorded or transcribed instructions before they are saved or acted on. Medication information must come from the person's prescribed regimen and healthcare team; Nightingale must not invent or change prescriptions, doses, or clinical instructions. Unclear or conflicting information should be taken back to the nurse, pharmacist, or other responsible clinician rather than resolved by an AI guess.

These extensions would also require explicit design for consent, privacy, access, retention, and correction of health information. Reminder reliability—including missed notifications, offline operation, and an appropriate fallback—would need to be designed and evaluated. A reminder must not be presented as a guarantee that medication will be taken or that follow-up care will occur. None of these ideas establishes clinical readiness.

## What remains to be learned

These choices express an intended experience. They do not establish that Nightingale reduces anxiety, is easy for every older adult to use, or improves clinical outcomes. Evaluation should ask whether people understand the next step, can use and recover from the controls, feel comfortable with the bird and voices, and know when to seek human help.

The prototype uses simulated indoor navigation and is not a production hospital-navigation service. Its design should be judged by how well it supports people—not by how advanced the technology appears.

### Implementation references

- [Indoor screen and controls](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/App.tsx) · [Typography and touch-target styling](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/styles.css)
- [Bird presentation](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/NightingaleBird.tsx) · [Help voice playback](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/speech.ts)
- [Outdoor voice input and review](https://github.com/Crystal32378/Nightingale/blob/main/src/remote/VoiceInput.tsx) · [Indoor/outdoor entry-point separation](https://github.com/Crystal32378/Nightingale/blob/main/src/main.tsx)
