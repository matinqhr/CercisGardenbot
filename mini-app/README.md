# Cercis Mini App

## V1 — Quiz + XP

The first playable version focuses only on the learning loop:

**Loading → 5-question round → answer → feedback → XP → next round**

### Included
- Random 5-question rounds from the local question bank
- Exactly 3 options per question
- Single-answer and multi-answer questions
- Selection before submission
- Correct-answer feedback
- XP awarded only for fully correct answers
- XP persisted in the browser with localStorage
- Total XP shown during the round and at round completion
- New Round button

### Intentionally postponed
- Garden / world
- House repair and building
- XP shop
- Object placement
- D1 question storage
- Admin question editor
- Dossier integration
- Player/account synchronization
- Production sound and pixel-art feedback

The current question bank is sample content used to validate the game system. The question model is designed so correct answers and XP can later come from D1/admin data without changing the quiz interaction model.
