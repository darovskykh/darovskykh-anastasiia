"""Inject a batch of (key, en, uk) tuples into all 6 locale files.

en/uk get real values. ar/es/pt/ru get EN as a placeholder — they'll be
machine/manually translated later. This keeps every locale file in sync
(no missing-key fallbacks during runtime).

Usage: edit BATCHES below, then `python3 scripts/add_locale_keys.py`.
"""
import json
import sys
from pathlib import Path

LOCALES_DIR = Path(__file__).resolve().parent.parent / "src" / "locales"
ALL_LOCALES = ["en", "uk", "ar", "es", "pt", "ru"]


def set_nested(d: dict, dotted_key: str, value: str) -> None:
    parts = dotted_key.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def get_nested(d: dict, dotted_key: str):
    cur = d
    for p in dotted_key.split("."):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def apply_batch(batch: list[tuple[str, str, str]]) -> dict:
    """Apply (key, en, uk) batch. Other locales get EN placeholder.
    Returns dict locale -> count_added/updated."""
    files = {loc: json.loads((LOCALES_DIR / f"{loc}.json").read_text()) for loc in ALL_LOCALES}
    stats = {loc: {"added": 0, "skipped_same": 0, "updated": 0} for loc in ALL_LOCALES}

    for key, en_val, uk_val in batch:
        for loc in ALL_LOCALES:
            new_val = en_val if loc not in ("en", "uk") else (en_val if loc == "en" else uk_val)
            existing = get_nested(files[loc], key)
            if existing is None:
                set_nested(files[loc], key, new_val)
                stats[loc]["added"] += 1
            elif existing == new_val:
                stats[loc]["skipped_same"] += 1
            else:
                set_nested(files[loc], key, new_val)
                stats[loc]["updated"] += 1

    for loc, data in files.items():
        (LOCALES_DIR / f"{loc}.json").write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        )

    return stats


# Each batch is a list of (dotted_key, en, uk).
BATCHES = {
    "small_components": [
        ("videoRecorder.confirmCloseWhileRecording", "Recording will stop when you close the browser. Are you sure?", "Запис зупиниться при закритті браузера. Ви впевнені?"),
    ],
    "case_editor_toast": [
        ("caseEditor.toast.uploadError", "Failed to upload image", "Не вдалося завантажити зображення"),
        ("caseEditor.toast.cropError", "Failed to crop image", "Не вдалося обрізати зображення"),
    ],
    "case_start": [
        ("caseStart.unknownError", "Unknown error", "Невідома помилка"),
        ("caseStart.activating", "Activating your invitation…", "Активуємо ваше запрошення…"),
        ("caseStart.title.expired", "Invitation expired", "Запрошення прострочене"),
        ("caseStart.title.invalid", "Invalid invitation", "Невірне запрошення"),
        ("caseStart.title.error", "Could not activate invitation", "Не вдалося активувати запрошення"),
        ("caseStart.description.expired", "This link has expired. Contact your administrator to get a new one.", "Термін дії цього посилання закінчився. Зверніться до адміністратора, щоб надіслав нове."),
        ("caseStart.description.invalid", "Link not found. It may be incorrect or already deleted.", "Посилання не знайдене. Можливо, воно неправильне або вже видалене."),
        ("caseStart.description.error", "A technical error occurred while activating the invitation. Please try again later or contact your administrator.", "Сталася технічна помилка при активації запрошення. Спробуйте пізніше або зверніться до адміністратора."),
        ("caseStart.goToLogin", "Go to login page", "На сторінку входу"),
    ],
    "assign_case_dialog_misc": [
        ("userProfile.assignCaseModal.previewName", "Name Surname", "Ім'я Прізвище"),
    ],
    "simulation_dividers": [
        ("simulation.divider.postVisit", "The visit took place, the conversation continues after the visit", "Візит відбувся, розмова продовжується після візиту"),
    ],
    "common_back": [
        ("common.back", "Back", "Назад"),
    ],
    "case_details_mock": [
        ("caseDetails.mock.case1.title", "Conflict management", "Управління конфліктами"),
        ("caseDetails.mock.case1.description", "Learn to resolve workplace conflicts effectively through interactive simulations with AI characters.", "Навчіться ефективно вирішувати конфлікти на робочому місці через інтерактивні симуляції з ШІ персонажами."),
        ("caseDetails.mock.case1.duration", "45 min", "45 хв"),
        ("caseDetails.mock.case1.difficulty", "Intermediate", "Intermediate"),
        ("caseDetails.mock.case1.participants", "1-2 participants", "1-2 учасники"),
        ("caseDetails.mock.case1.objective1", "Recognize signs of conflict at an early stage", "Розпізнавати ознаки конфлікту на ранній стадії"),
        ("caseDetails.mock.case1.objective2", "Apply active listening techniques", "Застосовувати техніки активного слухання"),
        ("caseDetails.mock.case1.objective3", "Find compromise solutions", "Знаходити компромісні рішення"),
        ("caseDetails.mock.case1.objective4", "Prevent conflict escalation", "Запобігати ескалації конфлікту"),
        ("caseDetails.mock.case1.instruction1", "Carefully read the conflict scenario", "Уважно прочитайте сценарій конфлікту"),
        ("caseDetails.mock.case1.instruction2", "Interact with the AI persona using a professional approach", "Взаємодійте з ШІ персоною, використовуючи професійний підхід"),
        ("caseDetails.mock.case1.instruction3", "Use various conflict resolution strategies", "Використовуйте різні стратегії вирішення конфлікту"),
        ("caseDetails.mock.case1.instruction4", "Stick to the time limit (45 minutes)", "Дотримуйтесь часових обмежень (45 хвилин)"),
        ("caseDetails.mock.case1.instruction5", "Forbidden to use aggressive language", "Заборонено використовувати агресивну мову"),
        ("caseDetails.mock.case1.instruction6", "Allowed to take pauses to think", "Дозволено робити паузи для обдумування"),
        ("caseDetails.mock.case1.personaName", "Anna Petrenko", "Анна Петренко"),
        ("caseDetails.mock.case1.personaRole", "Project Manager", "Менеджер проекту"),
        ("caseDetails.mock.case1.personaDescription", "Experienced manager with 8 years of IT industry experience", "Досвідчений менеджер з 8-річним стажем роботи в IT сфері"),
        ("caseDetails.mock.case2.title", "Leadership and motivation", "Лідерство та мотивація"),
        ("caseDetails.mock.case2.description", "Develop leadership skills and the ability to motivate a team in difficult situations.", "Розвивайте навички лідерства та вміння мотивувати команду в складних ситуаціях."),
        ("caseDetails.mock.case2.duration", "60 min", "60 хв"),
        ("caseDetails.mock.case2.difficulty", "Advanced", "Advanced"),
        ("caseDetails.mock.case2.participants", "1 participant", "1 учасник"),
        ("caseDetails.mock.case2.objective1", "Demonstrate leadership qualities", "Демонструвати лідерські якості"),
        ("caseDetails.mock.case2.objective2", "Motivate a demotivated team", "Мотивувати демотивовану команду"),
        ("caseDetails.mock.case2.objective3", "Create a recovery plan after setbacks", "Створювати план відновлення після невдач"),
        ("caseDetails.mock.case2.objective4", "Apply emotional intelligence", "Застосовувати емоційний інтелект"),
        ("caseDetails.mock.case2.instruction1", "Get acquainted with the team's situation after a failed release", "Ознайомтесь із ситуацією команди після невдалого релізу"),
        ("caseDetails.mock.case2.instruction2", "Hold a motivational conversation with a key employee", "Проведіть мотиваційну розмову з ключовим співробітником"),
        ("caseDetails.mock.case2.instruction3", "Suggest concrete steps to improve the situation", "Запропонуйте конкретні кроки для покращення ситуації"),
        ("caseDetails.mock.case2.instruction4", "Simulation duration: 60 minutes", "Тривалість симуляції: 60 хвилин"),
        ("caseDetails.mock.case2.instruction5", "Forbidden to blame or criticize", "Заборонено звинувачувати або критикувати"),
        ("caseDetails.mock.case2.instruction6", "Allowed to focus on positive solutions", "Дозволено фокусуватись на позитивних рішеннях"),
        ("caseDetails.mock.case2.personaName", "Oleksii Kovalenko", "Олексій Коваленко"),
        ("caseDetails.mock.case2.personaRole", "Senior Developer", "Старший розробник"),
        ("caseDetails.mock.case2.personaDescription", "Talented developer going through a confidence crisis after a failure", "Талановитий розробник, який переживає кризу впевненості після невдачі"),
    ],
    "case_details": [
        ("caseDetails.notFound.title", "Case not found", "Кейс не знайдено"),
        ("caseDetails.notFound.description", "The selected case is not available or does not exist.", "Вибраний кейс недоступний або не існує."),
        ("caseDetails.info.duration", "Duration", "Тривалість"),
        ("caseDetails.info.participants", "Participants", "Учасники"),
        ("caseDetails.info.level", "Level", "Рівень"),
        ("caseDetails.aiPersona.title", "AI Persona", "ШІ Персона"),
        ("caseDetails.objectives.title", "Learning objectives", "Цілі навчання"),
        ("caseDetails.instructions.title", "Instructions", "Інструкції для проходження"),
        ("caseDetails.instructions.allowed", "Allowed actions:", "Дозволені дії:"),
        ("caseDetails.instructions.forbidden", "Forbidden actions:", "Заборонені дії:"),
        ("caseDetails.equipment.title", "Equipment test", "Тест обладнання"),
        ("caseDetails.equipment.description", "Check your equipment before starting the simulation", "Перевірте ваше обладнання перед початком симуляції"),
        ("caseDetails.equipment.tabs.audio", "Audio test", "Тест звуку"),
        ("caseDetails.equipment.tabs.recording", "Voice recording", "Запис голосу"),
        ("caseDetails.equipment.tabs.video", "Video test", "Тест відео"),
        ("caseDetails.equipment.audio.title", "Audio playback test", "Тест відтворення звуку"),
        ("caseDetails.equipment.audio.description", "Press \"Start test\" to play a sample audio file", "Натисніть \"Розпочати тест\" щоб прослухати тестовий аудіофайл"),
        ("caseDetails.equipment.audio.playing", "Playing...", "Відтворення..."),
        ("caseDetails.equipment.audio.start", "Start test", "Розпочати тест"),
        ("caseDetails.equipment.audio.stop", "Finish test", "Закінчити тест"),
        ("caseDetails.equipment.audio.success", "✓ Test audio is playing", "✓ Відтворюється тестовий аудіо файл"),
        ("caseDetails.equipment.recording.title", "Voice recording test", "Тест запису голосу"),
        ("caseDetails.equipment.recording.description", "Record a test message and listen to the recording", "Записати тестове повідомлення та прослухати запис"),
        ("caseDetails.equipment.recording.stop", "Stop recording", "Зупинити запис"),
        ("caseDetails.equipment.recording.start", "Start recording", "Розпочати запис"),
        ("caseDetails.equipment.recording.play", "Play recording", "Відтворити запис"),
        ("caseDetails.equipment.recording.speakHint", "Say something for the test", "Скажіть щось для тесту"),
        ("caseDetails.equipment.recording.success", "✓ Recording saved successfully", "✓ Запис збережено успішно"),
        ("caseDetails.equipment.video.title", "Video test", "Тест відео"),
        ("caseDetails.equipment.video.description", "Watch a sample video to check playback quality", "Переглянути тестове відео для перевірки якості відтворення"),
        ("caseDetails.equipment.video.success", "✓ Test video is playing", "✓ Відтворюється тестове відео"),
        ("caseDetails.access.title", "Access restricted", "Доступ обмежено"),
        ("caseDetails.access.description", "You don't have access to this case or your access period has expired. Contact your administrator to get access.", "У вас немає доступу до цього кейсу або термін доступу закінчився. Зверніться до адміністратора для отримання доступу."),
        ("caseDetails.access.backToCases", "Back to cases", "Повернутися до кейсів"),
        ("caseDetails.actions.creatingChat", "Creating chat...", "Створення чату..."),
        ("caseDetails.actions.startSimulation", "Start simulation", "Почати симуляцію"),
        ("caseDetails.actions.starting", "Starting...", "Запуск..."),
        ("caseDetails.actions.startWithAgent", "Start with agent", "Запустити з агентом"),
        ("caseDetails.toast.startErrorDefault", "Failed to start simulation. Please try again.", "Не вдалося розпочати симуляцію. Спробуйте ще раз."),
        ("caseDetails.toast.errorTitle", "Error", "Помилка"),
        ("caseDetails.toast.forbiddenTitle", "Access denied", "Доступ заборонено"),
        ("caseDetails.toast.forbiddenNoCase", "You don't have access to this case. Contact your administrator to get access.", "У вас немає доступу до цього кейсу. Зверніться до адміністратора для отримання доступу."),
        ("caseDetails.toast.forbiddenGeneric", "You don't have permission to start the simulation. Contact your administrator.", "У вас недостатньо прав для запуску симуляції. Зверніться до адміністратора."),
        ("caseDetails.toast.notFoundTitle", "Case not found", "Кейс не знайдено"),
        ("caseDetails.toast.notFoundMessage", "This case is unavailable or does not exist. Try refreshing the page.", "Даний кейс недоступний або не існує. Спробуйте оновити сторінку."),
        ("caseDetails.toast.authTitle", "Authorization", "Авторизація"),
        ("caseDetails.toast.authMessage", "Your session has expired. Please sign in again.", "Сесія закінчилась. Будь ласка, увійдіть знову."),
        ("caseDetails.toast.agentInDevTitle", "Feature in development", "Функція в розробці"),
        ("caseDetails.toast.agentInDevFallback", "In development", "В розробці"),
        ("caseDetails.toast.agentStartedTitle", "Simulation started", "Симуляція запущена"),
        ("caseDetails.toast.agentStartedDescription", "Agent simulation started successfully", "Симуляція з агентом успішно розпочата"),
        ("caseDetails.toast.agentStartErrorDescription", "Failed to start simulation with agent", "Не вдалося запустити симуляцію з агентом"),
    ],
    "feedback_mgmt": [
        ("feedbackManagement.alt.screenshotPreview", "Screenshot preview", "Прев'ю скріншота"),
        ("feedbackManagement.alt.feedbackScreenshot", "Feedback screenshot", "Скріншот відгуку"),
        ("feedbackManagement.alt.screenshotFullView", "Screenshot full view", "Повний перегляд скріншота"),
    ],
    "cases_list": [
        ("cases.list.title", "Cases", "Кейси"),
        ("cases.list.subtitle", "Choose a case to start simulation", "Виберіть кейс для запуску симуляції"),
        ("cases.list.searchPlaceholder", "Search cases...", "Пошук кейсів..."),
        ("cases.list.refresh", "Refresh", "Оновити"),
        ("cases.list.errorLoading", "Error loading cases", "Помилка завантаження кейсів"),
        ("cases.list.failedToLoad", "Failed to load cases", "Не вдалося завантажити кейси"),
        ("cases.list.loading", "Loading cases...", "Завантаження кейсів..."),
        ("cases.list.noMatchingSearch", "No cases found matching your search.", "За вашим запитом кейсів не знайдено."),
        ("cases.list.noCases", "No cases available.", "Немає доступних кейсів."),
        ("cases.list.badgeAvailable", "Available", "Доступний"),
        ("cases.list.createdLabel", "Created", "Створено"),
        ("cases.list.startSimulation", "Start Simulation", "Розпочати симуляцію"),
        ("cases.list.accessDeniedTitle", "Access denied", "Доступ заборонено"),
        ("cases.list.accessDeniedBody", "You don't have access to this case. Contact your administrator.", "У вас немає доступу до цього кейсу. Зверніться до адміністратора."),
        ("cases.list.runErrorTitle", "Error", "Помилка"),
        ("cases.list.runErrorBody", "Failed to start simulation. Please try again.", "Не вдалося розпочати симуляцію. Спробуйте ще раз."),
    ],
}


def main() -> None:
    batch_name = sys.argv[1] if len(sys.argv) > 1 else None
    batches_to_run = [batch_name] if batch_name else list(BATCHES.keys())
    for name in batches_to_run:
        if name not in BATCHES:
            print(f"Unknown batch: {name}")
            continue
        print(f"\n=== Batch: {name} ({len(BATCHES[name])} keys) ===")
        stats = apply_batch(BATCHES[name])
        for loc, s in stats.items():
            print(f"  {loc}: +{s['added']} added, ~{s['updated']} updated, ={s['skipped_same']} same")


if __name__ == "__main__":
    main()
