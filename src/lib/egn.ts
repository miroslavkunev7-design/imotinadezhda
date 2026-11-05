/** Проверка на българско ЕГН по официалния алгоритъм (тегла 2,4,8,5,10,9,7,3,6). */

const WEIGHTS = [2, 4, 8, 5, 10, 9, 7, 3, 6];

export type EgnParse = {
  egn: string;
  valid: boolean;
  birthDate: string | null;
  sex: "м" | "ж" | null;
  ageYears: number | null;
};

export function normalizeEgn(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 10);
}

export function parseEgn(raw: string | null | undefined): EgnParse {
  const egn = normalizeEgn(raw);
  if (!/^\d{10}$/.test(egn)) {
    return { egn, valid: false, birthDate: null, sex: null, ageYears: null };
  }
  const digits = egn.split("").map(Number);
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * digits[i], 0);
  let check = sum % 11;
  if (check === 10) check = 0;
  if (check !== digits[9]) {
    return { egn, valid: false, birthDate: null, sex: null, ageYears: null };
  }

  let year = 1900 + Number(egn.slice(0, 2));
  let month = Number(egn.slice(2, 4));
  const day = Number(egn.slice(4, 6));
  if (month > 40) {
    year = 2000 + Number(egn.slice(0, 2));
    month -= 40;
  } else if (month > 20) {
    year = 1800 + Number(egn.slice(0, 2));
    month -= 20;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return { egn, valid: false, birthDate: null, sex: null, ageYears: null };
  }
  const birthDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const sex = digits[8] % 2 === 0 ? "ж" : "м";
  const now = new Date();
  let ageYears = now.getFullYear() - year;
  const hadBirthday =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthday) ageYears -= 1;
  return { egn, valid: true, birthDate, sex, ageYears };
}
