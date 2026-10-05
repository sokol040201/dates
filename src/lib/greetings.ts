import type { AppEvent, UpcomingEvent } from "../types";

function firstName(title: string): string {
  return title.trim().split(/\s+/)[0] || title.trim();
}

function yearsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "год";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "года";
  return "лет";
}

function isNameday(event: AppEvent): boolean {
  return !!event.external_id?.startsWith("name-") || event.title.startsWith("Именины:");
}

function namedayName(event: AppEvent): string {
  return event.title.replace(/^Именины:\s*/i, "").trim() || event.title;
}

/** Основной текст для кнопки «Скопировать» — как короткое сообщение */
export function buildGreeting(item: UpcomingEvent): string {
  return greetingTemplates(item.event, item.age)[0];
}

export function greetingTemplates(event: AppEvent, age: number | null): string[] {
  if (event.type === "birthday") {
    const name = firstName(event.title);
    if (age != null && age > 0) {
      return [
        `${name}, с днём рождения! Тебе сегодня ${age} ${yearsWord(age)} — обнимаю, пусть будет много поводов улыбаться.`,
        `С днюхой, ${name}! ${age} — красивая цифра. Здоровья, лёгкости и чтобы рядом были свои люди.`,
        `${name}, поздравляю! Пусть этот год будет спокойнее и добрее предыдущего. С ${age}-летием!`,
      ];
    }
    return [
      `${name}, с днём рождения! Пусть день пройдёт тепло, а год — без лишней суеты.`,
      `С днюхой, ${name}! Желаю здоровья, удачи и чтобы всё важное складывалось само.`,
      `${name}, поздравляю с днём рождения. Обнимаю — пусть рядом будут радость и хорошие новости.`,
    ];
  }

  if (isNameday(event)) {
    const name = namedayName(event);
    return [
      `${name}, с именинами! Пусть день будет добрым, а желания — исполнимыми.`,
      `С днём ангела, ${name}! Здоровья, спокойствия и тёплых встреч.`,
      `${name}, поздравляю с именинами — пусть всё складывается легко.`,
    ];
  }

  if (event.type === "holiday") {
    const title = event.title.trim();
    return [
      `С праздником — ${title}! Пусть день будет спокойным и приятным.`,
      `Поздравляю: сегодня ${title}. Хорошего настроения и тёплого вечера.`,
      `${title} — отличный повод выдохнуть и порадоваться. С праздником!`,
    ];
  }

  // свои события / годовщины
  const title = event.title.trim();
  if (age != null && age > 0) {
    return [
      `С годовщиной — ${title}! Уже ${age} ${yearsWord(age)}. Пусть дальше будет ещё теплее.`,
      `${title}: ${age} ${yearsWord(age)}. Поздравляю от всей души.`,
      `Поздравляю: ${title}, ${age} ${yearsWord(age)}. Пусть этот день запомнится только хорошим.`,
    ];
  }

  return [
    `Сегодня особенный день: ${title}. Поздравляю!`,
    `Напоминаю себе поздравить: ${title}. Пусть всё пройдёт хорошо.`,
    `${title} — поздравляю! Пусть день оставит только приятные впечатления.`,
  ];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
