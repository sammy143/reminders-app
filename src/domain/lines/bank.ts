import type { Intensity, Tone } from '@/types';

/**
 * Nag's lines, per tone × intensity (docs/design/DESIGN.md "Voice (Nag)", docs/PLAN.md rules 3–7).
 *
 * Data only. Rules, enforced by bank.test.ts:
 * - every template contains `{cue}` exactly once (filled by `fillCue` in select.ts);
 * - at least 6 lines per cell; no line appears twice anywhere in the bank;
 * - mock the lateness and the situation (clock, bus, traffic, door, keys, the excuse),
 *   never identity, looks, intelligence, ability or any protected trait; no strong profanity.
 * - the cue may read "leave in 4 min", "leave now" or "11 min late", so every template must read
 *   well with any of them. Polite lines also get "starts in 20 min" / "starting now" (events that
 *   aren't in person; online or phone), so they say nothing about leaving, travel or the door.
 *   After `.`, `!` or `?` the cue is capitalised; after `:` it is not.
 *
 * Cells F003 can't reach today (mild × rude/savage/unhinged, spicy × unhinged, all supportive)
 * are filled anyway for F007's snooze and supportive transforms.
 */
export type LineBank = Record<Tone, Record<Intensity, readonly string[]>>;

export const BANK: LineBank = {
  polite: {
    mild: [
      'Gentle heads-up: {cue}.',
      'Friendly reminder from the calendar: {cue}.',
      'A quick word on timing: {cue}.',
      'A small note from the clock: {cue}.',
      'Status update from your calendar: {cue}.',
      'The clock would like a word: {cue}.',
    ],
    spicy: [
      'Hello. The appointment still exists: {cue}.',
      'Polite reminder regarding timing: {cue}.',
      'A reminder, delivered with manners: {cue}.',
      'Noting the time, as agreed: {cue}.',
      'Your calendar asked me to mention it: {cue}.',
      'Courtesy notice regarding the clock: {cue}.',
    ],
    savage: [
      'Reminder, served politely: {cue}.',
      'The calendar sends its regards: {cue}.',
      'Politely, regarding the schedule: {cue}.',
      'A calm note about your calendar: {cue}.',
      'Checking in on the schedule: {cue}.',
      'Hello. A word about the time: {cue}.',
    ],
  },
  firm: {
    mild: [
      'Time to get moving. {cue}.',
      'Shoes on, please. {cue}.',
      'Head for the door. {cue}.',
      "Wrap up what you're doing. {cue}.",
      'Keys, phone, wallet. {cue}.',
      'This is the one to act on. {cue}.',
    ],
    spicy: [
      "Stop what you're doing. {cue}.",
      'This is not a suggestion. {cue}.',
      'Put the phone down after reading this. {cue}.',
      "The appointment won't come to you. {cue}.",
      'Coat. Keys. Door. {cue}.',
      'Close the tab. Yes, that one. {cue}.',
    ],
    savage: [
      'Move. {cue}.',
      'Whatever that is, it can wait. {cue}.',
      "Doors don't open themselves. {cue}.",
      "No more 'one sec'. {cue}.",
      "Whatever you're doing, stop doing it. {cue}.",
      'Pockets. Keys. Door. {cue}.',
    ],
  },
  sarcastic: {
    mild: [
      "Bold strategy. Let's see how it plays out. {cue}.",
      'The clock and I have been talking. {cue}.',
      'Oh good, a snack break. {cue}.',
      'The couch will survive without you. {cue}.',
      'Great time to reorganise a drawer. Or not. {cue}.',
      'The bus is famously patient. It is not. {cue}.',
    ],
    spicy: [
      "Ah yes, the classic 'I'll just finish this'. {cue}.",
      'Maybe the appointment will wait. Doubtful. {cue}.',
      "Teleportation still isn't out. {cue}.",
      'Fascinating strategy. {cue}.',
      'Bold of you to trust the bus timetable. {cue}.',
      'The door has been waiting all day. {cue}.',
    ],
    savage: [
      'Wow, still home. Riveting. {cue}.',
      'Is the plan to arrive by wishing? {cue}.',
      "The bus doesn't care about your vibes. {cue}.",
      'Sure, check one more thing. What could go wrong. {cue}.',
      'Sure, the roads will be empty. Definitely. {cue}.',
      "Your keys called. They're bored. {cue}.",
    ],
  },
  rude: {
    mild: [
      'The clock has opinions about this. {cue}.',
      'Somebody over there is keeping score. {cue}.',
      'Coat on. Door open. Out. {cue}.',
      'Less scrolling, more door. {cue}.',
      "They're checking the time. So am I. {cue}.",
      'Door. Please. {cue}.',
    ],
    spicy: [
      'Go. {cue}.',
      'The clock is not negotiating. {cue}.',
      'Tick. Tock. {cue}.',
      "Their 'no worries' will be a lie. {cue}.",
      'Put the snack down. Pick up the keys. {cue}.',
      'Shoes. Coat. Go. {cue}.',
    ],
    savage: [
      'Out. {cue}.',
      "This isn't getting ready. This is stalling. {cue}.",
      "Stop negotiating with the clock. It's winning. {cue}.",
      "That 'on my way' text is currently fiction. {cue}.",
      "The exit hasn't moved all day. {cue}.",
      "Nobody believes 'almost there'. {cue}.",
    ],
  },
  savage: {
    mild: [
      'This is getting awkward for everyone. {cue}.',
      'The excuse is writing itself at this point. {cue}.',
      'Punctuality is packing its bags. {cue}.',
      'The appointment is wondering where you are. {cue}.',
      'The bus timetable does not do exceptions. {cue}.',
      'Your coat is still on the hook. {cue}.',
    ],
    spicy: [
      "The excuse you're drafting won't survive contact. {cue}.",
      'The bus has places to be. So do you. {cue}.',
      "Traffic isn't the reason. The couch is. {cue}.",
      'Your keys have seen enough. {cue}.',
      "'Stuck in traffic' only works if you're in traffic. {cue}.",
      'Someone is saving you a seat. Reluctantly. {cue}.',
    ],
    savage: [
      'The front door remains unopened. Bold. {cue}.',
      'The apology text is drafting itself. {cue}.',
      'Somewhere, a receptionist is sighing. {cue}.',
      'Traffic will get the blame. Traffic is innocent. {cue}.',
      'The clock has filed a formal complaint. {cue}.',
      "'Fashionably' is not doing the work here. {cue}.",
    ],
  },
  unhinged: {
    mild: [
      "I'm narrating this to the houseplants. {cue}.",
      'The kettle and I are worried. {cue}.',
      "I have alerted the pigeons. They're concerned. {cue}.",
      'The door is doing breathing exercises. {cue}.',
      'I built a small shrine to punctuality. {cue}.',
      'The calendar is quietly weeping. {cue}.',
    ],
    spicy: [
      'I have written a sad song about this door. {cue}.',
      'The bus driver will tell this story at dinner tonight. {cue}.',
      'Your keys are forming a union. {cue}.',
      'I am emotionally attached to the front door. {cue}.',
      'Somewhere a clock just fell off a wall in protest. {cue}.',
      "I've begun drafting your apology in iambic pentameter. {cue}.",
    ],
    savage: [
      'I AM A PHONE AND I AM SCREAMING. {cue}.',
      'The door and I have been through so much. Go through it. {cue}.',
      'I contacted the moon. Even the moon left on time. {cue}.',
      'Historians will study this moment. {cue}.',
      'Every clock in the house is ticking louder, out of spite. {cue}.',
      "I'm lying face-down on the carpet in protest. {cue}.",
    ],
  },
  supportive: {
    mild: [
      'No stress. Just so you know: {cue}.',
      'Stuck happens. A quick heads-up message helps. {cue}.',
      "You've got this. For reference: {cue}.",
      'Deep breath. One thing at a time. {cue}.',
      "This isn't a crisis. Letting them know helps. {cue}.",
      "Got it, you're stuck. I'll keep it gentle. {cue}.",
    ],
    spicy: [
      "Okay, stuck. Send a quick 'held up' text. {cue}.",
      'Fair enough. When it clears, remember: {cue}.',
      'Things happen. A new ETA beats silence. {cue}.',
      'No roast this time. Just the time. {cue}.',
      'Handle what is in front of you, then the door. {cue}.',
      'Heard. One step at a time. {cue}.',
    ],
    savage: [
      "Truce. Tell them you're on it. {cue}.",
      'Stuck is a valid excuse. Use it. {cue}.',
      'Ceasefire. The clock, for the record: {cue}.',
      "I'll back off. A quick message goes a long way. {cue}.",
      'Insults paused. Priorities: safe, then there. {cue}.',
      'Okay. Real problem, no jokes. {cue}.',
    ],
  },
};
