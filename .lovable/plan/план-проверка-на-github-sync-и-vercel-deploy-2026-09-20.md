# План: Проверка на GitHub sync и Vercel deploy

## Цел
След като потребителят свърже GitHub от телефона, да се потвърди, че текущият Lovable state е качен на `miroslavkunev7-design/imotinadezhda:main` и че `imnad.vercel.app` redeploy-ва production.

## Стъпки

1. **Чакам потвърждение „свързано“ от потребителя** — той трябва да натисне Connect в мобилния редактор.
2. **Проверка на GitHub `main` SHA** — чрез GitHub API connector да се вземе текущият `main` commit SHA и да се сравни с Lovable HEAD (`60cfb9d6...`). Очаква се SHA-то да е по-ново.
3. **Проверка на Vercel deploy** — да се потвърди, че Vercel проектът за `imnad.vercel.app` започва/завършва production deploy от новия `main` commit.
4. **Live проверка на сайта** — след deploy да се провери:
   - Google вход на `/login` води правилно към accounts.google.com (без 400).
   - Банковите лихви и калкулатор зареждат реални стойности.
   - Основните страници (начална, /search, /properties/*) работят.
5. **Доклад** — да се върне новото SHA на `main`, статуса на deploy и дали live сайтът съвпада с текущия build.

## Забележки

- Не се правят промени по код, домейн или DNS.
- Ако sync-ът не мине автоматично, следващата стъпка е да се разбере защо и да се помогне на потребителя да повтори connect-а.
- `.env` никога не се качва в GitHub — Lovable го изключва автоматично.
