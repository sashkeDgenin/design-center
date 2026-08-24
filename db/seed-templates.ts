import type { Language, Stage } from "./schema";

type Seed = { stage: Stage; language: Language; touchNumber: number; body: string };

/**
 * Starting templates only. They are rows, not constants: the Settings screen edits
 * them and the composer reads whatever is in the table. Every one of them aims at a
 * store visit rather than a sale over WhatsApp, and stays inside three sentences.
 *
 * {{name}}, {{interest}} and {{quoted_price}} all render. {{quoted_price}} is left
 * out of these defaults on purpose: most leads walk out before a price is quoted, and
 * an empty price mid-sentence reads worse than no mention of price at all.
 */
export const TEMPLATE_SEEDS: Seed[] = [
  // ---------- nudge ----------
  { stage: "nudge", language: "he", touchNumber: 1, body: "היי {{name}}, נעים היה להכיר היום 🙂 ה{{interest}} שהסתכלת עליו עדיין אצלנו. רוצה שאשמור לך אותו?" },
  { stage: "nudge", language: "he", touchNumber: 2, body: "היי {{name}}, רק מוודא שלא פספסתי אותך. יש לי עוד כמה אפשרויות ב{{interest}} שלא הספקנו לראות. שווה קפיצה קצרה לחנות?" },
  { stage: "nudge", language: "he", touchNumber: 3, body: "{{name}}, מה נשמע? אם העיתוי פשוט לא מתאים עכשיו זה בסדר גמור, רק תעדכן/י אותי ואחזור אלייך בהמשך." },
  { stage: "nudge", language: "he", touchNumber: 4, body: "היי {{name}}, אני סוגר את הפינה הזאת אצלי. ה{{interest}} עדיין רלוונטי, או שנשים בצד לעכשיו?" },

  { stage: "nudge", language: "ru", touchNumber: 1, body: "Привет, {{name}}! Приятно было познакомиться 🙂 {{interest}} всё ещё у нас. Отложить для вас?" },
  { stage: "nudge", language: "ru", touchNumber: 2, body: "{{name}}, здравствуйте! Появились ещё варианты по позиции «{{interest}}», которые мы не успели посмотреть. Заглянете на пару минут?" },
  { stage: "nudge", language: "ru", touchNumber: 3, body: "{{name}}, как дела? Если сейчас неподходящий момент, это совершенно нормально: скажите, и я вернусь позже." },
  { stage: "nudge", language: "ru", touchNumber: 4, body: "Здравствуйте, {{name}}. Закрываю этот вопрос у себя: {{interest}} ещё актуален, или отложим?" },

  { stage: "nudge", language: "en", touchNumber: 1, body: "Hi {{name}}, good to meet you today 🙂 The {{interest}} you looked at is still here. Want me to hold it for you?" },
  { stage: "nudge", language: "en", touchNumber: 2, body: "Hi {{name}}, just making sure I didn't miss you. I have a couple more options on the {{interest}} we didn't get to. Worth a quick visit?" },
  { stage: "nudge", language: "en", touchNumber: 3, body: "{{name}}, how's it going? If the timing isn't right just now that's completely fine, just say the word and I'll come back to you later." },
  { stage: "nudge", language: "en", touchNumber: 4, body: "Hi {{name}}, I'm closing this off on my end. Is the {{interest}} still on the table, or shall we park it for now?" },

  // ---------- awaiting_photos ----------
  { stage: "awaiting_photos", language: "he", touchNumber: 1, body: "היי {{name}}, תזכורת קטנה: אפשר תמונות של הספה הישנה? מספיק 2-3 תמונות מזוויות שונות ואני חוזר עם הערכה." },
  { stage: "awaiting_photos", language: "he", touchNumber: 2, body: "היי {{name}}, התמונות עוד לא הגיעו. ברגע שהן אצלי אני נותן לך מחיר טרייד-אין תוך יום." },
  { stage: "awaiting_photos", language: "he", touchNumber: 3, body: "{{name}}, הטרייד-אין עדיין רלוונטי? אם כן שלח/י תמונות ואטפל בזה מיד, ואם לא זה בסדר גמור, רק שאדע." },

  { stage: "awaiting_photos", language: "ru", touchNumber: 1, body: "{{name}}, напоминаю: пришлите, пожалуйста, фото старого дивана. Достаточно 2-3 снимков с разных сторон, и я вернусь с оценкой." },
  { stage: "awaiting_photos", language: "ru", touchNumber: 2, body: "{{name}}, фото пока не пришли. Как только они у меня будут, дам цену по трейд-ин в течение дня." },
  { stage: "awaiting_photos", language: "ru", touchNumber: 3, body: "{{name}}, трейд-ин ещё интересен? Если да, пришлите фото, займусь сразу. Если нет, просто дайте знать." },

  { stage: "awaiting_photos", language: "en", touchNumber: 1, body: "Hi {{name}}, small reminder: could you send photos of the old sofa? Two or three from different angles is plenty and I'll come back with a valuation." },
  { stage: "awaiting_photos", language: "en", touchNumber: 2, body: "Hi {{name}}, the photos haven't come through yet. Once I have them I'll get you a trade-in price within a day." },
  { stage: "awaiting_photos", language: "en", touchNumber: 3, body: "{{name}}, still interested in the trade-in? If so send the photos and I'll handle it right away. If not, no problem at all, just let me know." },

  // ---------- photos_in ----------
  { stage: "photos_in", language: "he", touchNumber: 1, body: "היי {{name}}, קיבלתי את התמונות, תודה! חוזר אלייך היום עם הערכה מדויקת." },
  { stage: "photos_in", language: "ru", touchNumber: 1, body: "{{name}}, фото получил, спасибо! Вернусь сегодня с точной оценкой." },
  { stage: "photos_in", language: "en", touchNumber: 1, body: "Hi {{name}}, got the photos, thank you! I'll come back to you today with an exact valuation." },

  // ---------- schedule_meeting ----------
  { stage: "schedule_meeting", language: "he", touchNumber: 1, body: "היי {{name}}, בוא/י נקבע זמן שתגיע/י לחנות ונראה את זה פיזית. מתי נוח לך השבוע?" },
  { stage: "schedule_meeting", language: "he", touchNumber: 2, body: "{{name}}, עדיין רוצה שנקבע? יש לי זמן פנוי השבוע, תגיד/י מה מתאים ואשמור לך." },
  { stage: "schedule_meeting", language: "ru", touchNumber: 1, body: "{{name}}, давайте назначим время, чтобы вы зашли в магазин и посмотрели вживую. Когда вам удобно на этой неделе?" },
  { stage: "schedule_meeting", language: "ru", touchNumber: 2, body: "{{name}}, всё ещё хотите договориться? На этой неделе есть свободное время: скажите, что подходит, и я придержу." },
  { stage: "schedule_meeting", language: "en", touchNumber: 1, body: "Hi {{name}}, let's set a time for you to come into the store and see it in person. What works for you this week?" },
  { stage: "schedule_meeting", language: "en", touchNumber: 2, body: "{{name}}, still want to lock in a time? I have space this week, tell me what suits and I'll hold it." },

  // ---------- get_back_later ----------
  { stage: "get_back_later", language: "he", touchNumber: 1, body: "היי {{name}}, עבר קצת זמן מאז שדיברנו על ה{{interest}}. העיתוי מסתדר יותר טוב עכשיו?" },
  { stage: "get_back_later", language: "ru", touchNumber: 1, body: "Здравствуйте, {{name}}! Прошло время с нашего разговора о позиции «{{interest}}». Сейчас момент более подходящий?" },
  { stage: "get_back_later", language: "en", touchNumber: 1, body: "Hi {{name}}, it's been a while since we talked about the {{interest}}. Is the timing better now?" },
];
