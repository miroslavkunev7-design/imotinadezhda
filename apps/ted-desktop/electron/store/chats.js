// Local chat history. Chats contain CRM personal data, so they live only in the encrypted
// store (name "chats"), kept separately for every signed-in profile on this Windows account.
const NAME = "chats";

export function createChats({ secureStore, userId }) {
  const all = () => {
    const saved = secureStore.read(NAME);
    return saved && saved.byUser && typeof saved.byUser === "object" ? saved.byUser : {};
  };

  function load() {
    const id = userId();
    const chats = id ? all()[id] : null;
    return { chats: Array.isArray(chats) ? chats : [] };
  }

  function save(chats) {
    const id = userId();
    if (!id) return { ok: false, error: "Не сте влезли в профила си." };
    if (!secureStore.available()) return { ok: false, error: "Шифрирането на Windows не е достъпно – чатовете не се пазят на този компютър." };
    secureStore.write(NAME, { v: 1, byUser: { ...all(), [id]: chats } });
    return { ok: true };
  }

  // Removes the chats of the signed-in profile only.
  function clear() {
    const id = userId();
    const byUser = all();
    if (id) delete byUser[id];
    if (Object.keys(byUser).length) secureStore.write(NAME, { v: 1, byUser });
    else secureStore.remove(NAME);
    return { ok: true };
  }

  return { load, save, clear };
}
